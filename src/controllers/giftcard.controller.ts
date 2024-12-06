import { Request, Response } from 'express';
import { apiResponse, BASE_DOMAIN } from '../utils/constant';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import giftcardService from '../services/giftcard.service';
import mongoose, { ClientSession, Schema, Types } from 'mongoose';
import shopService from '../services/shop.service';
import customerService from '../services/customer.service';
import giftcardTemplateService from '../services/giftcard_template.service';
import {
	formatGiftCardCode,
	getNumberInLocalFormat,
	getPagination,
	omitFromObject,
	truncateToDecimals,
} from '../utils/helper';
import redeemGiftCardService from '../services/redeem_giftcards.service';
import {
	GiftCardInput,
	GiftCardMode,
	GiftCardStatus,
} from '../types/giftcards';
import { stripe } from '../utils/stripe.helper';
import {
	InvoiceMode,
	InvoiceOrderStatus,
	InvoiceTransactioStatus,
	PaymentTypes,
} from '../types/invoices';
import { WebhookLogModel, InvoiceModel } from '../database/models';
import { ValidationError } from 'yup';
import taxTypeService from '../services/tax_type.service';
import { UserRoles } from '../types/users';
import userService from '../services/user.service';
import { StudioMode } from '../types/shops';
import Stripe from 'stripe';
import InvoiceService from '../services/invoice.service';
import userSettingsService from '../services/user_settings.service';
import Mailchecker from 'mailchecker';

/**
 * Purchases giftcards based on the provided cart data and shop information.
 *
 * @param {Request} req - The request object containing the cart data and shop information.
 * @param {Response} res - The response object used to send the response.
 * @return {Promise<string[]>} - A promise that resolves when the giftcards are purchased successfully or rejects with an error message.
 */

