import {
	ShopAttributes,
	ShopInput,
	ShopStatus,
	StudioMode,
	shopCreateSchema,
	shopUpdateSchema,
} from '../types/shops';
import { AnyKeyObject } from '../types';
import {
	BackgroundTemplateImageModel,
	ListingDetailsModel,
	ShopModel,
	ShopUiModel,
	TaxTypeModel,
	UserModel,
} from '../database/models';
import GiftCardTemplate from '../database/models/giftcard_templates';
import { UserAttributes, UserRoles } from '../types/users';
import { GiftCardAttributes } from '../types/giftcards';
import { ClientSession, FilterQuery, Types, UpdateQuery } from 'mongoose';
import { stripe } from '../utils/stripe.helper';
import AWS from 'aws-sdk';
import ShopUiService from '../services/shop_ui.service';
import { ShopUiInput } from '../types/shops_ui';
import { apiResponse, HERO_SECTION_IMAGES } from '../utils/constant';
import { GiftCardTemplateAttributes } from '../types/giftcard_templates';
import { StudioIntegrations } from '../types/user_settings';
import {
	getCoordinatesForCity,
	getCoordinatesForStudio,
} from '../utils/helper';
import { ListingAttributes, ListingInput } from '../types/listing_details';
import invoiceService from './invoice.service';
import { RequestVoucher } from '../database/models/voucher_requests';
import { getReviewsByListingId } from './review.service';
import { getCombinedRatings } from '../controllers/review_controller';
import mailchecker from 'mailchecker';

