import moongoose, { Types } from 'mongoose';
import { GiftCardTemplateInput } from '../../types/giftcard_templates';

const { Schema } = moongoose;

const giftCardTemplateSchema = new Schema<GiftCardTemplateInput>(
	{
		template_name: {
			type: String,
			required: true,
		},
		template_image: {
			type: Schema.Types.ObjectId,
			ref: 'template_bg_imgs',
		},
		template_headline: {
			type: String,
			required: true,
		},
		primary_color: {
			type: String,
			required: true,
		},
		secondary_color: {
			type: String,
			required: true,
		},
		shop: {
			type: Schema.Types.ObjectId,
			ref: 'shop',
		},
		deleted_at: {
			type: Date,
			default: null,
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

export default moongoose.model<GiftCardTemplateInput>(
	'giftcard_templates',
	giftCardTemplateSchema
);