export const purchaseGiftcards = async (req: Request, res: Response) => {
	let clientSession: ClientSession | null = null;
	try {
		const data = await giftcardService.validateGiftCardPurchase(req.body);
		const { cart, shop_id, email } = data;

		// Validate the email using mailchecker
		const isEmailValid = Mailchecker.isValid(email);
		if (!isEmailValid) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_EMAIL_FORMAT.message,
				apiResponse.INVALID_EMAIL_FORMAT.code
			);
		}
		const emailValidationResponse = {
			is_valid: true,
		};
		clientSession = await mongoose.startSession();
		clientSession.startTransaction();

		// check if shop exists
		const [shopData] = await shopService.findShops(
			{ _id: shop_id },
			clientSession
		);
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code,
				clientSession
			);
		}
		const isLiveMode = shopData?.studio_mode === StudioMode.LIVE;
		const studioId = shopData.studio_id;
		// const studioId: string = studioIdFromShop.toString();
		// get shop user data
		const [userData] = await userService.findUsers(
			{ _id: shopData.user },
			clientSession
		);
		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND.message,
				apiResponse.USER_NOT_FOUND.code,
				clientSession
			);
		}

		// get tax type details of shop
		const [taxTypeData] = await taxTypeService.findTaxTypes(
			{
				_id: shopData.tax_type,
			},
			clientSession
		);

		// Get unique template ids
		const templateIds = Array.from(
			new Set(cart.map((giftcard) => giftcard.template_id))
		);
		// Get giftcard templates
		const templatesData = await giftcardTemplateService.findGiftcardTemplates(
			{
				_id: { $in: templateIds },
			},
			clientSession
		);

		// Calculate a valid till date for each giftcard
		const giftcardsFields = [];
		// const priceData = [];
		let totalCartAmount = 0;
		const purchase_date = new Date();
		const validtill_date = new Date();
		validtill_date.setFullYear(purchase_date.getFullYear() + 3);
		validtill_date.setMonth(11);
		validtill_date.setDate(31);

		// type TaxBehaviour = 'exclusive' | 'inclusive' | 'unspecified';
		// Create giftcards from cart data
		let totalGiftCards = 0;
		for (let giftCard of cart) {
			for (let i = 1; i <= giftCard.quantity; i++) {
				totalGiftCards++;
			}
		}
		const giftCardCodes = await giftcardService.getUniqueGiftCardCodes(
			totalGiftCards,
			clientSession
		);
		let codeIndex = 0;
		for (let giftcard of cart) {
			totalCartAmount += giftcard.amount * giftcard.quantity;
			if (giftcard.quantity > 0 && giftCardCodes[codeIndex]) {
				const template = templatesData.find(
					(template) => template._id.toString() === giftcard.template_id
				);
				if (!template) {
					throw new Error('Template not found');
				}
				// priceData.push({
				// 	price_data: {
				// 		currency: 'eur',
				// 		product_data: {
				// 			name: template.title,
				// 			description: `Gutschein: ${template.title}`,
				// 			images: [template.image_url],
				// 		},
				// 		unit_amount: giftcard.amount * 100,
				// 		// tax_behavior: 'exclusive' as TaxBehaviour,
				// 	},
				// 	quantity: giftcard.quantity,
				// 	// tax_rates: [taxTypeData.stripe_id as string],
				// });

				for (let i = 1; i <= giftcard.quantity; i++) {
					giftcardsFields.push({
						user: email,
						code: giftCardCodes[codeIndex],
						pin: giftcardService.generatePin(),
						incorrect_pin_count: 0,
						shop: shopData._id,
						giftcard_template: new Types.ObjectId(giftcard.template_id),
						message: giftcard.message || null,
						amount: giftcard.amount,
						available_amount: giftcard.amount,
						purchase_date: purchase_date,
						validtill_date: validtill_date,
						status: GiftCardStatus.PENDING_PAYMENT,
						giftcard_mode: isLiveMode ? GiftCardMode.LIVE : GiftCardMode.DEMO,
						pdf_url: null,
						deleted_at: null,
						comment: null,
						refunded_amount: 0,
						refund_invoice: null,
						blocked_until: null,
						last_incorrect_pin: null,
					});
					codeIndex++;
				}
			}
		}

		if (!totalCartAmount) {
			return sendErrorResponse(
				res,
				'No giftcards to purchase',
				422,
				clientSession
			);
		}

		const platformFeePercent = shopData.platform_fee;
		// const totalTransferAmount = Math.floor(
		// 	((100 - platformFee) * totalCartAmount) / 100
		// );
		if (!platformFeePercent || !shopData.fixed_payment_fee) {
			throw new Error('platform percent fee or fixed payment fee not defined');
		}

		const totalPlatformFee = parseFloat(
			((platformFeePercent * totalCartAmount) / 100).toFixed(2)
		);
		const totalApplicationFee = parseFloat(
			(totalPlatformFee + shopData.fixed_payment_fee).toFixed(2)
		);

		if (totalApplicationFee >= totalCartAmount) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_PURCHASE_FEE_AMOUNT_EXCEEDED.message,
				apiResponse.GIFTCARD_PURCHASE_FEE_AMOUNT_EXCEEDED.code,
				clientSession
			);
		}
		const rawTaxAmount =
			totalCartAmount - totalCartAmount / (1 + taxTypeData.percentage / 100);
		const totalTaxAmount = parseFloat(truncateToDecimals(rawTaxAmount, 2));
		const totalNetAmount = parseFloat(
			truncateToDecimals(totalCartAmount - totalTaxAmount, 2)
		);
		// const referenceNumber = shopData.invoice_reference_number + 1;
		// const invoiceNumber = `RE-${
		// 	shopData.studio_id
		// }-${new Date().getFullYear()}${referenceNumber}`;

		console.log(totalPlatformFee, totalApplicationFee);

		const invoice = new InvoiceModel({
			payment_id: null,
			pdf_url: null,
			transaction_status: isLiveMode
				? InvoiceTransactioStatus.PENDING
				: InvoiceTransactioStatus.COMPLETED,
			order_status: isLiveMode
				? InvoiceOrderStatus.PENDING
				: InvoiceOrderStatus.IN_PROGRESS,
			invoice_mode: isLiveMode ? InvoiceMode.LIVE : InvoiceMode.DEMO,
			email: email,
			fullname: isLiveMode ? null : 'Demo user',
			deleted_at: null,
			session_id: null,
			address: null,
			tax_type: shopData.tax_type,
			tax_amount: totalTaxAmount,
			net_amount: totalNetAmount,
			total_amount: totalCartAmount,
			payment_method: null,
			invoice_number: null,
			date: new Date(),
			shop: shopData._id,
			comment: null,
			fees: userData.role === UserRoles.ADMIN ? 0 : totalApplicationFee,
			payment_invoice: null,
			refunded_amount: 0,
			payment_type:
				userData.role === UserRoles.ADMIN ? null : PaymentTypes.DIRECT,
		});
		let customerId: string;
		const existingCustomer = await customerService.findCustomer(
			email,
			new Types.ObjectId(shop_id)
		);
		if (existingCustomer) {
			customerId = existingCustomer.stripe_customer_id;
		} else {
			customerId = await customerService.createCustomer(
				email,
				new Types.ObjectId(shop_id),
				shopData.stripe_account || undefined
			);
		}
		let paymentIntent;

		if (isLiveMode) {
			if (!customerId) {
				throw new Error('Customer ID is not defined');
			}
			paymentIntent = await stripe.paymentIntents.create(
				{
					amount: totalCartAmount * 100,
					currency: 'eur',
					customer: customerId,
					// customer_email: email,

					payment_method_types: ['card', 'paypal', 'customer_balance'],
					// automatic_payment_methods: {
					// 	enabled: true,
					// },
					payment_method_options: {
						customer_balance: {
							funding_type: 'bank_transfer',
							bank_transfer: {
								type: 'eu_bank_transfer',
								eu_bank_transfer: {
									country: 'DE',
								},
							},
						},
					},
					...(shopData.stripe_account
						? {
								application_fee_amount: Math.floor(100 * totalApplicationFee),
						  }
						: {}),
				},
				{
					stripeAccount: shopData.stripe_account ?? undefined,
				}
			);
			invoice.payment_id = paymentIntent.id;
		}
		await invoice.save({ session: clientSession });

		// console.dir(priceData, { depth: null });
		// console.dir(session, { depth: null });
		// throw new Error('No giftcards to purchase');

		const giftCardFieldsWithInvoice = giftcardsFields.map((giftcard) => {
			return {
				...giftcard,
				invoice: invoice._id,
			};
		});

		// Add giftcards to database
		const giftCardData = await giftcardService.createGiftcards(
			giftCardFieldsWithInvoice,
			clientSession
		);
		// await shopService.updateShop(
		// 	{
		// 		_id: shopData._id,
		// 	},
		// 	{ invoice_reference_number: referenceNumber },
		// 	clientSession
		// );

		// Get data for creating a pdf
		// const requiredDataForPdf = [];
		// for (let giftcard of giftCardData) {
		// 	const image_url =
		// 		templatesData.find(
		// 			(template) =>
		// 				template._id.toString() === giftcard.giftcard_template.toString()
		// 		)?.image_url || 'url';
		// 	const logo_url = shopData.logo_url || 'url';
		// 	requiredDataForPdf.push({
		// 		_id: giftcard._id,
		// 		code: giftcard.code,
		// 		pin: giftcard.pin,
		// 		amount: giftcard.amount,
		// 		message: giftcard.message,
		// 		image_url,
		// 		logo_url,
		// 		standard_text: shopData.standard_text,
		// 	});
		// }

		// const giftcardLocations = await giftcardService.createPdfForGiftcards(
		// 	requiredDataForPdf,
		// 	email
		// );

		const responseData = {
			// url: session ? session.url : successUrl,
			client_secret: paymentIntent?.client_secret,
			invoice_id: invoice._id,
			customerId: customerId,
			is_valid: emailValidationResponse.is_valid,
		};
		await sendSuccessResponse(
			res,
			responseData,
			'Giftcards created successfully',
			200,
			clientSession
		);
		if (!isLiveMode) {
			giftcardService.fullFillOrder(invoice._id.toString(), email, 'Demo user');
		}
	} catch (error: any) {
		console.log(error.message);
		if (error instanceof ValidationError) {
			return sendErrorResponse(res, error.message, 422, clientSession);
		}
		return sendErrorResponse(res, error.message, 500, clientSession);
	}
};


