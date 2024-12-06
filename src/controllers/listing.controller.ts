import { findListingById } from './../services/review.service';
// import { StudioIntegrations } from './../types/user_settings';
import { Request, Response } from 'express';
import {
	DEFAULT_IMG_URL,
	HERO_SECTION_IMAGES,
	apiResponse,
} from '../utils/constant';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import listingService from '../services/listing.service';
import mongoose, { Types, ClientSession, Document } from 'mongoose';
import DocumentArray from 'mongoose';
import { ValidationError } from 'yup';
import {
	createListingSchema,
	ListingAttributes,
	ListingInput,
} from '../types/listing_details';
import shopService from '../services/shop.service';
import { ListingDetailsModel } from '../database/models';


const createListing = async (req: Request, res: Response) => {
	let imageFiles: Express.MulterS3.File[] = [];
	let cityImages: Express.MulterS3.File[] = [];
	let session: ClientSession | null = null;

	try {
		session = await mongoose.startSession();
		session.startTransaction();

		const requestBody: ListingInput = req.body; // Ensure type safety
		await createListingSchema.validate(req.body);

		// Handle uploaded files
		if (req.files && !Array.isArray(req.files)) {
			imageFiles = (req.files['imageFiles'] as Express.MulterS3.File[]) || [];
			cityImages = (req.files['cityImages'] as Express.MulterS3.File[]) || [];
		}

		// Prepare ListingDetailsFields
		const listingDetailsFields: ListingInput = {
			shop: requestBody.shop || null, // Required field
			studio_name: requestBody.studio_name || null,
			description: requestBody.description || null,
			email: requestBody.description || null,
			opening_hours_specification:
				requestBody.opening_hours_specification || null,
			postal_code: requestBody.postal_code || null,
			available_service: requestBody.available_service || null,
			payment_options: requestBody.payment_options || null,
			amenity_feature: requestBody.amenity_feature || null,
			address: {
				streetAddress: requestBody.address?.streetAddress || null,
				addressLocality: requestBody.address?.addressLocality || null,
				postalCode: requestBody.address?.postalCode || null,
				addressCountry: requestBody.address?.addressCountry || null,
			},
			social_links: requestBody.social_links || null,
			telephone: requestBody.telephone || null,
			makes_offer: requestBody.makes_offer || null, 
			is_verified: requestBody.is_verified || false,
			logo_image_url: requestBody.logo_image_url || null, 
			title_image_url: requestBody.title_image_url || null, 
			image_urls: null,
			city_image_url: null,
			reviewPin: requestBody.reviewPin || null, 
			otp: requestBody.otp || null,
			otp_count: 0,
			otp_time: null, 
			otp_verified: requestBody.otp_verified || false,
			otp_used: requestBody.otp_used || false, 
		};

		// Handle the uploaded images
		if (imageFiles.length > 0) {
			const imageUrls = imageFiles.map((image) => image.location); // Extract the image URLs
			listingDetailsFields.image_urls = imageUrls; // Set the mapped URLs
		}

		// Handle the uploaded city images
		if (cityImages.length > 0) {
			const cityImageUrls = cityImages.map((image) => image.location); // Extract the city image URLs
			listingDetailsFields.city_image_url = cityImageUrls; // Set the mapped URLs for city images
		}

		// Create the listing
		const listingData = await listingService.createListing(
			listingDetailsFields,
			session
		);

		await session.commitTransaction();

		return sendSuccessResponse(
			res,
			listingData,
			apiResponse.LISTING_CREATED_SUCCESSFUL.message,
			apiResponse.LISTING_CREATED_SUCCESSFUL.code
		);
	} catch (error: any) {
		if (session) {
			await session.abortTransaction();
		}

		console.error('Error creating listing:', error.message);
		return sendErrorResponse(
			res,
			error.message || 'Internal Server Error',
			500
		);
	} finally {
		if (session) {
			session.endSession(); // End session only after all operations are done
		}
	}
};

