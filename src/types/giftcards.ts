import { Types } from 'mongoose';
import joi from 'joi';
import * as yup from 'yup';
import { truncateToDecimals } from '../utils/helper';
export enum GiftCardStatus {
	ACTIVE = 'active',
	PENDING_PAYMENT = 'pending_payment',
	INACTIVE = 'inactive',
	BLOCKED = 'blocked',
	EXPIRED = 'expired',
	REFUNDED = 'refunded',
}

export interface GroupedGiftCard {
	template_name: string;
	count: number;
	unitPrice: number;
	totalAmount: number;
}

export enum GiftCardMode {
	DEMO = 'demo',
	LIVE = 'live',
}

export interface GiftCardAttributes {
	_id: Types.ObjectId;
	user: string;
	code: string;
	pin: string;
	incorrect_pin_count: number;
	shop: Types.ObjectId;
	giftcard_template: Types.ObjectId;
	message: string | null;
	amount: number;
	available_amount: number;
	refunded_amount: number;
	purchase_date: Date;
	validtill_date: Date;
	status: GiftCardStatus;
	giftcard_mode: GiftCardMode;
	pdf_url: string | null;
	invoice: Types.ObjectId;
	refund_invoice: Types.ObjectId | null;
	blocked_until: Date | null;
	last_incorrect_pin:string | null;
	created_at: Date;
	updated_at: Date;
	comment: string | null;
	deleted_at: Date | null;
}

export type GiftCardInput = Omit<
	GiftCardAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export interface GiftCardPdf {
	_id: Types.ObjectId;
	studio_name: string;
	logo_url: string;
	standard_text: string | null;
	shop_url: string;
	image_url: string;
	code: string;
	pin: string;
	message: string | null;
	amount: number;
	template_name: string;
	template_headline: string;
}

// export const giftcardPurchaseSchema = joi.object({
// 	email: joi.string().email().required().messages({
// 		'string.base': 'Email must be a string',
// 		'string.email': 'Email must be a valid email address',
// 		'any.required': 'Email is required',
// 	}),
// 	shop_id: joi.string().required().messages({
// 		'string.base': 'Shop ID must be a string',
// 		'any.required': 'Shop ID is required',
// 	}),
// 	cart: joi
// 		.array()
// 		.items(
// 			joi.object({
// 				template_id: joi.string().required().messages({
// 					'string.base': 'Template ID inside cart must be a string',
// 					'any.required': 'Template ID inside cart is required',
// 				}),
// 				quantity: joi.number().min(1).required().messages({
// 					'number.base': 'Quantity inside cart must be a number',
// 					'number.min': 'Quantity inside cart must be at least 1',
// 					'any.required': 'Quantity inside cart is required',
// 				}),
// 				amount: joi.number().min(10).max(250).required().messages({
// 					'number.base': 'Amount inside cart must be a number',
// 					'number.min': 'Amount inside cart must be at least 10',
// 					'number.max': 'Amount inside cart must be at most 250',
// 					'any.required': 'Amount inside cart is required',
// 				}),
// 				message: joi.string().min(0).messages({
// 					'string.base': 'Message inside cart must be a string',
// 				}),
// 			})
// 		)
// 		.min(1)
// 		.messages({
// 			'array.base': 'Cart must be an array',
// 			'array.includesRequiredUnknowns':
// 				'Cart must contain items with template_id, quantity, and amount',
// 			'array.min': 'Cart must contain at least one item',
// 		}),
// });

export const giftcardPurchaseSchema = yup
	.object({
		email: yup
			.string()
			.trim()
			.typeError('Email must be a string')
			.email('Email must be a valid email address')
			.required('Email is required'),
		shop_id: yup
			.string()
			.trim()
			.typeError('Shop ID must be a string')
			.required('Shop ID is required'),
		cart: yup
			.array()
			.of(
				yup
					.object({
						template_id: yup
							.string()
							.trim()
							.typeError('Template ID inside cart must be a string')
							.required('Template ID inside cart is required'),
						quantity: yup
							.number()
							.transform((value) => parseInt(value))
							.typeError('Quantity inside cart item must be a number')
							.min(1, 'Quantity inside cart item must be at least 1')
							.max(10, 'Quantity inside cart item must be at most 10')
							.required('Quantity inside cart item is required'),
						amount: yup
							.number()
							.typeError('Amount inside cart must be a number')
							.transform((value) => parseInt(value))
							.min(10, 'Amount inside cart must be at least 10')
							.max(250, 'Amount inside cart must be at most 250')
							.required('Amount inside cart is required'),
						message: yup.string().trim().min(0),
					})
					.noUnknown()
					.label('Cart item')
			)
			.min(1, 'Cart must contain at least one item')
			.required('Cart is required'),
	})
	.noUnknown()
	.label('Request body');

export const giftCardUpdateSchema = yup
	.object({
		user: yup
			.string()
			.trim()
			.email('User must be a valid email')
			.typeError('User must be a string'),
		status: yup
			.mixed<GiftCardStatus>()
			.oneOf(Object.values(GiftCardStatus), 'Status is invalid'),
		comment: yup
			.string()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable()
			.trim(),
	})
	.noUnknown()
	.label('Request body');

export const giftCardReddemSchema = yup
	.object({
		amount: yup
			.number()
			.typeError('Amount must be a number')
			.transform((value) => +truncateToDecimals(value, 2, 'floor'))
			.min(1, 'Amount must be at least 1.00 EUR')
			.required('Amount is required'),
		shop_id: yup
			.string()
			.trim()
			.typeError('Shop ID must be a string')
			.required('Shop ID is required'),
		pin: yup
			.string()
			.trim()
			.typeError('Pin must be a string')
			.required('Pin is required'),
	})
	.noUnknown()
	.label('Request body');
