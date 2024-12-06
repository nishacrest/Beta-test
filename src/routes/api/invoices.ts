import express from 'express';
import controller from '../../controllers/invoice.controller';
import authentication from '../../middleware/authentication';
import { checkAdmin } from '../../middleware/authorization';

const router = express.Router();

router.get('/', authentication, controller.getAllInvoice);
router.get('/:id', controller.getInvoiceDetails);
router.patch('/:id', authentication, checkAdmin, controller.updateInvoice);

export default router;
