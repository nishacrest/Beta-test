import { Types } from 'mongoose';
import * as yup from 'yup';
import { truncateToDecimals, validatePhoneNumber } from '../utils/helper';
import { phone } from 'phone';
import { StudioIntegrations } from './user_settings';
import { ListingAttributes } from './listing_details';

export enum ShopStatus {
	ACTIVE = 'active',
	INACTIVE = 'inactive',
}

export enum StripeOnboardingStatus {
	PENDING = 'pending',
	COMPLETED = 'completed',
	PARTIAL = 'partial',
}

export enum StudioMode {
	LIVE = 'live',
	DEMO = 'demo',
}

export interface ShopAttributes {
	_id: Types.ObjectId;
	owner?: string;
	studio_id?: number;
	studio_name?: string;
	shop_url?: string;
	studio_slug?: string;
	logo_url?: string;
	giftcard_limit?: number | null;
	default_giftcard_value?: number | null;
	standard_text?: string | null;
	official_name?: string;
	country?: {
		code: string;
		name: string;
	};
	street?: string;
	city?: string;
	status?: ShopStatus;
	studio_mode?: StudioMode;
	studio_integration?: StudioIntegrations;
	stripe_account?: string | null;
	stripe_onboarding_status?: StripeOnboardingStatus;
	tax_type?: Types.ObjectId;
	platform_fee?: number;
	fixed_payment_fee?: number;
	platform_redeem_fee?: number;
	fixed_payment_redeem_fee?: number;
	iban?: string | null;
	bic?: string | null;
	bank_name?: string | null;
	tax_id?: {
		id: string;
		code: string;
	} | null;
	user?: Types.ObjectId;
	comment?: string | null;
	phone?: string;
	templates?: Types.ObjectId[];
	invoice_reference_number?: number;
	created_at: string;
	updated_at: string;
	deleted_at: Date | null;
	listing_details: Types.ObjectId | null;
	is_giftcard_partner?: null;
	max_amount?: number | null;
	min_amount?: number | null;
	max_total_amount?: number | null;
	setting_headline?: string | null;
}

export type ShopInput = Omit<
	ShopAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const shopCreateSchema = yup
	.object({
		studio_name: yup.string().trim(),
		// .required('Studio name is required'),

		official_name: yup.string().trim(),
		// .required('Official name is required'),
		studio_id: yup
			.string()
			.trim()
			.length(6, 'Studio ID must be exactly 6 characters')
			.test('numberTypeError', 'Studio ID must be a number', (value) => {
				if (!value) return true;
				return !isNaN(parseInt(value));
			}),
		// .required('Studio ID is required'),
		status: yup
			.mixed<ShopStatus>()
			.oneOf(Object.values(ShopStatus), 'Invalid shop status'),
		// .required('Status is required'),
		shop_url: yup
			.string()
			.trim()
			.test(
				'url',
				'Studio URL should not contain http:// or https://',
				(value) => {
					if (!value) return true;
					if (value.includes('http://') || value.includes('https://'))
						return false;
					return true;
				}
			),
		// .required('Studio URL is required'),
		studio_slug: yup
			.string()
			.trim()
			.test(
				'url',
				'Studio Slug should not contain /',
				(value) => !value?.includes('/')
			),
		// .required('Studio Slug is required'),
		country: yup
			.object({
				code: yup.string().trim().required('Country code is required'),
				name: yup.string().trim().required('Country name is required'),
			})
			.typeError('Country must be an object'),
		// .required('Country is required'),
		city: yup.string().trim(),
		// .required('City is required'),

		street: yup.string().trim(),
		// .required('Street is required'),
		owner: yup.string().trim().email('Must be an valid email'),
		// .required('Email is required'),
		tax_type: yup.string().trim(),
		// .required('Tax type is required'),
		platform_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Platform fee must be a number')
			.min(0, 'Platform fee must be greater than or equal to 0')
			.max(100, 'Platform fee must be less than or equal to 100'),
		// .required('Platform fee is required'),
		fixed_payment_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Fixed payment fee must be a number')
			.min(0, 'Fixed payment fee must be greater than or equal to 0'),
		// .required('Fixed payment fee is required'),
		tax_id: yup.string().trim().typeError('Tax ID must be a string'),
		login_email: yup.string().trim().email('Login email must be a valid email'),
		// .required('Login email is required'),
		password: yup
			.string()
			.trim()
			.test(
				'passwordLength',
				'Password must be at least 9 characters',
				(value) => {
					if (!value) return true;
					return value.length >= 9;
				}
			),
		// .required('Password is required'),
		comment: yup
			.string()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable()
			.trim(),
		studio_mode: yup
			.mixed<StudioMode>()
			.oneOf(Object.values(StudioMode), 'Invalid studio mode'),
		// .required('Studio mode is required'),

		studio_integration: yup
			.mixed<StudioIntegrations>()
			.oneOf(Object.values(StudioIntegrations), 'Invalid studio integration'),
		// .required('Studio integration is required'),
		phone: yup
			.string()
			.trim()
			.transform((value) => {
				if (!value) return '';
				const validatePhone = validatePhoneNumber(value);
				if (validatePhone.isValid) return validatePhone.number;
				throw new yup.ValidationError('Invalid phone number', value, 'phone');
			}),
		// .required('Phone number is required'),
		platform_redeem_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Platform redeem fee must be a number')
			.min(0, 'Platform redeem fee must be greater than or equal to 0')
			.max(100, 'Platform redeem fee must be less than or equal to 100'),
		// .required('Platform redeem fee is required'),
		fixed_payment_redeem_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Fixed payment redeem fee must be a number')
			.min(0, 'Fixed payment redeem fee must be greater than or equal to 0'),
		// .required('Fixed payment redeem fee is required'),
		iban: yup
			.string()
			.trim()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable(),
		bic: yup
			.string()
			.trim()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable(),
		bank_name: yup
			.string()
			.trim()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable(),
	})
	.noUnknown()
	.label('Request body');

