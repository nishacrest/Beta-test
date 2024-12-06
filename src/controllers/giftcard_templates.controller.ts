import { UploadedType } from './../types/template_bg_img';
import { Request, Response } from 'express';
import { apiResponse } from '../utils/constant';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import mongoose, { ClientSession, isValidObjectId, Types } from 'mongoose';
import giftcardTemplateService from '../services/giftcard_template.service';
import { giftCardReddemSchema } from '../types/giftcards';
import { getPagination, omitFromObject } from '../utils/helper';
import {
	GiftCardTemplateAttributes,
	// TemplateType,
} from '../types/giftcard_templates';
import shopService from '../services/shop.service';
import { UserRoles } from '../types/users';
import userService from '../services/user.service';
import { session } from 'passport';
import { count } from 'console';

const getAllGiftCardTemplates = async (req: Request, res: Response) => {
	try {
		const templates = await giftcardTemplateService.getAllGiftCardTemplates();
		return sendSuccessResponse(
			res,
			templates,
			apiResponse.GIFTCARD_TEMPLATES_FOUND_SUCCESSFUL.message,
			apiResponse.GIFTCARD_TEMPLATES_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getAllEligibleTemplates = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const [existingShopByStudioId] = await shopService.findShops({
			_id: shop_id,
		});
		const user_data = await userService.findUsers({
			_id: existingShopByStudioId.user,
		});
		const user_role = user_data[0].role;
		const studio_id = existingShopByStudioId._id;

		const templates = await giftcardTemplateService.getAllEligibleTemplates(
			studio_id,
			user_role === UserRoles.ADMIN
		);

		return sendSuccessResponse(
			res,
			templates,
			apiResponse.GIFTCARD_TEMPLATES_FOUND_SUCCESSFUL.message,
			apiResponse.GIFTCARD_TEMPLATES_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const addGiftCardTemplate = async (req: Request, res: Response) => {
	try {
		const {
			template_name,
			template_headline,
			primary_color,
			secondary_color,
			template_image,
			shop,
		} = await giftcardTemplateService.validateCreateTemplate(req.body);
		const [createdTemplate] =
			await giftcardTemplateService.createGiftcardTemplate([
				{
					template_name,
					template_image,
					template_headline,
					primary_color,
					secondary_color,
					shop,
					deleted_at: null,
				},
			]);

		const createdTemplateData =
			await giftcardTemplateService.getGiftCardTemplateById(
				createdTemplate._id
			);

		// Return success response with the omitted data (including the image_url)
		return sendSuccessResponse(
			res,
			createdTemplateData,
			apiResponse.GIFTCARD_TEMPLATE_UPDATED_SUCCESSFULLY.message,
			apiResponse.GIFTCARD_TEMPLATE_UPDATED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		// Handle errors
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getGiftCardTemplatesByShop = async (req: Request, res: Response) => {
	try {
		const { page = 0, size = 10, shop } = req.query;
		if (!shop || !isValidObjectId(shop)) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}
		const { limit, offset } = getPagination(page as string, size as string);

		const { giftcardsTemplates, count } =
			await giftcardTemplateService.getTemplatesByShop(
				new Types.ObjectId(shop as string),
				limit,
				offset
			);

		return sendSuccessResponse(
			res,
			{
				templates: giftcardsTemplates,
				total_count: count,
			},
			apiResponse.GIFTCARD_TEMPLATES_FOUND_SUCCESSFUL.message,
			apiResponse.GIFTCARD_TEMPLATES_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		// Handle errors
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const updateGiftCardTemplate = async (req: Request, res: Response) => {
	try {
		// Validate input data
		const { template_name,template_headline, primary_color, secondary_color, template_image } =
			await giftcardTemplateService.validateUpdateTemplate(req.body);

		const { template_id } = req.params;
		if (
			!template_name &&
			!template_headline &&
			!primary_color &&
			!secondary_color &&
			!template_image
		) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_TEMPLATE_UPDATE_FIELDS_REQUIRED.message,
				apiResponse.GIFTCARD_TEMPLATE_UPDATE_FIELDS_REQUIRED.code
			);
		}

		// Construct update fields
		const updateFields: Partial<GiftCardTemplateAttributes> = {};
		if (template_name) updateFields.template_name = template_name;
		if (primary_color) updateFields.primary_color = primary_color;
		if (template_headline) updateFields.template_headline = template_headline;
		if (secondary_color) updateFields.secondary_color = secondary_color;
		if (template_image) updateFields.template_image = template_image;

		await giftcardTemplateService.updateGiftcardTemplate(
			{ _id: template_id },
			updateFields
		);

		const updatedTemplate = await giftcardTemplateService.findGiftcardTemplates(
			{ _id: template_id },
			null
		);

		const templates = await giftcardTemplateService.getGiftCardTemplateById(
			new Types.ObjectId(template_id)
		);

		const responseData = {
			_id: template_id,
			templates,
		};
		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.GIFTCARD_TEMPLATE_UPDATED_SUCCESSFULLY.message,
			apiResponse.GIFTCARD_TEMPLATE_UPDATED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		// Handle errors
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const deleteGiftCardTemplate = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { template_id } = req.params;

		session = await mongoose.startSession();
		session.startTransaction();

		const [templateData] = await giftcardTemplateService.findGiftcardTemplates(
			{
				_id: template_id,
			},
			session
		);

		if (!templateData) {
			return sendErrorResponse(
				res,
				apiResponse.GIFTCARD_TEMPLATE_NOT_FOUND.message,
				apiResponse.GIFTCARD_TEMPLATE_NOT_FOUND.code,
				session
			);
		}

		// await shopService.removeTemplateFromShops(templateData._id, session);
		await giftcardTemplateService.deleteGiftcardTemplate(
			{ _id: template_id },
			session
		);
		return sendSuccessResponse(
			res,
			{},
			apiResponse.GIFTCARD_TEMPLATE_DELETED_SUCCESSFULLY.message,
			apiResponse.GIFTCARD_TEMPLATE_DELETED_SUCCESSFULLY.code,
			session
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code,
			session
		);
	}
};

const getBackgroundImages = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;
	try {
		const { uploaded_type, uploaded_by, page = 0, size = 10 } = req.query;

		// Validate input
		if (
			!uploaded_type ||
			![UploadedType.ADMIN, UploadedType.STUDIO].includes(
				uploaded_type as UploadedType
			)
		) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_UPLOAD_TYPE.message,
				apiResponse.INVALID_UPLOAD_TYPE.code
			);
		}
		if (uploaded_type === UploadedType.STUDIO && !uploaded_by) {
			return sendErrorResponse(
				res,
				apiResponse.MISSING_UPLOADED_BY.message,
				apiResponse.MISSING_UPLOADED_BY.code
			);
		}

		session = await mongoose.startSession();

		// Get pagination values
		const { limit, offset } = getPagination(page as string, size as string);

		// Build query filter
		const filter: any = {
			$or: [
				{ uploaded_type: UploadedType.ADMIN },
				{ uploaded_type: UploadedType.STUDIO, uploaded_by },
			],
			deleted_at: null,
		};

		// Use a single database query with aggregation
		const { data, totalItems } =
			await giftcardTemplateService.getBackgroundImagesWithPagination(
				filter,
				limit,
				offset
			);

		// Check if images exist
		if (!data || data.length === 0) {
			return sendSuccessResponse(
				res,
				{
					totalItems: 0,
					totalPages: 0,
					currentPage: +page,
					images: [],
				},
				apiResponse.NO_BACKGROUND_IMAGES_FOUND.message,
				apiResponse.NO_BACKGROUND_IMAGES_FOUND.code
			);
		}

		// Optional: Omit unnecessary fields
		const omitFields = ['created_at', 'updated_at', 'deleted_at', 'id'];
		const processedImages = data.map((image: any) =>
			omitFromObject(image, omitFields)
		);

		// Calculate total pages
		const totalPages = Math.ceil(totalItems / limit);

		return sendSuccessResponse(
			res,
			{
				totalItems,
				totalPages,
				currentPage: +page,
				images: processedImages,
			},
			apiResponse.BACKGROUND_IMAGES_FETCHED_SUCCESSFULLY.message,
			apiResponse.BACKGROUND_IMAGES_FETCHED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code,
			session
		);
	} finally {
		if (session) {
			session.endSession();
		}
	}
};

const addBackgroundTemplateImage = async (req: Request, res: Response) => {
	try {
		const { uploaded_by, uploaded_type } = req.body;
		const files: any = req.files;
		if (!files?.image) {
			return sendErrorResponse(
				res,
				apiResponse.BACKGROUND_IMAGE_REQUIRED.message,
				apiResponse.BACKGROUND_IMAGE_REQUIRED.code
			);
		}
		const [createdTemplate] =
			await giftcardTemplateService.addBackgroundTemplateImage([
				{
					// title,
					image_url: files.image[0].location,
					deleted_at: null,
					uploaded_by: uploaded_by,
					uploaded_type: uploaded_type,
				},
			]);

		const omitFields = ['created_at', 'updated_at', 'deleted_at', 'id'];
		const omitedData = omitFromObject(createdTemplate, omitFields);
		return sendSuccessResponse(
			res,
			omitedData,
			apiResponse.BACKGROUND_TEMPLATE_ADDED_SUCCESSFULLY.message,
			apiResponse.BACKGROUND_TEMPLATE_ADDED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const deleteBackgroundTemplateImage = async (req: Request, res: Response) => {
	try {
		const { imageId } = req.query;
		if (!imageId) {
			return sendErrorResponse(
				res,
				apiResponse.NO_BACKGROUND_IMAGES_FOUND.message,
				apiResponse.NO_BACKGROUND_IMAGES_FOUND.code
			);
		}


		// Call service to delete the image
		const result = await giftcardTemplateService.deleteBackgroundTemplateImage(
			imageId as string
		);
    //    await giftcardTemplateService.deleteGiftcardTemplate({template_image: imageId})
		if (!result) {
			return sendErrorResponse(
				res,
				apiResponse.NO_BACKGROUND_IMAGES_FOUND.message,
				apiResponse.NO_BACKGROUND_IMAGES_FOUND.code
			);
		}

		return sendSuccessResponse(
			res,
			{},
			apiResponse.BACKGROUND_TEMPLATE_DELETED_SUCCESSFULLY.message,
			apiResponse.BACKGROUND_TEMPLATE_DELETED_SUCCESSFULLY.code
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
	getAllGiftCardTemplates,
	addGiftCardTemplate,
	updateGiftCardTemplate,
	deleteGiftCardTemplate,
	getAllEligibleTemplates,
	addBackgroundTemplateImage,
	getBackgroundImages,
	deleteBackgroundTemplateImage,
	getGiftCardTemplatesByShop,
};
