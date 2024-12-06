import express from 'express';
import controller from '../../controllers/auth.controller';
import authentication from '../../middleware/authentication';
import passport from 'passport';
import { configurePassport } from '../../services/config-passport';

const router = express.Router();

// router.post('/register', userRegistrationController);
router.post('/login', controller.userLogin);
router.post('/forget-password', controller.forgetPassword);
router.post('/verify-otp', controller.verifyOTP);
router.post('/reset-password', controller.resetPassword);
router.post('/verify-login-otp', controller.verifyLoginOtp);
// router.post('/logout', authentication, userLogoutController);
router.get(
	'/facebook',
	passport.authenticate('facebook', { scope: ['email'] }) //when user clicks sign-in with facebook on FE
);

router.get(
	'/facebook/callback',
	passport.authenticate('facebook', {
		failureRedirect: '/login', // Redirect to login on failure
		session: true, // Persist session after login
	}),
	controller.facebookLogin // Redirect to your success handler
);

// Route for user registration
router.post('/register', controller.userRegister);

// Route for email verification
router.post('/verify-email', controller.verifyEmail);
// Route to handle TwiML voice response for OTP
router.post('/otp/voice', controller.getVoiceResponse);

router.post('/claim-listing', controller.verifyOTPForClaimListing)

// Route to initiate an OTP call
router.post('/request-otp', controller.requestOtp);
export default router;
