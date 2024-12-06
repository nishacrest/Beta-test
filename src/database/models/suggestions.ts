import mongoose from 'mongoose';

const { Schema } = mongoose;

// Define the suggestion schema
const suggestionSchema = new Schema(
	{
		studio_id: {
			type: Schema.Types.ObjectId,
			ref: 'studios',
			required: true,
		},
		listing_id: {
			type: Schema.Types.ObjectId,
			ref: 'listing_details',
			// required: true,
		},
		user_email: {
			type: Schema.Types.String,
			required: true,
		},
		user_name: {
			type: Schema.Types.String,
			required: true,
		},
		reason: {
			type: Schema.Types.String,
			enum: ['wrong_information', 'add_information', 'other'], // Reasons for the suggestion
			required: true,
		},
		suggestion_field: {
			type: Schema.Types.String,
			enum: [
				'studio_name',
				'description',
				'openingHoursSpecification',
				'address',
				'priceRange',
				'available_service',
				'amenity_feature',
				'payment_options',
				'telephone',
				'social_links',
				'makesOffer',
				'other',
				'out_of_business',
			],
			required: true,
		},
		field_type: {
			type: [Schema.Types.String],
		},
		out_of_buisness: {
			type: Schema.Types.Boolean,
			default: false,
		},
		suggested_text: {
			type: Schema.Types.String,
			required: true,
		},
		status: {
			type: Schema.Types.String,
			enum: ['pending', 'approved', 'rejected'], // Status of the suggestion
			default: 'pending',
		},
	},
	{
		timestamps: {
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		},
		versionKey: false,
	}
);

// Export the Suggestion model
export default mongoose.model('suggestions', suggestionSchema);
