import { Types } from 'mongoose';

export interface Shop {
	_id: Types.ObjectId;
	studio_name: string;
}

export interface Listing {
	_id: Types.ObjectId;
	value: string; // Adjust this type as per your Listing schema
}

export interface Suggestion {
	studio_id: Types.ObjectId;
	user_name: string;
	listing_id: Types.ObjectId;
	suggested_text: string;
	suggestion_field: string;
	status: string;
}

export interface FormattedSuggestion {
	studio_name: string;
	request_by: string;
	old_value: string;
	new_value: string;
	field: string;
	status: string;
}

export interface SuggestionAttributes {
	studio_id: Types.ObjectId;
	listing_id: Types.ObjectId;
	user_name: string;
	user_email: string;
	reason: 'wrong_information' | 'add_information' | 'other';
	suggestion_field:
		| 'description'
		| 'openingHoursSpecification'
		| 'address'
		| 'priceRange'
		| 'availableService'
		| 'amenityFeature'
		| 'paymentAccepted'
		| 'telephone'
		| 'social_links'
		| 'makesOffer'
		| 'other'
		| 'out_of_business';
	field_type?: string[];
	out_of_buisness?: boolean;
	suggested_text: string;
	status: 'pending' | 'approved' | 'rejected';
	updated_at?: Date;
}

export type SuggestionInput = Omit<
	SuggestionAttributes,
	'created_at' | 'updated_at' | 'status'
>;
