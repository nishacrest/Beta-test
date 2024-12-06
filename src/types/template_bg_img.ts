import { ObjectId, Types } from 'mongoose';
import * as yup from 'yup';

export enum UploadedType {
	ADMIN = 'admin',
	STUDIO = 'shop',
}

export interface TemplateBackgroundImgAttributes {
	_id: Types.ObjectId;
	image_url: string;
	// title: string;
	uploaded_by: Types.ObjectId;
	uploaded_type: UploadedType;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
}

export type TemplateBackgroundImgInput = Omit<
	TemplateBackgroundImgAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const createTemplateBackgroundImgSchema = yup.object({
	image_url: yup
		.string()
		.trim()
		.url('Invalid URL format')
		.required('Image URL is required'),
	// title: yup.string().trim().required('Title is required'),
	// uploaded_by: yup.string().trim().required('uploaded by is required'),
	uploaded_type: yup
		.mixed<UploadedType>()
		.oneOf(Object.values(UploadedType), 'Invalid uploaded_by value')
		.required(),
});

export const updateTemplateBackgroundImgSchema = yup.object({
	image_url: yup.string().trim().url('Invalid URL format'),
	// title: yup.string().trim(),
	// uploaded_by: yup.string().trim().required('uploaded by is required'),
	uploaded_type: yup
		.mixed<UploadedType>()
		.oneOf(Object.values(UploadedType), 'Invalid uploaded_by value'),
	deleted_at: yup.date().nullable(),
});
