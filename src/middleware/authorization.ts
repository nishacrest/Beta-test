import { NextFunction, Request, Response } from 'express';
import { UserRoles } from '../types/users';
import { sendErrorResponse } from '../utils/response';
import { apiResponse } from '../utils/constant';

export const checkAdmin = (req: Request, res: Response, next: NextFunction) => {
	try {
		const { loggedUser } = req;
		if (loggedUser.role === UserRoles.ADMIN) {
			next();
		} else {
			return sendErrorResponse(
				res,
				apiResponse.ACCESS_DENIED.message,
				apiResponse.ACCESS_DENIED.code
			);
		}
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export const checkShopOwner = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { loggedUser } = req;
		const { shop_id } = req.params;
		if (loggedUser.role === UserRoles.SHOP && loggedUser.shop_id !== shop_id) {
			return sendErrorResponse(
				res,
				apiResponse.ACCESS_DENIED.message,
				apiResponse.ACCESS_DENIED.code
			);
		}
		next();
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};