const s3 = new AWS.S3({
	region: process.env.AWS_S3_REGION,
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

const findShops = async (
	conditions: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const shopsData = await ShopModel.find({
			...conditions,
			deleted_at: null,
		})
			.session(clientSession)
			.lean();
		return shopsData as ShopAttributes[];
	} catch (error) {
		throw error;
	}
};

const updateShop = async (
	condition: FilterQuery<ShopAttributes>,
	updateFields: UpdateQuery<ShopInput>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await ShopModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields,
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const createShop = async (
	shopFields: ShopInput,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const shopData: any[] = await ShopModel.create([shopFields], {
			session: clientSession,
		});
		return shopData[0] as ShopAttributes;
	} catch (error) {
		throw error;
	}
};

const getShopDetails = async (shop_id: string) => {
	try {
		const shopData = await ShopModel.aggregate([
			{ $match: { deleted_at: null, _id: new Types.ObjectId(shop_id) } },
			{
				$lookup: {
					from: 'giftcard_templates',
					localField: 'templates',
					foreignField: '_id',
					as: 'templates',
					pipeline: [
						{
							$match: { deleted_at: null },
						},
						{
							$sort: { order_index: 1 },
						},
						{
							$lookup: {
								from: 'template_bg_imgs', 
								localField: 'template_image', 
								foreignField: '_id', 
								as: 'template_image',
								pipeline: [
									
									{
										$project: {
											_id: 1,
											image_url: 1,
										},
									},
								],
							},
						},
						{
							$unwind: '$template_image',
						},
						{
							$project: {
								created_at: 0,
								deleted_at: 0,
								updated_at: 0,
							},
						},
					],
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$project: {
								_id: 1,
								email: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1 } },
					],
				},
			},
			{
				$unwind: '$user_settings',
			},
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
					pipeline: [
						{
							$project: {
								_id: 1,
								title: 1,
								description: 1,
								percentage: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$tax_type',
			},
		]);
		if (shopData.length) {
			const shopUiData = await ShopUiService.getUiDetailByShopId(shop_id);
			shopData[0].shop_ui = shopUiData;
		}

		return (shopData[0] || null) as
			| (ShopAttributes & {
					templates: Omit<
						GiftCardTemplateAttributes,
						'created_at' | 'updated_at' | 'deleted_at'
					>[];
			  })
			| null;
	} catch (error) {
		throw error;
	}
};

const getAllShops = async (params: {
	limit: number;
	offset: number;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	search_value?: string;
	column_filters?: { id: string; value: string }[];
}) => {
	try {
		const shopConditions: AnyKeyObject = {};
		const shopSearchFields = [
			'studio_name',
			'official_name',
			'owner',
			// 'studio_id',
			'shop_url',
			'studio_slug',
			// 'platform_fee',
			// 'fixed_payment_fee',
			'studio_mode',
			'tax_id',
			'country',
			'city',
			'street',
			'phone',
			'iban',
			'bic',
			'bank_name',
		];
		const searchCondition: AnyKeyObject = { or: [], and: [] };

		if (!params.search_value && params.column_filters?.length) {
			// console.log('params.column_filters', params.column_filters);
			searchCondition.and = params.column_filters
				.filter((filter) => shopSearchFields.includes(filter.id))
				.map((filter) => ({
					[filter.id]: {
						$regex: filter.value,
						$options: 'i',
					},
				}));
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'studio_id':
						searchCondition.and.push({
							['studio_id']: +filter.value,
						});
						break;
					case 'platform_fee':
						searchCondition.and.push({
							['platform_fee']: +filter.value,
						});
						break;
					case 'fixed_payment_fee':
						searchCondition.and.push({
							['fixed_payment_fee']: +filter.value,
						});
					case 'tax_type':
						searchCondition.and.push({
							['tax_type._id']: new Types.ObjectId(filter.value),
						});
						break;
					case 'status':
						searchCondition.and.push({
							['status']: filter.value,
						});
						break;
					case 'studio_mode':
						searchCondition.and.push({
							['studio_mode']: filter.value,
						});
						break;
					case 'stripe_onboarding_status':
						searchCondition.and.push({
							['stripe_onboarding_status']: filter.value,
						});
						break;
					case 'login_email':
						searchCondition.and.push({
							['user.email']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'platform_redeem_fee':
						searchCondition.and.push({
							['platform_redeem_fee']: +filter.value,
						});
						break;
					case 'fixed_payment_redeem_fee':
						searchCondition.and.push({
							['fixed_payment_redeem_fee']: +filter.value,
						});
					default:
						break;
				}
			}
		}

		if (params.search_value) {
			searchCondition.or = shopSearchFields.map((field) => ({
				[field]: {
					$regex: params.search_value,
					$options: 'i',
				},
			}));
			if (!isNaN(+params.search_value)) {
				searchCondition.or.push({ studio_id: +params.search_value });
				searchCondition.or.push({ platform_fee: +params.search_value });
				searchCondition.or.push({ fixed_payment_fee: +params.search_value });
				searchCondition.or.push({ platform_redeem_fee: +params.search_value });
				searchCondition.or.push({
					fixed_payment_redeem_fee: +params.search_value,
				});
			}
			searchCondition.or.push({
				'status': params.search_value,
			});
			searchCondition.or.push({
				'stripe_onboarding_status': params.search_value,
			});
			searchCondition.or.push({
				'tax_type.title': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'user.email': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
		}

		if (params.sort_by && params.sort_by === 'tax_type') {
			params.sort_by = 'tax_type.title';
		}

		// console.log(params.sort_by);

		const shopData = await ShopModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...shopConditions,
				},
			},
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, title: 1 } },
					],
				},
			},
			{
				$unwind: '$tax_type',
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$project: {
								_id: 1,
								email: 1,
								hashed_password: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1 } },
					],
				},
			},
			{
				$unwind: '$user_settings',
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
					standard_text: 0,
					created_at: 0,
					updated_at: 0,
					deleted_at: 0,
				},
			},
		]);

		const totalCount = await ShopModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...shopConditions,
				},
			},
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, title: 1 } },
					],
				},
			},
			{
				$unwind: '$tax_type',
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
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
				$unwind: '$user',
			},
			{
				$count: 'count',
			},
		]);

		return {
			rows: shopData,
			count: totalCount[0]?.count || 0,
		};
	} catch (error) {
		throw error;
	}
};

