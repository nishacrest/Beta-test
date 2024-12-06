import moongoose from 'mongoose';
import { RedeemGiftCardInput } from '../../types/redeem_giftcards';

const { Schema } = moongoose;

const redeemGiftCardSchema = new Schema<RedeemGiftCardInput>(
	{
		giftcard: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'giftcards',
		},
		amount: {
			type: Number,
			required: true,
		},
		redeemed_shop: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'shops',
		},
		redeemed_date: {
			type: Date,
			required: true,
		},
		deleted_at: {
			type: Date,
			default: null,
		},
		comment: {
			type: Schema.Types.String,
		},
		fees: {
			type: Schema.Types.Number,
		},
		issuer_shop: {
			type: Schema.Types.ObjectId,
			ref: 'shops',
		},
		negotiation_invoice: {
			type: Schema.Types.ObjectId,
			ref: 'negotiation_invoices',
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

export default moongoose.model<RedeemGiftCardInput>(
	'redeem_giftcards',
	redeemGiftCardSchema
);
