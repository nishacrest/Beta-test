import express from 'express';
import controller from '../../controllers/refund.controller';
import authentication from '../../middleware/authentication';
import { checkAdmin, checkShopOwner } from '../../middleware/authorization';
import { pdfFileForRefundInvoice } from '../../middleware/upload';

const router = express.Router();

router.get('/', authentication, controller.getAllRefundInvoices);
router.post(
	'/',
	authentication,
	checkAdmin,
	pdfFileForRefundInvoice.single('invoice_file'),
	controller.createRefundInvoice
);
router.get(
	'/:invoice_id/giftcards',
	authentication,
	checkAdmin,
	controller.getGiftCardsForRefund
);
router.post(
	'/:customer_invoice_id/pdf-data',
	authentication,
	checkAdmin,
	controller.getPdfDataForRefundInvoice
);

export default router;
