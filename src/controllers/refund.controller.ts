import { Request, Response } from 'express';
import { ValidationError } from 'yup';
import {
	apiResponse,
	AvailableTaxTypes,
	AWS_S3_BUCKET_KEYS,
	DEFAULT_IMG_URL,
} from '../utils/constant';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import refundService from '../services/refund.service';
import invoiceService from '../services/invoice.service';
import giftcardService from '../services/giftcard.service';
import { stripe } from '../utils/stripe.helper';
import {
	InvoiceMode,
	InvoiceOrderStatus,
	PaymentTypes,
} from '../types/invoices';
import mongoose, { ClientSession, Types } from 'mongoose';
import shopService from '../services/shop.service';
import taxTypeService from '../services/tax_type.service';
import {
	calculateInclusiveTax,
	formatDateInGermanFormat,
	formatGiftCardCode,
	getNumberInLocalFormat,
	getPagination,
	truncateToDecimals,
	uploadFileToS3,
} from '../utils/helper';
import {
	IRefundInvoiceMail,
	IRefundInvoiceStudioMail,
	RefundInvoiceInput,
} from '../types/refunds_invoices';
import { GiftCardStatus } from '../types/giftcards';
import { UserRoles } from '../types/users';
import userService from '../services/user.service';
import userSettingService from '../services/user_settings.service';

