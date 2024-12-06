import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '../utils/response';
import { UserJwtPayload } from '../types/index';
import jwt, { VerifyErrors } from 'jsonwebtoken';
import { apiResponse } from '../utils/constant';
import userService from '../services/user.service';

const authentication = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader && authHeader.split(' ')[1];
		if (!token) {
			return sendErrorResponse(
				res,
				apiResponse.SESSION_EXPIRED.message,
				apiResponse.SESSION_EXPIRED.code
			);
		}

		try {
			const decoded = jwt.verify(
				token,
				process.env.JWT_SECRET as string
			) as UserJwtPayload;
			const [userData] = await userService.findUsers({
				_id: decoded.user_id,
			});
			if (!userData) {
				return sendErrorResponse(
					res,
					apiResponse.SESSION_EXPIRED.message,
					apiResponse.SESSION_EXPIRED.code
				);
			}
			req.loggedUser = { ...userData, shop_id: decoded.shop_id };
		} catch (error) {
			return sendErrorResponse(
				res,
				apiResponse.SESSION_EXPIRED.message,
				apiResponse.SESSION_EXPIRED.code
			);
		}

		next();
	} catch (error: any) {
		console.log(error);
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default authentication;
