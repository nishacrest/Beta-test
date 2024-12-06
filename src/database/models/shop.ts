import mongoose, { Document } from 'mongoose';
import {
	ShopInput,
	ShopStatus,
	StripeOnboardingStatus,
	StudioMode,
} from '../../types/shops';
import { StudioIntegrations } from '../../types/user_settings';

const { Schema } = mongoose;

const shopSchema = new Schema<ShopInput>(
	{
		owner: {
			type: Schema.Types.String,
		},
		studio_id: {
			type: Schema.Types.Number,
			// required: true,
			unique: true,
		},
		studio_name: {
			type: Schema.Types.String,
			// required: true,
		},
		studio_integration: {
			type: Schema.Types.String,
			enum: Object.values(StudioIntegrations),
		},
		shop_url: {
			type: Schema.Types.String,
			// required: true,
		},
		studio_slug: {
			type: Schema.Types.String,
			// required: true,
			unique: true,
		},
		logo_url: {
			type: Schema.Types.String,
			// required: true,
		},
		giftcard_limit: {
			type: Schema.Types.Number,
			// required: true,
		},
		default_giftcard_value: {
			type: Schema.Types.Number,
			// required: true,
		},
		standard_text: {
			type: Schema.Types.String,
		},
		official_name: {
			type: Schema.Types.String,
		},
		country: {
			type: {
				name: Schema.Types.String,
				code: Schema.Types.String,
			},
		},
		street: {
			type: Schema.Types.String,
		},
		city: {
			type: Schema.Types.String,
		},
		status: {
			type: Schema.Types.String,
			enum: Object.values(ShopStatus),
		},
		studio_mode: {
			type: Schema.Types.String,
			enum: Object.values(StudioMode),
		},

		stripe_onboarding_status: {
			type: Schema.Types.String,
			enum: Object.values(StripeOnboardingStatus),
		},
		stripe_account: {
			type: Schema.Types.String,
		},
		tax_type: {
			type: Schema.Types.ObjectId,
			ref: 'tax_types',
		},
		platform_fee: {
			type: Schema.Types.Number,
		},
		fixed_payment_fee: {
			type: Schema.Types.Number,
		},
		tax_id: {
			type: {
				id: Schema.Types.String,
				code: Schema.Types.String,
			},
		},
		deleted_at: {
			type: Schema.Types.String,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: 'users',
		},
		comment: {
			type: Schema.Types.String,
		},
		phone: {
			type: Schema.Types.String,
		},
		templates: [{ type: Schema.Types.ObjectId, ref: 'giftcard_templates' }],
		platform_redeem_fee: {
			type: Schema.Types.Number,
		},
		fixed_payment_redeem_fee: {
			type: Schema.Types.Number,
		},
		iban: {
			type: Schema.Types.String,
		},
		bic: {
			type: Schema.Types.String,
		},
		bank_name: {
			type: Schema.Types.String,
		},
		invoice_reference_number: {
			type: Schema.Types.Number,
		},
		is_giftcard_partner: {
			type: Schema.Types.Boolean,
		},
		setting_headline: {
			type: Schema.Types.String,
		},
		listing_details: {
			type: Schema.Types.ObjectId,
			ref: 'listing_details',
		},
		max_amount: {
			type: Schema.Types.Number,
		},
		min_amount: {
			type: Schema.Types.Number,
		},
		max_total_amount: {
			type: Schema.Types.Number,
		},
	},
	{
		timestamps: {
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		},
		versionKey: false,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

shopSchema.virtual('giftcard_templates', {
	ref: 'giftcard_templates',
	localField: '_id',
	foreignField: 'shop',
	justOne: false,
});

export default mongoose.model<ShopInput>('shops', shopSchema);
