import express from 'express';
import controller from '../../controllers/payment_invoices.controller';
import authentication from '../../middleware/authentication';
import { checkAdmin } from '../../middleware/authorization';
import { pdfFileForPaymentInvoice } from '../../middleware/upload';

const router = express.Router();

router.get('/', authentication, controller.getAllPaymentInvoices);
router.get(
	'/:shop_id/purchases',
	authentication,
	checkAdmin,
	controller.getPurchasesOfInvoice
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
	pdfFileForPaymentInvoice.single('invoice_file'),
	controller.createPaymentInvoice
);

export default router;
