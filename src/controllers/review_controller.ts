import { Listing } from './../types/suggestions';
import { Request, Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import {
	createReview,
	deleteReply,
	deleteReview,
	editReply,
	editReview,
	findListingById,
	findListingByPin,
	getReportedReviews,
	getReviewsByListingId,
	// likeReview,
	likeReviewOrReply,
	replyToReview,
	reportReview,
} from '../services/review.service';
import { sendOTP, generateOTP, renderEjsFile, sendMail } from '../utils/helper';
import {
	CategoryRating,
	ReviewAttributes,
	ReviewInput,
} from '../types/review';
import shopService from '../services/shop.service';
import { apiResponse, EJS_TEMPLATES } from '../utils/constant';
import invoiceService from '../services/invoice.service';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import mailchecker from 'mailchecker'; 

const otpStore: Record<string, string> = {};
export const calculateOverallRating = (
	categoryRatings: CategoryRating
): number => {
	const ratingsArray = Object.values(categoryRatings).map(Number);
	const total = ratingsArray.reduce((sum, rating) => sum + rating, 0);
	const average = total / ratingsArray.length;
	return parseFloat(average.toFixed(1));
};

const getCommentByRating = (rating: number): string => {
	if (rating === 5) {
		return 'Excellent';
	} else if (rating >= 4) {
		return 'Very Good';
	} else if (rating >= 3) {
		return 'Good';
	} else if (rating >= 2) {
		return 'Fair';
	} else {
		return 'Poor';
	}
};

export const submitReviewStep1Controller = async (
	req: Request,
	res: Response
) => {
	const { reviewerEmail } = req.body;

	// Validate the email using mailchecker
	const isEmailValid = mailchecker.isValid(reviewerEmail);
	if (!isEmailValid) {
		return sendErrorResponse(
			res,
			apiResponse.INVALID_EMAIL_FORMAT.message, // Assuming you have this in apiResponse
			apiResponse.INVALID_EMAIL_FORMAT.code // Assuming there's a corresponding code
		);
	}

	const otp = generateOTP();
	otpStore[reviewerEmail] = otp;

	try {
		await sendOTP(reviewerEmail, otp);
		return sendSuccessResponse(
			res,
			{ email: reviewerEmail },
			apiResponse.OTP_SENT.message,
			apiResponse.OTP_SENT.code
		);
	} catch (error: any) {
		console.error('Error in sending otp:', error);
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export const submitReviewStep2Controller = async (
	req: Request,
	res: Response
) => {
	const session: ClientSession = await mongoose.startSession();
	session.startTransaction();

	try {
		const {
			reviewerEmail,
			reviewerName,
			otp,
			listingId,
			reviewText,
			categoryRatings,
		} = req.body;
		const images = req.files as Express.MulterS3.File[];

		if (otpStore[reviewerEmail] !== otp) {
			return res
				.status(400)
				.json({ message: apiResponse.OTP_INVALID_EXPIRED.message });
		}

		const listing = await findListingById(listingId, session);

		if (!listing) {
			return res
				.status(404)
				.json({ message: apiResponse.LISTING_NOT_FOUND.message });
		}
		const shops = await shopService.findShops({ _id: listing.shop });
		const imageUrls = images.map((image) => image.location);

		const overallRating = calculateOverallRating(categoryRatings);
		const comment = getCommentByRating(overallRating);

		const reviewData: ReviewInput = {
			listingId,
			reviewerEmail,
			reviewerName,
			reviewText,
			images: imageUrls,
			categoryRatings,
			rating: overallRating,
			comment: comment,
			likes: { count: 0, likedBy: [] },
			replies: [],
			deleted_at: null,
		};
		const review = await createReview(reviewData, session);

		await invoiceService.sendReviewMailToStudio(
			shops[0].owner || '',
			shops[0].studio_name || '',
			{
				studioName: shops[0].studio_name || '',
				reviewText: review.reviewText,
				reviewerEmail: review.reviewerEmail,
				rating: overallRating,
			}
		);

		await session.commitTransaction();

		delete otpStore[reviewerEmail];

		sendSuccessResponse(
			res,
			{ review },
			apiResponse.REVIEW_CREATED_SUCCESS.message,
			apiResponse.REVIEW_CREATED_SUCCESS.code
		);
	} catch (error: any) {
		await session.abortTransaction();
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.REVIEW_CREATION_ERROR?.code ||
				apiResponse.INTERNAL_SERVER_ERROR.code
		);
	} finally {
		session.endSession();
	}
};

export const editReviewController = async (req: Request, res: Response) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const reviewId = req.query.reviewId as string;
		const updatedData: Partial<ReviewAttributes> = req.body;

		const images = req.files as Express.MulterS3.File[];
		if (images && images.length > 0) {
			updatedData.images = images.map((image) => image.location);
		}

		if (updatedData.categoryRatings) {
			const overallRating = calculateOverallRating(
				updatedData.categoryRatings as CategoryRating
			);
			updatedData.rating = overallRating;
		}

		const updatedReview = await editReview(reviewId, updatedData, session);

		if (!updatedReview) {
			return res
				.status(404)
				.json({ message: apiResponse.REVIEW_NOT_FOUND.message });
		}

		await session.commitTransaction();
		sendSuccessResponse(
			res,
			{ review: updatedReview },
			apiResponse.REVIEW_UPDATED_SUCCESS.message,
			apiResponse.REVIEW_UPDATED_SUCCESS.code
		);
	} catch (error: any) {
		await session.abortTransaction();
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.REVIEW_UPDATE_ERROR?.code ||
				apiResponse.INTERNAL_SERVER_ERROR.code
		);
	} finally {
		session.endSession();
	}
};

