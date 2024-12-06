import { Request, Response } from 'express';
import { apiResponse } from '../utils/constant';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import dashboardService from '../services/dashboard.service';
import shopService from '../services/shop.service';
import { UserRoles } from '../types/users';
import userService from '../services/user.service';
import { StudioMode } from '../types/shops';

const getDashboardData = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const { start_date, end_date }: { start_date?: string; end_date?: string } =
			req.query;

		if (!start_date || !end_date) {
			return sendErrorResponse(
				res,
				'All fields are required [start_date, end_date]',
				422
			);
		}

		const [shopData] = await shopService.findShops({ _id: shop_id });
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}

		const data = await dashboardService.getData(
			shop_id,
			start_date,
			end_date,
			shopData.studio_mode ?? StudioMode.DEMO 
		);
		const responseData = {
			...data,
		};
		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.DASHBOARD_DATA_FETCHED.message,
			apiResponse.DASHBOARD_DATA_FETCHED.code
		);
	} catch (error) {
		if (error instanceof Error)
			return sendErrorResponse(res, error.message, 500);
	}
};

const getGraphData = async (req: Request, res: Response) => {
	try {
		const { shop_id } = req.params;
		const {
			year = '2024',
		}: {
			year?: string;
		} = req.query;
		const { loggedUser } = req;

		const [shopData] = await shopService.findShops({ _id: shop_id });
		if (!shopData) {
			return sendErrorResponse(
				res,
				apiResponse.SHOP_NOT_FOUND.message,
				apiResponse.SHOP_NOT_FOUND.code
			);
		}
		const [userData] = await userService.findUsers({ _id: shopData.user });
		const isAdminShop = userData.role === UserRoles.ADMIN;
		const isLoggedAdmin = loggedUser.role === UserRoles.ADMIN;
		const graphData = await dashboardService.getMonthWiseData(
			shop_id,
			isAdminShop,
			+year,
			isLoggedAdmin ? StudioMode.LIVE : (shopData.studio_mode ?? StudioMode.DEMO)
		);
		const responseData = {
			graph_data: graphData,
			admin_shop: isAdminShop,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.DASHBOARD_DATA_FETCHED.message,
			apiResponse.DASHBOARD_DATA_FETCHED.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default { getDashboardData, getGraphData };
