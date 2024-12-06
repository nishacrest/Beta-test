import mongoose from 'mongoose';
import {
	InvoiceInput,
	InvoiceTransactioStatus,
	InvoiceOrderStatus,
	InvoiceMode,
	PaymentTypes,
} from '../../types/invoices';

const { Schema } = mongoose;

// Define the schema for bank transfer details
const bankTransferSchema = new Schema(
	{
		account_holder_name: {
			type: Schema.Types.String,
		},
		bic: {
			type: Schema.Types.String,
		},
		iban: {
			type: Schema.Types.String,
		},
		reference: {
			type: Schema.Types.String,
		},
		address: {
			type: Map,
			of: Schema.Types.Mixed,
		},
	},
	{ _id: false }
); // Avoid creating a separate _id for this subdocument

const invoiceSchema = new Schema<InvoiceInput>(
	{
		invoice_number: {
			type: Schema.Types.String,
			// unique: true,
		},
		order_id: {
			type: Schema.Types.String,
			// unique: true,
		},
		shop: {
			type: Schema.Types.ObjectId,
			ref: 'shops',
		},
		session_id: {
			type: Schema.Types.String,
			allowNull: true,
		},
		payment_id: {
			type: Schema.Types.String,
		},
		pdf_url: {
			type: Schema.Types.String,
		},
		transaction_status: {
			type: Schema.Types.String,
			enum: Object.values(InvoiceTransactioStatus),
			required: true,
		},
		order_status: {
			type: Schema.Types.String,
			enum: Object.values(InvoiceOrderStatus),
			required: true,
		},
		invoice_mode: {
			type: Schema.Types.String,
			enum: Object.values(InvoiceMode),
		},
		email: {
			type: Schema.Types.String,
		},
		fullname: {
			type: Schema.Types.String,
		},
		address: {
			city: Schema.Types.String,
			country: Schema.Types.String,
			line1: Schema.Types.String,
			line2: Schema.Types.String,
			state: Schema.Types.String,
			postal_code: Schema.Types.String,
		},
		tax_amount: {
			type: Schema.Types.Number,
		},
		net_amount: {
			type: Schema.Types.Number,
		},
		total_amount: {
			type: Schema.Types.Number,
		},
		received_amount: {
			type: Schema.Types.Number,
		},
		fees: {
			type: Schema.Types.Number,
		},
		refunded_amount: {
			type: Schema.Types.Number,
		},
		payment_invoice: {
			type: Schema.Types.ObjectId,
			ref: 'payment_invoices',
		},
		tax_type: {
			type: Schema.Types.ObjectId,
			ref: 'tax_types',
		},
		payment_method: {
			type: Schema.Types.String,
		},
		date: {
			type: Schema.Types.Date,
		},
		deleted_at: {
			type: Schema.Types.Date,
		},
		comment: {
			type: Schema.Types.String,
		},
		payment_type: {
			type: Schema.Types.String,
			enum: Object.values(PaymentTypes),
		},

		bank_transfer: {
			type: bankTransferSchema,
		},
		payment_overPaid: {
			type: Schema.Types.Boolean,
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

export default mongoose.model<InvoiceInput>('invoices', invoiceSchema);