export const getCombinedRatings = (reviews: ReviewInput[]) => {
	const totalCategoryRatings: CategoryRating = {
		Evaluation: 0,
		qualityOfMassage: 0,
		cleanliness: 0,
		park: 0,
		pricing: 0,
	};

	let totalRating = 0;
	let reviewCount = 0;

	reviews.forEach((review) => {
		if (review.categoryRatings) {
			totalCategoryRatings.Evaluation += review.categoryRatings.Evaluation || 0;
			totalCategoryRatings.qualityOfMassage +=
				review.categoryRatings.qualityOfMassage || 0;
			totalCategoryRatings.cleanliness +=
				review.categoryRatings.cleanliness || 0;
			totalCategoryRatings.park += review.categoryRatings.park || 0;
			totalCategoryRatings.pricing += review.categoryRatings.pricing || 0;
			totalRating += review.rating || 0;
			reviewCount++;
		}
	});

	const categoryAverages: CategoryRating = {
		Evaluation:
			reviewCount > 0
				? parseFloat(
						((totalCategoryRatings.Evaluation || 0) / reviewCount).toFixed(1)
				  )
				: 0,
		qualityOfMassage:
			reviewCount > 0
				? parseFloat(
						(
							(totalCategoryRatings.qualityOfMassage || 0) / reviewCount
						).toFixed(1)
				  )
				: 0,
		cleanliness:
			reviewCount > 0
				? parseFloat(
						((totalCategoryRatings.cleanliness || 0) / reviewCount).toFixed(1)
				  )
				: 0,
		park:
			reviewCount > 0
				? parseFloat(
						((totalCategoryRatings.park || 0) / reviewCount).toFixed(1)
				  )
				: 0,
		pricing:
			reviewCount > 0
				? parseFloat(
						((totalCategoryRatings.pricing || 0) / reviewCount).toFixed(1)
				  )
				: 0,
	};

	const overallAverage =
		reviewCount > 0 ? parseFloat((totalRating / reviewCount).toFixed(1)) : null;
	return {
		categoryAverages,
		overallAverage,
		reviews,
		reviewCount,
	};
};

export const getReviewsController = async (req: Request, res: Response) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const listingId = req.query.listingId as string; // Extract listingId from query parameter
		const reviews = await getReviewsByListingId(listingId, session);

		if (reviews.length === 0) {
			return res
				.status(404)
				.json({ message: apiResponse.REVIEW_NOT_FOUND.message });
		}

		const overallRatings = getCombinedRatings(reviews);

		await session.commitTransaction();
		res.status(200).json({
			message: apiResponse.REVIEWS_FOUND.message,
			overallRatings,
		});
	} catch (error: any) {
		await session.abortTransaction();
		res
			.status(500)
			.json({ message: apiResponse.INTERNAL_SERVER_ERROR.message });
	} finally {
		session.endSession();
	}
};

