import { Types } from 'mongoose';

export interface TaxTypeAttributes {
	_id: Types.ObjectId;
	stripe_id: string;
	title: string;
	description: string;
	percentage: number;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
}

export type TaxTypeInput = Omit<
	TaxTypeAttributes,
	'_id' | 'created_at' | 'updated_at'
>;
