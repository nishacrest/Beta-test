import mongoose from 'mongoose';
import { StudioIntegrations, UserSettingsInput } from '../../types/user_settings';

const { Schema } = mongoose;

const userSettingsSchema = new Schema<UserSettingsInput>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'users',
		},
		shop: {
			type: Schema.Types.ObjectId,
			ref: 'shops',
		},
		sale_email_notifications: {
			type: Boolean,
			default: true,
		},
		admin_redeem_notifications: {
			type: Boolean,
			default: true,
		},
		studio_redeem_notifications: {
			type: Boolean,
			default: true,
		},
		studio_integration: { 
			type: String,
			enum: Object.values(StudioIntegrations),
		},
		deleted_at: {
			type: Date,
			default: null,
		},
		negotiation_invoice_notifications: {
			type: Boolean,
			default: true,
		},
		payment_invoice_notifications: {
			type: Boolean,
			default: true,
		},
		refund_invoice_notifications: {
			type: Boolean,
			default: true,
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

export default mongoose.model<UserSettingsInput>(
	'user_settings',
	userSettingsSchema
);
