import express from 'express';
import controller from '../../controllers/stripe_onboarding.controller';

const router = express.Router();

router.post('/account-link', controller.createStripeAccountLink);
router.post('/express-login', controller.createExpressLoginLink);
router.post('/check-account', controller.checkAccountOnboarding);

export default router;
