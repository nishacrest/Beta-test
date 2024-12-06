import mongoose, { mongo } from 'mongoose';
import { WebhookLogInput } from '../../types/webhook_logs';

const { Schema } = mongoose;

const webhookLogSchema = new Schema<WebhookLogInput>({
	api_url: {
		type: Schema.Types.String,
	},
	api_response: {
		type: Schema.Types.String,
	},
	error_message: {
		type: Schema.Types.String,
	},
	status_code: {
		type: Schema.Types.Number,
	},
	platfrom_type: {
		type: Schema.Types.String,
	},
	timestamp: {
		type: Schema.Types.Date,
	},
});

export default mongoose.model<WebhookLogInput>('webhookLogs', webhookLogSchema);
