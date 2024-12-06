import { Request, Response } from 'express';
import { apiResponse } from '../utils/constant';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import invoiceService from '../services/invoice.service';
import { getPagination } from '../utils/helper';
import { UserRoles } from '../types/users';
import { InvoiceAttributes, InvoiceMode } from '../types/invoices';
import { ValidationError } from 'yup';
import { StudioMode } from '../types/shops';
import shopService from '../services/shop.service';
import mongoose, { ClientSession } from 'mongoose';

const getInvoiceDetails = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const [invoice] = await invoiceService.getInvoiceDetails(id);

		if (!invoice) {
			return sendErrorResponse(
				res,
				apiResponse.INVOICE_NOT_FOUND.message,
				apiResponse.INVOICE_NOT_FOUND.code
			);
		}

		return sendSuccessResponse(
			res,
			invoice,
			apiResponse.INVOICE_FETCHED_SUCCESSFUL.message,
			apiResponse.INVOICE_FETCHED_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getAllInvoice = async (req: Request, res: Response) => {
	try {
		const {
			page,
			size,
			sort_by = 'created_at',
			sort_order = 'desc',
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
		const { loggedUser } = req;

		const { limit, offset } = getPagination(page, size);

		const parsedColumnFilters: { id: string; value: string }[] = JSON.parse(
			column_filters || '[]'
		);
		const shopId =
			loggedUser.role === UserRoles.ADMIN ? null : loggedUser.shop_id;

		let invoiceMode = InvoiceMode.LIVE;
		if (shopId) {
			const [shopData] = await shopService.findShops({ _id: shopId });
			if (!shopData) {
				return sendErrorResponse(
					res,
					apiResponse.SHOP_NOT_FOUND.message,
					apiResponse.SHOP_NOT_FOUND.code
				);
			}
			invoiceMode =
				shopData.studio_mode === StudioMode.LIVE
					? InvoiceMode.LIVE
					: InvoiceMode.DEMO;
		}

		const invoices = await invoiceService.getAllInvoices({
			limit: limit,
			offset: offset,
			sort_by,
			sort_order,
			search_value,
			column_filters: parsedColumnFilters,
			shop_id: shopId,
			invoice_mode: invoiceMode,
		});

		const responseData = {
			invoices: invoices.rows,
			total_invoices: invoices.count,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.INVOICES_FOUND_SUCCESSFUL.message,
			apiResponse.INVOICES_FOUND_SUCCESSFUL.code
		);
	} catch (error) {
		throw error;
	}
};

const updateInvoice = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { id: invoice_id } = req.params;
		const { comment } = await invoiceService.validateInvoiceUpdate(req.body);

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

		const updateFields: Partial<InvoiceAttributes> = {};
		if (comment !== undefined) updateFields.comment = comment;

		await invoiceService.updateInvoices(
			{ _id: invoice_id },
			updateFields,
			session
		);
		return sendSuccessResponse(
			res,
			{},
			apiResponse.INVOICE_UPDATED_SUCCESSFULLY.message,
			apiResponse.INVOICE_UPDATED_SUCCESSFULLY.code,
			session
		);
	} catch (error: any) {
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

export default { getInvoiceDetails, getAllInvoice, updateInvoice };
