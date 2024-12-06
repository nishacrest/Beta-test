import { Types } from 'mongoose';
import * as yup from 'yup';

export interface ShopUiAttributes {
	_id: Types.ObjectId;
	shop: Types.ObjectId;
	hero_section: {
		title: string;
		subtitle: string;
		description: string;
		background_color: string;
		text_color: string;
		hide_section: boolean,
		carousel: { _id: Types.ObjectId; image_url: string; index: number }[];
	};
	template_section: {
		background_color: string;
	};
	about_us: {
		description: string;
		list_items: {
			_id: Types.ObjectId;
			description: string;
			index: number;
		}[];
		background_color: string;
		hide_section: boolean,
		text_color: string;
		list_item_icon_color: string;
	};
	faq: {
		background_color: string;
		header_bg_color: string;
		header_text_color: string;
		hide_section: boolean,
		list_items: {
			_id: Types.ObjectId;
			title: string;
			description: string;
			index: number;
		}[];
	};
	contact_us: {
		phone_no: string;
		email: string;
		hide_section: boolean,
		location: { _id: Types.ObjectId; lat: number; long: number }[];
	};
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
}

export type ShopUiInput = Omit<
	ShopUiAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const aboutUsSchema = yup
	.object({
		description: yup
			.string()
			.trim()
			.typeError('Description must be a string')
			.required('Description is required'),
		list_items: yup
			.array()
			.of(
				yup
					.object({
						id: yup
							.string()
							.trim()
							.nullable()
							.typeError('List item id must be a string'),
						description: yup
							.string()
							.trim()
							.typeError('Description of list item must be a string')
							.required('Description of list item is required'),
						index: yup
							.number()
							.typeError('Index of list item must be a number')
							.required('Index is required'),
					})
					.required('List item is required')
			)
			.min(1, 'List items must contain at least one item')
			.required('List items is required'),
		background_color: yup
			.string()
			.trim()
			.typeError('Background color must be a string')
			.required('Background color is required'),
		text_color: yup
			.string()
			.trim()
			.typeError('Text color must be a string')
			.required('Text color is required'),
		hide_section: yup
			.boolean(),	
		list_item_icon_color: yup
			.string()
			.trim()
			.typeError('List item icon color must be a string')
			.required('List item icon color is required'),
	})
	.unknown()
	.label('Request Body');

export const FaqSchema = yup
	.object({
		list_items: yup
			.array()
			.of(
				yup
					.object({
						id: yup
							.string()
							.trim()
							.nullable()
							.typeError('List item id must be a string'),
						title: yup
							.string()
							.trim()
							.typeError('Title of list item must be a string')
							.required('Title of list item is required'),
						description: yup
							.string()
							.trim()
							.typeError('Description of list item must be a string')
							.required('Description of list item is required'),
						index: yup
							.number()
							.typeError('Index of list item must be a number')
							.required('Index is required'),
					})
					.required('List item is required')
			)
			.min(1, 'List items must contain at least one item')
			.required('List items is required'),
		background_color: yup
			.string()
			.trim()
			.typeError('Background color must be a string')
			.required('Background color is required'),
		header_bg_color: yup
			.string()
			.trim()
			.typeError('Header background color must be a string')
			.required('Header background color is required'),
		header_text_color: yup
			.string()
			.trim()
			.typeError('Header text color must be a string')
			.required('Header text color is required'),
		hide_section: yup
			.boolean(),		
	})
	.unknown()
	.label('Request Body');

export const contactUsSchema = yup
	.object({
		phone_no: yup
			.string()
			.trim()
			.typeError('Phone number must be a string')
			.required('Phone number is required'),
		email: yup
			.string()
			.trim()
			.typeError('Email must be a string')
			.email('Email must be a valid email')
			.required('Email is required'),
		hide_section: yup
			.boolean(),	
		location: yup
			.array()
			.of(
				yup
					.object({
						id: yup
							.string()
							.trim()
							.nullable()
							.typeError('Location id must be a string'),
						lat: yup
							.number()
							.typeError('Latitude must be a number')
							.required('Latitude is required'),
						long: yup
							.number()
							.typeError('Longitude must be a number')
							.required('Longitude is required'),
					})
					.required('Location is required')
			)
			.min(1, 'Location must contain at least one item')
			.required('Location is required'),
	})
	.unknown()
	.label('Request Body');