const getFilteredShopsForListing = async (params: {
	limit: number;
	offset: number;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	search_value?: string;
	column_filters?: { id: string; value: string }[];
}) => {
	try {
		const shopConditions: AnyKeyObject = {};
		const shopSearchFields = [
			// 'studio_name',
			'official_name',
			'owner',
			// 'studio_id',
			'shop_url',
			'studio_slug',
			// 'platform_fee',
			// 'fixed_payment_fee',
			'studio_mode',
			'tax_id',
			'country',
			'city',
			'street',
			'phone',
			'iban',
			'bic',
			'bank_name',
		];
		const searchCondition: AnyKeyObject = { or: [], and: [] };
		const toBoolean = (value: any) => {
			if (value === 'true') return true;
			if (value === 'false') return false;
			return Boolean(value); // Default conversion
		};
		if (!params.search_value && params.column_filters?.length) {
			// console.log('params.column_filters', params.column_filters);
			searchCondition.and = params.column_filters
				.filter((filter) => shopSearchFields.includes(filter.id))
				.map((filter) => ({
					[filter.id]: {
						$regex: filter.value,
						$options: 'i',
					},
				}));
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'studio_id':
						searchCondition.and.push({
							['studio_id']: +filter.value,
						});
						break;
					case 'platform_fee':
						searchCondition.and.push({
							['platform_fee']: +filter.value,
						});
						break;
					case 'fixed_payment_fee':
						searchCondition.and.push({
							['fixed_payment_fee']: +filter.value,
						});
					case 'tax_type':
						if (typeof filter.value === 'string') {
							searchCondition.and.push({
								['tax_type._id']: new Types.ObjectId(filter.value),
							});
						}
						break;
					case 'status':
						searchCondition.and.push({
							['status']: filter.value,
						});
						break;
					case 'studio_mode':
						searchCondition.and.push({
							['studio_mode']: filter.value,
						});
						break;
					case 'stripe_onboarding_status':
						searchCondition.and.push({
							['stripe_onboarding_status']: filter.value,
						});
						break;
					case 'login_email':
						searchCondition.and.push({
							['user.email']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'city':
						searchCondition.and.push({
							['city']: {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'platform_redeem_fee':
						searchCondition.and.push({
							['platform_redeem_fee']: +filter.value,
						});
						break;
					case 'fixed_payment_redeem_fee':
						searchCondition.and.push({
							['fixed_payment_redeem_fee']: +filter.value,
						});
						break;
					case 'is_verified':
						searchCondition.and.push({
							'listing_details.is_verified': toBoolean(filter.value),
						});
						break;
					case 'claimed_by':
						searchCondition.and.push({
							'listing_details.claimed_by': filter.value,
						});
						break;
					case 'is_giftcard_partner':
						searchCondition.and.push({
							'is_giftcard_partner': toBoolean(filter.value),
						});
						break;
					case 'studio_integration':
						searchCondition.and.push({
							$or: [
								{ ['user_settings.studio_integration']: 'universal_studio' },
								{ ['user_settings.studio_integration']: filter.value },
							],
						});
						break;
					case 'available_service':
						if (Array.isArray(filter.value)) {
							searchCondition.and.push({
								['listing_details.available_service']: {
									'$elemMatch': {
										name: { '$in': filter.value }, // Correct this line
									},
								},
							});
						}
						break;
					case 'studio_slug':
						searchCondition.and.push({
							['studio_slug']: filter.value,
						});
						break;
					case 'studio_name':
						searchCondition.and.push({
							'listing_details.studio_name': filter.value,
						});
						break;

					default:
						break;
				}
			}
		}
		if (params.search_value) {
			searchCondition.or = shopSearchFields.map((field) => ({
				[field]: {
					$regex: params.search_value,
					$options: 'i',
				},
			}));
			if (!isNaN(+params.search_value)) {
				searchCondition.or.push({ studio_id: +params.search_value });
				searchCondition.or.push({ platform_fee: +params.search_value });
				searchCondition.or.push({ fixed_payment_fee: +params.search_value });
				searchCondition.or.push({ platform_redeem_fee: +params.search_value });
				searchCondition.or.push({
					fixed_payment_redeem_fee: +params.search_value,
				});
			}
			searchCondition.or.push({
				'status': params.search_value,
			});
			searchCondition.or.push({
				'stripe_onboarding_status': params.search_value,
			});
			searchCondition.or.push({
				'tax_type.title': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'user.email': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
		}

		if (params.sort_by && params.sort_by === 'tax_type') {
			params.sort_by = 'tax_type.title';
		}

		// console.log(params.sort_by);

		const shopData = await ShopModel.aggregate([
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, title: 1 } },
					],
				},
			},
			{
				$unwind: '$tax_type',
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$project: {
								_id: 1,
								email: 1,
								hashed_password: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1 } },
					],
				},
			},
			{
				$unwind: '$user_settings',
			},
			{
				$lookup: {
					from: 'listing_details', // Change this to your actual listing details collection name
					localField: '_id',
					foreignField: 'shop', // Change this to the actual field that references shop ID
					as: 'listing_details',
				},
			},
			{
				$unwind: { path: '$listing_details', preserveNullAndEmptyArrays: true },
			},
			{
				$match: {
					deleted_at: null,
					...shopConditions,
					...(searchCondition.or.length ? { $or: searchCondition.or } : {}),
					...(searchCondition.and.length ? { $and: searchCondition.and } : {}),
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
					standard_text: 0,
					created_at: 0,
					updated_at: 0,
					deleted_at: 0,
				},
			},
		]);
		// Fetch coordinates for each shop
		const shopsWithCoordinates = await Promise.all(
			shopData.map(async (shop) => {
				const { street, city, country } = shop; // Assuming these fields exist in your shop data
				const studioCoordinates = await getCoordinatesForStudio(
					street,
					city,
					country
				);
				return { ...shop, studioCoordinates }; // Merge coordinates into shop object
			})
		);
		const totalCount = await ShopModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...shopConditions,
				},
			},
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, title: 1 } },
					],
				},
			},
			{
				$unwind: '$tax_type',
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
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
				$unwind: '$user',
			},
			{
				$count: 'count',
			},
		]);

		return {
			rows: shopsWithCoordinates,
			count: totalCount[0]?.count || 0,
		};
	} catch (error) {
		throw error;
	}
};

