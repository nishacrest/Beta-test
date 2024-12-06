import { Request, Response } from 'express';
import { apiResponse } from '../utils/constant';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import mongoose, { ClientSession, Types } from 'mongoose';
import {
	getPagination,
	omitFromObject,
	truncateToDecimals,
} from '../utils/helper';
import redeemGiftCardService from '../services/redeem_giftcards.service';
import giftcardService from '../services/giftcard.service';
import { AnyKeyObject } from '../types';
import shopService from '../services/shop.service';
import { RedeemGiftCardInput } from '../types/redeem_giftcards';
import { UserRoles } from '../types/users';
import { ValidationError } from 'yup';
import userService from '../services/user.service';

/**
 * Retrieves all redemptions based on the provided query parameters.
 *
 * @param {Request} req - The request object containing query parameters.
 * @param {Response} res - The response object to send the redemptions data.
 * @return {Promise<Array<Object>>} - A promise that resolves when the redemptions data is sent.
 * @throws {Error} - If there is an error retrieving the redemptions.
 */
const getAllRedemptions = async (req: Request, res: Response) => {
	try {
		const {
			page,
			size,
			sort_by = 'created_at',
			sort_order = 'desc',
			search_value,
			column_filters,
			file,
		}: {
			page?: string;
			size?: string;
			sort_by?: string;
			sort_order?: 'asc' | 'desc';
			search_value?: string;
			column_filters?: string;
			file?: string;
		} = req.query;

		let { limit, offset } = getPagination(page, size);
		const { loggedUser } = req;

		const parsedColumnFilters: { id: string; value: string }[] = JSON.parse(
			column_filters || '[]'
		);

		const shopId =
			loggedUser.role === UserRoles.ADMIN ? null : loggedUser.shop_id;

		const downloadFile = file === 'csv';
		const data = await redeemGiftCardService.getAllRedemptions({
			limit: downloadFile ? null : limit,
			offset: downloadFile ? null : offset,
			sort_by,
			sort_order,
			search_value,
			column_filters: parsedColumnFilters,
			shop_id: shopId,
		});

		const responseData = {
			redemptions: data.rows,
			total_redemptions: data.count,
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

/**
 * Updates a redemption based on the provided request parameters.
 *
 * @param {Request} req - The request object containing the redemption ID and optional amount and redeemed shop.
 * @param {Response} res - The response object to send the updated redemption data.
 * @return {Promise<{}>} - A promise that resolves when the redemption is updated successfully.
 * @throws {Error} - If there is an error updating the redemption.
 */
const updateRedeemption = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { redeem_id } = req.params;
		const data = await redeemGiftCardService.validateRedeemGiftCardUpdate(
			req.body
		);
		const { amount, redeemed_shop, comment } = data;

		session = await mongoose.startSession();
		session.startTransaction();

		// check if giftcard redemption exists
		const [redeemData] = await redeemGiftCardService.findRedeemGiftCards(
			{
				_id: redeem_id,
			},
			session
		);

		if (!redeemData) {
			return sendErrorResponse(
				res,
				apiResponse.REDEEMPTION_NOT_FOUND.message,
				apiResponse.REDEEMPTION_NOT_FOUND.code,
				session
			);
		}

		const [giftCard] = await giftcardService.findGiftcards(
			{
				_id: redeemData.giftcard,
			},
			session
		);
		if (!giftCard) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_NOT_FOUND.message,
				apiResponse.GIFTCARD_NOT_FOUND.code,
				session
			);
		}

		const [redeemedAtShopData] = await shopService.findShops(
			{
				_id: redeemData.redeemed_shop,
			},
			session
		);
		if (!redeemedAtShopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code,
				session
			);
		}

		const [issuerShopData] = await shopService.findShops(
			{
				_id: redeemData.issuer_shop,
			},
			session
		);
		if (!issuerShopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code,
				session
			);
		}

		const [issuerUserData] = await userService.findUsers(
			{
				_id: issuerShopData.user,
			},
			session
		);
		if (!issuerUserData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND.message,
				apiResponse.USER_NOT_FOUND.code,
				session
			);
		}

		const responseData: AnyKeyObject = {
			available_amount: giftCard.available_amount,
		};
		const updateFields: Partial<RedeemGiftCardInput> = {};
		let platformRedeemFee = redeemedAtShopData.platform_redeem_fee;
		let fixRedeemFee = redeemedAtShopData.fixed_payment_redeem_fee;
		let latestAvailableAmount: number | null = null;

		// check if redeemed amount is updated
		if (amount !== undefined && redeemData.amount !== amount) {
			if (redeemData.negotiation_invoice) {
				return sendErrorResponse(
					res,
					apiResponse.REDEMPTION_AMOUNT_SHOP_WITH_INVOICE_CANNOT_BE_UPDATED
						.message,
					apiResponse.REDEMPTION_AMOUNT_SHOP_WITH_INVOICE_CANNOT_BE_UPDATED
						.code,
					session
				);
			}

			// reset available amount
			const resetAvailableAmount = parseFloat(
				(giftCard.available_amount + redeemData.amount).toFixed(2)
			);

			// check if amount is greater than available amount
			if (amount > resetAvailableAmount) {
				return sendErrorResponse(
					res,
					apiResponse.INTERNAL_SERVER_ERROR.message,
					apiResponse.INTERNAL_SERVER_ERROR.code,
					session
				);
			}

			// get latest available amount and update it
			latestAvailableAmount = parseFloat(
				(resetAvailableAmount - amount).toFixed(2)
			);
			updateFields.amount = amount;

			// update available amount of giftcard
			responseData.available_amount = latestAvailableAmount;
		}

		// check if redeemed shop is updated
		if (
			redeemed_shop &&
			!new Types.ObjectId(redeemed_shop).equals(redeemData.redeemed_shop)
		) {
			if (issuerUserData.role !== UserRoles.ADMIN) {
				return sendErrorResponse(
					res,
					apiResponse.REDEEM_AT_SHOP_UPDATE_ONLY_ON_ADMIN_ISSUED_GIFTCARDS
						.message,
					apiResponse.REDEEM_AT_SHOP_UPDATE_ONLY_ON_ADMIN_ISSUED_GIFTCARDS.code,
					session
				);
			}

			if (redeemData.negotiation_invoice) {
				return sendErrorResponse(
					res,
					apiResponse.REDEMPTION_AMOUNT_SHOP_WITH_INVOICE_CANNOT_BE_UPDATED
						.message,
					apiResponse.REDEMPTION_AMOUNT_SHOP_WITH_INVOICE_CANNOT_BE_UPDATED
						.code,
					session
				);
			}

			// check if updated shop exists
			const [shopData] = await shopService.findShops(
				{ _id: redeemed_shop },
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
			const [userData] = await userService.findUsers(
				{ _id: shopData.user },
				session
			);
			if (!userData) {
				return sendErrorResponse(
					res,
					apiResponse.USER_NOT_FOUND.message,
					apiResponse.USER_NOT_FOUND.code,
					session
				);
			}
			if (userData.role === UserRoles.ADMIN) {
				return sendErrorResponse(
					res,
					apiResponse
						.REDEEM_AT_SHOP_CAN_NOT_BE_ADMIN_STUDIO_ON_ADMIN_ISSUED_GIFTCARDS
						.message,
					apiResponse
						.REDEEM_AT_SHOP_CAN_NOT_BE_ADMIN_STUDIO_ON_ADMIN_ISSUED_GIFTCARDS
						.code,
					session
				);
			}

			platformRedeemFee = shopData.platform_redeem_fee;
			fixRedeemFee = shopData.fixed_payment_redeem_fee;

			// update redeemed shop
			updateFields.redeemed_shop = new Types.ObjectId(redeemed_shop);
		}

		if (typeof comment === 'string' && redeemData.comment !== comment)
			updateFields.comment = comment;

		// update total fees if amount or shop is updated
		if (
			(updateFields.amount !== undefined || updateFields.redeemed_shop) &&
			issuerUserData.role === UserRoles.ADMIN
		) {
			// get amount to calculate fees, if amount is not updated then use current redeemed amount to calculate fees
			if (!platformRedeemFee || !fixRedeemFee) {
				throw new Error('platform redeem fee or fix redeem fee not defined');
			}
			const totalAmount =
				updateFields.amount !== undefined
					? updateFields.amount
					: redeemData.amount;
			const totalFees = (totalAmount * platformRedeemFee) / 100 + fixRedeemFee;
			if (totalFees < totalAmount)
				updateFields.fees = +truncateToDecimals(totalFees, 2);
			else updateFields.fees = 0;
		}

		// update redemption
		await redeemGiftCardService.updateRedeemGiftCard(
			{ _id: redeem_id },
			updateFields,
			session
		);
		if (latestAvailableAmount !== null)
			await giftcardService.updateGiftCard(
				{ _id: giftCard._id },
				{ available_amount: latestAvailableAmount },
				session
			);

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.REDEEMPTION_UPDATED_SUCCESSFULLY.message,
			apiResponse.REDEEMPTION_UPDATED_SUCCESSFULLY.code,
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

export default { getAllRedemptions, updateRedeemption };
