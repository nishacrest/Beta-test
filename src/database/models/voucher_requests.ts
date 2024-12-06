import mongoose, { Schema } from 'mongoose';

const requestVoucherSchema: Schema = new Schema({
	shop_id: { type: Schema.Types.ObjectId, required: true, ref: 'shops' },
	name: { type: Schema.Types.String, required: true },
	email: { type: Schema.Types.String, required: true },
	phone: { type: Schema.Types.String },
	numberOfVouchers: { type: Schema.Types.Number, required: true },
	valuePerVoucher: { type: Schema.Types.Number, required: true },
	additionalInfo: {
		type: Schema.Types.String,
		default: 'No additional info provided.',
	},
	studioOwner: { type: Schema.Types.String, required: true },
	studioEmail: { type: Schema.Types.String, required: true },
	requestedAt: { type: Date, default: Date.now },
});

export const RequestVoucher = mongoose.model(
	'RequestVoucher',
	requestVoucherSchema
);
