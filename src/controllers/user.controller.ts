import { Request, Response } from 'express';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import userService from '../services/user.service';
import { omitFromObject } from '../utils/helper';
import { AnyKeyObject } from '../types';
import { apiResponse } from '../utils/constant';
import {
	comparePassword,
	createHashedPassword,
} from '../services/auth.service';

/**
 * Change user password controller function.
 *
 * @param {Request} req - the request object
 * @param {Response} res - the response object
 * @return {Promise<Object>} - the response data in case of success, or an error message in case of failure
 */
const changePassword = async (req: Request, res: Response) => {
	try {
		const {
			current_password,
			new_password,
		}: { current_password: string; new_password: string } = req.body;
		const { loggedUser } = req;

		if (!current_password || !new_password) {
			return sendErrorResponse(
				res,
				apiResponse.PASSWORD_CHANGE_FIELD_REQUIED.message,
				apiResponse.PASSWORD_CHANGE_FIELD_REQUIED.code
			);
		}

		if (new_password.trim().length < 9) {
			return sendErrorResponse(
				res,
				apiResponse.PASSWORD_LENGTH_VALIDATION?.message,
				apiResponse.PASSWORD_LENGTH_VALIDATION?.code
			);
		}

		const [userData] = await userService.findUsers({ _id: loggedUser._id });

		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND.message,
				apiResponse.USER_NOT_FOUND.code
			);
		}
		const currentPasswordMatch = await comparePassword(
			current_password,
			userData.hashed_password
		);
		if (!currentPasswordMatch) {
			return sendErrorResponse(
				res,
				apiResponse.OLD_PASSWORD_INCORRECT.message,
				apiResponse.OLD_PASSWORD_INCORRECT.code
			);
		}

		const hashedPassword = await createHashedPassword(new_password);
		await userService.update(
			{ _id: loggedUser._id },
			{ hashed_password: hashedPassword }
		);

		return sendSuccessResponse(
			res,
			{},
			apiResponse.PASSWORD_CHANGED_SUCCESSFUL.message,
			apiResponse.PASSWORD_CHANGED_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const getProfile = async (req: Request, res: Response) => {
	try {
		const { loggedUser } = req;
		const [userData] = await userService.getProfileDetails(
			loggedUser._id.toString()
		);

		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND.message,
				apiResponse.USER_NOT_FOUND.code
			);
		}
		return sendSuccessResponse(
			res,
			userData,
			apiResponse.USER_PROFILE_FOUND_SUCCESSFUL.message,
			apiResponse.USER_PROFILE_FOUND_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default { changePassword, getProfile };