export const updateCustomerEmailHandler = async (
	req: Request,
	res: Response
) => {
	const { invoice_id, customerId, newEmail } = req.body;

	try {
		const oldEmail = await customerService.findCustomerByStripeId(customerId);

		if (!oldEmail) {
			return res.status(404).send({ message: 'Customer not found.' });
		}

		// Update email in the system
		await customerService.updateCustomerEmail({
			customerId,
			newEmail,
			currentEmail: oldEmail,
		});
		// Update dependencies
		await Promise.all([
			giftcardService.updateGiftCard(
				{ invoice: invoice_id },
				{ user: newEmail }
			),
			InvoiceService.updateInvoices(
				{ _id: invoice_id },
				{ email: newEmail },
				null
			),
			// stripe.customers.update(customerId, { email: newEmail }),
		]);

		await sendSuccessResponse(
			res,
			{ newEmail },
			apiResponse.EMAIL_UPDATE_SUCCESSFUL.message,
			apiResponse.EMAIL_UPDATE_SUCCESSFUL.code
		);
	} catch (error: any) {
		res.status(500).send({ message: error.message });
	}
};

const formatDate = (date: Date) => {
	const formattedDate = new Date(date).toLocaleDateString('en-GB', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});
	return formattedDate;
};

/**
 * Checks the validity of a gift card code.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @return {Promise<object>} Returns a promise that resolves when the gift card code is checked.
 */
