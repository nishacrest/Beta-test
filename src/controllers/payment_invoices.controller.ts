import { Request, Response } from 'express';
import { apiResponse, AWS_S3_BUCKET_KEYS } from '../utils/constant';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import invoiceService from '../services/invoice.service';
import refundService from '../services/refund.service';
import {
	calculateInclusiveTax,
	formatDateInGermanFormat,
	getNumberInLocalFormat,
	getPagination,
	truncateToDecimals,
	uploadFileToS3,
} from '../utils/helper';
import paymentInvoiceService from '../services/payment_invoices.service';
import shopService from '../services/shop.service';
import { IPaymentInvoices } from '../types';
import userService from '../services/user.service';
import mongoose, { ClientSession, Types } from 'mongoose';
import {
	IPaymentInvoiceMail,
	PaymentInvoiceInput,
} from '../types/payment_invoices';
import { UserRoles } from '../types/users';
import { InvoiceMode, InvoiceTransactioStatus } from '../types/invoices';
import { StudioMode } from '../types/shops';
import userSettingsService from '../services/user_settings.service';

const getAllPaymentInvoices = async (req: Request, res: Response) => {
	try {
		const { loggedUser } = req;
		const {
			page,
			size,
			sort_by = 'studio_name',
			sort_order = 'asc',
			search_value,
			column_filters,
			start_date,
			end_date,
		}: {
			page?: string;
			size?: string;
			sort_by?: string;
			sort_order?: 'asc' | 'desc';
			search_value?: string;
			column_filters?: string;
			start_date?: string;
			end_date?: string;
		} = req.query;
		const { limit, offset } = getPagination(page, size);
		const parsedColumnFilters: { id: string; value: string }[] = JSON.parse(
			column_filters || '[]'
		);

		if (!start_date || !end_date) {
			return sendErrorResponse(
				res,
				apiResponse.DATE_RANGE_FIELD_REQUIRED.message,
				apiResponse.DATE_RANGE_FIELD_REQUIRED.code
			);
		}

		const responseData: {
			payment_invoices: IPaymentInvoices[];
			total_payment_invoices: number;
		} = {
			payment_invoices: [],
			total_payment_invoices: 0,
		};

		if (loggedUser.role === UserRoles.ADMIN) {
			const [adminData] = await userService.getAdminUserWithShop(null);
			if (!adminData) {
				return sendErrorResponse(
					res,
					apiResponse.SHOP_NOT_FOUND.message,
					apiResponse.SHOP_NOT_FOUND.code
				);
			}
			const invoices = await paymentInvoiceService.getAllPaymentInvoices({
				limit: limit,
				offset: offset,
				sort_by: sort_by,
				sort_order: sort_order,
				start_date: start_date,
				end_date: end_date,
				admin_shop: adminData.shop._id,
				search_value,
				column_filters: parsedColumnFilters,
			});

			responseData.payment_invoices = invoices.rows;
			responseData.total_payment_invoices = invoices.count;
		} else if (loggedUser.role === UserRoles.SHOP) {
			const [shopData] = await shopService.findShops({
				_id: loggedUser.shop_id,
			});
			if (!shopData) {
				return sendErrorResponse(
					res,
					apiResponse.SHOP_NOT_FOUND.message,
					apiResponse.SHOP_NOT_FOUND.code
				);
			}
			if (shopData.studio_mode === StudioMode.LIVE) {
				const invoices =
					await paymentInvoiceService.getAllPaymentInvoiceForShopUser({
						limit: limit,
						offset: offset,
						sort_by: sort_by,
						sort_order: sort_order,
						start_date: start_date,
						end_date: end_date,
						shop_id: new Types.ObjectId(loggedUser.shop_id),
						search_value,
						column_filters: parsedColumnFilters,
					});

				responseData.payment_invoices = invoices.rows;
				responseData.total_payment_invoices = invoices.count;
			}
		}

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.PAYMENT_INVOICES_FETCHED_SUCCESSFULLY.message,
			apiResponse.PAYMENT_INVOICES_FETCHED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getPurchasesOfInvoice = async (req: Request, res: Response) => {
	try {
		const { loggedUser } = req;
		const { shop_id } = req.params;
		const { start_date, end_date }: { start_date?: string; end_date?: string } =
			req.query;

		if (!start_date || !end_date) {
			return sendErrorResponse(
				res,
				apiResponse.DATE_RANGE_FIELD_REQUIRED.message,
				apiResponse.DATE_RANGE_FIELD_REQUIRED.code
			);
		}

		const [adminData] = await userService.getAdminUserWithShop(null);
		if (!adminData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		const [shopData] = await shopService.findShops({
			_id: shop_id,
		});
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		let { purchases, totalAmount, totalFees } =
			await paymentInvoiceService.getPurchasesOfInvoice(
				{
					start_date: start_date,
					end_date: end_date,
					shop_id: shopData._id,
					admin_shop: adminData.shop._id,
				},
				null
			);

		const responseData = {
			purchases: purchases,
			total_amount: totalAmount,
			total_fees: totalFees,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.PURCHASES_FOUND_SUCCESSFUL.message,
			apiResponse.PURCHASES_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getInvoiceDataForPdf = async (req: Request, res: Response) => {
	try {
		const { loggedUser } = req;
		const { shop_id } = req.params;
		const {
			start_date,
			end_date,
			timezone = 'Europe/Berlin',
		}: {
			start_date?: string;
			end_date?: string;
			timezone?: string;
		} = req.query;

		if (!start_date || !end_date) {
			return sendErrorResponse(
				res,
				apiResponse.DATE_RANGE_FIELD_REQUIRED.message,
				apiResponse.DATE_RANGE_FIELD_REQUIRED.code
			);
		}

		const [adminData] = await userService.getAdminUserWithShop(null);
		if (!adminData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}
		if (adminData.shop.invoice_reference_number == undefined) {
			throw new Error("invoice reference number undefined")
		}
		const referenceNumber = adminData.shop.invoice_reference_number + 1;
		const invoiceNumber = `RE-${
			adminData.shop.studio_id
		}-${new Date().getFullYear()}${referenceNumber}`;

		const [shopData] = await shopService.findShops({
			_id: shop_id,
		});
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		const { purchases, totalAmount, totalFees } =
			await paymentInvoiceService.getPurchasesOfInvoice(
				{
					start_date: start_date,
					end_date: end_date,
					shop_id: shopData._id,
					admin_shop: adminData.shop._id,
				},
				null
			);
		const formattedPurchases = purchases.map((item) => {
			return {
				...item,
				date: formatDateInGermanFormat(item.date.toISOString(), timezone),
				total_amount: getNumberInLocalFormat(item.total_amount, 2) + ' €',
				fees: getNumberInLocalFormat(item.fees, 2) + ' €',
			};
		});
		const lineItems = [
			{
				description: 'Software-Gebühr',
				quantity: 1,
				unit_price: getNumberInLocalFormat(totalFees, 2) + ' €',
				tax: '19%',
				total_price: getNumberInLocalFormat(totalFees, 2) + ' €',
			},
		];
		const { netAmount, taxAmount } = calculateInclusiveTax(totalFees, 19);

		const responseData = {
			invoice_number: invoiceNumber,
			date: formatDateInGermanFormat(new Date().toISOString(), timezone),
			date_range: `${formatDateInGermanFormat(
				start_date,
				timezone
			)} - ${formatDateInGermanFormat(end_date, timezone)}`,
			seller: {
				_id: adminData.shop._id,
				official_name: adminData.shop.official_name,
				shop_name: adminData.shop.studio_name,
				address: adminData.shop.street,
				city: adminData.shop.city,
				country: adminData.shop.country?.name,
				phone: adminData.shop.phone,
				email: adminData.shop.owner,
				logo_url: adminData.shop.logo_url,
			},
			buyer: {
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
			invoice_items: lineItems,
			purchases: formattedPurchases,
			total_amount: getNumberInLocalFormat(totalAmount, 2) + ' €',
			total_fees: getNumberInLocalFormat(totalFees, 2) + ' €',
			net_amount: getNumberInLocalFormat(netAmount, 2) + ' €',
			tax_amount: getNumberInLocalFormat(taxAmount, 2) + ' €',
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.PAYMENT_INVOICE_PDF_DATE_RETRIEVED_SUCCESSFULLY.message,
			apiResponse.PAYMENT_INVOICE_PDF_DATE_RETRIEVED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const createPaymentInvoice = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { loggedUser } = req;
		const { shop_id, start_date, end_date, invoice_number } =
			await paymentInvoiceService.validateInvoiceUpdate(req.body);
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

		const [adminData] = await userService.getAdminUserWithShop(session);
		if (!adminData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code,
				session
			);
		}
		if (adminData.shop.invoice_reference_number == undefined) {
			throw new Error("invoice reference number undefined")
		}
		const referenceNumber = adminData.shop.invoice_reference_number + 1;
		const invoiceNumber = `RE-${
			adminData.shop.studio_id
		}-${new Date().getFullYear()}${referenceNumber}`;

		if (invoiceNumber !== invoice_number) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_NUMBER_MISMATCH.message,
				apiResponse.INVOICE_NUMBER_MISMATCH.code,
				session
			);
		}

		const uniqueInvoiceNumber =
			await invoiceService.checkForUniqueInvoiceNumber(invoiceNumber, session);
		if (!uniqueInvoiceNumber) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_NUMBER_EXISTS.message,
				apiResponse.INVOICE_NUMBER_EXISTS.code,
				session
			);
		}

		const [shopData] = await shopService.findShops(
			{
				_id: shop_id,
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

		const [userSettings] = await userSettingsService.find(
			{
				shop: shopData._id,
			},
			session
		);

		const { purchases, totalAmount, totalFees } =
			await paymentInvoiceService.getPurchasesOfInvoice(
				{
					start_date: start_date,
					end_date: end_date,
					shop_id: shopData._id,
					admin_shop: adminData.shop._id,
				},
				session
			);
		if (!purchases.length) {
			return sendErrorResponse(
				res,
				apiResponse.PURCHASES_NOT_FOUND_FOR_INVOICE.message,
				apiResponse.PURCHASES_NOT_FOUND_FOR_INVOICE.code,
				session
			);
		}

		const fileName = `payment-invoice-${invoiceNumber}`;
		const invoicePdfData = await uploadFileToS3(
			file.buffer,
			fileName,
			file.mimetype,
			AWS_S3_BUCKET_KEYS.PAYMENT_INVOICE
		);
		const s3BaseUrl = process.env.S3_BASE_URL || "";
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || "";
		
		const filteredPdfUrl = invoicePdfData?.Location.replace(s3BaseUrl, cleanBaseUrl) ?? '';
		const invoiceFields: PaymentInvoiceInput = {
			date: new Date(),
			invoice_number: invoiceNumber,
			shop: shopData._id,
			purchased_amount: +truncateToDecimals(totalAmount, 2),
			fee_amount: +truncateToDecimals(totalFees, 2),
			pdf_url: filteredPdfUrl,
			deleted_at: null,
			date_range: {
				start: new Date(start_date),
				end: new Date(end_date),
			},
		};
		const invoiceData = await paymentInvoiceService.create(
			invoiceFields,
			session
		);
		await invoiceService.updateInvoices(
			{
				shop: shopData._id,
				date: {
					$gte: new Date(start_date),
					$lte: new Date(end_date),
				},
				deleted_at: null,
				transaction_status: InvoiceTransactioStatus.COMPLETED,
				invoice_mode: InvoiceMode.LIVE,
				payment_invoice: null,
			},
			{ payment_invoice: invoiceData._id },
			session
		);

		await refundService.updateInvoices(
			{
				shop: shopData._id,
				date: {
					$gte: new Date(start_date),
					$lte: new Date(end_date),
				},
				deleted_at: null,
				payment_invoice: null,
			},
			{ payment_invoice: invoiceData._id }
		);
		await shopService.updateShop(
			{ _id: adminData.shop._id },
			{ invoice_reference_number: referenceNumber },
			session
		);

		const responseData: IPaymentInvoices = {
			shop_id: shopData._id,
			invoice_date: invoiceData.date,
			invoice_number: invoiceData.invoice_number,
			pdf_url: invoiceData.pdf_url,
			studio_name: shopData.studio_name ?? '',
			total_amount: totalAmount,
			total_fees: totalFees,
		};

		await sendSuccessResponse(
			res,
			responseData,
			apiResponse.PAYMENT_INVOICE_GENERATED_SUCCESSFULLY.message,
			apiResponse.PAYMENT_INVOICE_GENERATED_SUCCESSFULLY.code,
			session
		);

		try {
			if (userSettings?.payment_invoice_notifications) {
				const invoiceMailData: IPaymentInvoiceMail = {
					invoiceDate: formatDateInGermanFormat(invoiceData.date.toISOString()),
					invoiceNumber: invoiceData.invoice_number,
					invoiceUrl: invoiceData.pdf_url,
					logoUrl: shopData.logo_url ?? '',
					shopEmail: shopData.owner ?? '',
					studioName: shopData.studio_name ?? '',
					totalAmount:
						getNumberInLocalFormat(invoiceData.purchased_amount, 2) + ' €',
				};

				paymentInvoiceService.sendInvoiceMail(invoiceMailData);
			}
		} catch (error) {}
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code,
			session
		);
	}
};

export default {
	getAllPaymentInvoices,
	createPaymentInvoice,
	getInvoiceDataForPdf,
	getPurchasesOfInvoice,
};
