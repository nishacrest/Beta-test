import mongoose from 'mongoose';
import { RefundInvoiceInput } from '../../types/refunds_invoices';

const { Schema } = mongoose;

const refundInvoiceSchema = new Schema<RefundInvoiceInput>(
	{
		shop: {
			type: Schema.Types.ObjectId,
			ref: 'shops',
		},
		customer_invoice: {
			type: Schema.Types.ObjectId,
			ref: 'invoices',
		},
		invoice_number: {
			type: Schema.Types.String,
			unique: true,
		},
		refund_amount: {
			type: Schema.Types.Number,
		},
		tax_amount: {
			type: Schema.Types.Number,
		},
		pdf_url: {
			type: Schema.Types.String,
		},
		date: {
			type: Schema.Types.Date,
		},
		deleted_at: {
			type: Schema.Types.Date,
		},
		reference_number: {
			type: Schema.Types.Number,
		},
		stripe_refund_id: {
			type: Schema.Types.String,
		},
		refund_reason: {
			type: Schema.Types.String,
		},
		payment_invoice: {
			type: Schema.Types.ObjectId,
			ref: 'payment_invoices',
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

export default mongoose.model<RefundInvoiceInput>(
	'refund_invoices',
	refundInvoiceSchema
);
