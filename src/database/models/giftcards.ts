import moongoose from 'mongoose';
import {
	GiftCardInput,
	GiftCardMode,
	GiftCardStatus,
} from '../../types/giftcards';

const { Schema } = moongoose;

const giftCardSchema = new Schema<GiftCardInput>(
	{
		user: {
			type: Schema.Types.String,
		},
		code: {
			type: Schema.Types.String,
			required: true,
			// unique: true,
		},
		pin: {
			type: Schema.Types.String,
			required: true,
		},
		incorrect_pin_count: {
			type: Schema.Types.Number,
			default: 0,
		},
		shop: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'shops',
		},
		giftcard_template: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'giftcard_templates',
		},
		message: {
			type: Schema.Types.String,
		},
		amount: {
			type: Schema.Types.Number,
			required: true,
		},
		available_amount: {
			type: Schema.Types.Number,
			required: true,
		},
		refunded_amount: {
			type: Schema.Types.Number,
		},
		purchase_date: {
			type: Schema.Types.Date,
			required: true,
		},
		validtill_date: {
			type: Schema.Types.Date,
			required: true,
		},
		status: {
			type: Schema.Types.String,
			enum: Object.values(GiftCardStatus),
		},
		giftcard_mode: {
			type: Schema.Types.String,
			enum: Object.values(GiftCardMode),
		},
		pdf_url: {
			type: Schema.Types.String,
			default: null,
		},
		invoice: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'invoices',
		},
		refund_invoice: {
			type: Schema.Types.ObjectId,
			ref: 'refund_invoices',
		},
		blocked_until: { type: Date, default: null },
		last_incorrect_pin: {	type: Schema.Types.String , default: null},
		deleted_at: {
			type: Date,
			default: null,
		},
		comment: {
			type: Schema.Types.String,
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

giftCardSchema.index({ code: 1, deleted_at: 1 }, { unique: true });

export default moongoose.model<GiftCardInput>('giftcards', giftCardSchema);
