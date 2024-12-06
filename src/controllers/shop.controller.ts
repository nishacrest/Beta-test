// import { StudioIntegrations } from './../types/user_settings';
import { Request, Response } from 'express';
import {
	DEFAULT_IMG_URL,
	HERO_SECTION_IMAGES,
	apiResponse,
} from '../utils/constant';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import shopService from '../services/shop.service';
import giftcardTemplateService from '../services/giftcard_template.service';
import { GiftCardTemplateAttributes } from '../types/giftcard_templates';
import mongoose, { Types, ClientSession } from 'mongoose';
import {
	ShopAttributes,
	ShopInput,
	ShopStatus,
	StripeOnboardingStatus,
	StudioMode,
} from '../types/shops';
import {
	countNonEmptyFields,
	getPagination,
	omitFromObject,
} from '../utils/helper';
import giftcardService from '../services/giftcard.service';
import { stripe } from '../utils/stripe.helper';
import { types } from 'joi';
import { platform } from 'os';
import { AnyKeyObject } from '../types';
import shopUiService from '../services/shop_ui.service';
import { ShopUiInput } from '../types/shops_ui';
import userService from '../services/user.service';
import { createHashedPassword } from '../services/auth.service';
import { UserInput, UserRoles } from '../types/users';
import { ValidationError } from 'yup';
import { StudioIntegrations, UserSettingsInput } from '../types/user_settings';
import userSettingsService from '../services/user_settings.service';
import { ListingInput } from '../types/listing_details';
import { getReviewsByListingId } from '../services/review.service';
import { getCombinedRatings } from './review_controller';
import { isArray } from 'lodash';

/**
 * Function to retrieve shop details by ID asynchronously.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @return {Promise<Object>} Returns a promise with the result of the operation.
 */
