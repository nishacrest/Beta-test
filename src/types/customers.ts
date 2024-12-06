import { Types, ObjectId } from 'mongoose';
import * as yup from 'yup';

export interface CustomerAttributes {
	_id: Types.ObjectId;
	customer_email: string;
	shop_id: Types.ObjectId;
	// studioId: string
	stripe_customer_id: string;
	created_at: string;
	updated_at: string;
}

export type CustomerInput = Omit<
	CustomerAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const customerCreateSchema = yup
	.object({
		customer_email: yup
			.string()
			.trim()
			.email('Must be a valid email')
			.required('Customer email is required'),
		shop_id: yup.string().required('Shop ID is required'),
		stripe_customer_id: yup
			.string()
			.trim()
			.required('Stripe customer ID is required'),
	})
	.noUnknown()
	.label('Customer request body');

export const customerUpdateSchema = yup
	.object({
		customer_email: yup.string().trim().email('Must be a valid email'),
		stripe_customer_id: yup.string().trim(),
	})
	.noUnknown()
	.label('Customer update body');
