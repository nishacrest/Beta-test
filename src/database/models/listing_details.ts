import mongoose from 'mongoose';
import {
	AmenityFeatureType,
	AvailableServiceType,
	PaymentOptionType,
} from '../../types/listing_details';

const { Schema } = mongoose;

const openingHoursSpecificationSchema = new Schema(
	{
		day_of_week: {
			type: [Schema.Types.String],
			required: true,
		},
		opening_time: {
			type: Schema.Types.String,
			required: true,
		},
		closing_time: {
			type: Schema.Types.String,
			required: true,
		},
	},
	{ _id: false }
);

const telephoneSchema = new Schema(
	{
		phone: {
			type: Schema.Types.String,
		},
		mobile_phone: {
			type: Schema.Types.String,
		},
	},
	{ _id: false }
);

const addressSchema = new Schema(
	{
		streetAddress: {
			type: Schema.Types.String,
		},
		addressLocality: {
			type: Schema.Types.String,
		},
		postalCode: {
			type: Schema.Types.String,
		},
		addressCountry: {
			type: Schema.Types.String,
		},
	},
	{ _id: false }
);

const makesOfferSchema = new Schema(
	{
		itemOffered: {
			name: {
				type: Schema.Types.String,
				required: true,
			},
		},
		description: {
			type: Schema.Types.String,
			required: true,
		},
		prices: [
			new Schema(
				{
					price: {
						type: Schema.Types.String,
						required: true,
					},
					priceCurrency: {
						type: Schema.Types.String,
						required: true,
					},
					duration: {
						type: Schema.Types.String,
						required: true,
					},
				},
				{ _id: false }
			),
		],
	},
	{ _id: false }
);

// New separated schemas for available service, amenity feature, and payment options
const availableServiceSchema = new Schema(
	{
		name: {
			type: Schema.Types.String,
			enum: Object.values(AvailableServiceType),
		},
		value: {
			type: Schema.Types.Boolean,
			default: true,
		},
	},
	{ _id: false }
);

const amenityFeatureSchema = new Schema(
	{
		name: {
			type: Schema.Types.String,
			enum: Object.values(AmenityFeatureType),
			required: true,
		},
		value: {
			type: Schema.Types.Boolean,
		},
	},
	{ _id: false }
);

const paymentOptionSchema = new Schema(
	{
		name: {
			type: Schema.Types.String,
			enum: Object.values(PaymentOptionType),
			required: true,
		},
		value: {
			type: Schema.Types.Boolean,
			default: true,
		},
	},
	{ _id: false }
);

const listingDetailsSchema = new Schema(
	{
		shop: {
			type: Schema.Types.ObjectId,
			ref: 'shops',
		},
		studio_name: {
			type: Schema.Types.String,
		},
		description: {
			type: Schema.Types.String,
		},
		email: {
			type: Schema.Types.String,
		},
		opening_hours_specification: [openingHoursSpecificationSchema],
		postal_code: {
			type: Schema.Types.String,
			required: true,
		},
		address: addressSchema,
		available_service: [availableServiceSchema],
		amenity_feature: [amenityFeatureSchema],
		payment_options: [paymentOptionSchema],
		social_links: {
			Whatsapp: { type: Schema.Types.String },
			Facebook: { type: Schema.Types.String },
			Website: { type: Schema.Types.String },
		},
		telephone: [telephoneSchema],
		makes_offer: [makesOfferSchema],
		is_verified: {
			type: Schema.Types.Boolean,
		},
		logo_image_url: {
			type: Schema.Types.String,
		},
		title_image_url: {
			type: Schema.Types.String,
		},
		image_urls: {
			type: [Schema.Types.String],
		},
		city_image_url: {
			type: [Schema.Types.String],
		},
		reviewPin: {
			type: Schema.Types.String,
		},
		otp: {
			type: Schema.Types.Number,
		},
		otp_count: {
			type: Schema.Types.Number,
			default: 0,
		},
		otp_time: {
			type: Schema.Types.Date,
		},
		otp_verified: {
			type: Schema.Types.Boolean,
			default: false,
		},
		otp_used: {
			type: Schema.Types.Boolean,
			default: false,
		},
		claimed_by: {
			type: Schema.Types.String,
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

export default mongoose.model('listing_details', listingDetailsSchema);