const getAllShopsForDropdown = async ({
	userRole,
}: {
	userRole?: UserRoles;
}) => {
	try {
		const shopData = await ShopModel.aggregate([
			{
				$match: {
					deleted_at: null,
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$match: {
								deleted_at: null,
								...(userRole ? { role: userRole } : {}),
							},
						},
						{
							$project: {
								_id: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1 } },
					],
				},
			},
			{
				$unwind: '$user_settings',
			},
			{
				$project: {
					_id: 1,
					studio_name: 1,
					user: 1,
				},
			},
		]);
		return shopData;
	} catch (error) {
		throw error;
	}
};

const validateCreateShop = async (data: any) => {
	try {
		if (data.country) {
			data.country = JSON.parse(data.country);
		}
		const parsedData = await shopCreateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});

		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validateUpdateShop = async (data: any) => {
	try {
		if (data.country) {
			data.country = JSON.parse(data.country);
		}
		const parsedData = await shopUpdateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});

		return parsedData;
	} catch (error) {
		throw error;
	}
};

const getShopDetailsByStudioSlug = async (studio_slug: string) => {
	try {
		const shopData = await ShopModel.aggregate([
			{ $match: { deleted_at: null, studio_slug } },
			{
				$lookup: {
					from: 'giftcard_templates',
					localField: 'templates',
					foreignField: '_id',
					as: 'templates',
					pipeline: [
						{
							$match: { deleted_at: null },
						},
						{
							$sort: { order_index: 1 },
						},
						{
							$lookup: {
								from: 'template_bg_imgs', 
								localField: 'template_image', 
								foreignField: '_id', 
								as: 'template_image',
								pipeline: [
									{
										$match: { deleted_at: null },
									},
									{
										$project: {
											_id: 1,
											image_url: 1,
										},
									},
								],
							},
						},
						{
							$unwind: '$template_image',
						},
						{
							$project: {
								created_at: 0,
								deleted_at: 0,
								updated_at: 0,
							},
						},
					],
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$project: {
								_id: 1,
								email: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1 } },
					],
				},
			},
			{
				$unwind: '$user_settings',
			},
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
					pipeline: [
						{
							$project: {
								_id: 1,
								title: 1,
								description: 1,
								percentage: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$tax_type',
			},
		]);
		return shopData
	} catch (error) {
		throw error;
	}
};

