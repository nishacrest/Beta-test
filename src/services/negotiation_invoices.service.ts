import {
	RedeemGiftCardModel,
	ShopModel,
	NegotiationInvoiceModel,
} from '../database/models';
import { ClientSession, PipelineStage, Types } from 'mongoose';
import { renderEjsFile, sendMail, truncateToDecimals } from '../utils/helper';
import {
	AnyKeyObject,
	INegotiationInvoiceRedemptions,
	INegotiationInvoices,
} from '../types';
import {
	INegotiationInvoiceMail,
	NegotiationInvoiceAttributes,
	NegotiationInvoiceCreateSchema,
	NegotiationInvoiceInput,
} from '../types/negotiation_invoices';
import { GiftCardMode } from '../types/giftcards';
import { EJS_TEMPLATES } from '../utils/constant';

const create = async (
	fields: NegotiationInvoiceInput,
	session: ClientSession | null
) => {
	try {
		const invoice: any[] = await NegotiationInvoiceModel.create([fields], {
			session,
		});
		return invoice[0] as NegotiationInvoiceAttributes;
	} catch (error) {
		throw error;
	}
};

const getAllNegotiationInvoiceQuery = (params: {
	start_date: string;
	end_date: string;
	admin_shop: Types.ObjectId;
	searchCondition: { or: AnyKeyObject[]; and: AnyKeyObject[] };
}) => {
	const pipeline: PipelineStage[] = [
		{
			$match: {
				redeemed_date: {
					$gte: new Date(params.start_date),
					$lte: new Date(params.end_date),
				},
				deleted_at: null,
			},
		},
		{
			$lookup: {
				from: 'giftcards',
				localField: 'giftcard',
				foreignField: '_id',
				as: 'giftcard',
				pipeline: [
					{
						$match: {
							shop: params.admin_shop,
							deleted_at: null,
							giftcard_mode: GiftCardMode.LIVE,
						},
					},
				],
			},
		},
		{
			$unwind: '$giftcard',
		},
		{
			$lookup: {
				from: 'shops',
				localField: 'redeemed_shop',
				foreignField: '_id',
				as: 'redeemed_shop',
			},
		},
		{
			$unwind: '$redeemed_shop',
		},
		{
			$lookup: {
				from: 'negotiation_invoices',
				localField: 'negotiation_invoice',
				foreignField: '_id',
				as: 'negotiation_invoice',
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
				path: '$negotiation_invoice',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$group: {
				_id: {
					shop: '$redeemed_shop._id',
					negotiation_invoice: '$negotiation_invoice._id',
				},
				total_amount: {
					$sum: '$amount',
				},
				total_fees: {
					$sum: '$fees',
				},
				studio_name: { $first: '$redeemed_shop.studio_name' },
				iban: { $first: '$redeemed_shop.iban' },
				invoice_number: { $first: '$negotiation_invoice.invoice_number' },
				pdf_url: { $first: '$negotiation_invoice.pdf_url' },
				invoice_iban: { $first: '$negotiation_invoice.iban' },
				invoice_date: { $first: '$negotiation_invoice.date' },
			},
		},
		{
			$project: {
				_id: 1,
				total_amount: 1,
				total_fees: 1,
				studio_name: 1,
				iban: 1,
				invoice_number: 1,
				pdf_url: 1,
				invoice_iban: 1,
				invoice_date: 1,
			},
		},
		{
			$match: {
				...(params.searchCondition.or.length
					? { $or: params.searchCondition.or }
					: {}),
				...(params.searchCondition.and.length
					? {
							$and: params.searchCondition.and,
					  }
					: {}),
			},
		},
	];

	return pipeline;
};

const getAllNegotiationInvoices = async (params: {
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
		const searchCondition: { or: AnyKeyObject[]; and: AnyKeyObject[] } = {
			or: [],
			and: [],
		};
		if (params.column_filters?.length && !params.search_value) {
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'iban':
						{
							searchCondition.and.push({
								'iban': {
									$regex: filter.value,
									$options: 'i',
								},
							});
							searchCondition.and.push({
								'invoice_iban': {
									$regex: filter.value,
									$options: 'i',
								},
							});
						}
						break;
					case 'total_amount':
					case 'total_fees':
					case 'total_payout':
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
						iban: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						invoice_iban: {
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
				searchCondition.or.push({
					total_payout: +params.search_value,
				});
			}
		}

		const queryStage = getAllNegotiationInvoiceQuery({
			start_date: params.start_date,
			end_date: params.end_date,
			searchCondition: searchCondition,
			admin_shop: params.admin_shop,
		});
		const data = await RedeemGiftCardModel.aggregate([
			...queryStage,
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

		const totalCount = await RedeemGiftCardModel.aggregate([
			...queryStage,
			{
				$count: 'count',
			},
		]);

		const formattedData: INegotiationInvoices[] = [];
		for (let item of data) {
			const totalAmount = +truncateToDecimals(item.total_amount, 2);
			const totalFees = +truncateToDecimals(item.total_fees, 2);
			const totalPayout = +truncateToDecimals(totalAmount - totalFees, 2);

			formattedData.push({
				shop_id: item._id.shop,
				studio_name: item.studio_name,
				total_amount: totalAmount,
				total_fees: totalFees,
				total_payout: totalPayout,
				iban: item.iban,
				invoice_number: item.invoice_number,
				pdf_url: item.pdf_url,
				invoice_iban: item.invoice_iban,
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

const getAllNegotiationInvoicesForShopUser = async (params: {
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
		const searchCondition: AnyKeyObject = {
			and: [],
			or: [],
		};
		if (params.column_filters?.length && !params.search_value) {
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'total_amount':
						searchCondition.and.push({
							['redeemed_amount']: +filter.value,
						});
						break;
					case 'total_fees':
						searchCondition.and.push({
							['fee_amount']: +filter.value,
						});
						break;
					case 'total_payout':
						searchCondition.and.push({
							['payout_amount']: +filter.value,
						});
						break;
					case 'studio_name':
						searchCondition.and.push({
							['shop.studio_name']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
					case 'iban':
						searchCondition.and.push({
							['invoice_iban']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
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
						'shop.studio_name': {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						'invoice_iban': {
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
					redeemed_amount: +params.search_value,
				});
				searchCondition.or.push({
					fee_amount: +params.search_value,
				});
				searchCondition.or.push({
					payout_amount: +params.search_value,
				});
			}
		}
		if (params.sort_by) {
			switch (params.sort_by) {
				case 'total_amount':
					params.sort_by = 'redeemed_amount';
					break;
				case 'total_fees':
					params.sort_by = 'fee_amount';
					break;
				case 'total_payout':
					params.sort_by = 'payout_amount';
					break;
				case 'studio_name':
					params.sort_by = 'shop.studio_name';
					break;
				case 'iban':
					params.sort_by = 'invoice_iban';
					break;
				case 'invoice_date':
					params.sort_by = 'date';
					break;
				default:
					break;
			}
		}

		const data = await NegotiationInvoiceModel.aggregate([
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
								iban: 1,
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
			{
				$project: {
					_id: 1,
					date: 1,
					pdf_url: 1,
					invoice_number: 1,
					shop: 1,
					redeemed_amount: 1,
					fee_amount: 1,
					payout_amount: 1,
					iban: 1,
				},
			},
		]);

		const totalCount = await NegotiationInvoiceModel.aggregate([
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
								iban: 1,
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

		const formattedData: INegotiationInvoices[] = [];
		for (let item of data) {
			formattedData.push({
				shop_id: item.shop._id,
				studio_name: item.shop.studio_name,
				total_amount: item.redeemed_amount,
				total_fees: item.fee_amount,
				total_payout: item.payout_amount,
				iban: item.shop.iban,
				invoice_number: item.invoice_number,
				pdf_url: item.pdf_url,
				invoice_iban: item.iban,
				invoice_date: item.date,
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

const getRedemptionsOfInvoice = async (
	params: {
		start_date: string;
		end_date: string;
		admin_shop: Types.ObjectId;
		shop_id: Types.ObjectId;
	},
	session: ClientSession | null
) => {
	try {
		const data = await RedeemGiftCardModel.aggregate([
			{
				$match: {
					redeemed_date: {
						$gte: new Date(params.start_date),
						$lte: new Date(params.end_date),
					},
					redeemed_shop: params.shop_id,
					negotiation_invoice: null,
					deleted_at: null,
				},
			},
			{
				$lookup: {
					from: 'giftcards',
					localField: 'giftcard',
					foreignField: '_id',
					as: 'giftcard',
					pipeline: [
						{
							$match: {
								shop: params.admin_shop,
								// deleted_at: null,
								giftcard_mode: GiftCardMode.LIVE,
							},
						},
						{
							$project: {
								_id: 1,
								code: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$giftcard',
			},
			{
				$sort: { 'redeemed_date': -1 },
			},
			{
				$project: {
					redeemed_date: 1,
					giftcard: 1,
					amount: 1,
					fees: 1,
				},
			},
		]).session(session);
		const formattedData: INegotiationInvoiceRedemptions[] = [];
		let totalAmount = 0;
		let totalFees = 0;
		let totalPayout = 0;
		for (let item of data) {
			const payout = +truncateToDecimals(item.amount - item.fees, 2);
			formattedData.push({
				...item,
				payout,
			});

			totalAmount += item.amount;
			totalFees += item.fees;
			totalPayout += payout;
		}

		const response = {
			redemptions: formattedData,
			totalAmount: +truncateToDecimals(totalAmount, 2),
			totalFees: +truncateToDecimals(totalFees, 2),
			totalPayout: +truncateToDecimals(totalPayout, 2),
		};
		return response;
	} catch (error) {
		throw error;
	}
};
const validateInvoiceUpdate = async (data: any) => {
	try {
		const parsedData = await NegotiationInvoiceCreateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const sendInvoiceMail = async (mailData: INegotiationInvoiceMail) => {
	try {
		const html = await renderEjsFile(
			EJS_TEMPLATES.NEGOTIATION_INVOICE_MAIL,
			mailData
		);

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [mailData.shopEmail],
			subject: `Your payout-invoice for redeemed Universal-Giftcards`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

export default {
	create,
	getAllNegotiationInvoices,
	getAllNegotiationInvoicesForShopUser,
	getRedemptionsOfInvoice,
	validateInvoiceUpdate,
	sendInvoiceMail,
};
