// import { StudioIntegrations } from './user_settings';
import { Types } from 'mongoose';
import * as yup from 'yup';

export enum StudioIntegrations {
	UNIVERSAL_AND_STUDIO = 'universal_studio',
	UNIVERSAL = 'universal',
	STUDIO = 'studio',
}
export interface UserSettingsAttributes {
	_id: Types.ObjectId;
	user?: Types.ObjectId;
	shop: Types.ObjectId;
	sale_email_notifications: boolean;
	admin_redeem_notifications: boolean;
	studio_redeem_notifications: boolean;
	studio_integration: StudioIntegrations;
	negotiation_invoice_notifications: boolean;
	payment_invoice_notifications: boolean;
	refund_invoice_notifications: boolean;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
}

export type UserSettingsInput = Omit<
	UserSettingsAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const userSettingsUpdateSchema = yup
	.object({
		sale_email_notifications: yup.boolean().nullable(),
		admin_redeem_notifications: yup.boolean().nullable(),
		studio_redeem_notifications: yup.boolean().nullable(),
		negotiation_invoice_notifications: yup.boolean().nullable(),
		payment_invoice_notifications: yup.boolean().nullable(),
		refund_invoice_notifications: yup.boolean().nullable(),
	})
	.noUnknown(true)
	.label('Request body');
