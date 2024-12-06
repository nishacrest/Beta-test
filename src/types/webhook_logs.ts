import { Types } from 'mongoose';

export interface WebhookLogAttributes {
	_id: Types.ObjectId;
	api_url: string;
	api_response: string;
	error_message: string;
	status_code: Number;
	platfrom_type: String;
	timestamp: Date;
}

export type WebhookLogInput = Omit<
	WebhookLogAttributes,
	'_id' | 'created_at' | 'updated_at'
>;
