import { Types } from 'mongoose';
import * as yup from 'yup';

export interface PaymentInvoiceAttributes {
	_id: Types.ObjectId;
	shop: Types.ObjectId;
	invoice_number: string;
	purchased_amount: number;
	fee_amount: number;
	pdf_url: string;
	date: Date;
	date_range: {
		start: Date;
		end: Date;
	};
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
}

export type PaymentInvoiceInput = Omit<
	PaymentInvoiceAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const PaymentInvoiceCreateSchema = yup
	.object()
	.shape({
		shop_id: yup
			.string()
			.required('Shop ID is required')
			.test(
				'is-valid-objectid',
				'Shop ID must be a valid MongoDB ObjectId',
				(value) => {
					return Types.ObjectId.isValid(value);
				}
			),
		start_date: yup
			.string()
			.required('Start date is required')
			.test('is-valid-date', 'Start date must be a valid date', (value) => {
				const date = new Date(value);
				return !isNaN(date.getTime());
			}),
		end_date: yup
			.string()
			.required('End date is required')
			.test('is-valid-date', 'End date must be a valid date', (value) => {
				const date = new Date(value);
				return !isNaN(date.getTime());
			}),
		invoice_number: yup.string().required('Invoice number is required'),
	})
	.noUnknown()
	.label('Request body');

export interface IPaymentInvoiceMail {
	logoUrl: string;
	studioName: string;
	shopEmail: string;
	totalAmount: string;
	invoiceNumber: string;
	invoiceDate: string;
	invoiceUrl: string;
}
