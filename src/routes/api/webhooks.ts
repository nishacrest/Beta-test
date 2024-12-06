import express from 'express';
import controller from '../../controllers/webhook.controller';

const router = express.Router();

router.post('/stripe', controller.stripeWebhook);

export default router;
