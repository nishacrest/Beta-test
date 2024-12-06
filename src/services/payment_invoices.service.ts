import {
	PaymentInvoiceModel,
	InvoiceModel,
	RefundInvoiceModel,
} from '../database/models';
import { ClientSession, Types } from 'mongoose';
import { renderEjsFile, sendMail, truncateToDecimals } from '../utils/helper';
import {
	AnyKeyObject,
	IPaymentInvoicePurchases,
	IPaymentInvoices,
	IRefundInvoices,
} from '../types';
import {
	IPaymentInvoiceMail,
	PaymentInvoiceAttributes,
	PaymentInvoiceCreateSchema,
	PaymentInvoiceInput,
} from '../types/payment_invoices';
import { InvoiceMode, InvoiceTransactioStatus } from '../types/invoices';
import { EJS_TEMPLATES } from '../utils/constant';
import shop from '../database/models/shop';

const create = async (
	fields: PaymentInvoiceInput,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const invoice: any[] = await PaymentInvoiceModel.create([fields], {
			session: clientSession,
		});
		return invoice[0] as PaymentInvoiceAttributes;
	} catch (error) {
		throw error;
	}
};

const getAllPaymentInvoices = async (params: {
	limit: number;
	offset: number;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	start_date: string;
	end_date: string;
	admin_shop: Types.ObjectId;
	search_value?: string;
	column_filters?: { id: string; value: string }[];
}) => {
	try {
		const searchCondition: AnyKeyObject = { or: [], and: [] };
		if (params.column_filters?.length && !params.search_value) {
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'total_amount':
					case 'total_fees':
						searchCondition.and.push({
							[filter.id]: +filter.value,
						});
						break;
					default:
						searchCondition.and.push({
							[filter.id]: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
				}
			}
		}
		if (params.search_value) {
			searchCondition.or.push(
				...[
					{
						studio_name: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						invoice_number: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
				]
			);
			if (!isNaN(+params.search_value)) {
				searchCondition.or.push({
					total_amount: +params.search_value,
				});
				searchCondition.or.push({
					total_fees: +params.search_value,
				});
			}
		}
		const invoiceData = await InvoiceModel.aggregate([
			{
				$match: {
					date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					deleted_at: null,
					shop: {
						$ne: params.admin_shop,
					},
					transaction_status: InvoiceTransactioStatus.COMPLETED,
					invoice_mode: InvoiceMode.LIVE,
				},
			},
			{
				$lookup: {
					from: 'shops',
					localField: 'shop',
					foreignField: '_id',
					as: 'shop',
				},
			},
			{
				$unwind: '$shop',
			},
			{
				$lookup: {
					from: 'payment_invoices',
					localField: 'payment_invoice',
					foreignField: '_id',
					as: 'payment_invoice',
					pipeline: [
						{
							$match: {
								deleted_at: null,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: '$payment_invoice',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$group: {
					_id: {
						shop: '$shop._id',
						payment_invoice: '$payment_invoice._id',
					},
					total_amount: {
						$sum: '$total_amount',
					},
					total_fees: {
						$sum: '$fees',
					},
					studio_name: { $first: '$shop.studio_name' },
					invoice_number: { $first: '$payment_invoice.invoice_number' },
					pdf_url: { $first: '$payment_invoice.pdf_url' },
					invoice_date: { $first: '$payment_invoice.date' },
				},
			},
			{
				$project: {
					_id: 1,
					total_amount: 1,
					total_fees: 1,
					studio_name: 1,
					invoice_number: 1,
					pdf_url: 1,
					invoice_date: 1,
				},
			},
			{
				$match: {
					...(searchCondition.or.length ? { $or: searchCondition.or } : {}),
					...(searchCondition.and.length
						? {
								$and: searchCondition.and,
						  }
						: {}),
				},
			},
			{
				$sort: {
					[params.sort_by]: params.sort_order === 'asc' ? 1 : -1,
				},
			},
			{
				$skip: params.offset,
			},
			{
				$limit: params.limit,
			},
		]);

		// Fetch refund data
		const refundData = await RefundInvoiceModel.aggregate([
			{
				$match: {
					date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					deleted_at: null,
					shop: { $ne: params.admin_shop },
				},
			},
			{
				$sort: { date: 1 }, // Ensure refunds are sorted by date
			},
		]);

		// Create a map to track refunds for each shop and total refunds for each shop
		const refundMap = new Map();
		const totalRefundMap = new Map();

		for (const refund of refundData) {
			const shopId = refund.shop.toString();
			if (!refundMap.has(shopId)) {
				refundMap.set(shopId, []);
				totalRefundMap.set(shopId, 0);
			}
			refundMap.get(shopId).push({
				refund_amount: refund.refund_amount,
				refund_date: refund.date,
			});
			totalRefundMap.set(
				shopId,
				totalRefundMap.get(shopId) + refund.refund_amount
			);
		}

		const totalCount = await InvoiceModel.aggregate([
			{
				$match: {
					date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					deleted_at: null,
					shop: {
						$ne: params.admin_shop,
					},
					transaction_status: InvoiceTransactioStatus.COMPLETED,
					invoice_mode: InvoiceMode.LIVE,
				},
			},
			{
				$lookup: {
					from: 'shops',
					localField: 'shop',
					foreignField: '_id',
					as: 'shop',
				},
			},
			{
				$unwind: '$shop',
			},
			{
				$lookup: {
					from: 'payment_invoices',
					localField: 'payment_invoice',
					foreignField: '_id',
					as: 'payment_invoice',
					pipeline: [
						{
							$match: {
								deleted_at: null,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: '$payment_invoice',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$group: {
					_id: {
						shop: '$shop._id',
						payment_invoice: '$payment_invoice._id',
					},
					total_amount: {
						$sum: '$total_amount',
					},
					total_fees: {
						$sum: '$fees',
					},
					studio_name: { $first: '$shop.studio_name' },
					invoice_number: { $first: '$payment_invoice.invoice_number' },
					pdf_url: { $first: '$payment_invoice.pdf_url' },
					invoice_date: { $first: '$payment_invoice.date' },
				},
			},
			{
				$project: {
					_id: 1,
					total_amount: 1,
					total_fees: 1,
					studio_name: 1,
					invoice_number: 1,
					pdf_url: 1,
					invoice_date: 1,
				},
			},
			{
				$match: {
					...(searchCondition.or.length ? { $or: searchCondition.or } : {}),
					...(searchCondition.and.length
						? {
								$and: searchCondition.and,
						  }
						: {}),
				},
			},
			{
				$count: 'count',
			},
		]);

		const formattedData: IPaymentInvoices[] = [];

		for (let item of invoiceData) {
			const refundsForShop = refundMap.get(item._id.shop.toString()) || [];
			let totalRefundAmount = totalRefundMap.get(item._id.shop.toString()) || 0;

			if (item.invoice_date) {
				totalRefundAmount = refundsForShop.reduce(
					(acc: number, refund: any) => {
						if (refund.refund_date <= item.invoice_date) {
							return acc + refund.refund_amount;
						}
						return acc;
					},
					0
				);
			}

			const adjustedTotalAmount = item.total_amount - totalRefundAmount;
			const totalAmount = +truncateToDecimals(adjustedTotalAmount, 2);
			const totalFees = +truncateToDecimals(item.total_fees, 2);

			formattedData.push({
				shop_id: item._id.shop,
				studio_name: item.studio_name,
				total_amount: totalAmount,
				total_fees: totalFees,
				invoice_number: item.invoice_number,
				pdf_url: item.pdf_url,
				invoice_date: item.invoice_date,
			});
		}
		return {
			rows: formattedData,
			count: (totalCount[0]?.count || 0) as number,
		};
	} catch (error) {
		throw error;
	}
};

const getAllPaymentInvoiceForShopUser = async (params: {
	limit: number;
	offset: number;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	start_date: string;
	end_date: string;
	shop_id: Types.ObjectId;
	search_value?: string;
	column_filters?: { id: string; value: string }[];
}) => {
	try {
		const searchCondition: AnyKeyObject = { or: [], and: [] };
		if (params.column_filters?.length && !params.search_value) {
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'total_amount':
						searchCondition.and.push({
							['purchased_amount']: +filter.value,
						});
						break;
					case 'total_fees':
						searchCondition.and.push({
							['fee_amount']: +filter.value,
						});
						break;
					case 'studio_name':
						searchCondition.and.push({
							['shop.studio_name']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					default:
						searchCondition.and.push({
							[filter.id]: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
				}
			}
		}
		if (params.search_value) {
			searchCondition.or.push(
				...[
					{
						['shop.studio_name']: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						['invoice_number']: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
				]
			);
			if (!isNaN(+params.search_value)) {
				searchCondition.or.push({
					['purchased_amount']: +params.search_value,
				});
				searchCondition.or.push({
					['fee_amount']: +params.search_value,
				});
			}
		}

		if (params.sort_by) {
			switch (params.sort_by) {
				case 'total_amount':
					params.sort_by = 'purchased_amount';
					break;
				case 'total_fees':
					params.sort_by = 'fee_amount';
					break;
				case 'studio_name':
					params.sort_by = 'shop.studio_name';
					break;
				default:
					break;
			}
		}
		const data = await PaymentInvoiceModel.aggregate([
			{
				$match: {
					deleted_at: null,
					date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					shop: params.shop_id,
				},
			},
			{
				$lookup: {
					from: 'shops',
					localField: 'shop',
					foreignField: '_id',
					as: 'shop',
					pipeline: [
						{
							$project: {
								_id: 1,
								studio_name: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$shop',
			},
			{
				$match: {
					...(searchCondition.or.length ? { $or: searchCondition.or } : {}),
					...(searchCondition.and.length
						? {
								$and: searchCondition.and,
						  }
						: {}),
				},
			},
			{
				$project: {
					_id: 1,
					date: 1,
					purchased_amount: 1,
					fee_amount: 1,
					shop: 1,
					pdf_url: 1,
					invoice_number: 1,
				},
			},
			{
				$sort: {
					[params.sort_by]: params.sort_order === 'asc' ? 1 : -1,
				},
			},
			{
				$skip: params.offset,
			},
			{
				$limit: params.limit,
			},
		]);

		const totalCount = await PaymentInvoiceModel.aggregate([
			{
				$match: {
					deleted_at: null,
					date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					shop: params.shop_id,
				},
			},
			{
				$lookup: {
					from: 'shops',
					localField: 'shop',
					foreignField: '_id',
					as: 'shop',
					pipeline: [
						{
							$project: {
								_id: 1,
								studio_name: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$shop',
			},
			{
				$match: {
					...(searchCondition.or.length ? { $or: searchCondition.or } : {}),
					...(searchCondition.and.length
						? {
								$and: searchCondition.and,
						  }
						: {}),
				},
			},
			{
				$count: 'count',
			},
		]);

		const formattedData: IPaymentInvoices[] = [];
		for (let item of data) {
			formattedData.push({
				shop_id: item.shop._id,
				studio_name: item.shop.studio_name,
				total_amount: item.purchased_amount,
				total_fees: item.fee_amount,
				invoice_number: item.invoice_number,
				pdf_url: item.pdf_url,
				invoice_date: item.date,
			});
		}

		return { rows: formattedData, count: totalCount[0]?.count || 0 };
	} catch (error) {
		throw error;
	}
};

const getPurchasesOfInvoice = async (
	params: {
		start_date: string;
		end_date: string;
		admin_shop: Types.ObjectId;
		shop_id: Types.ObjectId;
	},
	session: ClientSession | null
) => {
	try {
		const data = await InvoiceModel.aggregate([
			{
				$match: {
					deleted_at: null,
					date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					shop: params.shop_id,
					transaction_status: InvoiceTransactioStatus.COMPLETED,
					payment_invoice: null,
					invoice_mode: InvoiceMode.LIVE,
				},
			},
			{
				$sort: { 'date': -1 },
			},
			{
				$project: {
					_id: 1,
					date: 1,
					invoice_number: 1,
					total_amount: 1,
					fees: 1,
				},
			},
		]).session(session);
		const formattedData: IPaymentInvoicePurchases[] = [];
		let totalAmount = 0;
		let totalFees = 0;
		for (let item of data) {
			formattedData.push({
				...item,
			});

			totalAmount += item.total_amount;
			totalFees += item.fees;
		}

		const refundData = await RefundInvoiceModel.aggregate([
			{
				$match: {
					deleted_at: null,
					date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					shop: params.shop_id,
					payment_invoice: null,
				},
			},
			{
				$sort: {
					'date': -1,
				},
			},
			{
				$project: {
					_id: 1,
					date: 1,
					invoice_number: 1,
					refund_amount: 1,
					tax_amount: 1,
				},
			},
		]).session(session);

		const formattedRefundData: IRefundInvoices[] = [];
		let refundTotalAmount = 0;
		for (let item of refundData) {
			formattedRefundData.push({
				_id: item._id,
				invoice_number: item.invoice_number,
				total_amount: -Math.abs(item.refund_amount),
				fees: 0,
				date: item.date,
				...item,
			});
			refundTotalAmount += item.refund_amount;
		}

		totalAmount = totalAmount - refundTotalAmount;

		const data2: any[] = [];
		data2.push(...formattedData);
		data2.push(...formattedRefundData);

		data2.sort((a, b) => b.date - a.date);

		const response = {
			purchases: data2,
			totalAmount: +truncateToDecimals(totalAmount, 2),
			totalFees: +truncateToDecimals(totalFees, 2),
		};
		return response;
	} catch (error) {
		throw error;
	}
};

const validateInvoiceUpdate = async (data: any) => {
	try {
		const parsedData = await PaymentInvoiceCreateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const sendInvoiceMail = async (mailData: IPaymentInvoiceMail) => {
	try {
		const html = await renderEjsFile(
			EJS_TEMPLATES.PAYMENT_INVOICE_MAIL,
			mailData
		);

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [mailData.shopEmail],
			subject: `Your invoice for giftcard handling-fees`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

export default {
	create,
	getAllPaymentInvoices,
	getAllPaymentInvoiceForShopUser,
	getPurchasesOfInvoice,
	validateInvoiceUpdate,
	sendInvoiceMail,
};
