import { Review } from '../database/models/review'; // Adjust the path as needed
import ListingModel from '../database/models/listing_details'; // Import Listing model for notifications
import mongoose, { ClientSession } from 'mongoose';
import {
	ReviewInput,
	ReviewAttributes,
	CategoryRating,
	Reply
} from '../types/review'; // Adjust the import path as needed
import { calculateOverallRating } from '../controllers/review_controller';
import { apiResponse } from '../utils/constant';
import { ListingAttributes, ListingInput } from '../types/listing_details';
import { getPagination } from '../utils/helper';

// Function to create a review
export const createReview = async (
	reviewData: ReviewInput,
	session?: ClientSession | null
): Promise<ReviewInput> => {
	try {
		// const emailExists = await Review.findOne({
		// 	reviewerEmail: reviewData.reviewerEmail,
		// });

		const emailAndListingExists = await Review.findOne({
			reviewerEmail: reviewData.reviewerEmail,
			listingId: reviewData.listingId,
			deleted_at: null,
		});

		if (emailAndListingExists) {
			throw new Error('Email already exists');
		}
		const review = new Review(reviewData);
		const savedReview = await review.save({ session }); // Save with session if provided
		// Cast to ReviewAttributes and ensure all fields are included
		return {
			_id: savedReview._id,
			listingId: savedReview.listingId,
			reviewerEmail: savedReview.reviewerEmail,
			reviewerName: savedReview.reviewerName,
			reviewText: savedReview.reviewText,
			rating: savedReview.rating,
			categoryRatings: savedReview.categoryRatings,
			images: savedReview.images,
			comment: savedReview.comment,
		} as ReviewAttributes;
	} catch (error) {
		throw error;
	}
};

// Function to find a listing by ID
export const findListingById = async (
	listingId: string,
	session?: ClientSession | null
) => {
	return await ListingModel.findById(listingId, null, { session }); // Fetch with session if provided
};

export const editReview = async (
	reviewId: string,
	updatedData: Partial<ReviewAttributes>, // Allow partial updates
	session: ClientSession | null
) => {
	try {
		const existingReview = await Review.findById(reviewId).session(session);
		if (!existingReview) {
			throw new Error('Review not found');
		}

		// Update the review fields with the new data
		if (updatedData.reviewText) {
			existingReview.reviewText = updatedData.reviewText;
		}

		if (updatedData.rating) {
			existingReview.rating = updatedData.rating;
		}

		if (updatedData.categoryRatings) {
			if (existingReview.categoryRatings) {
				// Check if categoryRatings is not null
				if (updatedData.categoryRatings.Evaluation !== undefined) {
					existingReview.categoryRatings.Evaluation =
						updatedData.categoryRatings.Evaluation;
				}
				if (updatedData.categoryRatings.pricing !== undefined) {
					existingReview.categoryRatings.pricing =
						updatedData.categoryRatings.pricing;
				}
				if (updatedData.categoryRatings.park !== undefined) {
					existingReview.categoryRatings.park =
						updatedData.categoryRatings.park;
				}
				if (updatedData.categoryRatings.cleanliness !== undefined) {
					existingReview.categoryRatings.cleanliness =
						updatedData.categoryRatings.cleanliness;
				}
				if (updatedData.categoryRatings.qualityOfMassage !== undefined) {
					existingReview.categoryRatings.qualityOfMassage =
						updatedData.categoryRatings.qualityOfMassage;
				}
			}
		}

		// Update images if provided
		if (updatedData.images) {
			existingReview.images = updatedData.images; // Assign new images
		}

		// Save the updated review
		const savedReview = await existingReview.save({ session });

		// Return the updated review as ReviewAttributes
		return {
			_id: savedReview._id,
			listingId: savedReview.listingId,
			reviewerEmail: savedReview.reviewerEmail,
			reviewerName: savedReview.reviewerName,
			reviewText: savedReview.reviewText,
			rating: savedReview.rating,
			images: savedReview.images,
			categoryRatings: savedReview.categoryRatings,
			comment: savedReview.comment,
		} as ReviewAttributes;
	} catch (error) {
		throw error;
	}
};

