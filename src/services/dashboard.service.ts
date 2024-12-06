import { GiftCardModel, RedeemGiftCardModel } from '../database/models';
import { Types } from 'mongoose';
import { GiftCardMode, GiftCardStatus } from '../types/giftcards';
import { StudioMode } from '../types/shops';

const getMonthWiseData = async (
	shop_id: string,
	isAdmin: boolean,
	year: number,
	studioMode: StudioMode
) => {
	try {
		const purchaseData = await GiftCardModel.aggregate([
			{
				$match: {
					deleted_at: null,
					shop: new Types.ObjectId(shop_id),
					$expr: {
						$eq: [{ $year: '$purchase_date' }, year],
					},
					giftcard_mode: studioMode,
					status: {
						$ne: GiftCardStatus.PENDING_PAYMENT,
					},
				},
			},
			{
				$group: {
					_id: {
						year: { $year: '$purchase_date' },
						month: { $month: '$purchase_date' },
					},
					total_amount: {
						$sum: '$amount',
					},
					total_refund_amount: {
						$sum: '$refunded_amount',
					},
				},
			},
			{
				$project: {
					_id: 0,
					total_amount: {
						$subtract: ['$total_amount', '$total_refund_amount'],
					},
					total_refund_amount: 1,
					year: '$_id.year',
					month: '$_id.month',
				},
			},
		]);
		const redeemData = await RedeemGiftCardModel.aggregate([
			{
				$match: {
					deleted_at: null,
					$expr: {
						$eq: [{ $year: '$redeemed_date' }, year],
					},
					...(isAdmin ? {} : { redeemed_shop: new Types.ObjectId(shop_id) }),
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
								giftcard_mode: studioMode,
								status: {
									$ne: GiftCardStatus.PENDING_PAYMENT,
								},
							},
						},
					],
				},
			},
			{
				$unwind: '$giftcard',
			},
			{
				$group: {
					_id: {
						year: { $year: '$redeemed_date' },
						month: { $month: '$redeemed_date' },
					},
					total_amount: {
						$sum: {
							$cond: {
								if: {
									$eq: ['$giftcard.shop', new Types.ObjectId(shop_id)],
								},
								then: '$amount',
								else: 0,
							},
						},
					},
					...(isAdmin
						? {}
						: {
								total_admin_amount: {
									$sum: {
										$cond: {
											if: {
												$ne: ['$giftcard.shop', new Types.ObjectId(shop_id)],
											},
											then: '$amount',
											else: 0,
										},
									},
								},
						  }),
				},
			},
			{
				$project: {
					_id: 0,
					total_amount: 1,
					total_admin_amount: 1,
					year: '$_id.year',
					month: '$_id.month',
				},
			},
		]);

		const monthWiseData = [];
		for (let i = 1; i <= 12; i++) {
			const purchaseAmount = purchaseData.find((data) => data.month === i);
			const redeemAmount = redeemData.find((data) => data.month === i);

			monthWiseData.push({
				month: i,
				purchased_amount: purchaseAmount?.total_amount || 0,
				redeemed_amount: redeemAmount?.total_amount || 0,
				...(isAdmin
					? {}
					: { admin_redeemed_amount: redeemAmount?.total_admin_amount || 0 }),
			});
		}
		return monthWiseData;
	} catch (error) {
		throw error;
	}
};
const getData = async (
	shop_id: string,
	start_date: string,
	end_date: string,
	studioMode: StudioMode
) => {
	try {
		const chartData = await GiftCardModel.aggregate([
			{
				$match: {
					deleted_at: null,
					shop: new Types.ObjectId(shop_id),
					purchase_date: {
						$gte: new Date(start_date),
						$lt: new Date(end_date),
					},
					giftcard_mode: studioMode,
					status: {
						$ne: GiftCardStatus.PENDING_PAYMENT,
					},
				},
			},
			{
				$group: {
					_id: '$shop',
					total_amount: {
						$sum: '$amount',
					},
					total_available_amount: {
						$sum: '$available_amount',
					},
					total_refund_amount: {
						$sum: '$refunded_amount',
					},
				},
			},
			{
				$project: {
					total_amount: {
						$subtract: ['$total_amount', '$total_refund_amount'],
					},
					total_available_amount: 1,
				},
			},
		]);

		const actualData = {
			total: {
				amount: chartData[0]?.total_amount || 0,
				available: chartData[0]?.total_available_amount || 0,
				redeemed:
					chartData[0]?.total_amount - chartData[0]?.total_available_amount ||
					0,
			},
		};

		return actualData;
	} catch (error) {
		throw error;
	}
};

export default { getData, getMonthWiseData };