const getGiftCardsForRefund = async (req: Request, res: Response) => {
	try {
		const { invoice_id } = req.params;

		const isValidId = Types.ObjectId.isValid(invoice_id);
		if (!isValidId) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_CUSTOMER_INVOICE_ID.message,
				apiResponse.INVALID_CUSTOMER_INVOICE_ID.code
			);
		}

		const [invoiceData] = await invoiceService.findInvoices({
			_id: invoice_id,
		});
		if (!invoiceData) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_NOT_FOUND.message,
				apiResponse.INVOICE_NOT_FOUND.code
			);
		}

		const giftCards = await refundService.getGiftCardsForRefund(
			invoiceData._id
		);
		if (!giftCards.length) {
			return sendErrorResponse(
				res,
				apiResponse.ELIGIBLE_GIFTCARD_REFUND_NOT_FOUND.message,
				apiResponse.ELIGIBLE_GIFTCARD_REFUND_NOT_FOUND.code
			);
		}

		const responseData = {
			giftcards: giftCards,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.ELIGIBLE_GIFTCARD_REFUND_FETCHED_SUCCESSFULLY.message,
			apiResponse.ELIGIBLE_GIFTCARD_REFUND_FETCHED_SUCCESSFULLY.code
		);
	} catch (error) {
		return sendErrorResponse(
			res,
			apiResponse.INTERNAL_SERVER_ERROR.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getPdfDataForRefundInvoice = async (req: Request, res: Response) => {
	try {
		const { customer_invoice_id } = req.params;

		const isValidId = Types.ObjectId.isValid(customer_invoice_id);
		if (!isValidId) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_CUSTOMER_INVOICE_ID.message,
				apiResponse.INVALID_CUSTOMER_INVOICE_ID.code
			);
		}

		const { refund_giftcards } =
			await refundService.validateInvoicePdfDataSchema(req.body);

		const [invoiceData] = await invoiceService.findInvoices({
			_id: customer_invoice_id,
		});
		if (!invoiceData) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_NOT_FOUND.message,
				apiResponse.INVOICE_NOT_FOUND.code
			);
		}
		if (invoiceData.invoice_mode === InvoiceMode.DEMO) {
			return sendErrorResponse(
				res,
				apiResponse.DEMO_INVOICE_REFUND_NOT_ALLOWED.message,
				apiResponse.DEMO_INVOICE_REFUND_NOT_ALLOWED.code
			);
		}

		if (!invoiceData.payment_id) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_PAYMENT_ID_NOT_EXISTS.message,
				apiResponse.INVOICE_PAYMENT_ID_NOT_EXISTS.code
			);
		}

		const [shopData] = await shopService.findShops({
			_id: invoiceData.shop,
		});
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		const [taxTypeData] = await taxTypeService.findTaxTypes({
			_id: invoiceData.tax_type,
		});

		const giftCards = await refundService.getGiftCardsForRefundInvoice(
			refund_giftcards,
			null
		);
		if (!giftCards.length) {
			return sendErrorResponse(
				res,
				apiResponse.ELIGIBLE_GIFTCARD_REFUND_NOT_FOUND.message,
				apiResponse.ELIGIBLE_GIFTCARD_REFUND_NOT_FOUND.code
			);
		}

		for (let giftCard of giftCards) {
			if (!giftCard.invoice.equals(invoiceData._id)) {
				return sendErrorResponse(
					res,
					apiResponse.ONE_OF_GIFTCARD_NOT_BELONG_TO_INVOICE_REFUND.message,
					apiResponse.ONE_OF_GIFTCARD_NOT_BELONG_TO_INVOICE_REFUND.code
				);
			}
		}

		const { invoiceNumber } = await refundService.generateInvoiceNumber(
			invoiceData.invoice_number,
			invoiceData._id,
			null
		);

		let totalRefundAmount = 0;
		const invoiceItems = giftCards.map((giftCard) => {
			const tax = '19%';
			totalRefundAmount += giftCard.available_amount;
			return {
				description: `Gutschein - ${giftCard.giftcard_template.template_name}`,
				quantity: 1,
				unit_price: getNumberInLocalFormat(giftCard.available_amount) + ' €',
				tax: tax,
				total_price: getNumberInLocalFormat(giftCard.available_amount) + ' €',
			};
		});
		const showTax = taxTypeData?.title === AvailableTaxTypes.STANDARD;
		const { netAmount, taxAmount } = calculateInclusiveTax(
			totalRefundAmount,
			19
		);

		const responseData = {
			invoice_number: invoiceNumber,
			customer_invoice: invoiceData.invoice_number,
			date: formatDateInGermanFormat(new Date().toISOString()),
			seller: {
				_id: shopData._id,
				official_name: shopData.official_name,
				shop_name: shopData.studio_name,
				address: shopData.street,
				city: shopData.city,
				country: shopData.country?.name,
				phone: shopData.phone,
				email: shopData.owner,
				logo_url: shopData.logo_url,
			},
			buyer: {
				name: invoiceData.fullname,
				address1: invoiceData.address?.line1,
				address2: invoiceData.address?.line2,
				country: invoiceData.address?.country,
				city: invoiceData.address?.city,
				postal_code: invoiceData.address?.postal_code,
				email: invoiceData.email,
			},
			items: invoiceItems,
			show_tax: showTax,
			total_amount: getNumberInLocalFormat(totalRefundAmount) + ' €',
			net_amount: getNumberInLocalFormat(netAmount) + ' €',
			tax_amount: getNumberInLocalFormat(taxAmount) + ' €',
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.REFUND_INVOICE_PDF_DATA_RETRIEVED_SUCCESSFULLY.message,
			apiResponse.REFUND_INVOICE_PDF_DATA_RETRIEVED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const createRefundInvoice = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { invoice_id, refund_giftcards, refund_reason } =
			await refundService.validateCreateRefund(req.body);

		const file = req.file;

		if (!file) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_FILE_REQUIRED.message,
				apiResponse.INVOICE_FILE_REQUIRED.code
			);
		}

		session = await mongoose.startSession();
		session.startTransaction();

		const [invoiceData] = await invoiceService.findInvoices(
			{
				_id: invoice_id,
			},
			session
		);
		if (!invoiceData) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_NOT_FOUND.message,
				apiResponse.INVOICE_NOT_FOUND.code,
				session
			);
		}

		if (invoiceData.invoice_mode === InvoiceMode.DEMO) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_CUSTOMER_INVOICE_ID.message,
				apiResponse.INVALID_CUSTOMER_INVOICE_ID.code,
				session
			);
		}

		if (!invoiceData.payment_id) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_PAYMENT_ID_NOT_EXISTS.message,
				apiResponse.INVOICE_PAYMENT_ID_NOT_EXISTS.code,
				session
			);
		}

		const [shopData] = await shopService.findShops(
			{
				_id: invoiceData.shop,
			},
			session
		);
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code,
				session
			);
		}

		const [shopUserSettings] = await userSettingService.find(
			{
				shop: shopData._id,
			},
			session
		);
		if (!shopUserSettings) {
			return sendErrorResponse(
				res,
				apiResponse.USER_SETTINGS_NOT_FOUND.message,
				apiResponse.USER_SETTINGS_NOT_FOUND.code,
				session
			);
		}

		const [taxTypeData] = await taxTypeService.findTaxTypes(
			{
				_id: invoiceData.tax_type,
			},
			session
		);

		const giftCards = await refundService.getGiftCardsForRefundInvoice(
			refund_giftcards,
			session
		);
		if (!giftCards.length) {
			return sendErrorResponse(
				res,
				apiResponse.ELIGIBLE_GIFTCARD_REFUND_NOT_FOUND.message,
				apiResponse.ELIGIBLE_GIFTCARD_REFUND_NOT_FOUND.code,
				session
			);
		}

		for (let giftCard of giftCards) {
			if (!giftCard.invoice.equals(invoiceData._id)) {
				return sendErrorResponse(
					res,
					apiResponse.ONE_OF_GIFTCARD_NOT_BELONG_TO_INVOICE_REFUND.message,
					apiResponse.ONE_OF_GIFTCARD_NOT_BELONG_TO_INVOICE_REFUND.code,
					session
				);
			}
		}

		const otherEligibleGiftCards =
			await refundService.getOtherEligibleGiftCardsForRefund(
				invoiceData._id,
				refund_giftcards,
				session
			);

		const { invoiceNumber, referenceNumber } =
			await refundService.generateInvoiceNumber(
				invoiceData.invoice_number,
				invoiceData._id,
				session
			);

		let totalRefundAmount = 0;
		for (let giftCard of giftCards) {
			totalRefundAmount += giftCard.available_amount;
		}
		let taxAmount = 0;
		if (taxTypeData.title === AvailableTaxTypes.STANDARD) {
			const { taxAmount: tax } = calculateInclusiveTax(totalRefundAmount, 19);
			taxAmount = tax;
		}

		const fileName = `refund-invoice-${invoiceNumber}`;
		const invoicePdfData = await uploadFileToS3(
			file.buffer,
			fileName,
			file.mimetype,
			AWS_S3_BUCKET_KEYS.REFUND_INVOICE
		);

		const isDirectCharge = invoiceData.payment_type === PaymentTypes.DIRECT;
		const isDestinationCharge =
			invoiceData.payment_type === PaymentTypes.DESTINATION;

		const refundData = await stripe.refunds.create(
			{
				payment_intent: invoiceData.payment_id,
				amount: totalRefundAmount * 100,
				metadata: {
					invoice_id: invoiceData._id.toString(),
				},
				...(isDestinationCharge && shopData.stripe_account
					? { reverse_transfer: true }
					: {}),
			},
			isDirectCharge && shopData.stripe_account
				? { stripeAccount: shopData.stripe_account }
				: undefined
		);

		if (refundData.status === 'failed') {
			return sendErrorResponse(
				res,
				apiResponse.REFUND_FAILED_FROM_STRIPE.message,
				apiResponse.REFUND_FAILED_FROM_STRIPE.code,
				session
			);
		}
		const s3BaseUrl = process.env.S3_BASE_URL || "";
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || "";
		
		const filteredPdfUrl = invoicePdfData?.Location.replace(s3BaseUrl, cleanBaseUrl) ?? '';
		const refundInvoiceFields: RefundInvoiceInput = {
			customer_invoice: invoiceData._id,
			shop: invoiceData.shop,
			invoice_number: invoiceNumber,
			date: new Date(),
			deleted_at: null,
			pdf_url: filteredPdfUrl,
			reference_number: referenceNumber,
			refund_amount: totalRefundAmount,
			tax_amount: taxAmount,
			stripe_refund_id: refundData.id,
			refund_reason: refund_reason,
			payment_invoice: null,
		};

		const refundInvoice = await refundService.create(
			refundInvoiceFields,
			session
		);

		await invoiceService.updateInvoices(
			{
				_id: invoiceData._id,
			},
			{
				refunded_amount: +truncateToDecimals(
					invoiceData.refunded_amount + totalRefundAmount,
					2
				),
				order_status: otherEligibleGiftCards.length
					? InvoiceOrderStatus.PARTIAL_REFUND
					: InvoiceOrderStatus.REFUNDED,
			},
			session
		);

		for (let giftCard of giftCards) {
			await giftcardService.updateGiftCard(
				{
					_id: giftCard._id,
				},
				{
					refund_invoice: refundInvoice._id,
					refunded_amount: giftCard.available_amount,
					available_amount: 0,
					status: GiftCardStatus.REFUNDED,
				},
				session
			);
		}

		await sendSuccessResponse(
			res,
			{},
			apiResponse.REFUND_INVOICE_GENERATED_SUCCESSFULLY.message,
			apiResponse.REFUND_INVOICE_GENERATED_SUCCESSFULLY.code,
			session
		);

		try {
			const mailData: IRefundInvoiceMail = {
				logoUrl: shopData.logo_url ?? '',
				userName: invoiceData.fullname as string,
				userEmail: invoiceData.email,
				invoiceNumber: refundInvoice.invoice_number,
				refundDate: formatDateInGermanFormat(refundInvoice.date.toISOString()),
				invoiceUrl: refundInvoice.pdf_url,
			};
			refundService.sendInvoiceMail(mailData);

			if (shopUserSettings.refund_invoice_notifications) {
				const studioMailData: IRefundInvoiceStudioMail = {
					logoUrl: DEFAULT_IMG_URL.LOGO,
					studioName: shopData.studio_name ?? '',
					shopEmail: shopData.owner ?? '',
					customerInvoice: invoiceData.invoice_number as string,
					refundInvoice: refundInvoice.invoice_number,
					refundGiftCards: giftCards.map((giftCard) => ({
						code: formatGiftCardCode(giftCard.code),
						amount: getNumberInLocalFormat(giftCard.available_amount) + ' €',
					})),
					invoiceUrl: refundInvoice.pdf_url,
				};

				refundService.sendInvoiceStudioMail(studioMailData);
			}
		} catch (error) {}
	} catch (error: any) {
		console.log(error);
		if (error instanceof ValidationError) {
			return sendErrorResponse(
				res,
				error.message,
				apiResponse.VALIDATION_ERROR.code,
				session
			);
		}
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code,
			session
		);
	}
};