export const submitReviewWithPinController = async (
	req: Request,
	res: Response
) => {
	const session: ClientSession = await mongoose.startSession();
	session.startTransaction();

	try {
		const { pin, reviewText, categoryRatings, reviewerEmail, reviewerName } =
			req.body;
		const images = req.files as Express.MulterS3.File[];
		if (!pin) {
			return res
				.status(400)
				.json({ message: apiResponse.REVIEW_PIN_REQUIRED.message });
		}

		const listing = await findListingByPin(pin, session);
		if (!listing) {
			return res
				.status(400)
				.json({ message: apiResponse.REVIEW_PIN_INVALID.message });
		}

		const imageUrls =
			images?.length > 0 ? images.map((image) => image.location) : [];
		const overallRating = calculateOverallRating(categoryRatings);
		const comment = getCommentByRating(overallRating);

		const requiresEmail = Object.values(categoryRatings).some((rating) => {
			return (rating as number) <= 3;
		});

		if (requiresEmail && !reviewerEmail) {
			return res
				.status(400)
				.json({ message: apiResponse.REVIEWER_EMAIL_REQUIRED.message });
		}

		const reviewData: ReviewInput = {
			listingId: listing._id,
			reviewerEmail: requiresEmail ? reviewerEmail : undefined,
			reviewerName: reviewerName ? reviewerName : undefined,
			reviewText,
			images: imageUrls,
			categoryRatings,
			rating: overallRating,
			comment,
			likes: { count: 0, likedBy: [] },
			replies: [],
			deleted_at: null,
		};

		const review = await createReview(reviewData, session);

		const shops = await shopService.findShops({ _id: listing.shop });
		if (shops.length > 0) {
			await invoiceService.sendReviewMailToStudio(
				shops[0].owner || '',
				shops[0].studio_name || '',
				{
					studioName: shops[0].studio_name || '',
					reviewText: review.reviewText,
					reviewerEmail: review.reviewerEmail,
					rating: overallRating,
				}
			);
		}

		await session.commitTransaction();
		sendSuccessResponse(
			res,
			{ review },
			apiResponse.REVIEW_SUBMITTED_SUCCESS.message,
			apiResponse.REVIEW_SUBMITTED_SUCCESS.code
		);
	} catch (error: any) {
		return res.status(500).json({
			message: error.message,
			code: apiResponse.REVIEW_SUBMISSION_ERROR?.code,
		});
	} finally {
		session.endSession();
	}
};

export const handleReplyToReview = async (req: Request, res: Response) => {
	try {
		const { reviewId, parentReplyId, is_replied } = req.query;
		const { replyerEmail, replyText, replyerName } = req.body; // Get the email and text from the request body
		if (!reviewId) return;
		const updatedReview = await replyToReview(
			reviewId.toString(),
			replyerEmail,
			replyerName,
			replyText,
			parentReplyId ? parentReplyId.toString() : null,
			null
		); // Call service to add reply

		if (is_replied) {
			throw new Error('reply already added..');
		}
		// Return success response
		return res.status(200).json({
			code: 200,
			message: 'Reply added successfully',
			data: updatedReview,
		});
	} catch (error: any) {
		return res.status(500).json({
			code: 500,
			message: 'Error replying to review: ' + error.message,
		});
	}
};

export const handleLikeReviewOrReply = async (req: Request, res: Response) => {
	const { reviewId, replyId } = req.query; // Accept optional replyId
	const user_email = req.body.user_email;

	if (!reviewId)
		return res.status(400).json({ message: 'Review ID is required' });

	try {
		const likedItem = await likeReviewOrReply(
			reviewId.toString(),
			user_email,
			replyId ? replyId.toString() : null // Pass replyId if provided
		);

		return res.status(200).json({
			message: replyId
				? 'Reply liked successfully'
				: 'Review liked successfully',
			likedItem,
		});
	} catch (error: any) {
		return res.status(500).json({
			message: 'Error liking item: ' + error.message,
		});
	}
};