export const getReviewsByListingId = async (
	listingId: string,
	session: ClientSession | null
) => {
	try {
		const reviews = await Review.find({ listingId, deleted_at: null }, null, {
			session,
		}); // Find reviews by listing ID
		return reviews;
	} catch (error: any) {
		throw new Error('Error fetching reviews: ' + error.message);
	}
};

export const findListingByPin = async (
	pin: string,
	session?: ClientSession | null
) => {
	return await ListingModel.findOne({ reviewPin: pin }, null, { session });
};

export const likeReviewOrReply = async (
	reviewId: string,
	user_email: string,
	replyId: string | null = null, // Used to differentiate between liking a review or a reply
	session: ClientSession | null = null
) => {
	// Fetch the review by ID
	const review = await Review.findById(reviewId).session(session);

	if (!review) {
		throw new Error('Review not found');
	}

	if (replyId) {
		// If replyId is provided, handle like/unlike for the reply
		const replyToLike = findReplyById(review.replies, replyId);

		if (!replyToLike) {
			throw new Error('Reply not found');
		}

		// Check if the user already liked this reply
		const existingLikeIndex = replyToLike.likes.likedBy.indexOf(user_email);

		if (existingLikeIndex !== -1) {
			// User has already liked it, so unlike (remove their like)
			replyToLike.likes.likedBy.splice(existingLikeIndex, 1); // Remove the user from likedBy
			replyToLike.likes.count -= 1; // Decrease like count
		} else {
			// User has not liked it yet, so like (add their like)
			replyToLike.likes.likedBy.push(user_email); // Add user email only
			replyToLike.likes.count += 1; // Increase like count
		}

		// Save the review with updated reply likes
		await review.save({ session });

		return replyToLike; // Return the updated reply
	} else {
		// Handle like/unlike for the main review
		const existingLikeIndex = review.likes.likedBy.indexOf(user_email);

		if (existingLikeIndex !== -1) {
			// User has already liked it, so unlike (remove their like)
			review.likes.likedBy.splice(existingLikeIndex, 1); // Remove the user from likedBy
			review.likes.count -= 1; // Decrease like count
		} else {
			// User has not liked it yet, so like (add their like)
			review.likes.likedBy.push(user_email); // Add user email only
			review.likes.count += 1; // Increase like count
		}

		// Save the review with updated likes
		await review.save({ session });

		return review; // Return the updated review
	}
};

export const replyToReview = async (
	reviewId: string,
	replyerEmail: string,
	replyerName: string,
	replyText: string,
	parentReplyId: string | null,
	session: ClientSession | null
) => {
	try {
		const review = await Review.findById(reviewId).session(session);
		if (!review) {
			throw new Error('Review not found');
		}
		// Check if a reply has already been added
		if (review.replies.length > 0) {
			const hasReplied = review.replies.some(reply => reply.is_replied);
			if (hasReplied) {
				throw new Error('Reply already added');
			}
		}
		const newReply = {
			_id: new mongoose.Types.ObjectId(), // Create a new ObjectId for the reply
			replyerEmail,
			replyerName,
			replyText,
			createdAt: new Date(),
			replies: [], // Start with an empty array for nested replies
			likes: { count: 0, likedBy: [] },
			is_replied: true
		};
		if (parentReplyId) {
			// Find the specific reply in the review's replies
			const parentReply = findReplyById(review.replies, parentReplyId);

			if (!parentReply) {
				throw new Error('Parent reply not found');
			}

			// Push the new reply into the parent reply's replies array
			parentReply.replies.push(newReply);
		} else {
			// If it's a reply to the main review
			review.replies.push(newReply);
		}

		// Save the updated review document
		await review.save({ session });

		return review; // Return the updated review
	} catch (error: any) {
		throw new Error(`Error replying to review: ${error.message}`);
	}
};