const getAllRefundInvoices = async (req: Request, res: Response) => {
	try {
		const { loggedUser } = req;
		const {
			page,
			size,
			sort_by = 'invoice_date',
			sort_order = 'asc',
			search_value,
			column_filters,
		}: {
			page?: string;
			size?: string;
			sort_by?: string;
			sort_order?: 'asc' | 'desc';
			search_value?: string;
			column_filters?: string;
		} = req.query;
		const { limit, offset } = getPagination(page, size);
		const parsedColumnFilters: { id: string; value: string }[] = JSON.parse(
			column_filters || '[]'
		);

		const isAdmin = loggedUser.role === UserRoles.ADMIN;

		const { rows, totalRows } = await refundService.getAllRefundInvoices({
			limit: limit,
			offset: offset,
			sort_by: sort_by,
			sort_order: sort_order,
			search_value: search_value,
			column_filters: parsedColumnFilters,
			shop_id: isAdmin ? null : new Types.ObjectId(loggedUser.shop_id),
		});

		const responseData = {
			refund_invoices: rows,
			total_refund_invoices: totalRows,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.REFUND_INVOICES_FETCHED_SUCCESSFULLY.message,
			apiResponse.REFUND_INVOICES_FETCHED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default {
	getGiftCardsForRefund,
	getPdfDataForRefundInvoice,
	createRefundInvoice,
	getAllRefundInvoices,
};
