import mongoose, { Schema, Document } from 'mongoose';
import { CustomerInput } from '../../types/customers';

const CustomerSchema: Schema<CustomerInput> = new Schema(
	{
		customer_email: {
			type: String,
			required: true,
			trim: true,
		},
		shop_id: {
			type: Schema.Types.ObjectId,
			ref: 'shop',
		},
		stripe_customer_id: {
			type: String,
			required: true,
			trim: true,
		},
	},
	{
		timestamps: true,
	}
);

const CustomerModel = mongoose.model<CustomerInput>('Customer', CustomerSchema);

export default CustomerModel;
