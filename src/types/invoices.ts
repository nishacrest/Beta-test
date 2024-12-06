import { Types } from 'mongoose';
import * as yup from 'yup';

export enum InvoiceTransactioStatus {
	PENDING = 'pending',
	PARTIAL_PAYMENT = 'partial_payment',
	IN_PROGRESS = 'in_progress',
	COMPLETED = 'completed',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
}

export enum InvoiceOrderStatus {
	PENDING = 'pending',
	IN_PROGRESS = 'in_progress',
	COMPLETED = 'completed',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	PARTIAL_REFUND = 'partial_refund',
	REFUNDED = 'refunded',
}

export enum InvoiceMode {
	LIVE = 'live',
	DEMO = 'demo',
}

export enum PaymentTypes {
	DESTINATION = 'destination',
	DIRECT = 'direct',
}

export interface BankTransferDetails {
	account_holder_name: string | null;
	bic: string | null;
	iban: string | null;
	reference: string | null;
	address: any
}

export interface InvoiceAttributes {
	_id: Types.ObjectId;
	invoice_number: string | null;
	order_id: string | null;
	shop: Types.ObjectId;
	session_id: string | null;
	payment_id: string | null;
	pdf_url: string | null;
	transaction_status: InvoiceTransactioStatus;
	order_status: InvoiceOrderStatus;
	invoice_mode: InvoiceMode;
	email: string;
	fullname: string | null;
	address: {
		city: string | null;
		country: string | null;
		line1: string | null;
		line2: string | null;
		postal_code: string | null;
		state: string | null;
	} | null;
	tax_amount: number;
	net_amount: number;
	total_amount: number;
	received_amount: number | null;
	fees: number;
	refunded_amount: number;
	payment_invoice: Types.ObjectId | null;
	tax_type: Types.ObjectId;
	payment_method: string | null;
	date: Date;
	created_at: Date;
	updated_at: Date;
	comment: string | null;
	deleted_at: Date | null;
	payment_type: PaymentTypes;
	bank_transfer: BankTransferDetails;
	payment_overPaid: boolean;

}

export type InvoiceInput = Omit<
	InvoiceAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const invoiceUpdateSchema = yup
	.object({
		comment: yup.string().trim().nullable(),
		order_id: yup.string().trim(),
		bank_transfer: yup
			.object({
				account_holder_name: yup.string().nullable(),
				bic: yup.string().nullable(),
				iban: yup.string().nullable(),
				reference: yup.string().nullable(),
			})
			.nullable(),
	})
	.noUnknown(true)
	.label('Request body');
