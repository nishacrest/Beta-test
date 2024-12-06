import express from 'express';
import controller from '../../controllers/negotiation_invoices.controller';
import authentication from '../../middleware/authentication';
import { checkAdmin } from '../../middleware/authorization';
import { pdfFileForNegotiationInvoice } from '../../middleware/upload';

const router = express.Router();

router.get('/', authentication, controller.getAllNegotiationInvoices);
router.get(
	'/:shop_id/redemptions',
	authentication,
	checkAdmin,
	controller.getRedemptionsOfInvoice
);
router.get(
	'/:shop_id/pdf-data',
	authentication,
	checkAdmin,
	controller.getInvoiceDataForPdf
);
router.post(
	'/',
	authentication,
	checkAdmin,
	pdfFileForNegotiationInvoice.single('invoice_file'),
	controller.createNegotiationInvoice
);

export default router;
