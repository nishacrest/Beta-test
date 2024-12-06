import mongoose from 'mongoose';
import { TaxTypeInput } from '../../types/tax_types';

const { Schema } = mongoose;

const taxTypeSchema = new Schema<TaxTypeInput>(
	{
		stripe_id: {
			type: Schema.Types.String,
		},
		title: {
			type: Schema.Types.String,
			unique: true,
		},
		description: {
			type: Schema.Types.String,
		},
		percentage: {
			type: Schema.Types.Number,
		},
		deleted_at: {
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

export default mongoose.model<TaxTypeInput>('tax_types', taxTypeSchema);