const updateListingController = async (req: Request, res: Response) => {
	const listingId = req.params.id;
	let imageFiles: Express.MulterS3.File[] = [];
	let cityImages: Express.MulterS3.File[] = [];
	let session: ClientSession | null = null;

	try {
		session = await mongoose.startSession();
		session.startTransaction();
		const requestBody = req.body;
		if (req.files && !Array.isArray(req.files)) {
			imageFiles = (req.files['imageFiles'] as Express.MulterS3.File[]) || [];
			cityImages = (req.files['cityImages'] as Express.MulterS3.File[]) || [];
		}

		// Check if listing exists
		const listingExists = await ListingDetailsModel.findById(listingId);
		if (!listingExists) {
			return sendErrorResponse(
				res,
				'The specified listing does not exist.',
				404,
				session
			);
		}
		const deletedImageUrls: string[] = requestBody.deletedImageUrls || [];
		// Helper function to convert DocumentArray to plain array
		// Helper function to convert DocumentArray to plain array of objects
		const toPlainArray = <T>(documentArray: Types.Array<T>): T[] =>
			documentArray.map((doc: any) => doc.toObject());

		// Prepare fields to update
		const updatedListingFields: Partial<ListingInput> = {
			studio_name: requestBody.studio_name ?? listingExists.studio_name,
			description: requestBody.description ?? listingExists.description,
			email: requestBody.email ?? listingExists.email,
			opening_hours_specification:
				requestBody.opening_hours_specification ??
				listingExists.opening_hours_specification,
			postal_code: requestBody.postal_code ?? listingExists.postal_code,
			available_service:
				requestBody.available_service ??
				toPlainArray(listingExists.available_service),
			amenity_feature:
				requestBody.amenity_feature ??
				toPlainArray(listingExists.amenity_feature),
			address: {
				streetAddress:
					requestBody.address?.streetAddress ??
					listingExists.address?.streetAddress,
				addressLocality:
					requestBody.address?.addressLocality ??
					listingExists.address?.addressLocality,
				postalCode:
					requestBody.address?.postalCode ?? listingExists.address?.postalCode,
				addressCountry:
					requestBody.address?.addressCountry ??
					listingExists.address?.addressCountry,
			},
			payment_options:
				requestBody.payment_options ??
				toPlainArray(listingExists.payment_options),
			social_links: requestBody.social_links ?? listingExists.social_links,
			telephone: requestBody.telephone ?? listingExists.telephone,
			makes_offer:
				requestBody.makes_offer ?? toPlainArray(listingExists.makes_offer),
			is_verified: requestBody.is_verified ?? listingExists.is_verified,
			logo_image_url:
				requestBody.logo_image_url ?? listingExists.logo_image_url,
			title_image_url:
				requestBody.title_image_url ?? listingExists.title_image_url,
			reviewPin: requestBody.reviewPin ?? listingExists.reviewPin,
			otp: requestBody.otp ?? listingExists.otp,
			otp_count: requestBody.otp_count ?? listingExists.otp_count,
			otp_time: requestBody.otp_time ?? listingExists.otp_time,
			otp_verified: requestBody.otp_verified ?? listingExists.otp_verified,
			otp_used: requestBody.otp_used ?? listingExists.otp_used,
			// image_urls: listingExists.image_urls,
			image_urls: listingExists.image_urls.filter(
				(url) => !deletedImageUrls.includes(url)
			),
			city_image_url: listingExists.city_image_url,
		};

		// Handle image uploads
		const handleImages = (files: Express.MulterS3.File[]) =>
			files.length > 0 ? files.map((file) => file.location) : null;

		// Add new images to existing ones
		const newImageUrls = handleImages(imageFiles);
		if (newImageUrls) {
			updatedListingFields.image_urls = [
				...listingExists.image_urls.filter(
					(url) => !deletedImageUrls.includes(url)
				), // Keep existing URLs that are not deleted
				...newImageUrls, // Add new image URLs
			];
		}

		// Add new city images to existing ones
		const newCityImageUrls = handleImages(cityImages);
		if (newCityImageUrls) {
			updatedListingFields.city_image_url = [
				...listingExists.city_image_url, // Keep existing city image URLs
				...newCityImageUrls, // Add new city image URLs
			];
		}

		// Update the listing
		const updatedListing = await listingService.updateListing(
			new Types.ObjectId(listingId),
			updatedListingFields,
			session
		);
		await session.commitTransaction();

		// Calculate the total count of items in makes_offer
		const makesOfferCount = updatedListingFields.makes_offer
			? updatedListingFields.makes_offer.length
			: 0;
		return sendSuccessResponse(
			res,
			{
				updatedListing,
				makesOfferCount,
			},
			apiResponse.LISTING_UPDATED_SUCCESSFUL.message,
			apiResponse.LISTING_UPDATED_SUCCESSFUL.code
		);
	} catch (error: any) {
		if (session) {
			await session.abortTransaction();
		}

		console.error('Error updating listing:', error.message);
		return sendErrorResponse(
			res,
			error.message || 'Internal Server Error',
			500,
			session
		);
	} finally {
		if (session) {
			session.endSession();
		}
	}
};