export const shopUpdateSchema = yup
	.object({
		studio_name: yup.string().trim(),
		official_name: yup.string().trim(),
		studio_id: yup
			.string()
			.trim()
			.length(6, 'Studio ID must be exactly 6 characters')
			.test('numberTypeError', 'Studio ID must be a number', (value) => {
				if (!value) return true;
				return !isNaN(parseInt(value));
			}),
		status: yup
			.mixed<ShopStatus>()
			.oneOf(Object.values(ShopStatus), 'Invalid shop status'),
		shop_url: yup
			.string()
			.trim()
			.test(
				'url',
				'Studio URL should not contain http:// or https://',
				(value) => {
					if (!value) return true;
					if (value.includes('http://') || value.includes('https://'))
						return false;
					return true;
				}
			)
			.required('Shop URL is required'),
		studio_slug: yup
			.string()
			.trim()
			.test(
				'url',
				'Studio Slug should not contain /',
				(value) => !value?.includes('/')
			)
			.required('Studio Slug is required'),
		country: yup
			.object({
				code: yup.string().trim().required('Country code is required'),
				name: yup.string().trim().required('Country name is required'),
			})
			.typeError('Country must be an object'),
		city: yup.string().trim(),
		street: yup.string().trim(),
		owner: yup.string().trim().email('Must be an valid email'),
		tax_type: yup.string().trim(),
		platform_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Platform fee must be a number')
			.min(0, 'Platform fee must be greater than or equal to 0')
			.max(100, 'Platform fee must be less than or equal to 100'),
		fixed_payment_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Fixed payment fee must be a number')
			.min(0, 'Fixed payment fee must be greater than or equal to 0'),
		tax_id: yup
			.string()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return undefined;
				return value;
			})
			.trim()
			.typeError('Tax ID must be a string'),
		login_email: yup.string().trim().email('Login email must be a valid email'),
		password: yup
			.string()
			.trim()
			.nullable()
			.test(
				'passwordLength',
				'Password must be at least 9 characters',
				(value) => {
					if (!value) return true;
					return value.length >= 8;
				}
			),
		comment: yup
			.string()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable()
			.trim(),
		studio_mode: yup
			.mixed<StudioMode>()
			.oneOf(Object.values(StudioMode), 'Invalid studio mode'),
		studio_integration: yup
			.mixed<StudioIntegrations>()
			.oneOf(Object.values(StudioIntegrations), 'Invalid studio integration'),
		phone: yup
			.string()
			.trim()
			.transform((value) => {
				if (!value) return '';
				const validatePhone = validatePhoneNumber(value);
				if (validatePhone.isValid) return validatePhone.number;
				throw new yup.ValidationError('Invalid phone number', value, 'phone');
			}),
		platform_redeem_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Platform redeem fee must be a number')
			.min(0, 'Platform redeem fee must be greater than or equal to 0')
			.max(100, 'Platform redeem fee must be less than or equal to 100'),
		fixed_payment_redeem_fee: yup
			.number()
			.transform((value, originalValue) => {
				return originalValue === ''
					? undefined
					: parseFloat(truncateToDecimals(value, 2, 'floor'));
			})
			.typeError('Fixed payment redeem fee must be a number')
			.min(0, 'Fixed payment redeem fee must be greater than or equal to 0'),
		iban: yup
			.string()
			.trim()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable(),
		bic: yup
			.string()
			.trim()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable(),
		bank_name: yup
			.string()
			.trim()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable(),
	})
	.noUnknown()
	.label('Request body');
