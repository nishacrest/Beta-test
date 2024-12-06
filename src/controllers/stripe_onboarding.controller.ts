import { Request, Response } from 'express';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import { stripe } from '../utils/stripe.helper';
import { apiResponse } from '../utils/constant';
import shopService from '../services/shop.service';
import { StripeOnboardingStatus } from '../types/shops';

const createStripeAccountLink = async (req: Request, res: Response) => {
	try {
		const { account_id }: { account_id?: string } = req.body;

		// const account = await stripe.accounts.create({
		// 	type: 'express',
		// });

		// console.dir(account, { depth: null });

		if (!account_id) {
			return sendErrorResponse(
				res,
				'all fields are required [account_id]',
				422
			);
		}

		// const account = await stripe.accounts.retrieve('acct_1PL1bV2NIc3bfEQV');
		// console.dir(account, { depth: null });

		// throw new Error('Not Implemented');

		const accountLink = await stripe.accountLinks.create({
			account: account_id,
			type: 'account_onboarding',
			return_url: `${process.env.FE_DOMAIN}/stripe-onboarding/${account_id}/complete`,
			refresh_url: `${process.env.FE_DOMAIN}/stripe-onboarding/${account_id}/refresh`,
			collection_options: {
				fields: 'eventually_due',
			},
		});

		return sendSuccessResponse(
			res,
			accountLink,
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
		);
		// res.redirect(accountLink.url);
	} catch (error: any) {
		console.log(error);
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const createExpressLoginLink = async (req: Request, res: Response) => {
	try {
		const { account_id }: { account_id?: string } = req.body;

		if (!account_id) {
			return sendErrorResponse(
				res,
				'all fields are required [account_id]',
				422
			);
		}

		const data = await stripe.accounts.createLoginLink(account_id);

		const responseData = {
			url: data.url,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const redirectOnboardingSuccess = async (req: Request, res: Response) => {
	try {
		const { id } = req.query;
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const redirectOnboardingFailure = async (req: Request, res: Response) => {
	try {
		const { id } = req.query;
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const checkAccountOnboarding = async (req: Request, res: Response) => {
	try {
		const { account_id } = req.body;

		if (!account_id) {
			return sendErrorResponse(
				res,
				'all fields are required [account_id]',
				422
			);
		}

		const [shop] = await shopService.findShops({
			stripe_account: account_id,
		});

		if (!shop) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		if (
			shop.stripe_account &&
			shop.stripe_onboarding_status !== StripeOnboardingStatus.COMPLETED
		) {
			const account = await stripe.accounts.retrieve(shop.stripe_account);

			if (
				account.charges_enabled &&
				account.payouts_enabled &&
				account.requirements?.currently_due?.length === 0 &&
				account.requirements?.disabled_reason === null
			) {
				if (account.requirements.eventually_due?.length) {
					await shopService.updateShop(
						{ stripe_account: account.id },
						{
							stripe_onboarding_status: StripeOnboardingStatus.PARTIAL,
						}
					);
				} else {
					await shopService.updateShop(
						{ stripe_account: account.id },
						{ stripe_onboarding_status: StripeOnboardingStatus.COMPLETED }
					);
				}
			}
		}

		sendSuccessResponse(
			res,
			{},
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
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
	createStripeAccountLink,
	createExpressLoginLink,
	checkAccountOnboarding,
};