const getAllListingsController = async (req: Request, res: Response) => {
	let session: ClientSession | null = null;

	try {
		session = await mongoose.startSession();
		session.startTransaction();

		// Fetch all listings from the service
		const listings = await listingService.getAllListings(session);
		await session.commitTransaction();
		// Send success response without the session
		return sendSuccessResponse(
			res,
			listings,
			apiResponse.LISTINGS_FETCHED_SUCCESSFUL.message,
			apiResponse.LISTINGS_FETCHED_SUCCESSFUL.code
		);
	} catch (error: any) {
		console.error('Error fetching listings:', error.message); // Log the error
		if (session) {
			await session.abortTransaction(); // Abort if any error occurs
		}

		// Send error response without the session
		return sendErrorResponse(
			res,
			error.message || 'Internal Server Error',
			500
		);
	} finally {
		if (session) {
			session.endSession(); // End the session at the end
		}
	}
};

const deleteListingController = async (req: Request, res: Response) => {
	const listingId = req.params.id;
	const { field, value } = req.body; // specify the field and the value (if removing a specific item from an array)
	let session: ClientSession | null = null;
	try {
		// Start a new session and transaction
		session = await mongoose.startSession();
		session.startTransaction();

		// Check if listing exists
		const listingExists = await ListingDetailsModel.findById(listingId);
		console.log(listingExists?.makes_offer);
		if (!listingExists) {
			return sendErrorResponse(
				res,
				'The specified listing does not exist.',
				404,
				session
			);
		}

		// Prepare update operation
		let updateOperation: any = {};
		if (Array.isArray((listingExists as any)[field])) {
			updateOperation = { $pull: { [field]: { _id: value._id } } };
		} else {
			// If the field is not an array, set it to null (or you could remove it entirely)
			updateOperation = { $unset: { [field]: '' } };
		}

		// Perform the update
		await ListingDetailsModel.updateOne(
			{ _id: listingId },
			updateOperation
		).session(session);

		// Commit the transaction
		await session.commitTransaction();

		return sendSuccessResponse(
			res,
			{},
			`${field} deleted successfully.`,
			apiResponse.LISTING_DELETED_SUCCESSFUL.code
		);
	} catch (error: any) {
		// If an error occurs, abort the transaction
		if (session) {
			await session.abortTransaction();
		}

		console.error('Error deleting field from listing:', error.message);
		return sendErrorResponse(
			res,
			error.message || 'Internal Server Error',
			500,
			session
		);
	} finally {
		// End the session
		if (session) {
			session.endSession();
		}
	}
};

const getListingByIdController = async (req: Request, res: Response) => {
	const listingId = req.params.id; // Get the listing ID from URL params
	let session: ClientSession | null = null;

	try {
		// Validate the listing ID (Optional, but recommended)
		if (!mongoose.isValidObjectId(listingId)) {
			return sendErrorResponse(res, 'Invalid listing ID format.', 400);
		}

		session = await mongoose.startSession();
		session.startTransaction();

		// Fetch the listing using the service function
		const listing = await listingService.getListingByIdService(
			listingId,
			session
		);

		// Check if the listing exists
		if (!listing) {
			return sendErrorResponse(res, 'Listing not found.', 404);
		}

		await session.commitTransaction();

		// Send success response
		return sendSuccessResponse(
			res,
			listing,
			apiResponse.LISTINGS_FETCHED_SUCCESSFUL.message,
			apiResponse.LISTINGS_FETCHED_SUCCESSFUL.code
		);
	} catch (error: any) {
		console.error('Error fetching listing:', error.message); // Log the error
		if (session) {
			await session.abortTransaction(); // Abort if any error occurs
		}

		// Send error response
		return sendErrorResponse(
			res,
			error.message || 'Internal Server Error',
			500
		);
	} finally {
		if (session) {
			session.endSession(); // End the session at the end
		}
	}
};

export default {
	createListing,
	updateListingController,
	getAllListingsController,
	deleteListingController,
	getListingByIdController,
};
