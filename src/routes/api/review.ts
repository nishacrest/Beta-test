import express from 'express';
import {
	editReviewController,
	getReviewsController,
	// handleLikeReview,
	handleReplyToReview,
	handleLikeReviewOrReply,
	submitReviewStep1Controller,
	submitReviewStep2Controller,
	submitReviewWithPinController,
	editReplyController,
	deleteReplyController,
	deleteReviewController,
	reportReviewController,
	getReportedReviewsController,
} from '../../controllers/review_controller'; 
import { imageFromReviewListing } from '../../middleware/upload';
import { checkAdmin } from '../../middleware/authorization';
import authentication from '../../middleware/authentication';

const router = express.Router();

// Step 1: Request OTP
router.post('/request-otp', submitReviewStep1Controller);

// Step 2: Submit review with OTP verification
router.post(
	'/',
	// authentication,
	// checkAdmin,
	imageFromReviewListing.array('images'),
	submitReviewStep2Controller
);

router.patch(
	'/',
	// authentication,
	// checkAdmin,
	imageFromReviewListing.array('images'),
	editReviewController
);
router.get(
	'/',
	// authentication,
	// checkAdmin,
	getReviewsController
);

router.post(
	'/review-landing-page',
	// authentication,
	// checkAdmin,
	imageFromReviewListing.array('images'),
	submitReviewWithPinController
);
router.post('/:reviewId/like', handleLikeReviewOrReply); // Route for liking a review
router.post('/:reviewId/reply', handleReplyToReview); // Route for replying to a review
// Edit a reply to a review
router.patch('/:reviewId/replies/:replyId', editReplyController); // Route for editing a reply

// Delete a reply to a review
router.delete('/:reviewId/replies/:replyId', deleteReplyController); // Route for deleting a reply
router.delete('/:reviewId', deleteReviewController); 
router.post('/report', reportReviewController);
router.get('/reported-reviews', getReportedReviewsController);
export default router;
