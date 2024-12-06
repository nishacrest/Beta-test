import { Request, Response } from 'express';
import { apiResponse, AWS_S3_BUCKET_KEYS } from '../utils/constant';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import invoiceService from '../services/invoice.service';
import {
	calculateInclusiveTax,
	formatDateInGermanFormat,
	formatGiftCardCode,
	getNumberInLocalFormat,
	getPagination,
	truncateToDecimals,
	uploadFileToS3,
} from '../utils/helper';
import negotiationInvoiceService from '../services/negotiation_invoices.service';
import shopService from '../services/shop.service';
import {
	INegotiationInvoiceMail,
	NegotiationInvoiceInput,
} from '../types/negotiation_invoices';
import { INegotiationInvoices } from '../types';
import redeemGiftCardService from '../services/redeem_giftcards.service';
import mongoose, { ClientSession, Types } from 'mongoose';
import userService from '../services/user.service';
import { UserRoles } from '../types/users';
import { StudioMode } from '../types/shops';
import userSettingsService from '../services/user_settings.service';

const getAllNegotiationInvoices = async (req: Request, res: Response) => {
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
			negotiation_invoices: INegotiationInvoices[];
			total_negotiation_invoices: number;
		} = { negotiation_invoices: [], total_negotiation_invoices: 0 };

		if (loggedUser.role === UserRoles.ADMIN) {
			const [adminData] = await userService.getAdminUserWithShop(null);
			if (!adminData) {
				return sendErrorResponse(
					res,
					apiResponse.SHOP_NOT_FOUND.message,
					apiResponse.SHOP_NOT_FOUND.code
				);
			}
			const adminShopData = adminData.shop;

			const invoices =
				await negotiationInvoiceService.getAllNegotiationInvoices({
					limit: limit,
					offset: offset,
					sort_by: sort_by,
					sort_order: sort_order,
					start_date: start_date,
					end_date: end_date,
					admin_shop: adminShopData._id,
					search_value,
					column_filters: parsedColumnFilters,
				});
			responseData.negotiation_invoices = invoices.rows;
			responseData.total_negotiation_invoices = invoices.count;
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
			// fetch invoice only if studio is in live mode
			if (shopData.studio_mode === StudioMode.LIVE) {
				const invoices =
					await negotiationInvoiceService.getAllNegotiationInvoicesForShopUser({
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
				responseData.negotiation_invoices = invoices.rows;
				responseData.total_negotiation_invoices = invoices.count;
			}
		}

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.NEGOTIATION_INVOICES_FETCHED_SUCCESSFULLY.message,
			apiResponse.NEGOTIATION_INVOICES_FETCHED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getRedemptionsOfInvoice = async (req: Request, res: Response) => {
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
		const adminShopData = adminData.shop;

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

		const redemptions = await negotiationInvoiceService.getRedemptionsOfInvoice(
			{
				start_date: start_date,
				end_date: end_date,
				shop_id: shopData._id,
				admin_shop: adminShopData._id,
			},
			null
		);
		const responseData = {
			redemptions: redemptions.redemptions,
			total_amount: redemptions.totalAmount,
			total_fees: redemptions.totalFees,
			total_payout: redemptions.totalPayout,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.REDEEMPTIONS_FOUND_SUCCESSFUL.message,
			apiResponse.REDEEMPTIONS_FOUND_SUCCESSFUL.code
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
		const adminShopData = adminData.shop;

		// calculate a invoice number
		if(! adminShopData.invoice_reference_number){
			throw new Error("invoice reference number not defined")
		}
		const referenceNumber = adminShopData.invoice_reference_number + 1;
		const invoiceNumber = `RE-${
			adminShopData.studio_id
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

		const { redemptions, totalAmount, totalFees, totalPayout } =
			await negotiationInvoiceService.getRedemptionsOfInvoice(
				{
					start_date: start_date,
					end_date: end_date,
					shop_id: shopData._id,
					admin_shop: adminShopData._id,
				},
				null
			);
		const formattedRedemptions = redemptions.map((item) => {
			return {
				...item,
				redeemed_date: formatDateInGermanFormat(
					item.redeemed_date.toISOString(),
					timezone
				),
				giftcard_code: formatGiftCardCode(item.giftcard.code),
				amount: getNumberInLocalFormat(item.amount, 2) + ' €',
				fees: getNumberInLocalFormat(item.fees, 2) + ' €',
				payout: getNumberInLocalFormat(item.payout, 2) + ' €',
			};
		});
		const lineItems = [
			{
				description: 'Vermittlungs-Provision',
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
				_id: adminShopData._id,
				official_name: adminShopData.official_name,
				shop_name: adminShopData.studio_name,
				address: adminShopData.street,
				city: adminShopData.city,
				country: adminShopData.country?.name,
				phone: adminShopData.phone,
				email: adminShopData.owner,
				logo_url: adminShopData.logo_url,
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
			redemptions: formattedRedemptions,
			total_amount: getNumberInLocalFormat(totalAmount, 2) + ' €',
			total_fees: getNumberInLocalFormat(totalFees, 2) + ' €',
			total_payout: getNumberInLocalFormat(totalPayout, 2) + ' €',
			net_amount: getNumberInLocalFormat(netAmount, 2) + ' €',
			tax_amount: getNumberInLocalFormat(taxAmount, 2) + ' €',
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.NEGOTIATION_INVOICE_PDF_DATE_RETRIEVED_SUCCESSFULLY.message,
			apiResponse.NEGOTIATION_INVOICE_PDF_DATE_RETRIEVED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const createNegotiationInvoice = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { loggedUser } = req;
		const { shop_id, start_date, end_date, invoice_number } =
			await negotiationInvoiceService.validateInvoiceUpdate(req.body);
		const file = req.file;

		if (!file) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_FILE_REQUIRED.message,
				apiResponse.INVOICE_FILE_REQUIRED.code,
				null
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
		const adminShopData = adminData.shop;
		if(! adminShopData.invoice_reference_number){
			throw new Error("invoice reference number not defined")
		}
		const referenceNumber = adminShopData.invoice_reference_number + 1;
		const invoiceNumber = `RE-${
			adminShopData.studio_id
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

		const { totalAmount, totalFees, totalPayout, redemptions } =
			await negotiationInvoiceService.getRedemptionsOfInvoice(
				{
					start_date: start_date,
					end_date: end_date,
					admin_shop: adminShopData._id,
					shop_id: shopData._id,
				},
				session
			);
		if (!redemptions.length) {
			return sendErrorResponse(
				res,
				apiResponse.REDEMPTIONS_NOT_FOUND_FOR_INVOICE.message,
				apiResponse.REDEMPTIONS_NOT_FOUND_FOR_INVOICE.code,
				session
			);
		}
		const redemptionIds: Types.ObjectId[] = [];

		for (let item of redemptions) {
			redemptionIds.push(item._id);
		}

		const fileName = `negotiation-invoice-${invoiceNumber}`;
		const invoicePdfData = await uploadFileToS3(
			file.buffer,
			fileName,
			file.mimetype,
			AWS_S3_BUCKET_KEYS.NEGOTIATION_INVOICE
		);
		const s3BaseUrl = process.env.S3_BASE_URL || "";
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || "";
		
		const filteredPdfUrl = invoicePdfData?.Location.replace(s3BaseUrl, cleanBaseUrl) ?? '';
		const invoiceFields: NegotiationInvoiceInput = {
			invoice_number: invoiceNumber,
			shop: shopData._id,
			redeemed_amount: +truncateToDecimals(totalAmount, 2),
			fee_amount: +truncateToDecimals(totalFees, 2),
			payout_amount: +truncateToDecimals(totalPayout, 2),
			iban: shopData.iban ?? '',
			pdf_url: filteredPdfUrl,
			date: new Date(),
			date_range: {
				start: new Date(start_date),
				end: new Date(end_date),
			},
			deleted_at: null,
		};
		const invoiceData = await negotiationInvoiceService.create(
			invoiceFields,
			session
		);
		await redeemGiftCardService.updateRedeemGiftCard(
			{
				_id: {
					$in: redemptionIds,
				},
			},
			{ negotiation_invoice: invoiceData._id },
			session
		);
		await shopService.updateShop(
			{ _id: adminShopData._id },
			{ invoice_reference_number: referenceNumber },
			session
		);

		const responseData: INegotiationInvoices = {
			shop_id: shopData._id,
			studio_name: shopData.studio_name ?? '',
			iban: shopData.iban ?? '',
			invoice_iban: invoiceData.iban,
			invoice_number: invoiceData.invoice_number,
			pdf_url: invoiceData.pdf_url,
			total_amount: invoiceData.redeemed_amount,
			total_fees: invoiceData.fee_amount,
			total_payout: invoiceData.payout_amount,
			invoice_date: invoiceData.date,
		};

		await sendSuccessResponse(
			res,
			responseData,
			apiResponse.NEGOTIATION_INVOICE_GENERATED_SUCCESSFULLY.message,
			apiResponse.NEGOTIATION_INVOICE_GENERATED_SUCCESSFULLY.code,
			session
		);

		try {
			if (userSettings?.negotiation_invoice_notifications) {
				const invoiceMailData: INegotiationInvoiceMail = {
					invoiceDate: formatDateInGermanFormat(invoiceData.date.toISOString()),
					invoiceNumber: invoiceData.invoice_number,
					invoiceUrl: invoiceData.pdf_url,
					logoUrl: shopData.logo_url ?? '',
					shopEmail: shopData.owner ?? '',
					studioName: shopData.studio_name ?? '',
					totalPayout:
						getNumberInLocalFormat(invoiceData.payout_amount, 2) + ' €',
				};

				negotiationInvoiceService.sendInvoiceMail(invoiceMailData);
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
	getAllNegotiationInvoices,
	getRedemptionsOfInvoice,
	getInvoiceDataForPdf,
	createNegotiationInvoice,
};