export const checkGiftCardCode = async (req: Request, res: Response) => {
	try {
		const { code } = req.params;

		// check if giftcard exists
		const [giftCardData] = await giftcardService.findGiftcards({ code });
		if (!giftCardData) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_NOT_FOUND.message,
				apiResponse.GIFTCARD_NOT_FOUND.code
			);
		}

		const [shopData] = await shopService.findShops({
			_id: giftCardData.shop,
		});

		if (
			giftCardData.giftcard_mode === GiftCardMode.DEMO &&
			shopData.studio_mode === StudioMode.LIVE
		) {
			return sendErrorResponse(
				res,
				apiResponse.DEMO_GIFTCARD_CANNOT_BE_REDEEMED_IN_LIVE_MODE.message,
				apiResponse.DEMO_GIFTCARD_CANNOT_BE_REDEEMED_IN_LIVE_MODE.code
			);
		}
		if (
			giftCardData.giftcard_mode === GiftCardMode.LIVE &&
			shopData.studio_mode === StudioMode.DEMO
		) {
			return sendErrorResponse(
				res,
				apiResponse.LIVE_GIFTCARD_CANNOT_BE_REDEEMED_IN_DEMO_MODE.message,
				apiResponse.LIVE_GIFTCARD_CANNOT_BE_REDEEMED_IN_DEMO_MODE.code
			);
		}
		if (giftCardData.validtill_date.getTime() < new Date().getTime()) {
			// check if giftcard is expired
			const message = `${apiResponse.GIFTCARD_EXPIRED.message} ${formatDate(
				giftCardData.validtill_date
			)}`;

			// Update giftcard status to expired
			await giftcardService.updateGiftCard(
				{ _id: giftCardData._id },
				{ status: GiftCardStatus.EXPIRED }
			);
			return sendErrorResponse(res, message, 422);
		}

		let message = '';
		// send error response if giftcard is not active
		switch (giftCardData.status) {
			case GiftCardStatus.INACTIVE:
				message = apiResponse.GIFTCARD_INACTIVE.message;
				break;
			case GiftCardStatus.BLOCKED:
				message = apiResponse.GIFTCARD_BLOCKED.message;
				break;
			case GiftCardStatus.PENDING_PAYMENT:
				message = apiResponse.GIFTCARD_PAYMENT_PENDING.message;
				break;
			case GiftCardStatus.EXPIRED:
				message = `${apiResponse.GIFTCARD_EXPIRED.message} ${formatDate(
					giftCardData.validtill_date
				)}`;
				break;
			case GiftCardStatus.REFUNDED:
				message = apiResponse.GIFTCARD_REFUNDED.message;
				break;
		}
		if (message) {
			return sendErrorResponse(res, message, 422);
		}

		const [shopUserData] = await userService.findUsers({
			_id: shopData.user,
		});

		const omitFields = [
			'created_at',
			'updated_at',
			'deleted_at',
			'pin',
			'message',
			'user',
			'shop',
			'giftcard_template',
		];
		const shopOmitFields = [
			'standard_text',
			'created_at',
			'updated_at',
			'deleted_at',
		];

		// omit fields from giftcard data
		const omitedGiftCardData = omitFromObject(giftCardData, omitFields);
		const omitedShopData = omitFromObject(shopData, shopOmitFields);

		const responseData = {
			giftcard: omitedGiftCardData,
			shop: {
				...omitedShopData,
				user: {
					_id: shopUserData._id,
					email: shopUserData.email,
					role: shopUserData.role,
				},
			},
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.GIFTCARD_FOUND_SUCCESSFUL.message,
			apiResponse.GIFTCARD_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

/**
 * Redeems a gift card with the specified amount and shop ID.
 *
 * @param {Request} req - The request object containing the giftcard ID, amount, shop ID, and pin.
 * @param {Response} res - The response object.
 * @return {Promise<object>} Returns a promise that resolves when the gift card is redeemed successfully, or rejects with an error message.
 */
const redeemGiftCard = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { giftcard_id } = req.params;
		// const {
		// 	amount,
		// 	shop_id,
		// 	pin,
		// }: {
		// 	amount: number;
		// 	shop_id: string;
		// 	pin: string;
		// } = req.body;

		const data = await giftcardService.validateGiftCardRedeem(req.body);
		const { amount, shop_id, pin } = data;

		session = await mongoose.startSession();
		session.startTransaction();

		// check if giftcard exists
		const [giftCardData] = await giftcardService.findGiftcards(
			{
				_id: giftcard_id,
			},
			session
		);
		if (!giftCardData) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_NOT_FOUND.message,
				apiResponse.GIFTCARD_NOT_FOUND.code,
				session
			);
		}

		const [issuerShopData] = await shopService.findShops(
			{
				_id: giftCardData.shop,
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

		const [redeemAtShopData] = await shopService.findShops(
			{
				_id: shop_id,
			},
			session
		);
		if (!redeemAtShopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code,
				session
			);
		}

		const [issuerShopUser] = await userService.findUsers(
			{
				_id: issuerShopData.user,
			},
			session
		);
		if (!issuerShopUser) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND.message,
				apiResponse.USER_NOT_FOUND.code,
				session
			);
		}
		const isAdminIssuer = issuerShopUser.role === UserRoles.ADMIN;

		if (
			giftCardData.giftcard_mode === GiftCardMode.DEMO &&
			issuerShopData.studio_mode === StudioMode.LIVE
		) {
			return sendErrorResponse(
				res,
				apiResponse.DEMO_GIFTCARD_CANNOT_BE_REDEEMED_IN_LIVE_MODE.message,
				apiResponse.DEMO_GIFTCARD_CANNOT_BE_REDEEMED_IN_LIVE_MODE.code,
				session
			);
		}
		if (
			giftCardData.giftcard_mode === GiftCardMode.LIVE &&
			issuerShopData.studio_mode === StudioMode.DEMO
		) {
			return sendErrorResponse(
				res,
				apiResponse.LIVE_GIFTCARD_CANNOT_BE_REDEEMED_IN_DEMO_MODE.message,
				apiResponse.LIVE_GIFTCARD_CANNOT_BE_REDEEMED_IN_DEMO_MODE.code,
				session
			);
		}

		if (isAdminIssuer) {
			const [redeemAtShopUser] = await userService.findUsers(
				{
					_id: redeemAtShopData.user,
				},
				session
			);
			if (!redeemAtShopUser) {
				return sendErrorResponse(
					res,
					apiResponse.USER_NOT_FOUND.message,
					apiResponse.USER_NOT_FOUND.code,
					session
				);
			}
			// send error if issuer and redeem at shop are same when admin is issuer
			if (redeemAtShopUser.role === UserRoles.ADMIN) {
				return sendErrorResponse(
					res,
					apiResponse.REDEEM_AT_SHOP_CAN_NOT_ADMIN_ON_ADMIN_ISSUED_GIFTCARDS
						.message,
					apiResponse.REDEEM_AT_SHOP_CAN_NOT_ADMIN_ON_ADMIN_ISSUED_GIFTCARDS
						.code,
					session
				);
			}
			if (
				issuerShopData.studio_mode === StudioMode.LIVE &&
				redeemAtShopData.studio_mode === StudioMode.DEMO
			)
				return sendErrorResponse(
					res,
					apiResponse.REDEEM_AT_DEMO_MODE_WHILE_ISSUER_IS_LIVE.message,
					apiResponse.REDEEM_AT_DEMO_MODE_WHILE_ISSUER_IS_LIVE.code,
					session
				);

			if (
				issuerShopData.studio_mode === StudioMode.DEMO &&
				redeemAtShopData.studio_mode === StudioMode.LIVE
			)
				return sendErrorResponse(
					res,
					apiResponse.REDEEM_AT_LIVE_MODE_WHILE_ISSUER_IS_DEMO.message,
					apiResponse.REDEEM_AT_DEMO_MODE_WHILE_ISSUER_IS_LIVE.code,
					session
				);
		}

		// send error response if giftcard is not active
		let message = '';
		switch (giftCardData.status) {
			case GiftCardStatus.INACTIVE:
				message = apiResponse.GIFTCARD_INACTIVE.message;
				break;
			case GiftCardStatus.BLOCKED:
				message = apiResponse.GIFTCARD_BLOCKED.message;
				break;
			case GiftCardStatus.PENDING_PAYMENT:
				message = apiResponse.GIFTCARD_PAYMENT_PENDING.message;
				break;
			case GiftCardStatus.EXPIRED:
				message = `${apiResponse.GIFTCARD_EXPIRED.message} ${formatDate(
					giftCardData.validtill_date
				)}`;
				break;
			case GiftCardStatus.REFUNDED:
				message = apiResponse.GIFTCARD_REFUNDED.message;
				break;
		}
		if (message) {
			return sendErrorResponse(
				res,
				message,
				apiResponse.VALIDATION_ERROR.code,
				session
			);
		}

		if (giftCardData.blocked_until && new Date() < giftCardData.blocked_until) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_BLOCKED_TEMPORARILY.message,
				apiResponse.GIFTCARD_BLOCKED_TEMPORARILY.code,
				null
			);
		}

		// check if pin is correct
		if (pin !== giftCardData.pin) {
			// Check if the pin is the same as the last incorrect pin entered
			if (
				giftCardData.incorrect_pin_count > 0 &&
				pin === giftCardData.last_incorrect_pin
			) {
				// If the pin is the same, skip incrementing the count
				return sendErrorResponse(
					res,
					apiResponse.PIN_ALREADY_TRIED.message,
					apiResponse.PIN_ALREADY_TRIED.code,
					null
				);
			}

			// increment incorrect pin count
			await giftcardService.updateGiftCard(
				{
					_id: giftCardData._id,
				},
				{
					incorrect_pin_count: giftCardData.incorrect_pin_count + 1,
					last_incorrect_pin: pin, // Store the current incorrect pin attempt
				},
				null
				// session
			);
			// calculate attempts left based on incorrect pin count
			const incorrectAttemptLeft = 5 - (giftCardData.incorrect_pin_count + 1);

			// update giftcard status to blocked if attempts left is 0
			if (incorrectAttemptLeft <= 0) {
				await giftcardService.updateGiftCard(
					{ _id: giftCardData._id },
					{ status: GiftCardStatus.BLOCKED },
					// session
					null
				);
				const oneHourLater = new Date();
				oneHourLater.setHours(oneHourLater.getHours() + 1);

				// update gift card status to blocked and set `blocked_until`
				await giftcardService.updateGiftCard(
					{ _id: giftCardData._id },
					{
						status: GiftCardStatus.ACTIVE,
						blocked_until: oneHourLater,
						incorrect_pin_count: 0,
					},
					// session
					null
				);
				await session.commitTransaction();
				return sendErrorResponse(
					res,
					apiResponse.GIFTCARD_BLOCKED_TEMPORARILY.message,
					apiResponse.GIFTCARD_BLOCKED_TEMPORARILY.code,
					null
				);
			}
			// send error response if pin is incorrect
			return sendErrorResponse(
				res,
				res.__('Invalid gift card PIN', {
					incorrectAttemptLeft: incorrectAttemptLeft.toString(),
				}),
				422,
				// session
				null
			);
		}

		// check if redeem amount is greater than available amount
		if (amount > giftCardData.available_amount) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_AMOUNT_EXCEEDED.message,
				apiResponse.GIFTCARD_AMOUNT_EXCEEDED.code,
				session
			);
		}

		let totalFees = 0;

		if (isAdminIssuer) {
			if (
				redeemAtShopData.platform_redeem_fee == undefined ||
				redeemAtShopData.fixed_payment_redeem_fee == undefined
			) {
				throw new Error('platform fee or fixed payment fee undefined');
			}
			const rawTotalFees =
				(amount * redeemAtShopData.platform_redeem_fee) / 100 +
				redeemAtShopData.fixed_payment_redeem_fee;
			totalFees = +truncateToDecimals(rawTotalFees, 2);
			if (totalFees >= amount) totalFees = 0;
		}

		// add redeem data to database
		const redeemData = await redeemGiftCardService.createRedeemGiftCard(
			{
				giftcard: giftCardData._id,
				redeemed_shop: isAdminIssuer
					? new Types.ObjectId(shop_id)
					: issuerShopData._id,
				redeemed_date: new Date(),
				amount,
				deleted_at: null,
				comment: null,
				negotiation_invoice: null,
				fees: totalFees,
				issuer_shop: issuerShopData._id,
			},
			session
		);

		const availableAmount = giftCardData.available_amount - amount;
		// update giftcard available amount
		await giftcardService.updateGiftCard(
			{
				_id: giftCardData._id,
			},
			{
				available_amount: giftCardData.available_amount - amount,
			},
			session
		);

		const [userSettingsData] = await userSettingsService.find(
			{
				shop: issuerShopData._id,
			},
			session
		);

		await sendSuccessResponse(
			res,
			redeemData,
			apiResponse.GIFTCARD_REDEEMED_SUCCESSFUL.message,
			apiResponse.GIFTCARD_REDEEMED_SUCCESSFUL.code,
			session
		);

		// send mail notifications
		try {
			if (userSettingsData?.studio_redeem_notifications) {
				// gather mail data for studio redemptions
				const studioRedeemMailData = {
					logoUrl: issuerShopData.logo_url ?? '',
					studioName: issuerShopData.studio_name ?? '',
					studioEmail: issuerShopData.owner ?? '',
					giftCardCode: formatGiftCardCode(giftCardData.code),
					redeemedAmount: getNumberInLocalFormat(amount) + ' €',
					availableAmount: getNumberInLocalFormat(availableAmount) + ' €',
					dashboardUrl: `${BASE_DOMAIN}/dashboard/historie`,
					websiteUrl: 'gutschein.thai-massage.de',
				};
				// send a mail to studio
				redeemGiftCardService.sendStudioRedeemMail(studioRedeemMailData);
			}

			if (isAdminIssuer) {
				const [userSettingsData] = await userSettingsService.find({
					shop: redeemAtShopData._id,
				});
				if (userSettingsData?.admin_redeem_notifications) {
					const adminRedeemMailData = {
						logoUrl: redeemAtShopData.logo_url ?? '',
						studioName: redeemAtShopData.studio_name ?? '',
						studioEmail: redeemAtShopData.owner ?? '',
						redeemedAmount: getNumberInLocalFormat(amount) + ' €',
					};
					redeemGiftCardService.sendAdminRedeemMail(adminRedeemMailData);
				}
			}
		} catch (error) {}
	} catch (error: any) {
		console.log(error.message);
		if (error instanceof ValidationError) {
			return sendErrorResponse(res, error.message, 422, session);
		}
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code,
			session
		);
	}
};

