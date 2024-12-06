import mongoose from 'mongoose';
import { NegotiationInvoiceInput } from '../../types/negotiation_invoices';

const { Schema } = mongoose;

const negotiationInvoiceSchema = new Schema<NegotiationInvoiceInput>(
	{
		shop: {
			type: Schema.Types.ObjectId,
			ref: 'shops',
		},
		invoice_number: {
			type: Schema.Types.String,
			unique: true,
		},
		redeemed_amount: {
			type: Schema.Types.Number,
		},
		fee_amount: {
			type: Schema.Types.Number,
		},
		payout_amount: {
			type: Schema.Types.Number,
		},
		iban: {
			type: Schema.Types.String,
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

export default mongoose.model<NegotiationInvoiceInput>(
	'negotiation_invoices',
	negotiationInvoiceSchema
);
