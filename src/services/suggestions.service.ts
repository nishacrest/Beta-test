import { SuggestionModel } from '../database/models'; // Adjust the path based on your project structure
import { ListingAttributes, ListingInput } from '../types/listing_details';
import { SuggestionInput } from '../types/suggestions'; // Adjust the path based on your project structure
import { apiResponse, SUGGESTION_STATUS } from '../utils/constant';
import { findListingById } from './review.service';
import shopService from './shop.service';

// Create Suggestion
export const createSuggestion = async (data: SuggestionInput) => {
	const suggestion = new SuggestionModel(data);
	await suggestion.save();

	return suggestion;
};

// Admin Approve Suggestion
export const approveSuggestion = async (id: string) => {
	const suggestion = await SuggestionModel.findByIdAndUpdate(
		id,
		{ status: SUGGESTION_STATUS.APPROVED },
		{ new: true }
	);

	if (!suggestion) throw new Error(apiResponse.SUGGESTION_NOT_FOUND.message);
	const studioId = suggestion.studio_id;
	return suggestion;
};

// Admin Decline Suggestion
export const declineSuggestion = async (id: string) => {
	const suggestion = await SuggestionModel.findByIdAndUpdate(
		id,
		{ status: SUGGESTION_STATUS.REJECTED },
		{ new: true }
	);

	if (!suggestion) throw new Error(apiResponse.SUGGESTION_NOT_FOUND.message);

	return suggestion;
};

export const getAllSuggestions = async () => {
	try {
		const suggestions = await SuggestionModel.find().exec(); // Fetch all suggestions

		// Map over suggestions to transform the data into the desired format
		const formattedSuggestions = await Promise.all(
			suggestions.map(async (suggestion) => {
				// Ensure studio_id is defined
				const shop = await shopService.findShops({ _id: suggestion.studio_id });
				const studio_name = shop[0]?.studio_name || 'Unknown Studio'; // Fallback if studio not found
				const request_by = suggestion.user_email;

				// Ensure listing_id is defined
				if (!suggestion.listing_id) {
					console.error('Listing ID is undefined for suggestion:', suggestion);
					return {
						studio_name,
						request_by,
						old_value: 'No Data',
						new_value: suggestion.suggested_text,
						field: suggestion.suggestion_field,
						status: suggestion.status,
					};
				}

				const listingData: ListingAttributes | null = await findListingById(
					suggestion.listing_id.toString()
				);
				if (!listingData) return;
				const old_value =
					listingData[suggestion.suggestion_field as keyof ListingAttributes] ||
					'No Data'; // Fallback for old value
				const new_value = suggestion.suggested_text;
				const field = suggestion.suggestion_field;
				const status = suggestion.status;
				const _id = suggestion._id;

				return {
					_id,
					studio_name,
					request_by,
					old_value,
					new_value,
					field,
					status,
				};
			})
		);

		return formattedSuggestions; // Return the array of formatted suggestions
	} catch (error: any) {
		throw new Error('Error fetching suggestions: ' + error.message); // Handle any errors
	}
};
