import { Types } from 'mongoose';
import * as yup from 'yup';
import { truncateToDecimals } from '../utils/helper';

export interface RedeemGiftCardAttributes {
	_id: Types.ObjectId;
	giftcard: Types.ObjectId;
	amount: number;
	redeemed_shop: Types.ObjectId;
	redeemed_date: Date;
	created_at: Date;
	updated_at: Date;
	comment: string | null;
	negotiation_invoice: Types.ObjectId | null;
	fees: number;
	issuer_shop: Types.ObjectId;
	deleted_at: Date | null;
}

export type RedeemGiftCardInput = Omit<
	RedeemGiftCardAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const redeemGiftCardUpdateSchema = yup
	.object({
		amount: yup
			.number()
			.transform((value) => +truncateToDecimals(value, 2, 'floor'))
			.typeError('Amount must be a number')
			.min(0, 'Amount must be greater than or equal to 0 EUR'),
		redeemed_shop: yup
			.string()
			.trim()
			.typeError('Redeemed shop must be a string'),
		comment: yup
			.string()
			.transform((value) => {
				if (value === 'undefined' || value === 'null') return null;
				return value;
			})
			.nullable()
			.trim(),
	})
	.noUnknown()
	.label('Request body');