const getShopDetailsById = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const shopData = await shopService.getShopDetails(shop_id);
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		return sendSuccessResponse(
			res,
			shopData,
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

/**
 * Asynchronously updates gift card settings for a shop.
 *
 * @param {Request} req - The request object containing shop details.
 * @param {Response} res - The response object to send back the result.
 * @return {Promise<Object>} Returns a promise with the updated shop details.
 */
const updateGiftCardSettings = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const {
			quantity_limit,
			default_amount,
			standard_text,
			background_color,
			templates,
			max_amount,
			min_amount,
			max_total_amount,
			setting_headline,
		}: {
			quantity_limit: string;
			default_amount: string;
			standard_text: string;
			background_color: string;
			templates: string[];
			max_amount: number | null;
			min_amount: number | null;
			max_total_amount: number | null;
			setting_headline: string | null;
		} = req.body;

		// check if shop exists
		const [shopData] = await shopService.findShops({ _id: shop_id });
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		const latestTemplates: Types.ObjectId[] = [];
		if (templates && isArray(templates)) {
			for (let template of templates) {
				latestTemplates.push(new Types.ObjectId(template));
			}
		}
		// update shop
		const updateFields: Partial<ShopInput> = {};
		if (quantity_limit) updateFields.giftcard_limit = +quantity_limit;
		if (default_amount) updateFields.default_giftcard_value = +default_amount;
		if (standard_text)
			updateFields.standard_text =
				standard_text === 'null' ? null : standard_text;
		if (templates && isArray(templates))
			updateFields.templates = latestTemplates;
		if (max_amount) updateFields.max_amount = +max_amount;
		if (min_amount) updateFields.min_amount = +min_amount;
		if (setting_headline) updateFields.setting_headline = setting_headline;
		if (max_total_amount) updateFields.max_total_amount = +max_total_amount;
		const shopUiUpdateFields: AnyKeyObject = {
			...(background_color
				? { 'template_section.background_color': background_color }
				: {}),
		};
		await shopService.updateShop({ _id: shop_id }, updateFields);

		Object.keys(shopUiUpdateFields).length &&
			(await shopUiService.updateShopUi({ shop: shop_id }, shopUiUpdateFields));

		const updatedData = await shopService.getShopDetails(shop_id);

		return sendSuccessResponse(
			res,
			updatedData,
			apiResponse.GIFTCARD_CONFIG_UPDATED_SUCCESSFUL.message,
			apiResponse.GIFTCARD_CONFIG_UPDATED_SUCCESSFUL.code
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
 * Retrieves the details of a shop by studio ID.
 *
 * @param {Request} req - The request object containing the studio ID.
 * @param {Response} res - The response object to send the result.
 * @return {Promise<object>} - A promise that resolves when the shop details are retrieved and sent as a response.
 */
export const getShopDetailsByStudioId = async (req: Request, res: Response) => {
	try {
		const { studio_id } = req.params;

		const [shopData] = await shopService.getShopDetailsByStudioId(studio_id);

		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.STUDIO_NOT_FOUND.message,
				apiResponse.STUDIO_NOT_FOUND.code
			);
		}

		if (shopData.status === ShopStatus.INACTIVE) {
			return sendErrorResponse(
				res,
				`${shopData.studio_name} ${apiResponse.STUDIO_INACTIVE.message}`,
				apiResponse.STUDIO_INACTIVE.code
			);
		}

		return sendSuccessResponse(
			res,
			shopData,
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
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
 * Retrieves all shops based on the provided parameters and sends a success response with the shops and total count.
 *
 * @param {Request} req - The request object containing the query parameters.
 * @param {Response} res - The response object to send the success response.
 * @return {Promise<Array<Object>>} - A promise that resolves when the success response is sent.
 */
const getAllShops = async (req: Request, res: Response) => {
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

		const { limit, offset } = getPagination(page, size);

		const parsedColumnFilters: { id: string; value: string }[] = JSON.parse(
			column_filters || '[]'
		);

		const { rows, count } = await shopService.getAllShops({
			limit,
			offset,
			sort_by,
			sort_order,
			search_value,
			column_filters: parsedColumnFilters,
		});

		const responseData = {
			shops: rows,
			total_shops: count,
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

/**
 * Updates a shop with the provided data.
 *
 * @param {Request} req - The request object containing the shop ID and updated data.
 * @param {Response} res - The response object to send the result.
 * @return {Promise<{}>} - A promise that resolves when the shop is updated successfully or rejects with an error.
 */
const updateShop = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { shop_id } = req.params;
		const requestBody = await shopService.validateUpdateShop(req.body);
		const imageFile = req.file;

		session = await mongoose.startSession();
		session.startTransaction();

		// check if shop exists
		const [shopData] = await shopService.findShops({ _id: shop_id }, session);
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

		const updateFields: Partial<ShopInput> = {};
		const userUpdateFields: Partial<UserInput> = {};
		const stripeProfileUpdate: AnyKeyObject = {
			business_profile: {},
			settings: {},
		};
		const userSettingsField: Partial<UserSettingsInput> = {};

		// check if studio_id is updated
		if (
			requestBody.studio_id &&
			+requestBody.studio_id !== shopData.studio_id
		) {
			// check if shop with studio_id already exists
			const [studioData] = await shopService.findShops(
				{
					studio_id: +requestBody.studio_id,
				},
				session
			);
			if (studioData) {
				return sendErrorResponse(
					res,
					apiResponse.STUDIO_ID_EXISTS.message,
					apiResponse.STUDIO_ID_EXISTS.code,
					session
				);
			}
			updateFields.studio_id = +requestBody.studio_id;
		}

		// check if studio_name is updated
		if (
			requestBody.studio_name &&
			requestBody.studio_name !== shopData.studio_name
		) {
			// check if shop with studio_name already exists
			const [studioData] = await shopService.findShops(
				{
					studio_name: requestBody.studio_name,
				},
				session
			);
			if (studioData) {
				return sendErrorResponse(
					res,
					apiResponse.STUDIO_NAME_EXISTS.message,
					apiResponse.STUDIO_NAME_EXISTS.code,
					session
				);
			}
			updateFields.studio_name = requestBody.studio_name;
		}

		// check if studio_slug is updated
		if (
			requestBody.studio_slug &&
			requestBody.studio_slug !== shopData.studio_slug
		) {
			// check if shop with studio_slug already exists
			const [studioData] = await shopService.findShops(
				{
					studio_slug: requestBody.studio_slug,
				},
				session
			);
			if (studioData) {
				return sendErrorResponse(
					res,
					apiResponse.STUDIO_SLUG_EXISTS.message,
					apiResponse.STUDIO_SLUG_EXISTS.code,
					session
				);
			}
			updateFields.studio_slug = requestBody.studio_slug;
		}

		// check if shop login email is updated
		if (requestBody.login_email && requestBody.login_email !== userData.email) {
			const [existingUser] = await userService.findUsers(
				{
					email: requestBody.login_email,
				},
				session
			);
			if (existingUser) {
				return sendErrorResponse(
					res,
					apiResponse.EMAIL_EXISTS.message,
					apiResponse.EMAIL_EXISTS.code,
					session
				);
			} else {
				userUpdateFields.email = requestBody.login_email;
			}
		}

		if (requestBody.password) {
			const hashedPassword = await createHashedPassword(requestBody.password);
			userUpdateFields.hashed_password = hashedPassword;
		}

		if (
			requestBody.country &&
			shopData.country?.code !== requestBody.country.code
		) {
			updateFields.country = requestBody.country;
			stripeProfileUpdate.business_profile = {
				support_address: {
					line1: shopData.street,
					city: shopData.city,
					country: requestBody.country.code,
				},
			};
		}

		if (requestBody.city && shopData.city !== requestBody.city) {
			updateFields.city = requestBody.city;
			if (stripeProfileUpdate.business_profile.support_address) {
				stripeProfileUpdate.business_profile.support_address.city =
					requestBody.city;
			} else {
				stripeProfileUpdate.business_profile = {
					support_address: {
						line1: shopData.street,
						city: requestBody.city,
						country: shopData.country?.code,
					},
				};
			}
		}

		if (requestBody.street && shopData.street !== requestBody.street) {
			updateFields.street = requestBody.street;
			if (stripeProfileUpdate.business_profile.support_address) {
				stripeProfileUpdate.business_profile.support_address.line1 =
					requestBody.street;
			} else {
				stripeProfileUpdate.business_profile = {
					support_address: {
						line1: requestBody.street,
						city: shopData.city,
						country: shopData.country?.code,
					},
				};
			}
		}

		if (shopData.owner !== requestBody.owner) {
			updateFields.owner = requestBody.owner;
			stripeProfileUpdate.business_profile.support_email = requestBody.owner;
		}
		if (shopData.official_name !== requestBody.official_name) {
			updateFields.official_name = requestBody.official_name;
			stripeProfileUpdate.business_profile.name = requestBody.official_name;
		}

		if (imageFile && shopData.stripe_account) {
			const fileName = `${new Date().getTime()}-${imageFile.originalname}`;
			const data = await shopService.uploadLogoToStripeTemp(
				imageFile.buffer,
				fileName,
				imageFile.mimetype
			);

			stripeProfileUpdate.settings.branding = {
				logo: data.id,
			};
		}

		if (shopData.tax_id?.code !== requestBody.tax_id) {
			if (requestBody.tax_id) {
				// const taxId = await stripe.taxIds.create(
				// 	{
				// 		type: 'eu_vat',
				// 		value: requestBody.tax_id,
				// 	},
				// 	{
				// 		stripeAccount: shopData.stripe_account,
				// 	}
				// );

				// stripeProfileUpdate.settings.invoices = {
				// 	default_account_tax_ids: [taxId.id],
				// };

				updateFields.tax_id = {
					code: requestBody.tax_id,
					id: '',
				};
			} else {
				stripeProfileUpdate.settings.invoices = {
					default_account_tax_ids: null,
				};
				updateFields.tax_id = null;
			}
		}

		if (shopData.stripe_account) {
			const updateFields: AnyKeyObject = {};
			if (Object.keys(stripeProfileUpdate.business_profile).length > 0) {
				updateFields.business_profile = stripeProfileUpdate.business_profile;
			}
			if (Object.keys(stripeProfileUpdate.settings).length > 0) {
				updateFields.settings = stripeProfileUpdate.settings;
			}
			// const account = await stripe.accounts.update(
			// 	shopData.stripe_account,
			// 	updateFields
			// );
			if (Object.keys(updateFields).length > 0) {
				const account = await stripe.accounts.update(
					shopData.stripe_account,
					updateFields
				);
				if (
					stripeProfileUpdate.settings?.invoices?.default_account_tax_ids !==
						undefined &&
					shopData.tax_id?.id
				) {
					await stripe.taxIds.del(shopData.tax_id.id, {
						stripeAccount: shopData.stripe_account,
					});
					console.log('tax id deleted');
				}
				// console.dir(account, { depth: null });
			}
		}
		const s3BaseUrl = process.env.S3_BASE_URL || '';
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || '';
		if (imageFile) {
			const fileName = `${new Date().getTime()}-${imageFile.originalname}`;
			const uploadedImage = await shopService.uploadLogoToS3(
				imageFile.buffer,
				fileName,
				imageFile.mimetype
			);
			const originalUrl = uploadedImage.Location;
			const filteredUrl = originalUrl.replace(s3BaseUrl, cleanBaseUrl);

			updateFields.logo_url = filteredUrl;
		}

		if (requestBody.comment !== shopData.comment) {
			if (requestBody.comment) updateFields.comment = requestBody.comment;
			else updateFields.comment = null;
		}

		if (requestBody.phone && requestBody.phone !== shopData.phone) {
			updateFields.phone = requestBody.phone;
		}

		// update other fields
		// if (requestBody.official_name)
		// 	updateFields.official_name = requestBody.official_name;
		// if (requestBody.street) updateFields.street = requestBody.street;
		// if (requestBody.city) updateFields.city = requestBody.city;
		if (requestBody.status) {
			updateFields.status = requestBody.status as ShopStatus;
		}
		if (requestBody.studio_integration) {
			userSettingsField.studio_integration = requestBody.studio_integration;
		}
		if (requestBody.studio_mode)
			updateFields.studio_mode = requestBody.studio_mode;
		// if (imageFile && imageFile.location)
		// 	updateFields.logo_url = imageFile.location;
		if (requestBody.owner) updateFields.owner = requestBody.owner;
		if (requestBody.tax_type)
			updateFields.tax_type = new Types.ObjectId(requestBody.tax_type);
		if (requestBody.platform_fee !== undefined)
			updateFields.platform_fee = requestBody.platform_fee;
		if (requestBody.shop_url)
			updateFields.shop_url = 'http://' + requestBody.shop_url;
		if (requestBody.fixed_payment_fee !== undefined)
			updateFields.fixed_payment_fee = requestBody.fixed_payment_fee;
		if (requestBody.platform_redeem_fee !== undefined)
			updateFields.platform_redeem_fee = requestBody.platform_redeem_fee;
		if (requestBody.fixed_payment_redeem_fee !== undefined)
			updateFields.fixed_payment_redeem_fee =
				requestBody.fixed_payment_redeem_fee;
		if (requestBody.iban !== shopData.iban)
			updateFields.iban = requestBody.iban || null;
		if (requestBody.bic !== shopData.bic)
			updateFields.bic = requestBody.bic || null;
		if (requestBody.bank_name !== shopData.bank_name)
			updateFields.bank_name = requestBody.bank_name || null;

		await shopService.updateShop({ _id: shop_id }, updateFields, session);
		await userService.update({ _id: userData._id }, userUpdateFields, session);
		await userSettingsService.update(
			{ shop: shopData._id },
			userSettingsField,
			session
		);

		const [updatedShopData] = await shopService.findShops(
			{ _id: shop_id },
			session
		);
		const [udpatedUserData] = await userService.findUsers(
			{
				_id: userData._id,
			},
			session
		);
		const omitFields = [
			'created_at',
			'updated_at',
			'deleted_at',
			'standard_text',
		];
		const omitedData = omitFromObject(updatedShopData, omitFields);
		const responseData = {
			...omitedData,
			user: {
				email: udpatedUserData.email,
				hashed_password: udpatedUserData.hashed_password,
			},
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.SHOP_UPDATED_SUCCESSFUL.message,
			apiResponse.SHOP_UPDATED_SUCCESSFUL.code,
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

/**
 * Creates a new shop with the provided data.
 *
 * @param {Request} req - The request object containing the shop data.
 * @param {Response} res - The response object to send the result.
 * @return {Promise<Object>} - A promise that resolves when the shop is created successfully or rejects with an error.
 */
const createShop = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const imageFile = req.file;
		const requestBody = await shopService.validateCreateShop(req.body);
		session = await mongoose.startSession();
		session.startTransaction();

		const [existingShopByStudioId] = await shopService.findShops(
			{
				studio_id: requestBody.studio_id ? +requestBody.studio_id : undefined,
			},
			session
		);
		if (existingShopByStudioId) {
			// await session.abortTransaction();
			return sendErrorResponse(
				res,
				apiResponse.STUDIO_ID_EXISTS.message,
				apiResponse.STUDIO_ID_EXISTS.code,
				session
			);
		}

		// check if shop with studio_slug already exists
		const [existingShopByStudioSlug] = await shopService.findShops(
			{
				studio_slug: requestBody.studio_slug,
			},
			session
		);
		if (existingShopByStudioSlug) {
			// await session.abortTransaction();
			return sendErrorResponse(
				res,
				apiResponse.STUDIO_SLUG_EXISTS.message,
				apiResponse.STUDIO_SLUG_EXISTS.code,
				session
			);
		}

		// check if shop with studio_name already exists
		const [existingShopByStudioName] = await shopService.findShops(
			{
				studio_name: requestBody.studio_name,
			},
			session
		);
		if (existingShopByStudioName) {
			// await session.abortTransaction();
			return sendErrorResponse(
				res,
				apiResponse.STUDIO_NAME_EXISTS.message,
				apiResponse.STUDIO_NAME_EXISTS.code,
				session
			);
		}

		// find existing user by email
		const [existingUser] = await userService.findUsers({
			email: requestBody.login_email,
		});

		if (existingUser) {
			// await session.abortTransaction();
			return sendErrorResponse(
				res,
				apiResponse.EMAIL_EXISTS.message,
				apiResponse.EMAIL_EXISTS.code,
				session
			);
		}
		const password = requestBody.password || '';
		const hashedPassword = await createHashedPassword(password);

		// create stripe account of this shop
		const account = await stripe.accounts.create({
			// type: 'express',
			controller: {
				stripe_dashboard: {
					type: 'none',
				},
				fees: {
					payer: 'application',
				},
				losses: {
					payments: 'stripe',
				},
				requirement_collection: 'stripe',
			},
			country: 'DE',
			capabilities: {
				transfers: {
					requested: true,
				},
				card_payments: {
					requested: true,
				},
				link_payments: {
					requested: true,
				},
				sepa_debit_payments: {
					requested: true,
				},
			},
		});

		const userData = await userService.create(
			{
				email: requestBody.login_email ?? '',
				hashed_password: hashedPassword,
				role: UserRoles.SHOP,
				otp: null,
				otp_count: 0,
				otp_time: null,
				otp_verified: false,
				otp_used: false,
				deleted_at: null,
				verified: false,
				verificationToken: null,
				auth_provider: null,
			},
			session
		);

		// create shop
		const shopFields: ShopInput = {
			// studio_id: +requestBody.studio_id,
			studio_id: requestBody.studio_id ? +requestBody.studio_id : undefined,
			shop_url: 'http://' + requestBody.shop_url,
			studio_slug: requestBody.studio_slug,
			official_name: requestBody.official_name,
			studio_name: requestBody.studio_name,
			country: requestBody.country || ' ',
			street: requestBody.street,
			city: requestBody.city,
			status: requestBody.status,
			studio_mode: StudioMode.DEMO,
			logo_url: DEFAULT_IMG_URL.LOGO,
			giftcard_limit: 10,
			default_giftcard_value: 20,
			standard_text: '<p>Standard text</p>',
			deleted_at: null,
			owner: requestBody.owner,
			stripe_account: account.id,
			stripe_onboarding_status: StripeOnboardingStatus.PENDING,
			tax_type: new Types.ObjectId(requestBody.tax_type),
			platform_fee: requestBody.platform_fee,
			fixed_payment_fee: requestBody.fixed_payment_fee,
			tax_id: null,
			user: userData._id,
			comment: requestBody.comment || null,
			phone: requestBody.phone,
			templates: [],
			fixed_payment_redeem_fee: requestBody.fixed_payment_redeem_fee,
			platform_redeem_fee: requestBody.platform_redeem_fee,
			iban: requestBody.iban || null,
			bic: requestBody.bic || null,
			bank_name: requestBody.bank_name || null,
			invoice_reference_number: 0,
			listing_details: null,
			is_giftcard_partner: null,
			max_amount: null,
			min_amount: null,
			max_total_amount: null,
			setting_headline: null,
		};

		const stripeSettingsField: AnyKeyObject = {};
		const s3BaseUrl = process.env.S3_BASE_URL || '';
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || '';
		if (imageFile) {
			const fileName = `${new Date().getTime()}-${imageFile.originalname}`;
			const data = await shopService.uploadLogoToStripeTemp(
				imageFile.buffer,
				fileName,
				imageFile.mimetype
			);

			const uploadedImage = await shopService.uploadLogoToS3(
				imageFile.buffer,
				fileName,
				imageFile.mimetype
			);
			const filteredLogoUrl = uploadedImage.Location.replace(
				s3BaseUrl,
				cleanBaseUrl
			);
			shopFields.logo_url = filteredLogoUrl;
			stripeSettingsField.branding = {
				logo: data.id,
			};
		}
		if (requestBody.tax_id && requestBody.tax_id !== 'undefined') {
			// const taxId = await stripe.taxIds.create(
			// 	{
			// 		type: 'eu_vat',
			// 		value: requestBody.tax_id,
			// 	},
			// 	{
			// 		stripeAccount: account.id,
			// 	}
			// );
			// stripeSettingsField.invoices = {
			// 	default_account_tax_ids: [taxId.id],
			// };
			shopFields.tax_id = {
				id: '',
				code: requestBody.tax_id,
			};
		}

		await stripe.accounts.update(account.id, {
			business_profile: {
				support_address: {
					line1: requestBody.street,
					city: requestBody.city,
					country: requestBody.country.code,
				},
				support_email: requestBody.owner,
				name: requestBody.official_name,
			},
			...(Object.keys(stripeSettingsField).length
				? {
						settings: {
							...stripeSettingsField,
						},
				  }
				: {}),
		});

		shopFields.user = userData._id;
		const shopData = await shopService.createShop(shopFields, session);

		// add a initial data of this shop ui settings
		const shopUiFields = shopService.getDefaultShopUiData(shopData._id);
		await shopUiService.createShopUi(shopUiFields, session);

		// create a user settings for this shop
		const userSettingsFields: UserSettingsInput = {
			shop: shopData._id,
			user: userData._id,
			admin_redeem_notifications: true || null,
			sale_email_notifications: true || null,
			studio_integration: StudioIntegrations.UNIVERSAL_AND_STUDIO,
			studio_redeem_notifications: true || null,
			deleted_at: null,
			negotiation_invoice_notifications: true || null,
			payment_invoice_notifications: true || null,
			refund_invoice_notifications: true || null,
		};
		await userSettingsService.create(userSettingsFields, session);

		// omit fields from created shop
		const omitFields = [
			'created_at',
			'updated_at',
			'deleted_at',
			'standard_text',
		];
		const omitedData = omitFromObject(shopData, omitFields);

		// await session.commitTransaction();
		return sendSuccessResponse(
			res,
			omitedData,
			apiResponse.SHOP_CREATED_SUCCESSFUL.message,
			apiResponse.SHOP_CREATED_SUCCESSFUL.code,
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
		console.log(error.message);
		return sendErrorResponse(res, error.message, 500, session);
	}
};

/**
 * Retrieves all shops for dropdown and sends a success response with the shop data.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object to send the success response.
 * @return {Promise<Array<Object>>} A promise that resolves when the success response is sent.
 */
const getAllShopsForDropdown = async (req: Request, res: Response) => {
	try {
		const { user_role }: { user_role?: UserRoles } = req.query;
		const shopData = await shopService.getAllShopsForDropdown({
			userRole: user_role,
		});

		return sendSuccessResponse(
			res,
			shopData,
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(res, error.message, 500);
	}
};

const getAllShopsForReemption = async (req: Request, res: Response) => {
	try {
		// Extract `user_role`, `studio_id`, `studio_name`, and `limit` from query parameters
		const {
			studio_id,
			studio_name,
			limit = '10',
		}: {
			user_role?: UserRoles;
			studio_id?: string;
			studio_name?: string;
			limit?: string;
		} = req.query;

		// Call the service method with the required arguments
		const shopData = await shopService.getAllShopsForReemption({
			studioId: studio_id,
			studioName: studio_name,

			limit: parseInt(limit, 10),
		});

		//   const filteredShopData = shopData.filter(shop => shop.studio_integration !== "universal");
		// Send the successful response with the shop data
		return sendSuccessResponse(
			res,
			shopData,
			// filteredShopData,
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		// Handle any errors by sending an error response
		return sendErrorResponse(res, error.message, 500);
	}
};

const getShopDetailsByStudioSlug = async (req: Request, res: Response) => {
	try {
		const { studio_slug } = req.params;

		const [shopData] = await shopService.getShopDetailsByStudioSlug(
			studio_slug
		);
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		if (shopData.status === ShopStatus.INACTIVE) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_INACTIVE.message,
				apiResponse.SHOP_INACTIVE.code
			);
		}
		if (
			shopData.user_settings.studio_integration === StudioIntegrations.UNIVERSAL
		) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_INACTIVE.message,
				apiResponse.SHOP_INACTIVE.code
			);
		}
		const shopUiData = await shopUiService.getUiDetailByShopId(
			shopData._id.toString()
		);
		shopData.shop_ui = shopUiData;

		return sendSuccessResponse(
			res,
			shopData,
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getShopDetailsForListingPage = async (req: Request, res: Response) => {
	try {
		const { studio_slug } = req.params;

		const [shopData] = await shopService.getShopDetailsByStudioSlug(
			studio_slug
		);
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		const shopUiData = await shopUiService.getUiDetailByShopId(
			shopData._id.toString()
		);
		shopData.shop_ui = shopUiData;

		return sendSuccessResponse(
			res,
			shopData,
			apiResponse.SHOP_FOUND_SUCCESSFUL.message,
			apiResponse.SHOP_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};
const updatePurchaseHeroSection = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const {
			carousel: rawCarousel,
			title,
			subtitle,
			description,
			background_color,
			hide_section,
			text_color,
		}: {
			carousel: string;
			title: string;
			subtitle: string;
			description: string;
			background_color: string;
			hide_section: boolean;
			text_color: string;
		} = req.body;
		const images = req.files as Express.Multer.File[] | undefined;

		const carousel: {
			id: string | null;
			image_name: string | null;
			index: number;
		}[] = JSON.parse(rawCarousel);

		//send error if shop not found
		const [shopUiData] = await shopUiService.findShopUi({
			shop: shop_id,
		});
		if (!shopUiData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		// get current carousel data
		let currentCarouselData = shopUiData.hero_section.carousel;

		// get latest state of carousel id's and database carousel id's
		const updatedCarouselIds = carousel.map((item) => item.id);
		const currentCarouselIds = currentCarouselData.map((carouselItem) =>
			carouselItem._id.toString()
		);

		// find a delete carousel ids
		const deletedCarouselIds = currentCarouselIds.filter(
			(id) => !updatedCarouselIds.includes(id)
		);

		// filter out deleted carousel from current carousel state
		currentCarouselData = currentCarouselData.filter(
			(carouselItem) =>
				!deletedCarouselIds.includes(carouselItem._id.toString())
		);

		// update a carousel or add a new carousel if id is null
		for (let item of carousel) {
			const { id, image_name, index } = item;

			let imageUrl: string | undefined;
			if (image_name) {
				imageUrl = images?.find(
					(image) => image.originalname === image_name
				)?.location;
			}

			if (id) {
				const carouselData = currentCarouselData.find(
					(carouselItem) => carouselItem._id.toString() === id
				);
				if (carouselData) {
					carouselData.index = index;
					if (imageUrl) {
						carouselData.image_url = imageUrl;
					}
				}
			} else {
				if (imageUrl) {
					currentCarouselData.push({
						_id: new Types.ObjectId(),
						image_url: imageUrl,
						index,
					});
				}
			}
		}
		const updateFields = {
			'hero_section.carousel': currentCarouselData,
			...(title ? { 'hero_section.title': title } : {}),
			...(subtitle ? { 'hero_section.subtitle': subtitle } : {}),
			...(hide_section !== undefined
				? { 'hero_section.hide_section': hide_section }
				: {}),
			...(description ? { 'hero_section.description': description } : {}),
			...(background_color
				? { 'hero_section.background_color': background_color }
				: {}),
			...(text_color ? { 'hero_section.text_color': text_color } : {}),
		};
		await shopUiService.updateShopUi(
			{
				shop: shop_id,
			},
			updateFields
		);

		const updatedData = await shopUiService.getUiDetailByShopId(shop_id);
		return sendSuccessResponse(
			res,
			updatedData,
			apiResponse.SHOP_HERO_SECTION_UPDATED_SUCCESSFUL.message,
			apiResponse.SHOP_HERO_SECTION_UPDATED_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const updatePurchaseAboutUsSection = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const data = await shopUiService.validateAboustUsData(req.body);
		const {
			description,
			background_color,
			text_color,
			list_items,
			list_item_icon_color,
			hide_section,
		} = data;

		//send error if shop not found
		const [shopUiData] = await shopUiService.findShopUi({
			shop: shop_id,
		});
		if (!shopUiData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		// get current list items data
		let currentListItemsData = shopUiData.about_us.list_items;

		// get latest state of carousel id's and database carousel id's
		const updatedListItemsIds = list_items.map((item) => item.id);
		const currentListItemsIds = currentListItemsData.map((listItem) =>
			listItem._id.toString()
		);

		// find a delete carousel ids
		const deleteListItemsIds = currentListItemsIds.filter(
			(id) => !updatedListItemsIds.includes(id)
		);

		// filter out deleted carousel from current carousel state
		currentListItemsData = currentListItemsData.filter(
			(listItem) => !deleteListItemsIds.includes(listItem._id.toString())
		);

		// update a carousel or add a new carousel if id is null
		for (let item of list_items) {
			const { id, description, index } = item;

			if (id) {
				const listItemData = currentListItemsData.find(
					(listItem) => listItem._id.toString() === id
				);
				if (listItemData) {
					listItemData.index = index;
					listItemData.description = description;
				}
			} else {
				currentListItemsData.push({
					_id: new Types.ObjectId(),
					description: description,
					index,
				});
			}
		}
		console.log(list_item_icon_color);
		const updateFields = {
			'about_us.list_items': currentListItemsData,
			...(description ? { 'about_us.description': description } : {}),
			...(background_color
				? { 'about_us.background_color': background_color }
				: {}),
			...(text_color ? { 'about_us.text_color': text_color } : {}),
			...(hide_section !== undefined
				? { 'about_us.hide_section': hide_section }
				: {}),
			...(list_item_icon_color
				? {
						'about_us.list_item_icon_color': list_item_icon_color,
				  }
				: {}),
		};
		await shopUiService.updateShopUi(
			{
				shop: shop_id,
			},
			updateFields
		);

		const updatedData = await shopUiService.getUiDetailByShopId(shop_id);
		return sendSuccessResponse(
			res,
			updatedData,
			apiResponse.SHOP_ABOUT_SECTION_UPDATED_SUCCESSFUL.message,
			apiResponse.SHOP_ABOUT_SECTION_UPDATED_SUCCESSFUL.code
		);
	} catch (error: any) {
		if (error instanceof ValidationError) {
			return sendErrorResponse(
				res,
				error.message,
				apiResponse.VALIDATION_ERROR.code
			);
		}
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const updatePurchaseFaqSection = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const data = await shopUiService.validateFaqData(req.body);
		const {
			background_color,
			header_text_color,
			header_bg_color,
			list_items,
			hide_section,
		} = data;

		//send error if shop not found
		const [shopUiData] = await shopUiService.findShopUi({
			shop: shop_id,
		});
		if (!shopUiData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		// get current list items data
		let currentListItemsData = shopUiData.faq.list_items;

		// get latest state of carousel id's and database carousel id's
		const updatedListItemsIds = list_items.map((item) => item.id);
		const currentListItemsIds = currentListItemsData.map((listItem) =>
			listItem._id.toString()
		);

		// find a delete carousel ids
		const deleteListItemsIds = currentListItemsIds.filter(
			(id) => !updatedListItemsIds.includes(id)
		);

		// filter out deleted carousel from current carousel state
		currentListItemsData = currentListItemsData.filter(
			(listItem) => !deleteListItemsIds.includes(listItem._id.toString())
		);

		// update a carousel or add a new carousel if id is null
		for (let item of list_items) {
			const { id, title, description, index } = item;

			if (id) {
				const listItemData = currentListItemsData.find(
					(listItem) => listItem._id.toString() === id
				);
				if (listItemData) {
					listItemData.index = index;
					listItemData.description = description;
					listItemData.title = title;
				}
			} else {
				currentListItemsData.push({
					_id: new Types.ObjectId(),
					description: description,
					title: title,
					index: index,
				});
			}
		}
		const updateFields = {
			'faq.list_items': currentListItemsData,
			'faq.background_color': background_color,
			'faq.header_bg_color': header_bg_color,
			'faq.header_text_color': header_text_color,
			'faq.hide_section': hide_section,
		};
		await shopUiService.updateShopUi(
			{
				shop: shop_id,
			},
			updateFields
		);

		const updatedData = await shopUiService.getUiDetailByShopId(shop_id);
		return sendSuccessResponse(
			res,
			updatedData,
			apiResponse.SHOP_FAQ_SECTION_UPDATED_SUCCESSFUL.message,
			apiResponse.SHOP_FAQ_SECTION_UPDATED_SUCCESSFUL.code
		);
	} catch (error: any) {
		if (error instanceof ValidationError) {
			return sendErrorResponse(
				res,
				error.message,
				apiResponse.VALIDATION_ERROR.code
			);
		}
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const updatePurchaseContactUsSection = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const data = await shopUiService.validateContactUsData(req.body);
		const { phone_no, email, location, hide_section } = data;

		//send error if shop not found
		const [shopUiData] = await shopUiService.findShopUi({
			shop: shop_id,
		});
		if (!shopUiData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		// get current list items data
		let currentLocationsData = shopUiData.contact_us.location;

		// get latest state of carousel id's and database carousel id's
		const updatedLocationsIds = location.map((item) => item.id);
		const currentLocationsIds = currentLocationsData.map((location) =>
			location._id.toString()
		);

		// find a delete carousel ids
		const deleteListItemsIds = currentLocationsIds.filter(
			(id) => !updatedLocationsIds.includes(id)
		);

		// filter out deleted carousel from current carousel state
		currentLocationsData = currentLocationsData.filter(
			(listItem) => !deleteListItemsIds.includes(listItem._id.toString())
		);

		// update a carousel or add a new carousel if id is null
		for (let item of location) {
			const { id, lat, long } = item;

			if (id) {
				const locationData = currentLocationsData.find(
					(location) => location._id.toString() === id
				);
				if (locationData) {
					locationData.lat = lat;
					locationData.long = long;
				}
			} else {
				currentLocationsData.push({
					_id: new Types.ObjectId(),
					lat: lat,
					long: long,
				});
			}
		}
		const updateFields = {
			'contact_us.location': currentLocationsData,
			...(phone_no ? { 'contact_us.phone_no': phone_no } : {}),
			...(email ? { 'contact_us.email': email } : {}),
			...(hide_section !== undefined
				? { 'contact_us.hide_section': hide_section }
				: {}),
		};
		await shopUiService.updateShopUi(
			{
				shop: shop_id,
			},
			updateFields
		);

		const updatedData = await shopUiService.getUiDetailByShopId(shop_id);
		return sendSuccessResponse(
			res,
			updatedData,
			apiResponse.SHOP_CONTACT_SECTION_UPDATED_SUCCESSFUL.message,
			apiResponse.SHOP_CONTACT_SECTION_UPDATED_SUCCESSFUL.code
		);
	} catch (error: any) {
		if (error instanceof ValidationError) {
			return sendErrorResponse(
				res,
				error.message,
				apiResponse.VALIDATION_ERROR.code
			);
		}
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const uploadShopLogo = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const image = req.file;

		const s3BaseUrl = process.env.S3_BASE_URL || '';
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || '';
		const [shopData] = await shopService.findShops({ _id: shop_id });
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}
		if (!image) {
			return sendErrorResponse(
				res,
				'Image not found',
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		const fileName = `${new Date().getTime()}-${image.originalname}`;

		if (shopData.stripe_account) {
			const data = await shopService.uploadLogoToStripeTemp(
				image.buffer,
				fileName,
				image.mimetype
			);
			await stripe.accounts.update(shopData.stripe_account, {
				settings: {
					branding: {
						logo: data.id,
					},
				},
			});
		}

		const uploadedImage = await shopService.uploadLogoToS3(
			image.buffer,
			fileName,
			image.mimetype
		);
		// Filter the S3 URL
		const filteredLogoUrl = uploadedImage.Location.replace(
			s3BaseUrl,
			cleanBaseUrl
		);
		await shopService.updateShop(
			{ _id: shop_id },
			{ logo_url: filteredLogoUrl }
		);

		sendSuccessResponse(
			res,
			{ url: filteredLogoUrl },
			apiResponse.SHOP_UPDATED_SUCCESSFUL.message,
			apiResponse.SHOP_UPDATED_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getFilteredShops = async (req: Request, res: Response) => {
	try {
		const {
			sort_by = 'created_at',
			sort_order = 'desc',
			search_value,
			column_filters,
			city,
			available_service,
			studio_integration,
			is_open,
			is_verified,
			studio_slug,
			is_giftcard_partner,
			studio_name,
			claimed_by,
		}: {
			sort_by?: string;
			sort_order?: 'asc' | 'desc';
			search_value?: string;
			column_filters?: string;
			city?: string;
			available_service?: string;
			studio_integration?: string | string[];
			is_open?: boolean;
			is_verified?: string;
			is_giftcard_partner?: string;
			studio_slug?: string;
			studio_name?: string;
			claimed_by?: string;
		} = req.body;
		const { page, size }: { page?: string; size?: string } = req.query;
		const { limit, offset } = getPagination(page, size);
		// Parse column filters from the request
		const parsedColumnFilters: { id: string; value: string }[] = JSON.parse(
			column_filters || '[]'
		);

		// Construct filters from the request body
		const bodyFilters: { id: string; value: string }[] = [
			...(city ? [{ id: 'city', value: city }] : []),
			...(studio_slug ? [{ id: 'studio_slug', value: studio_slug }] : []),
			...(studio_name ? [{ id: 'studio_name', value: studio_name }] : []),
			...(claimed_by ? [{ id: 'claimed_by', value: claimed_by }] : []),
			...(available_service
				? [{ id: 'available_service', value: available_service }]
				: []),
			...(studio_integration
				? [
						{
							id: 'studio_integration',
							value: Array.isArray(studio_integration)
								? ({ $in: studio_integration } as unknown as string)
								: studio_integration,
						},
				  ]
				: []),
			...(is_verified !== undefined
				? [{ id: 'is_verified', value: is_verified }]
				: []),
			...(is_giftcard_partner !== undefined
				? [{ id: 'is_giftcard_partner', value: is_giftcard_partner }]
				: []),
		];

		// Combine unique filters
		const combinedFilters = [
			...parsedColumnFilters,
			...bodyFilters.filter(
				(bf) => !parsedColumnFilters.some((pcf) => pcf.id === bf.id)
			),
		];
		// Fetch filtered shops
		const { rows } = await shopService.getFilteredShopsForListing({
			limit,
			offset,
			sort_by,
			sort_order,
			search_value,
			column_filters: combinedFilters,
		});
		let filteredShops = rows.filter((shop) => shop.listing_details);
		const isShopOpen = (opening_hours: any[]) => {
			const currentDay = new Date().toLocaleString('en-us', {
				weekday: 'long',
			});
			const currentTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS format

			return opening_hours.some((schedule) => {
				if (schedule.day_of_week.includes(currentDay)) {
					const { opening_time, closing_time } = schedule;
					return (
						opening_time !== 'Closed' &&
						closing_time !== 'Closed' &&
						opening_time <= currentTime &&
						currentTime <= closing_time
					);
				}
				return false;
			});
		};

		// Filter shops based on open status
		if (is_open !== undefined) {
			filteredShops = filteredShops.filter(
				(shop) =>
					isShopOpen(shop.listing_details.opening_hours_specification) ===
					is_open
			);
		}

		const formatOpeningHours = (opening_hours: any[]) => {
			const weeklyHours: {
				[key: string]: { opening_time: string; closing_time: string }[];
			} = {};

			// Populate weeklyHours with times for each day
			opening_hours.forEach(({ day_of_week, opening_time, closing_time }) => {
				day_of_week.forEach((day: string) => {
					if (!weeklyHours[day]) {
						weeklyHours[day] = [];
					}
					weeklyHours[day].push({ opening_time, closing_time });
				});
			});

			// Merge times into single range per day
			const formattedHours = Object.keys(weeklyHours).map((day) => {
				const times = weeklyHours[day];

				if (times.length > 1) {
					// Find the earliest opening time and the latest closing time to merge them
					const opening_time = times.reduce(
						(earliest, current) =>
							current.opening_time < earliest ? current.opening_time : earliest,
						times[0].opening_time
					);
					const closing_time = times.reduce(
						(latest, current) =>
							current.closing_time > latest ? current.closing_time : latest,
						times[0].closing_time
					);

					return { day, times: [`${opening_time} - ${closing_time}`] };
				}

				// If there's only one range, use it directly
				return {
					day,
					times: [`${times[0].opening_time} - ${times[0].closing_time}`],
				};
			});

			return formattedHours.length > 0
				? formattedHours
				: [{ day: 'Closed', times: [] }];
		};

		for (let shop of filteredShops) {
			const reviews = await getReviewsByListingId(
				shop?.listing_details?._id,
				null
			);

			const overallRating =
				reviews.length > 0
					? getCombinedRatings(reviews)
					: { overallAverage: 0, reviewCount: 0 }; // Default values when no reviews are found

			// Extract values from overallRating
			const { overallAverage, reviewCount } = overallRating;

			const ratingScore = overallAverage
				? overallAverage * Math.log(reviewCount + 1)
				: 0;

			shop.ratingScore = ratingScore;
			shop.overallRating = overallRating; // Attach the overall rating details

			// Format the opening hours and attach to shop object
			shop.formattedOpeningHours = formatOpeningHours(
				shop.listing_details.opening_hours_specification
			);
			shop.is_open = isShopOpen(
				shop.listing_details.opening_hours_specification
			);
			shop.nonEmptyFieldCount = countNonEmptyFields(shop.listing_details);
		}

		filteredShops.sort((a, b) => {
			if (b.ratingScore === a.ratingScore) {
				// If the rating score is the same, randomize the order
				return Math.random() - 0.5;
			}
			return b.ratingScore - a.ratingScore;
		});
		// Prepare and send the response data
		const responseData = {
			shops: filteredShops,
			total_shops: filteredShops.length,
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

const getCitiesWithStudiosController = async (req: Request, res: Response) => {
	const cityFilter = req.query.city as string;
	const page = req.query.page as string;
	const size = req.query.limit as string;
	const cityArray = cityFilter ? cityFilter.split(',') : [];
	try {
		const { limit, offset } = getPagination(page, size);
		const cities = await shopService.getUniqueCitiesWithStudios(
			// cityFilter,
			cityArray,
			offset,
			limit
		); // Pass the filter to the function

		return sendSuccessResponse(
			res,
			{ cities },
			'Unique cities with studios retrieved successfully',
			200
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const requestVoucherController = async (req: Request, res: Response) => {
	// Assuming you have some way to get studio details by city
	try {
		const {
			name,
			email,
			phone,
			numberOfVouchers,
			valuePerVoucher,
			additionalInfo,
			studio_id,
		} = req.body;

		// Fetch studio details based on the city
		const studio = await shopService.findShops({ _id: studio_id });

		if (!studio || !studio[0].owner) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		// Invoke the requestVoucher function
		const result = await shopService.requestVoucher(
			{
				name,
				email,
				phone,
				numberOfVouchers,
				valuePerVoucher,
				additionalInfo,
				studio_id,
			},
			studio[0].studio_name || '',
			studio[0].owner
		);

		// Return a success response
		return sendSuccessResponse(
			res,
			result,
			apiResponse.REQUEST_VOUCHER_SUCCESSFUL.message,
			apiResponse.REQUEST_VOUCHER_SUCCESSFUL.code
		);
	} catch (error: any) {
		// Return error response
		return sendErrorResponse(
			res,
			error.message || 'Internal server error',
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getRequestVoucherController = async (req: Request, res: Response) => {
	try {
		const query = req.query;

		const result = await shopService.getRequestVoucher(query);

		return sendSuccessResponse(
			res,
			result.data,
			apiResponse.REQUEST_VOUCHERS_RETRIEVED.message,
			apiResponse.REQUEST_VOUCHERS_RETRIEVED.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message || 'Internal server error',
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default {
	getShopDetailsById,
	updateGiftCardSettings,
	getShopDetailsByStudioId,
	getAllShops,
	updateShop,
	createShop,
	getAllShopsForDropdown,
	getShopDetailsByStudioSlug,
	updatePurchaseHeroSection,
	updatePurchaseAboutUsSection,
	updatePurchaseFaqSection,
	updatePurchaseContactUsSection,
	uploadShopLogo,
	getAllShopsForReemption,
	getFilteredShops,
	getCitiesWithStudiosController,
	getShopDetailsForListingPage,
	requestVoucherController,
	getRequestVoucherController,
};
