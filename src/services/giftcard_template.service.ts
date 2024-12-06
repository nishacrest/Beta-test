import {
	GiftCardTemplateAttributes,
	GiftCardTemplateInput,
	createTemplateSchema,
	updateTemplateSchema,
	// TemplateType
} from '../types/giftcard_templates';
import { AnyKeyObject } from '../types';
import {
	BackgroundTemplateImageModel,
	GiftCardTemplateModel,
} from '../database/models';
import {
	ClientSession,
	FilterQuery,
	ObjectId,
	PipelineStage,
	Types,
} from 'mongoose';
import {
	TemplateBackgroundImgAttributes,
	TemplateBackgroundImgInput,
} from '../types/template_bg_img';

const findGiftcardTemplates = async (
	condition: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const giftCardTemplateData: GiftCardTemplateAttributes[] =
			await GiftCardTemplateModel.find({
				...condition,
				deleted_at: null,
			})
				.session(clientSession)
				.lean();
		return giftCardTemplateData;
	} catch (error) {
		throw error;
	}
};

const createGiftcardTemplate = async (
	createFields: GiftCardTemplateInput[],
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const giftCardTemplate = await GiftCardTemplateModel.insertMany(
			createFields,
			{ session: clientSession }
		);
		const jsonData = giftCardTemplate.map((item) => item.toJSON());
		return jsonData as GiftCardTemplateAttributes[];
	} catch (error) {
		throw error;
	}
};

const addBackgroundTemplateImage = async (
	createFields: TemplateBackgroundImgInput[],
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const BackgroundTemplate = await BackgroundTemplateImageModel.insertMany(
			createFields,
			{ session: clientSession }
		);
		const jsonData = BackgroundTemplate.map((item) => item.toJSON());
		return jsonData as TemplateBackgroundImgAttributes[];
	} catch (error) {
		throw error;
	}
};

const deleteBackgroundTemplateImage = async (imageId: string) => {
	try {
		const image = await BackgroundTemplateImageModel.findById(imageId);
		if (!image) {
			return null;
		}
		image.deleted_at = new Date();
		const updatedImage = await image.save();

		return updatedImage;
	} catch (error) {
		throw error;
	}
};

