import { Request, Response } from 'express';
import * as suggestionService from '../services/suggestions.service'; // Adjust the path based on your project structure
import invoiceService from '../services/invoice.service';
import shopService from '../services/shop.service';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import { apiResponse, SUGGESTION_STATUS } from '../utils/constant';
import mailchecker from 'mailchecker';

// Controller for submitting a suggestion
export const submitSuggestion = async (req: Request, res: Response) => {
	try {
		const { studio_id, user_name, user_email, reason, suggested_text } =
			req.body;
		// Validate the email using mailchecker
		const isEmailValid = mailchecker.isValid(user_email);
		if (!isEmailValid) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_EMAIL_FORMAT.message, // Assuming you have this in apiResponse
				apiResponse.INVALID_EMAIL_FORMAT.code // Assuming there's a corresponding code
			);
		}
		const suggestion = await suggestionService.createSuggestion(req.body);
		const mailData = {
			user_name,
			user_email,
			reason,
			suggested_text,
		};
		// Send the voucher request email to the studio
		await invoiceService.sendSuggestionProcessingMail(
			user_email,
			user_name,
			mailData
		);

		return sendSuccessResponse(
			res,
			{ suggestion }, // Passing the suggestion object
			apiResponse.SUGGESTION_SUBMITTED_SUCCESS.message, // Assuming you have this in apiResponse
			apiResponse.SUGGESTION_SUBMITTED_SUCCESS.code // Assuming there's a corresponding code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message || apiResponse.SUGGESTION_SUBMISSION_ERROR.message, // Error message or a default fallback
			apiResponse.SUGGESTION_SUBMISSION_ERROR.code // Specific error code
		);
	}
};

export const handleSuggestionAction = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { action } = req.body; // 'approve' or 'reject'

		let suggestion;
		if (!id) return;
		// Handle the action
		if (action == SUGGESTION_STATUS.APPROVED) {
			suggestion = await suggestionService.approveSuggestion(id.toString());
			await invoiceService.sendSuggestionApprovalMail(
				suggestion.user_email,
				suggestion.user_name,
				{
					suggested_text: suggestion.suggested_text,
				}
			);

			// Notify the studio about the approved suggestion
			const studioIdString = suggestion.studio_id.toString();
			const studioData = await shopService.getShopDetails(studioIdString);
			if (!studioData) return;

			await invoiceService.sendStudioNotificationMailForApproval(
				studioData.owner || "",
				studioData.studio_name || "",
				{
					user_name: suggestion.user_name,
					suggested_text: suggestion.suggested_text,
				}
			);

			return sendSuccessResponse(
				res,
				{ suggestion }, // Passing the suggestion object
				apiResponse.SUGGESTION_APPROVED_SUCCESS.message, // Success message for suggestion approval
				apiResponse.SUGGESTION_APPROVED_SUCCESS.code // Success code for suggestion approval
			);
		} else if (action === SUGGESTION_STATUS.REJECTED) {
			suggestion = await suggestionService.declineSuggestion(id.toString());

			// Send rejection email to the user
			await invoiceService.sendSuggestionRejectionMail(
				suggestion.user_email,
				suggestion.user_name,
				{
					user_name: suggestion.user_name,
					reason: suggestion.reason,
					suggested_text: suggestion.suggested_text,
				}
			);

			return sendSuccessResponse(
				res,
				{ suggestion }, // Passing the suggestion object
				apiResponse.SUGGESTION_REJECTED_SUCCESS.message, // Assuming you have this in apiResponse
				apiResponse.SUGGESTION_REJECTED_SUCCESS.code // Assuming there's a corresponding code
			);
		} else {
			// Invalid action
			return sendErrorResponse(
				res,
				apiResponse.INVALID_ACTION_ERROR.message, // The specific error message
				apiResponse.INVALID_ACTION_ERROR.code // The specific error code
			);
		}
	} catch (error: any) {
		res.status(500).json({ message: error.message });
	}
};

// Controller for fetching all suggestions
export const fetchAllSuggestions = async (req: Request, res: Response) => {
	try {
		const suggestions = await suggestionService.getAllSuggestions(); // Call the service function
		return sendSuccessResponse(
			res,
			{ suggestions },
			apiResponse.SUGGESTIONS_FETCH_SUCCESS.message, // Success message
			apiResponse.SUGGESTIONS_FETCH_SUCCESS.code // Success code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message || apiResponse.SUGGESTIONS_FETCH_ERROR.message, // Error message
			apiResponse.SUGGESTIONS_FETCH_ERROR.code // Error code
		);
	}
};