const getShopDetailsByStudioId = async (studioId: string) => {
	try {
		const shopData = await ShopModel.aggregate([
			{ $match: { deleted_at: null, studio_id: parseInt(studioId) } },
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$project: {
								_id: 1,
								email: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$project: {
					standard_text: 0,
				},
			},
		]);

		return shopData as Array<
			Omit<
				ShopAttributes,
				'created_at' | 'updated_at' | 'deleted_at' | 'user' | 'standard_text'
			> & {
				user: Pick<UserAttributes, '_id' | 'email' | 'role'>;
			}
		>;
	} catch (error) {
		throw error;
	}
};

const uploadLogoToStripe = async (
	bucket: string,
	key: string,
	contentType: string,
	fileName: string
) => {
	const params = {
		Bucket: bucket,
		Key: key,
	};

	try {
		const data = await s3.getObject(params).promise();

		const upload = await stripe.files.create({
			file: {
				data: data.Body as Buffer,
				name: fileName,
				type: contentType,
			},
			purpose: 'business_logo',
		});
		return upload;
	} catch (error) {
		throw error;
	}
};

const uploadLogoToStripeTemp = async (
	buffer: Buffer,
	fileName: string,
	fileType: string
) => {
	try {
		const stripeUpload = await stripe.files.create({
			file: {
				data: buffer,
				name: fileName,
				type: fileType,
			},
			purpose: 'business_logo',
		});
		return stripeUpload;
	} catch (error) {
		throw error;
	}
};

const uploadLogoToS3 = async (
	buffer: Buffer,
	fileName: string,
	fileType: string
) => {
	try {
		const params = {
			Bucket: process.env.AWS_S3_BUCKET_NAME as string,
			Key: `uploads/${fileName}`,
			Body: buffer,
			ContentType: fileType,
		};
		const s3Upload = await s3.upload(params).promise();

		return s3Upload;
	} catch (error) {
		throw error;
	}
};

const getDefaultShopUiData = (shop_id: Types.ObjectId) => {
	try {
		const shopUiFields: ShopUiInput = {
			shop: shop_id,
			hero_section: {
				title: 'Wohlbefinden verschenken',
				subtitle: 'Gutscheine direkt hier zum Sofort-Download',
				description:
					'Entspannen und Genießen mit einem Gutschein für Thai-Massage',
				background_color: '#009916',
				hide_section: false,
				text_color: '#ffffff',
				carousel: HERO_SECTION_IMAGES.map((image, index) => ({
					_id: new Types.ObjectId(),
					image_url: image,
					index: ++index,
				})),
			},
			template_section: {
				background_color: '#f7f7f7',
			},
			about_us: {
				description: `Danke für Ihren Besuch in unserem Gutschein-Shop.
Bei uns können Sie nicht nur wohltuende Massagen genießen, sondern auch Gutscheine erwerben, um das perfekte Entspannungs-Erlebnis zu verschenken. Entdecken Sie unsere zahlreichen Vorlagen - sicherlich ist auch etwas für Ihren Zweck etwas passendes dabei.`,
				background_color: '#f6ffe2',
				text_color: '#111111',
				hide_section: false,
				list_items: [
					{
						_id: new Types.ObjectId(),
						description: 'Sofortiger Download',
						index: 1,
					},
					{
						_id: new Types.ObjectId(),
						description:
							'Flexible Bezahlmöglichkeiten: Kreditkarte, Paypal oder Banküberweisung',
						index: 2,
					},
					{
						_id: new Types.ObjectId(),
						description: 'Persönliches Geschenk durch Individualisierung',
						index: 3,
					},
					{
						_id: new Types.ObjectId(),
						description: 'Lange Gültigkeit (3 Jahre und mehr)',
						index: 4,
					},
					{
						_id: new Types.ObjectId(),
						description: 'Flexibel: Einlösbar für unser komplettes Angebot',
						index: 5,
					},
				],
				list_item_icon_color: '#70bf0c',
			},
			faq: {
				background_color: '#009916',
				header_bg_color: '#ededed',
				header_text_color: '#111111',
				hide_section: false,
				list_items: [
					{
						_id: new Types.ObjectId(),
						title: 'Wie lange ist ein Gutschein gültig?',
						description:
							'<p>Unsere Gutscheine sind immer für mindestens 3 Jahre ab Kaufdatum gültig. Der Ablauf ist immer zum jeweiligen Jahresende.</p>',
						index: 1,
					},
					{
						_id: new Types.ObjectId(),
						title: 'Wie kann der Gutschein eingelöst werden?',
						description:
							'<p>Die Einlösung erfolgt ganz unkompliziert bei uns vor Ort.</p><p>Da wir spontan nicht immer freie Kapazitäten haben, ist eine Terminvereinbarung vorab dringend zu empfehlen.<br>Jeder Gutschein ist mit einem Gutschein-Code, sowie einem Geheim-Code versehen. Mit diesen beiden Informationen kann der Gutschein bei uns eingelöst werden.</p>',
						index: 2,
					},
					{
						_id: new Types.ObjectId(),
						title: 'Wie kann der Gutschein eingelöst werden?',
						description:
							'<p>Wir bieten verschiedene Bezahlmöglichkeiten an:</p><ul><li>Kreditkarte</li><li>Paypal</li><li>Banküberweisung (der Gutschein wird Ihnen sofort zugestellt. Die Aktivierung erfolgt erst nach Geldeingang)</li></ul>',
						index: 3,
					},
					{
						_id: new Types.ObjectId(),
						title: 'Wann erhalte ich den Gutschein?',
						description:
							'<p>Direkt im Anschluss der Bestellung können Sie den Gutschein herunterladen.</p><p>Außerdem erhalten Sie eine E-Mail, in welcher Ihnen ebenfalls der Gutschein bereitgestellt wird.</p>',
						index: 4,
					},
					{
						_id: new Types.ObjectId(),
						title:
							'Was passiert wenn ich keinen Zugriff mehr auf den Gutschein habe, oder sonstige Anliegen habe?',
						description:
							'<p>Kontaktieren Sie bitte unseren Support unter <a href="mailto:support@thai-massage.de">support@thai-massage.de</a></p><p>Bitte beachten Sie, dass eine Neuzustellung erst nach Verifizierung möglich ist.</p><p>Hierzu teilen Sie uns bitte das Kaufdatum mit, sowie die Rechnungsnummer.</p><p>&nbsp;</p>',
						index: 5,
					},
				],
			},
			contact_us: {
				phone_no: '+49 (151) 12345678',
				email: 'gutschein@example.com',
				hide_section: false,
				location: [],
			},
			deleted_at: null,
		};

		return shopUiFields;
	} catch (error) {
		throw error;
	}
};

