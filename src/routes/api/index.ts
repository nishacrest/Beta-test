import express from 'express';
import authRoutes from './auth';
import loggedUserRoutes from './logged_user';
import shopRoutes from './shops';
import giftcardRoutes from './giftcard';
import redeemRoutes from './redeem';
import stripeOnboardingRoutes from './stripe_onboarding';
import webhooksRoutes from './webhooks';
import invoiceRoutes from './invoices';
import taxTypesRoutes from './tax_types';
import dashboardRoutes from './dashboard';
import giftCardTemplatesRoutes from '../api/giftcard_templates';
import userSettingsRoutes from '../api/user_settings';
// import { stripe } from '../../utils/stripe.helper';
import negotiationInvoiceRoutes from './negotiation_invoices';
import paymentInvoicesRoutes from './payment_invoices';
import refundRoutes from './refunds';
import reviews from './review';
import suggestions from './suggestions';
import listings from './listing';
import templateImages from './template_images';

const router = express.Router();

// const func = async () => {
// 	try {
// 		// acct_1PNuom2KVB01vqzA;
// 		const data = await stripe.accounts.retrieve('acct_1PNuom2KVB01vqzA');
// 		console.log(data);
// 	} catch (error) {
// 		console.log(error);
// 	}
// };

router.get('/ping', async (req, res) => {
	// func();
	res.send('pong');
});
router.use('/auth', authRoutes);
router.use('/me', loggedUserRoutes);
router.use('/shops', shopRoutes);
router.use('/giftcards', giftcardRoutes);
router.use('/redemptions', redeemRoutes);
router.use('/stripe-onboarding', stripeOnboardingRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/tax-types', taxTypesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/giftcard-templates', giftCardTemplatesRoutes);
router.use('/user-settings', userSettingsRoutes);
router.use('/negotiation-invoices', negotiationInvoiceRoutes);
router.use('/payment-invoices', paymentInvoicesRoutes);
router.use('/refunds', refundRoutes);
router.use('/reviews', reviews);
router.use('/suggestions', suggestions);
router.use('/listings', listings);
router.use('/template-images', templateImages);
export default router;
