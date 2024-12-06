import { Request, Response } from 'express';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import { stripe } from '../utils/stripe.helper';
import { apiResponse } from '../utils/constant';
import taxTypeService from '../services/tax_type.service';
import { TaxTypeAttributes } from '../types/tax_types';

const getAllTaxTypes = async (req: Request, res: Response) => {
	try {
		const taxTypes = await taxTypeService.getAllTaxTypes();

		return sendSuccessResponse(
			res,
			taxTypes,
			'Tax types fetched successfully',
			200
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default { getAllTaxTypes };
