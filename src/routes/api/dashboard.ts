import express from 'express';
import controller from '../../controllers/dashboard.controller';
import authentication from '../../middleware/authentication';
import { checkShopOwner } from '../../middleware/authorization';

const router = express.Router();

router.get(
	'/:shop_id',
	authentication,
	checkShopOwner,
	controller.getDashboardData
);
router.get(
	'/:shop_id/bar-graph',
	authentication,
	checkShopOwner,
	controller.getGraphData
);

export default router;