const removeTemplateFromShops = async (
	template_id: Types.ObjectId,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await ShopModel.updateMany(
			{ templates: template_id },
			{ $pull: { templates: template_id } },
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};
const getAllShopsForReemption = async ({
	studioId,
	studioName,
	limit = 10,
}: {
	studioId?: string;
	studioName?: string;
	limit?: number;
}) => {
	try {
		const shopData = await ShopModel.aggregate([
			{
				$match: {
					deleted_at: null, // Shop should not be deleted
					status: ShopStatus.ACTIVE, // Shop should be active
					studio_mode: StudioMode.LIVE, // Shop should be live
					...(studioId ? { studio_id: studioId } : {}),
					...(studioName ? { studio_name: studioName } : {}),
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$match: {
								deleted_at: null, // User should not be deleted
								role: { $ne: UserRoles.ADMIN }, // Exclude users with ADMIN role
							},
						},
						{
							$project: {
								studio_id: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1 } },
					],
				},
			},
			{
				$unwind: '$user_settings',
			},
			{
				$match: {
					'user_settings.studio_integration': {
						$in: [
							StudioIntegrations.UNIVERSAL,
							StudioIntegrations.UNIVERSAL_AND_STUDIO,
						],
					},
				},
			},
			{
				$project: {
					studio_id: 1, // Return the studioId field
					studio_name: 1, // Return the studio name
					created_at: 1, // Return the created_at field
					studio_integration: '$user_settings.studio_integration',
				},
			},
			{
				$sort: { created_at: -1 }, // Sort by created_at in descending order
			},
			{
				$limit: limit, // Apply limit to the results
			},
		]);
		return shopData;
	} catch (error) {
		throw error;
	}
};

