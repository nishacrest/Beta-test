import { isValidObjectId, Types } from 'mongoose';
import * as yup from 'yup';

export interface GiftCardTemplateAttributes {
	_id: Types.ObjectId;
	template_name: string;
	template_image: Types.ObjectId;
	template_headline: string;
	primary_color: string;
	secondary_color: string;
	shop: Types.ObjectId;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
}

export type GiftCardTemplateInput = Omit<
	GiftCardTemplateAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const createTemplateSchema = yup.object({
	template_name: yup.string().trim().required('Templates is required'),
	template_image: yup
		.mixed<Types.ObjectId>()
		.required()
		.test('is-object-id', '${path} must be a valid MongoDB ObjectId', (value) =>
			isValidObjectId(value)
		)
		.transform((value) => {
			if (value && isValidObjectId(value)) return new Types.ObjectId(value);
			return value;
		}),
	template_headline: yup
		.string()
		.trim()
		.required('template colour is required'),
	primary_color: yup.string().trim().required('template colour is required'),
	secondary_color: yup.string().trim().required('template colour is required'),
	shop: yup
		.mixed<Types.ObjectId>()
		.required()
		.test('is-object-id', '${path} must be a valid MongoDB ObjectId', (value) =>
			isValidObjectId(value)
		)
		.transform((value) => {
			if (value && isValidObjectId(value)) return new Types.ObjectId(value);
			return value;
		}),
});

export const updateTemplateSchema = yup.object({
	template_name: yup.string().trim(),
	template_image: yup
		.mixed<Types.ObjectId>()
		// .required()
		.test('is-object-id', '${path} must be a valid MongoDB ObjectId', (value) =>
			isValidObjectId(value)
		)
		.transform((value) => {
			if (value && isValidObjectId(value)) return new Types.ObjectId(value);
			return value;
		}),
	template_headline: yup.string().trim(),
	primary_color: yup.string().trim(),
	secondary_color: yup.string().trim(),
	deleted_at: yup.date().nullable(),
	shop: yup.string().trim(),
});
