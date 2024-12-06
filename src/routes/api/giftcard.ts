import express from 'express';
import giftcardController from '../../controllers/giftcard.controller';
import authentication from '../../middleware/authentication';
import { checkAdmin } from '../../middleware/authorization';

const router = express.Router();

router.get('/', authentication, giftcardController.getAllGiftCards);
router.post('/purchase', giftcardController.purchaseGiftcards);
router.post('/email-update', giftcardController.updateCustomerEmailHandler);
router.get('/:code/check', giftcardController.checkGiftCardCode);
router.post('/:giftcard_id/redeem', giftcardController.redeemGiftCard);
router.patch(
	'/:giftcard_id',
	authentication,
	checkAdmin,
	giftcardController.updateGiftCard
);

export default router;
