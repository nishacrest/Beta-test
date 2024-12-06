import { Response } from 'express';
import { ClientSession } from 'mongoose';

export const sendSuccessResponse = async (
	res: Response,
	data: any,
	messageKey: string,
	status: number,
	session?: ClientSession | null
) => {
	try {
		if (session) {
			await session.commitTransaction();
			await session.endSession();

			if (process.env.NODE_ENV === 'development' || true) {
				console.log('===== session committed ======');
			}
		}
		res.status(status).json({
			success: true,
			status,
			message: res.__(messageKey),
			data,
		});
	} catch (error: any) {
		console.log(error.message);
	}
};

export const sendErrorResponse = async (
	res: Response,
	messageKey: string,
	status: number,
	session?: ClientSession | null
) => {
	try {
		if (session) {
			await session.abortTransaction();
			await session.endSession();
			if (process.env.NODE_ENV === 'development' || true) {
				console.log('===== session aborted ======');
			}
		}
		res.status(status).json({
			success: false,
			status,
			message: res.__(messageKey),
			data: {},
		});
	} catch (error: any) {
		console.log(error.message);
	}
};
