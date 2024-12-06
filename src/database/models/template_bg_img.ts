import { UploadedType } from './../../types/template_bg_img';
import moongoose, { Types } from 'mongoose';
import { TemplateBackgroundImgInput } from '../../types/template_bg_img';

const { Schema } = moongoose;

const TemplateBackgroundImg = new Schema<TemplateBackgroundImgInput>(
	{
		image_url: {
			type: String,
			required: true,
		},
		uploaded_by: {
			type: Schema.Types.ObjectId,
			required: true,
		},
		uploaded_type: {
			type: Schema.Types.String,
			enum: Object.values(UploadedType),
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

export default moongoose.model<TemplateBackgroundImgInput>(
	'template_bg_img',
	TemplateBackgroundImg
);
