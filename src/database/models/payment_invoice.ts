import mongoose from 'mongoose';
import { PaymentInvoiceInput } from '../../types/payment_invoices';

const { Schema } = mongoose;

const paymentInvoiceSchema = new Schema<PaymentInvoiceInput>(
	{
		shop: {
			type: Schema.Types.ObjectId,
			ref: 'shops',
		},
		invoice_number: {
			type: Schema.Types.String,
			unique: true,
		},
		purchased_amount: {
			type: Schema.Types.Number,
		},
		fee_amount: {
			type: Schema.Types.Number,
		},
		pdf_url: {
			type: Schema.Types.String,
		},
		date: {
			type: Schema.Types.Date,
		},
		date_range: {
			type: {
				start: Schema.Types.Date,
				end: Schema.Types.Date,
			},
		},
		deleted_at: {
			type: Schema.Types.Date,
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

export default mongoose.model<PaymentInvoiceInput>(
	'payment_invoices',
	paymentInvoiceSchema
);