const findReplyById = (replies: Reply[], replyId: string): Reply | null => {
	for (let reply of replies) {
		if ((reply as any)._id && (reply as any)._id.toString() === replyId) {
			return reply;
		}

		if (reply.replies && Array.isArray(reply.replies)) {
			const nestedReply = findReplyById(reply.replies, replyId);
			if (nestedReply) {
				return nestedReply;
			}
		}
	}
	return null;
};

// Edit a reply by its ID
export const editReply = async (
	reviewId: string,
	replyId: string,
	newReplyText: string,
	session: ClientSession | null
) => {
	const review = await Review.findById(reviewId).session(session);
	if (!review) {
		throw new Error('Review not found');
	}

	const reply = findReplyById(review.replies, replyId);
	if (!reply) {
		throw new Error('Reply not found');
	}

	reply.replyText = newReplyText;
	await review.save({ session });

	return review;
};

// Delete a reply by its ID
export const deleteReply = async (
	reviewId: string,
	replyId: string,
	session: ClientSession | null
) => {
	const review = await Review.findById(reviewId).session(session);
	if (!review) {
		throw new Error('Review not found');
	}

	// Function to delete a reply recursively
	const deleteReplyById = (replies: any[], replyId: string) => {
		for (let i = 0; i < replies.length; i++) {
			if (replies[i]._id.toString() === replyId) {
				replies.splice(i, 1);
				return true;
			}
			if (deleteReplyById(replies[i].replies, replyId)) {
				return true;
			}
		}
		return false;
	};

	const deleted = deleteReplyById(review.replies, replyId);
	if (!deleted) {
		throw new Error('Reply not found');
	}

	await review.save({ session });
	return review;
};

export const deleteReview = async (
	reviewId: string,
	session: ClientSession | null
) => {
	const review = await Review.findById(reviewId).session(session);
	if (!review) {
		throw new Error('Review not found');
	}

	review.deleted_at = new Date();
	await review.save({ session });

	return review;
};

export const reportReview = async (
	reviewId: string,
	// reason: ReportReason,
	listingId: string,
	description?: string
): Promise<void> => {
	try {
		const review = await Review.findById(reviewId);

		// Check if the review already has a report with the same reason
		const alreadyReported = review?.reports?.some(
			(report) => report.listingId === listingId
		);
		if (alreadyReported) {
			throw new Error('Review already reported');
		}
		await Review.findByIdAndUpdate(
			reviewId,
			{
				$push: {
					reports: {
						// reason: reason,
						description: description || '',
						createdAt: new Date(),
						listingId: listingId,
					},
				},
				// $set: { deleted_at: new Date() }, // Soft delete the review
			},
			{ new: true }
		);
	} catch (error: any) {
		if (error.message === 'Review already reported') {
			error.statusCode = apiResponse.INTERNAL_SERVER_ERROR.code;
			throw error;
		} else {
			error.statusCode = apiResponse.INTERNAL_SERVER_ERROR.code;
			throw new Error('Unable to report review');
		}
	}
};

export const getReportedReviews = async (page: number, pageSize: number) => {
	try {
		const { limit, offset } = getPagination(page, pageSize);
		const reportedReviews = await Review.find({
			'reports.0': { $exists: true },
			deleted_at: { $eq: null }, // Only include reviews where deleted_at is null
		})
			.skip(offset)
			.limit(limit);

		const totalCount = await Review.countDocuments({
			'reports.0': { $exists: true },
			deleted_at: { $eq: null }, // Only count reviews where deleted_at is null
		});

		return { reportedReviews, totalCount };
	} catch (error: any) {
		throw new Error('Failed to fetch reported reviews: ' + error.message);
	}
};
