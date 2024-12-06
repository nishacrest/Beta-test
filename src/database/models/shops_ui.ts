import mongoose from 'mongoose';
import { ShopUiInput } from '../../types/shops_ui';

const { Schema } = mongoose;

const shopUiSchema = new Schema<ShopUiInput>(
	{
		shop: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'shops',
		},
		hero_section: {
			type: {
				title: Schema.Types.String,
				subtitle: Schema.Types.String,
				description: Schema.Types.String,
				background_color: Schema.Types.String,
				text_color: Schema.Types.String,
				hide_section: Schema.Types.Boolean,
				carousel: [
					{
						_id: Schema.Types.ObjectId,
						image_url: Schema.Types.String,
						index: Schema.Types.Number,
					},
				],
			},
		},
		template_section: {
			type: {
				background_color: Schema.Types.String,
			},
		},
		about_us: {
			type: {
				description: Schema.Types.String,
				list_items: [
					{
						_id: Schema.Types.ObjectId,
						description: Schema.Types.String,
						index: Schema.Types.Number,
					},
				],
				background_color: Schema.Types.String,
				text_color: Schema.Types.String,
				hide_section: Schema.Types.Boolean,
				list_item_icon_color: Schema.Types.String,
			},
		},
		faq: {
			type: {
				background_color: Schema.Types.String,
				header_bg_color: Schema.Types.String,
				header_text_color: Schema.Types.String,
				hide_section: Schema.Types.Boolean,
				list_items: [
					{
						_id: Schema.Types.ObjectId,
						title: Schema.Types.String,
						description: Schema.Types.String,
						index: Schema.Types.Number,
					},
				],
			},
		},
		contact_us: {
			type: {
				phone_no: Schema.Types.String,
				email: Schema.Types.String,
				hide_section: Schema.Types.Boolean,
				location: [
					{
						_id: Schema.Types.ObjectId,
						lat: Schema.Types.Number,
						long: Schema.Types.Number,
					},
				],
			},
		},
		deleted_at: {
			type: Schema.Types.Date,
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

export default mongoose.model<ShopUiInput>('shops_ui', shopUiSchema);
