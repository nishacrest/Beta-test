import express from 'express';
import controller from '../../controllers/tax_types.controller';

const router = express.Router();

router.get('/', controller.getAllTaxTypes);

export default router;
