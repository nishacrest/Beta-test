import express from 'express';
import redeemController from '../../controllers/redeem.controller';
import authentication from '../../middleware/authentication';
import { checkAdmin } from '../../middleware/authorization';

const router = express.Router();

router.get('/', authentication, redeemController.getAllRedemptions);
router.patch(
	'/:redeem_id',
	authentication,
	checkAdmin,
	redeemController.updateRedeemption
);

export default router;