const getStudiosByCity = async ({
	city,
	userRole,
}: {
	city: string; // The city to filter studios
	userRole?: UserRoles; // Optional user role to filter users
}) => {
	try {
		const studioData = await ShopModel.aggregate([
			{
				$match: {
					deleted_at: null,
					city: city, // Filter by the specified city
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: 'user',
					foreignField: '_id',
					as: 'user',
					pipeline: [
						{
							$match: {
								deleted_at: null,
								...(userRole ? { role: userRole } : {}), // Filter by user role if provided
							},
						},
						{
							$project: {
								_id: 1,
								role: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$user',
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1 } },
					],
				},
			},
			{
				$unwind: '$user_settings',
			},
			{
				$project: {
					_id: 1,
					studio_name: 1,
					user: 1,
					user_settings: 1, // Include user settings if needed
				},
			},
		]);

		return studioData;
	} catch (error) {
		throw error;
	}
};

const getUniqueCitiesWithStudios = async (
	cityFilter?: string[],
	offset: number = 0,
	limit: number = 10
) => {
	try {
		const matchStage: any = {
			deleted_at: null,
		};

		// If a city filter is provided, add it to the match stage
		// if (cityFilter) {
		// 	matchStage.city = { $regex: new RegExp(`^${cityFilter}$`, 'i') }; // Case-insensitive match
		// }
		if (cityFilter && cityFilter.length > 0) {
			matchStage.city = {
				$in: cityFilter.map((city) => new RegExp(`^${city}$`, 'i')),
			}; // Case-insensitive match
		}

		const uniqueCities = await ShopModel.aggregate([
			{
				$match: matchStage, // Use the constructed match stage
			},
			{
				$lookup: {
					from: 'listing_details',
					localField: '_id',
					foreignField: 'shop',
					as: 'listing_details',
				},
			},
			{
				$unwind: {
					path: '$listing_details',
					preserveNullAndEmptyArrays: false, // Allow studios without listing details
				},
			},
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'shop',
					as: 'user_settings',
					pipeline: [
						{ $match: { deleteAt: null } },
						{ $project: { _id: 1, studio_integration: 1, is_verified: 1 } }, // Include is_verified for sorting
					],
				},
			},
			{
				$unwind: {
					path: '$user_settings',
					preserveNullAndEmptyArrays: true, // Allow shops without user settings
				},
			},
			{
				$group: {
					_id: { $toLower: '$city' }, // Group by lowercase city names
					city: { $first: '$city' }, // Preserve original case for the first occurrence of the city
					city_image_url: { $first: '$listing_details.city_image_url' }, // Get the first city_image_url
					studios: {
						$push: {
							shop_id: '$_id',
							studio_name: '$studio_name',
							studio_slug: '$studio_slug',
							studio_id: '$studio_id',
							owner: '$owner',
							studio_mode: '$studio_mode',
							status: '$status',
							street: '$street', // Add street information
							country: '$country.name',
							studio_integration: '$user_settings.studio_integration',
							is_verified: '$user_settings.is_verified', // Include is_verified for sorting
							listing_details: '$listing_details', // Include listing details for each studio
						},
					},
					studioCount: { $sum: 1 }, // Count total studios for this city
				},
			},
			{
				$project: {
					city: '$_id',
					city_image_url: 1,
					studios: 1,
					_id: 0,
					studioCount: 1,
				},
			},
			{ $sort: { city: 1 } },
			...(cityFilter ? [] : [{ $skip: offset }, { $limit: limit }]),
		]);

		const citiesWithCoordinates = await Promise.all(
			uniqueCities.map(async (cityData) => {
				const integrationPriority: { [key: string]: number } = {
					'universal': 1,
					'universal_studio': 2,
					'studio': 3,
				};
				const sortedStudios = cityData.studios.sort((a: any, b: any) => {
					const aIntegrationPriority =
						integrationPriority[a.studio_integration] || 4; // Default to 4 if not found
					const bIntegrationPriority =
						integrationPriority[b.studio_integration] || 4; // Default to 4 if not found

					if (aIntegrationPriority !== bIntegrationPriority) {
						return aIntegrationPriority - bIntegrationPriority;
					}

					return Number(b.is_verified) - Number(a.is_verified); // Verified studios first
				});

				const limitedStudios = cityFilter
					? sortedStudios.slice(offset, offset + limit)
					: sortedStudios;

				const cityCoordinates = await getCoordinatesForCity(
					cityData.city,
					cityData.country
				);
				// Fetch coordinates for each studio in the city and attach overall ratings
				const studiosWithRatings = await Promise.all(
					limitedStudios.map(async (studio: any) => {
						const reviews = await getReviewsByListingId(
							studio.listing_details._id,
							null
						); // Fetch reviews by listing ID
						const overallRating = getCombinedRatings(reviews); // Calculate overall rating
						const { overallAverage, reviewCount } = overallRating;

						// Calculate the rating score based on the formula
						const ratingScore = overallAverage
							? overallAverage * Math.log(reviewCount + 1)
							: 0; // If overallAverage is null, fallback to 0

						const studioCoordinates = await getCoordinatesForStudio(
							studio.street,
							cityData.city,
							studio.country
						);
						return {
							...studio,
							studioCoordinates: studioCoordinates || { lat: null, lng: null }, // Add studio coordinates
							overallRating: overallRating, // Attach the overall rating details
							ratingScore: ratingScore, // Attach the rating score
						};
					})
				);
				return {
					city: cityData.city,
					country: cityData.country,
					cityCoordinates: cityCoordinates || { lat: null, lng: null }, // Add city coordinates
					city_image_url: cityData.city_image_url, // Include the first city image URL
					studioCount: cityData.studioCount,
					studios: studiosWithRatings,
				};
			})
		);

		return {
			success: true,
			status: 200,
			message: apiResponse.UNIQUE_CITIES_RETRIEVED_SUCCESS,
			data: {
				cities: citiesWithCoordinates,
			},
		};
	} catch (error) {
		console.error('Error retrieving unique cities with studios:', error);
		throw error; // Ensure you rethrow the error for higher-level error handling
	}
};

