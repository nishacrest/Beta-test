import { Types } from 'mongoose';
import * as yup from 'yup';

export interface RefundInvoiceAttributes {
	_id: Types.ObjectId;
	customer_invoice: Types.ObjectId;
	shop: Types.ObjectId;
	invoice_number: string;
	refund_amount: number;
	tax_amount: number;
	pdf_url: string;
	date: Date;
	reference_number: number;
	stripe_refund_id: string;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
	refund_reason: string;
	payment_invoice: Types.ObjectId | null;
}

export type RefundInvoiceInput = Omit<
	RefundInvoiceAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

const invoiceId = yup
	.string()
	.required('Invoice ID is required')
	.test(
		'is-valid-objectid',
		'Invoice ID must be a valid MongoDB ObjectId',
		(value) => {
			return Types.ObjectId.isValid(value);
		}
	);
const refundGiftCards = yup
	.array()
	.of(
		yup
			.mixed<Types.ObjectId>()
			.transform((value) => {
				if (Types.ObjectId.isValid(value)) {
					return new Types.ObjectId(value);
				}
				return value;
			})
			.required('Refund giftcard id is required')
			.test(
				'is-valid-objectid',
				'Refund giftcard id must be a valid MongoDB ObjectId',
				(value) => {
					return Types.ObjectId.isValid(value);
				}
			)
	)
	.min(1, 'Refund giftcards must much contain at least 1 item')
	.required('Refund giftcards is required');

const refundReason = yup.string().trim().required('Refund reason is required');

export const createRefundInvoiceSchema = yup
	.object()
	.shape({
		invoice_id: invoiceId,
		refund_giftcards: refundGiftCards,
		refund_reason: refundReason,
	})
	.noUnknown()
	.label('Request body');

export const invoicePdfDataSchema = yup
	.object()
	.shape({
		refund_giftcards: refundGiftCards,
	})
	.noUnknown()
	.label('Request body');

export interface IRefundInvoiceMail {
	logoUrl: string;
	userName: string;
	userEmail: string;
	invoiceNumber: string;
	refundDate: string;
	invoiceUrl: string;
}

export interface IRefundInvoiceStudioMail {
	logoUrl: string;
	studioName: string;
	shopEmail: string;
	customerInvoice: string;
	refundInvoice: string;
	refundGiftCards: {
		code: string;
		amount: string;
	}[];
	invoiceUrl: string;
}