/**
 * Retrieves all gift cards based on the provided parameters and sends a success response with the gift cards and total count.
 *
 * @param {Request} req - The request object containing the query parameters.
 * @param {Response} res - The response object to send the success response.
 * @return {Promise<Array<Object>>} - A promise that resolves when the success response is sent.
 */
const getAllGiftCards = async (req: Request, res: Response) => {
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
		const { loggedUser } = req;

		const { limit, offset } = getPagination(page, size);

		const parsedColumnFilters: { id: string; value: string }[] = JSON.parse(
			column_filters || '[]'
		);
		const shopId =
			loggedUser.role === UserRoles.ADMIN ? null : loggedUser.shop_id;
		const isAdmin = loggedUser.role === UserRoles.ADMIN;

		const downloadFile = file === 'csv';

		// get all giftcards
		const { rows, count } = await giftcardService.getAllGiftCards({
			limit: downloadFile ? null : limit,
			offset: downloadFile ? null : offset,
			sort_by,
			sort_order,
			search_value,
			column_filters: parsedColumnFilters,
			shop_id: shopId,
			isAdmin,
		});
		const responseData = {
			giftcards: rows,
			total_giftcards: count,
		};
		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.GIFTCARDS_FOUND_SUCCESSFUL.message,
			apiResponse.GIFTCARDS_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

/**
 * Updates a gift card with the provided information.
 *
 * @param {Request} req - The request object containing the gift card ID and updated information.
 * @param {Response} res - The response object to send the result.
 * @return {Promise<{}>} - Returns a empty object that resolves when the gift card is successfully updated.
 */
const updateGiftCard = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { giftcard_id } = req.params;
		// const {
		// 	user,
		// 	status,
		// }: {
		// 	user?: string;
		// 	status?: GiftCardStatus;
		// } = req.body;
		const data = await giftcardService.validateGiftCardUpdate(req.body);
		const { user, status, comment } = data;

		session = await mongoose.startSession();
		session.startTransaction();

		// check if giftcard exists
		const [giftCard] = await giftcardService.findGiftcards(
			{
				_id: giftcard_id,
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

		// update giftcard
		const updateFields: Partial<GiftCardInput> = {
			user: user || giftCard.user,
			status: status || (giftCard.status as GiftCardStatus),
		};
		if (typeof comment === 'string' && giftCard.comment !== comment)
			updateFields.comment = comment;

		if (
			status &&
			giftCard.status === GiftCardStatus.BLOCKED &&
			status !== GiftCardStatus.BLOCKED
		) {
			updateFields.incorrect_pin_count = 0;
		}

		await giftcardService.updateGiftCard(
			{ _id: giftCard._id },
			updateFields,
			session
		);

		return sendSuccessResponse(
			res,
			{},
			apiResponse.GIFTCARD_UPDATED_SUCCESSFULLY.message,
			apiResponse.GIFTCARD_UPDATED_SUCCESSFULLY.code,
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

export default {
	purchaseGiftcards,
	checkGiftCardCode,
	redeemGiftCard,
	getAllGiftCards,
	updateGiftCard,
	updateCustomerEmailHandler
};
