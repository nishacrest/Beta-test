import {
	RedeemGiftCardAttributes,
	RedeemGiftCardInput,
	redeemGiftCardUpdateSchema,
} from '../types/redeem_giftcards';
import { AnyKeyObject } from '../types';
import { RedeemGiftCardModel } from '../database/models';
import { ClientSession, Types } from 'mongoose';
import { error } from 'console';
import { renderEjsFile, sendMail } from '../utils/helper';
import { EJS_TEMPLATES } from '../utils/constant';

/**
 * Asynchronously creates a new redeemable gift card using the provided data.
 *
 * @param {RedeemGiftCardInput} redeemData - The data for the gift card to be redeemed.
 * @return {Promise<RedeemGiftCardAttributes[]>} The newly created redeemable gift card.
 */
const createRedeemGiftCard = async (
	redeemData: RedeemGiftCardInput,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const redeemGiftCard: any[] = await RedeemGiftCardModel.create(
			[redeemData],
			{
				session: clientSession,
			}
		);
		return redeemGiftCard[0] as RedeemGiftCardAttributes;
	} catch (error) {
		throw error;
	}
};

const findRedeemGiftCards = async (
	condition: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const redeemGiftCards: RedeemGiftCardAttributes[] =
			await RedeemGiftCardModel.find({
				...condition,
				deleted_at: null,
			})
				.session(clientSession)
				.lean();
		return redeemGiftCards;
	} catch (error) {
		throw error;
	}
};

const updateRedeemGiftCard = async (
	condition: AnyKeyObject,
	updateFields: Partial<RedeemGiftCardInput>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await RedeemGiftCardModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields,
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const getAllRedemptions = async (params: {
	limit: number | null;
	offset: number | null;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	search_value?: string;
	column_filters?: { id: string; value: any }[];
	shop_id?: string | null;
}) => {
	try {
		const redeemConditions: AnyKeyObject = {};
		const searchCondition: AnyKeyObject = { or: [], and: [] };

		if (params.shop_id) {
			redeemConditions['redeemed_shop'] = new Types.ObjectId(params.shop_id);
		}

		if (!params.search_value && params.column_filters?.length) {
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'code':
						searchCondition.and.push({
							'giftcard.code': { $regex: filter.value, $options: 'i' },
						});
						break;
					case 'amount':
						searchCondition.and.push({
							'amount': +filter.value,
						});
						break;
					case 'redeemed_shop':
						searchCondition.and.push({
							['redeemed_shop.studio_name']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'studio_name':
						searchCondition.and.push({
							['giftcard.shop.studio_name']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'redeemed_date':
						searchCondition.and.push({
							[filter.id]: {
								$gte: new Date(filter.value[0]),
								$lte: new Date(filter.value[1]),
							},
						});
					case 'negotiation_invoice':
						searchCondition.and.push({
							['negotiation_invoice.invoice_number']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
				}
			}
		}

		if (params.search_value) {
			searchCondition.or.push({
				'giftcard.code': { $regex: params.search_value, $options: 'i' },
			});
			if (!isNaN(+params.search_value))
				searchCondition.or.push({ amount: +params.search_value });

			searchCondition.or.push({
				'redeemed_shop.studio_name': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'giftcard.shop.studio_name': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'negotiation_invoice.invoice_number': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
		}

		switch (params.sort_by) {
			case 'redeemed_shop':
				params.sort_by = 'redeemed_shop.studio_name';
				break;
			case 'code':
				params.sort_by = 'giftcard.code';
				break;
			case 'studio_name':
				params.sort_by = 'giftcard.shop.studio_name';
				break;
			case 'invoice_number':
				params.sort_by = 'negotiation_invoice.invoice_number';
				break;
		}

		const redemptions = await RedeemGiftCardModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...redeemConditions,
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
								deleted_at: null,
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
										$match: {
											deleted_at: null,
										},
									},
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
							$project: {
								_id: 1,
								code: 1,
								available_amount: 1,
								shop: 1,
							},
						},
					],
				},
			},
			{ $unwind: '$giftcard' },
			{
				$lookup: {
					from: 'shops',
					localField: 'redeemed_shop',
					foreignField: '_id',
					as: 'redeemed_shop',
					pipeline: [
						{
							$match: {
								deleted_at: null,
							},
						},
						{
							$project: {
								_id: 1,
								studio_name: 1,
							},
						},
					],
				},
			},
			{ $unwind: '$redeemed_shop' },
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
				$unwind: {
					path: '$negotiation_invoice',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$match: {
					deleted_at: null,
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
					giftcard: 1,
					amount: 1,
					redeemed_shop: 1,
					redeemed_date: 1,
					comment: 1,
					negotiation_invoice: 1,
				},
			},
			{
				$sort: { [params.sort_by]: params.sort_order === 'asc' ? 1 : -1 },
			},
			...(params.offset !== null ? [{ $skip: params.offset }] : []),
			...(params.limit !== null ? [{ $limit: params.limit }] : []),
		]);

		const totalCount = await RedeemGiftCardModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...redeemConditions,
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
								deleted_at: null,
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
										$match: {
											deleted_at: null,
										},
									},
								],
							},
						},
						{
							$unwind: '$shop',
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
				$unwind: '$redeemed_shop',
			},
			{
				$match: {
					deleted_at: null,
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
			rows: redemptions,
			count: totalCount.length ? totalCount[0].count : 0,
		};
	} catch (error) {
		throw error;
	}
};

const validateRedeemGiftCardUpdate = async (data: any) => {
	try {
		const parsedData = await redeemGiftCardUpdateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const sendStudioRedeemMail = async (mailData: {
	logoUrl: string;
	studioName: string;
	studioEmail: string;
	giftCardCode: string;
	redeemedAmount: string;
	availableAmount: string;
	dashboardUrl: string;
	websiteUrl: string;
}) => {
	try {
		const renderedHtml = await renderEjsFile(EJS_TEMPLATES.STUDIO_REDEEM_MAIL, {
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [mailData.studioEmail],
			subject: `Gift Card Redemption for ${mailData.studioName}`,
			html: renderedHtml,
		};
		await sendMail(mailOptions);
	} catch (error: any) {
		console.log(error.message);
	}
};
const sendAdminRedeemMail = async (mailData: {
	logoUrl: string;
	studioName: string;
	studioEmail: string;
	redeemedAmount: string;
}) => {
	try {
		const renderedHtml = await renderEjsFile(EJS_TEMPLATES.ADMIN_REDEEM_MAIL, {
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [mailData.studioEmail],
			subject: `Admin Gift Card Redemption - ${mailData.studioName}`,
			html: renderedHtml,
		};
		await sendMail(mailOptions);
	} catch (error: any) {
		console.log(error.message);
	}
};

export default {
	createRedeemGiftCard,
	getAllRedemptions,
	findRedeemGiftCards,
	updateRedeemGiftCard,
	validateRedeemGiftCardUpdate,
	sendStudioRedeemMail,
	sendAdminRedeemMail,
};
