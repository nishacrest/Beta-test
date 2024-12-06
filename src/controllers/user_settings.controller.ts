import { StudioIntegrations } from './../types/user_settings';
import { Request, Response } from 'express';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import userSettingsService from '../services/user_settings.service';
import { apiResponse } from '../utils/constant';
import { UserSettingsAttributes } from '../types/user_settings';

const updateUserSettings = async (req: Request, res: Response) => {
	try {
		const { loggedUser } = req;
		const {
			admin_redeem_notifications,
			sale_email_notifications,
			studio_redeem_notifications,
			negotiation_invoice_notifications,
			payment_invoice_notifications,
			refund_invoice_notifications,
			// StudioIntegrations
			
		} = await userSettingsService.validateUserSettingsUpdate(req.body);

		const updateFields: Partial<UserSettingsAttributes> = {};
		if (typeof sale_email_notifications === 'boolean')
			updateFields.sale_email_notifications = sale_email_notifications;
		if (typeof admin_redeem_notifications === 'boolean')
			updateFields.admin_redeem_notifications = admin_redeem_notifications;
		if (typeof studio_redeem_notifications === 'boolean')
			updateFields.studio_redeem_notifications = studio_redeem_notifications;
		if (typeof negotiation_invoice_notifications === 'boolean')
			updateFields.negotiation_invoice_notifications =
				negotiation_invoice_notifications;
		if (typeof payment_invoice_notifications === 'boolean')
			updateFields.payment_invoice_notifications =
				payment_invoice_notifications;
		if (typeof refund_invoice_notifications === 'boolean')
			updateFields.refund_invoice_notifications = refund_invoice_notifications;
        // if (typeof studio_integrations  === 'StudioIntegrations')
		// 	updateFields.studio_integrations = studio_integrations;
		await userSettingsService.update({ user: loggedUser._id }, updateFields);
        await userSettingsService.update({ studio_integrations: StudioIntegrations }, updateFields)
		return sendSuccessResponse(
			res,
			{},
			apiResponse.USER_SETTINGS_UPDATED_SUCCESSFULLY.message,
			apiResponse.USER_SETTINGS_UPDATED_SUCCESSFULLY.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default { updateUserSettings };