const requestVoucher = async (
	data: {
		name: string;
		email: string;
		phone?: string;
		numberOfVouchers: number;
		valuePerVoucher: number;
		additionalInfo?: string;
		studio_id: string;
	},
	studio_owner: string, // Studio owner's name
	studio_email: string // Studio's email address
) => {
	try {
		const {
			name,
			email,
			phone,
			numberOfVouchers,
			valuePerVoucher,
			additionalInfo,
			studio_id,
		} = data;

		if (!name || !email || !numberOfVouchers || !valuePerVoucher) {
			throw new Error('All required fields must be filled.');
		}

		// Validate the email using mailchecker
		const isEmailValid = mailchecker.isValid(email);
		if (!isEmailValid) {
			throw new Error('Invalid email format');
		}
		// Send the voucher request email to the studio
		await invoiceService.sendRequestVoucherMail(studio_email, studio_owner, {
			name,
			email,
			number: numberOfVouchers,
			value_per_voucher: valuePerVoucher,
			message: additionalInfo || 'No additional info provided.', // Ensure a message is always passed
		});

		// Save the voucher request to the database
		const newVoucherRequest = new RequestVoucher({
			shop_id: studio_id,
			name,
			email,
			phone,
			numberOfVouchers,
			valuePerVoucher,
			additionalInfo: additionalInfo || 'No additional info provided.',
			studioOwner: studio_owner,
			studioEmail: studio_email,
		});

		await newVoucherRequest.save();

		return { success: true, message: apiResponse.VOUCHER_REQUEST_SUCCESS };
	} catch (error) {
		console.error('Error sending voucher request:', error);
		throw error;
	}
};

const getRequestVoucher = async (query: any) => {
	try {
		const voucherRequests = await RequestVoucher.find(query); // Populate to get studio details

		return { success: true, data: voucherRequests };
	} catch (error) {
		console.error('Error fetching voucher requests:', error);
		throw new Error('Could not retrieve voucher requests');
	}
};

export default {
	findShops,
	getShopDetails,
	updateShop,
	createShop,
	getAllShops,
	getAllShopsForDropdown,
	getShopDetailsByStudioSlug,
	validateCreateShop,
	validateUpdateShop,
	uploadLogoToStripe,
	uploadLogoToS3,
	uploadLogoToStripeTemp,
	getDefaultShopUiData,
	removeTemplateFromShops,
	getShopDetailsByStudioId,
	getAllShopsForReemption,
	getStudiosByCity,
	getUniqueCitiesWithStudios,
	requestVoucher,
	getRequestVoucher,
	getFilteredShopsForListing,
};
