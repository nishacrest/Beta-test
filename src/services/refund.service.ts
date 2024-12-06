import {
	GiftCardModel,
	RefundInvoiceModel,
	ShopModel,
} from '../database/models';
import {
	AnyKeyObject,
	IGiftCardsForRefund,
	IGiftCardsForRefundInvoice,
	IRefundInvoices,
} from '../types';
import { GiftCardMode, GiftCardStatus } from '../types/giftcards';
import {
	createRefundInvoiceSchema,
	invoicePdfDataSchema,
	IRefundInvoiceMail,
	IRefundInvoiceStudioMail,
	RefundInvoiceAttributes,
	RefundInvoiceInput,
} from '../types/refunds_invoices';
import { ClientSession, Types } from 'mongoose';
import { convertUtcToLocal, renderEjsFile, sendMail } from '../utils/helper';
import { EJS_TEMPLATES } from '../utils/constant';
import { BankTransferDetails } from '../types/invoices';

const create = async (
	fields: RefundInvoiceInput,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const data: any[] = await RefundInvoiceModel.create([fields], {
			session: clientSession,
		});
		return data[0] as RefundInvoiceAttributes;
	} catch (error) {
		throw error;
	}
};

const validateCreateRefund = async (data: any) => {
	try {
		const giftCards = data.refund_giftcards
			? JSON.parse(data.refund_giftcards)
			: [];

		const finalData = {
			...data,
			refund_giftcards: giftCards,
		};
		const parsedData = await createRefundInvoiceSchema.validate(finalData, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validateInvoicePdfDataSchema = async (data: any) => {
	try {
		const parsedData = await invoicePdfDataSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const getBaseGiftCardConditionForEligibleRefund = () => {
	try {
		return {
			deleted_at: null,
			status: {
				$in: [
					GiftCardStatus.ACTIVE,
					GiftCardStatus.BLOCKED,
					GiftCardStatus.INACTIVE,
				],
			},
			giftcard_mode: GiftCardMode.LIVE,
			available_amount: {
				$gt: 0,
			},
		};
	} catch (error) {
		throw error;
	}
};

const getGiftCardsForRefund = async (invoiceId: Types.ObjectId) => {
	try {
		const baseCondition = getBaseGiftCardConditionForEligibleRefund();
		const data = await GiftCardModel.aggregate([
			{
				$match: {
					invoice: invoiceId,
					...baseCondition,
				},
			},
			{
				$lookup: {
					from: 'giftcard_templates',
					localField: 'giftcard_template',
					foreignField: '_id',
					as: 'giftcard_template',
					pipeline: [
						{
							$match: {
								deleted_at: null,
							},
						},
						{
							$project: {
								_id: 1,
								title: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$giftcard_template',
			},
			{
				$project: {
					_id: 1,
					amount: 1,
					available_amount: 1,
					status: 1,
					code: 1,
					validtill_date: 1,
					giftcard_template: 1,
				},
			},
		]);

		return data as IGiftCardsForRefund[];
	} catch (error) {
		throw error;
	}
};

const getGiftCardsForRefundInvoice = async (
	giftCards: Types.ObjectId[],
	session: ClientSession | null
) => {
	try {
		const baseCondition = getBaseGiftCardConditionForEligibleRefund();
		const data = await GiftCardModel.aggregate([
			{
				$match: {
					_id: {
						$in: giftCards,
					},
					...baseCondition,
				},
			},
			{
				$lookup: {
					from: 'giftcard_templates',
					localField: 'giftcard_template',
					foreignField: '_id',
					as: 'giftcard_template',
					pipeline: [
						{
							$project: {
								_id: 1,
								title: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$giftcard_template',
			},
			{
				$project: {
					_id: 1,
					amount: 1,
					invoice: 1,
					available_amount: 1,
					giftcard_template: 1,
					code: 1,
				},
			},
		]).session(session);

		return data as IGiftCardsForRefundInvoice[];
	} catch (error) {
		throw error;
	}
};

const getOtherEligibleGiftCardsForRefund = async (
	invoice_id: Types.ObjectId,
	giftCards: Types.ObjectId[],
	session: ClientSession | null
) => {
	try {
		const baseCondition = getBaseGiftCardConditionForEligibleRefund();
		const data = await GiftCardModel.aggregate([
			{
				$match: {
					invoice: invoice_id,
					_id: {
						$nin: giftCards,
					},
					...baseCondition,
				},
			},
			{
				$lookup: {
					from: 'giftcard_templates',
					localField: 'giftcard_template',
					foreignField: '_id',
					as: 'giftcard_template',
					pipeline: [
						{
							$project: {
								_id: 1,
								title: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$giftcard_template',
			},
			{
				$project: {
					_id: 1,
					amount: 1,
					invoice: 1,
					available_amount: 1,
					giftcard_template: 1,
					code: 1,
				},
			},
		]).session(session);

		return data as IGiftCardsForRefundInvoice[];
	} catch (error) {
		throw error;
	}
};

const generateInvoiceNumber = async (
	customerInvoice: string | null,
	customerInvoiceId: Types.ObjectId,
	session: ClientSession | null
) => {
	try {
		if (!customerInvoice) {
			throw new Error(
				'Can not generate invoice number for customer invoice with null value'
			);
		}
		const invoice = await RefundInvoiceModel.findOne({
			customer_invoice: customerInvoiceId,
		})
			.sort({
				created_at: -1,
			})
			.session(session)
			.lean();

		let referenceNumber = invoice ? invoice.reference_number + 1 : 1;

		const invoiceNumber = `${customerInvoice.replace(
			'RE',
			'GS'
		)}-${referenceNumber}`;

		return {
			invoiceNumber,
			referenceNumber,
		};
	} catch (error) {
		throw error;
	}
};

const getAllRefundInvoices = async (params: {
	limit: number;
	offset: number;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	shop_id: Types.ObjectId | null;
	search_value?: string;
	column_filters?: { id: string; value: string }[];
}) => {
	try {
		const refundInvoiceConditions: AnyKeyObject = {};
		const searchCondition: AnyKeyObject = { or: [], and: [] };

		if (params.shop_id) {
			refundInvoiceConditions.shop = params.shop_id;
		}

		if (params.column_filters?.length && !params.search_value) {
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'studio_name':
						searchCondition.and.push({
							['shop.studio_name']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'customer_invoice':
						searchCondition.and.push({
							['customer_invoice.invoice_number']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'refund_amount':
						searchCondition.and.push({
							[filter.id]: +filter.value,
						});
						break;
					case 'date':
						searchCondition.and.push({
							[filter.id]: {
								$gte: new Date(filter.value[0]),
								$lte: new Date(filter.value[1]),
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
						invoice_number: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						'shop.studio_name': {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						'customer_invoice.invoice_number': {
							$regex: params.search_value,
							$options: 'i',
						},
					},
				]
			);
			if (!isNaN(+params.search_value)) {
				searchCondition.or.push({
					refund_amount: +params.search_value,
				});
			}
		}

		if (params.sort_by === 'studio_name') {
			params.sort_by = 'shop.studio_name';
		} else if (params.sort_by === 'customer_invoice') {
			params.sort_by = 'customer_invoice.invoice_number';
		}

		const data = await RefundInvoiceModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...refundInvoiceConditions,
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
				$lookup: {
					from: 'invoices',
					localField: 'customer_invoice',
					foreignField: '_id',
					as: 'customer_invoice',
					pipeline: [
						{
							$project: {
								_id: 1,
								invoice_number: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$customer_invoice',
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
					created_at: 0,
					updated_at: 0,
					deleted_at: 0,
					reference_number: 0,
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

		const totalRows = await RefundInvoiceModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...refundInvoiceConditions,
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
				$lookup: {
					from: 'invoices',
					localField: 'customer_invoice',
					foreignField: '_id',
					as: 'customer_invoice',
					pipeline: [
						{
							$project: {
								_id: 1,
								invoice_number: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$customer_invoice',
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

		return {
			rows: data as IRefundInvoices[],
			totalRows: totalRows[0]?.count || 0,
		};
	} catch (error) {
		throw error;
	}
};

const sendInvoiceMail = async (mailData: IRefundInvoiceMail) => {
	try {
		const html = await renderEjsFile(EJS_TEMPLATES.REFUND_EMAIL, mailData);
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [mailData.userEmail],
			subject: `Refund Invoice`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendInvoiceStudioMail = async (mailData: IRefundInvoiceStudioMail) => {
	try {
		const html = await renderEjsFile(
			EJS_TEMPLATES.REFUND_STUDIO_EMAIL,
			mailData
		);
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [mailData.shopEmail],
			subject: `Your order was refunded`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const updateInvoices = async (
	condition: AnyKeyObject,
	updateFields: Partial<RefundInvoiceInput>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await RefundInvoiceModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields,
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const getRefundInvoice = async (shop: AnyKeyObject) => {
	try {
		const shopData = await ShopModel.find({
			_id: shop.shop,
		});
		return shopData;
	} catch (error) {
		throw error;
	}
};

const sendPartialPaymentMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		orderId: string;
		totalAmount: Number;
		receivedAmount: Number | null;
		toPay: Number;
		BankDetails: BankTransferDetails;
	}
) => {
	try {
		console.log('send partial mail has been called::');
		const html = await renderEjsFile(EJS_TEMPLATES.STUDIO_PARTIAL_INFO, {
			receiverName,
			...mailData,
		});
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: ` Partial payment for order ${mailData.orderId}`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log('error::', error);
	}
};
export default {
	create,
	validateCreateRefund,
	getGiftCardsForRefund,
	validateInvoicePdfDataSchema,
	getGiftCardsForRefundInvoice,
	generateInvoiceNumber,
	getOtherEligibleGiftCardsForRefund,
	getAllRefundInvoices,
	sendInvoiceMail,
	sendInvoiceStudioMail,
	updateInvoices,
	getRefundInvoice,
	sendPartialPaymentMail,
};