export const editReplyController = async (req: Request, res: Response) => {
	const { reviewId, replyId } = req.params;
	const { replyText } = req.body;
	const session = await mongoose.startSession();

	try {
		session.startTransaction();
		const updatedReview = await editReply(
			reviewId,
			replyId,
			replyText,
			session
		);
		await session.commitTransaction();
		res.status(200).json(updatedReview);
	} catch (error: any) {
		await session.abortTransaction();
		res.status(500).json({ message: `Error editing reply: ${error.message}` });
	} finally {
		session.endSession();
	}
};

// Delete reply endpoint
export const deleteReplyController = async (req: Request, res: Response) => {
	const { reviewId, replyId } = req.params;
	const session = await mongoose.startSession();

	try {
		session.startTransaction();
		const updatedReview = await deleteReply(reviewId, replyId, session);
		await session.commitTransaction();
		res.status(200).json(updatedReview);
	} catch (error: any) {
		await session.abortTransaction();
		res.status(500).json({ message: `Error deleting reply: ${error.message}` });
	} finally {
		session.endSession();
	}
};

export const deleteReviewController = async (req: Request, res: Response) => {
	const { reviewId } = req.params;
	const session: ClientSession = await mongoose.startSession();

	try {
		session.startTransaction();
		const updatedReview = await deleteReview(reviewId, session);
		await session.commitTransaction();

		sendSuccessResponse(
			res,
			{ updatedReview },
			apiResponse.REVIEW_DELETED_SUCCESS.message,
			apiResponse.REVIEW_DELETED_SUCCESS.code
		);
	} catch (error: any) {
		await session.abortTransaction();
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.REVIEW_DELETION_ERROR?.code ||
				apiResponse.INTERNAL_SERVER_ERROR.code
		);
	} finally {
		session.endSession();
	}
};

export const reportReviewController = async (req: Request, res: Response) => {
	try {
		const { reviewId, listingId, description } = req.body;

		// if (!Object.values(ReportReason).includes(reason)) {
		// 	return sendErrorResponse(
		// 		res,
		// 		apiResponse.INVALID_REPORT_REASON.message,
		// 		apiResponse.INVALID_REPORT_REASON.code
		// 	);
		// }

		await reportReview(reviewId, listingId, description);
		return sendSuccessResponse(
			res,
			null, // No additional data returned
			apiResponse.REVIEW_REPORTED_SUCCESSFULLY.message,
			apiResponse.REVIEW_REPORTED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return res.status(500).json({ message: error.message });
	}
};

export const getReportedReviewsController = async (
	req: Request,
	res: Response
) => {
	try {
		// Extract pagination params from query, with default values
		const { page = 0, pageSize = 10 } = req.query;

		const pageInt = parseInt(page as string, 10) || 0;
		const pageSizeInt = parseInt(pageSize as string, 10) || 10;

		const { reportedReviews, totalCount } = await getReportedReviews(
			pageInt,
			pageSizeInt
		);
		const listingIds = [
			...new Set(reportedReviews.map((review) => review.listingId)),
		];

		const listingsData = await Promise.all(
			listingIds.map((listingId) => findListingById(listingId.toString()))
		);

		const listingMap = new Map(
			listingsData.map((listing) => [
				listing?._id.toString(),
				listing?.studio_name,
			])
		);

		const totalPages = Math.ceil(totalCount / pageSizeInt);

		const reportData = reportedReviews.map((review) => ({
			...review.toObject(),
			studio_name: listingMap.get(review.listingId.toString()),
		}));

		return sendSuccessResponse(
			res,
			{
				data: reportData,
				pagination: {
					totalCount,
					totalPages,
					currentPage: pageInt,
					pageSize: pageSizeInt,
				},
			},
			apiResponse.REPORTED_REVIEWS_RETRIEVED_SUCCESSFULLY.message,
			apiResponse.REPORTED_REVIEWS_RETRIEVED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.REPORTED_REVIEWS_FETCH_FAILED.code
		);
	}
};