const updateGiftcardTemplate = async (
	condition: AnyKeyObject,
	updateFields: Partial<GiftCardTemplateAttributes>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await GiftCardTemplateModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields,
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const deleteGiftcardTemplate = async (
	condition: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await GiftCardTemplateModel.updateMany(
			{ ...condition },
			{ deleted_at: new Date() },
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const getAllGiftCardTemplates = async () => {
	try {
		const templates = await GiftCardTemplateModel.find({
			deleted_at: null,
			// shop: null,
		})
			.select('-created_at -updated_at -deleted_at')
			.lean();

		return templates as Omit<
			GiftCardTemplateAttributes,
			'created_at' | 'updated_at' | 'deleted_at'
		>[];
	} catch (error) {
		throw error;
	}
};

const getBackgroundImages = async (filter: FilterQuery<any>) => {
	try {
		if (filter._id && typeof filter._id === 'string') {
			filter._id = new Types.ObjectId(filter._id);
		}

		const extendedFilter = {
			...filter,
			deleted_at: null,
		};

		const backgroundImages = await BackgroundTemplateImageModel.find(
			extendedFilter
		).lean();

		return backgroundImages;
	} catch (error) {
		throw error;
	}
};

const getBackgroundImagesWithPagination = async (
	filter: FilterQuery<any>,
	limit?: number,
	offset?: number
) => {
	try {
		// Convert _id to ObjectId if needed
		if (filter._id && typeof filter._id === 'string') {
			filter._id = new Types.ObjectId(filter._id);
		}

		// Extend filter to exclude deleted records
		const extendedFilter = {
			...filter,
			deleted_at: null,
		};

		// Aggregation pipeline for count and paginated data
		const pipeline = [
			{ $match: extendedFilter },
			{
				$facet: {
					data: [{ $skip: offset || 0 }, { $limit: limit || 10 }],
					totalCount: [{ $count: 'count' }],
				},
			},
		];

		const result = await BackgroundTemplateImageModel.aggregate(pipeline);

		const totalItems = result[0]?.totalCount[0]?.count || 0;
		const data = result[0]?.data || [];

		return { totalItems, data };
	} catch (error) {
		throw error;
	}
};

const getAllEligibleTemplates = async (
	studio_id: Types.ObjectId,
	isAdmin: boolean
) => {
	try {
		// Build the query conditions
		const conditions: any = { deleted_at: null };
		if (isAdmin) {
			// Admin: Fetch templates with "admin" or "all studios" types
			// conditions.$or = [
			// 	{ template_type: TemplateType.ADMIN },
			// 	{ template_type: TemplateType.ALL_STUDIOS },
			// 	{custom_template_type: { $in: [studio_id] }}
			// ];
		} else {
			// Non-admin: Fetch templates with "all studios" or custom templates matching studio_id
			// conditions.$or = [
			// 	{ template_type: TemplateType.ALL_STUDIOS },
			// 	{custom_template_type: { $in: [studio_id] }}
			// ];
		}

		// Fetch the templates based on the conditions
		const templates = await GiftCardTemplateModel.find(conditions)
			.select('-created_at -updated_at -deleted_at')
			.lean();

		return templates as Omit<
			GiftCardTemplateAttributes,
			'created_at' | 'updated_at' | 'deleted_at'
		>[];
	} catch (error) {
		throw error;
	}
};

const getGiftCardTemplateById = async (templateId: Types.ObjectId) => {
	try {
		const giftcardsTemplates = await GiftCardTemplateModel.aggregate([
			{
				$match: {_id: templateId, deleted_at: null},
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
								// template_name: 1,
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
					updated_at: 0,
					deleted_at: 0,
				},
			},
		]);
		return giftcardsTemplates[0] || null
	} catch (error) {
		throw error; // Rethrow the error for higher-level handling
	}
};
const getTemplatesByShop = async (
	shop: Types.ObjectId,
	limit: number,
	offset: number
) => {
	try {
		const condition: FilterQuery<GiftCardTemplateAttributes> = {
			shop: new Types.ObjectId(shop),
			deleted_at: null,
		};

		const giftcardsTemplates = await GiftCardTemplateModel.aggregate([
			{
				$match: condition,
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
								// template_name: 1,
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
				$skip: offset,
			},
			{
				$limit: limit,
			},
			{
				$project: {
					created_at: 0,
					updated_at: 0,
					deleted_at: 0,
				},
			},
		]);
		const totalCount = await GiftCardTemplateModel.aggregate([
			{
				$match: condition,
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
								// template_name: 1,
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
				$count: 'count',
			},
		]);

		return { giftcardsTemplates, count: totalCount[0]?.count || 0 };
	} catch (error) {
		throw error;
	}
};

const validateCreateTemplate = async (data: any) => {
	try {
		const parsedData = await createTemplateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});

		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validateUpdateTemplate = async (data: any) => {
	try {
		const parsedData = await updateTemplateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validatecreateTemplate = async (data: any) => {
	try {
		const parsedData = await createTemplateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};
export default {
	findGiftcardTemplates,
	createGiftcardTemplate,
	updateGiftcardTemplate,
	deleteGiftcardTemplate,
	getAllGiftCardTemplates,
	validateCreateTemplate,
	validateUpdateTemplate,
	getAllEligibleTemplates,
	addBackgroundTemplateImage,
	validatecreateTemplate,
	getBackgroundImages,
	deleteBackgroundTemplateImage,
	getTemplatesByShop,
	getGiftCardTemplateById,
	getBackgroundImagesWithPagination,
};
