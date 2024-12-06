import path from 'path';

export const OTP_COUNT = {
	MAX_LIMIT: 50,
};
export const OTP_VALID_TIME = 15;
export const ROLES_ID = {
	ADMIN: 1,
	SHOP: 2,
	USER: 3,
};
export const TEMPLATES_DIRECTORY = path.join(__dirname, '../../src/templates');
export const EJS_TEMPLATES = {
	GIFTCARD_PDF: path.join(__dirname, '../../src/templates/giftcard.ejs'),
	GIFTCARD_EMAIL: path.join(
		__dirname,
		'../../src/templates/giftcard_email.ejs'
	),
	RESET_PASSWORD_OTP: path.join(
		__dirname,
		'../../src/templates/reset_password_otp.ejs'
	),
	INVOICE_PDF: path.join(__dirname, '../../src/templates/invoice.ejs'),
	INVOICE_EMAIL: path.join(__dirname, '../../src/templates/invoice_email.ejs'),
	LOGIN_OTP: path.join(TEMPLATES_DIRECTORY, 'login_otp_email.ejs'),
	GIFTCARD_SALE_MAIL: path.join(TEMPLATES_DIRECTORY, 'giftcard_sale_email.ejs'),
	STUDIO_REDEEM_MAIL: path.join(TEMPLATES_DIRECTORY, 'studio_redeem_email.ejs'),
	ADMIN_REDEEM_MAIL: path.join(TEMPLATES_DIRECTORY, 'admin_redeem_email.ejs'),
	NEGOTIATION_INVOICE_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'negotiation_invoice_email.ejs'
	),
	PAYMENT_INVOICE_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'payment_invoice_email.ejs'
	),
	REFUND_EMAIL: path.join(TEMPLATES_DIRECTORY, 'refund_email.ejs'),
	REFUND_STUDIO_EMAIL: path.join(
		TEMPLATES_DIRECTORY,
		'refund_studio_email.ejs'
	),
	PAYMENT_REMAINDER_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'payment_remainder.ejs'
	),
	ORDER_CONFIRMATION_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'order_confirmation.ejs'
	),
	STUDIO_PARTIAL_INFO: path.join(
		TEMPLATES_DIRECTORY,
		'studio_partial_info.ejs'
	),
	ORDER_CANCELLATION_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'order_cancellation_mail.ejs'
	),
	REVIEW_EMAIL: path.join(TEMPLATES_DIRECTORY, 'review_email.ejs'),
	REQUEST_VOUCHER_MAIL: path.join(TEMPLATES_DIRECTORY, 'request_voucher.ejs'),
	SUGGESTION_PROCESSING_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'suggestion_proceed.ejs'
	),
	STUDIO_SUGGESTION_NOTIFICATION_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'suggestion_approval_studio.ejs'
	),
	SUGGESTION_APPROVAL_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'suggestion_approval_user.ejs'
	),
	SUGGESTION_REJECTION_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'suggestion_rejection_user.ejs'
	),
	SUGGESTION_NOT_FOUND: {
		code: 404, // Assuming 404 Not Found is appropriate
		message: 'Suggestion not found.',
	},
	FACEBOOK_REGISTRATION_MAIL: path.join(
		TEMPLATES_DIRECTORY,
		'facebook_registration_mail.ejs'
	),
	EMAIL_VERIFICATION: path.join(
		TEMPLATES_DIRECTORY,
		'email_verification_mail.ejs'
	),
};
export const BASE_DOMAIN =
	process.env.BASE_URL || 'https://gutschein.thai-massage.de';

export const HERO_SECTION_IMAGES = [
	`${BASE_DOMAIN}/api/assets/image-hero1.jpg`,
	`${BASE_DOMAIN}/api/assets/image-hero2.jpg`,
	`${BASE_DOMAIN}/api/assets/image-hero3.jpg`,
];
export const DEFAULT_IMG_URL = {
	LOGO: `${BASE_DOMAIN}/api/assets/logo.png`,
	FULL_LOGO: `${BASE_DOMAIN}/api/assets/full-logo.png`,
};

export const LAMBDA_FUNCTION = {
	PDF_GENERATION: 'pdf-generation',
	// INVOICE_PDF: 'invoice-pdf-generation',
};

export const AvailableTaxTypes = {
	STANDARD: 'Standard',
	VAT_FREE: 'Steuerbefreit',
	SMALL_BUSINESS: 'Kleinunternehmen',
};

export const AWS_S3_BUCKET_KEYS = {
	NEGOTIATION_INVOICE: 'negotiation-invoice',
	PAYMENT_INVOICE: 'payment-invoice',
	GIFTCARD: 'giftcards',
	INVOICE: 'invoices',
	REFUND_INVOICE: 'refund_invoice',
};

export const SUGGESTION_STATUS = {
	APPROVED: 'approved',
	REJECTED: 'rejected',
};
export const apiResponse = {
	SIGNUP_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [fullname, phone, password]',
	},
	SOCIAL_SIGNIN_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [token, provider]',
	},
	FIREBASE_TOKEN_FIELDS_NOT_FOUND: {
		code: 422,
		message: 'Required fields are missing in firebase token. [fullname, email]',
	},
	SIGNUP_SUCCESSFUL: {
		code: 200,
		message: 'Signed up successfully',
	},
	NAME_VALIDATION: {
		code: 422,
		message: 'Must be valid fullname',
	},
	PHONE_VALIDATION: {
		code: 422,
		message: 'Must be a valid phone number',
	},
	EMAIL_VALIDATION: {
		code: 422,
		message: 'Must be a valid email address',
	},
	EMAIL_EXISTS: {
		code: 422,
		message: 'Email already exists',
	},
	EMAIL_UPDATE_SUCCESSFUL: {
		code: 200,
		message: 'Email updated successfully',
	},
	PHONE_CHANGED: {
		code: 200,
		message: 'Phone changed successfully',
	},
	PHONE_EXISTS: {
		code: 422,
		message: 'Phone already exists',
	},
	ROLES_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Roles retrieved successfully',
	},
	USER_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [fullname, phone, password, role]',
	},
	USER_CREATED_SUCCESSFUL: {
		code: 200,
		message: 'User created successfully',
	},
	USER_NOT_FOUND: {
		code: 404,
		message: 'User not found',
	},
	USER_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'User retrieved successfully',
	},
	USER_UPDATED_SUCCESSFUL: {
		code: 200,
		message: 'User updated successfully',
	},
	USER_DELETED_SUCCESSFUL: {
		code: 200,
		message: 'User deleted successfully',
	},
	USER_VERIFIED: {
		code: 200,
		message: 'User is verified',
	},
	USER_ALREADY_VERIFIED: {
		code: 422,
		message: 'User is already verified',
	},
	USER_NOT_VERIFIED: {
		code: 422,
		message: 'Your phone is not verified',
	},
	USER_PROFILE_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'User profile retrieved successfully',
	},
	USER_TEST_FOUND: {
		code: 200,
		message: 'Test data retrieved successfully',
	},
	USER_INCORRECT_QUESTION_FOUND: {
		code: 200,
		message: 'Incorrect question data retrieved successfully',
	},
	USER_INCORRECT_QUESTION_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [exam_uuid]',
	},
	OLD_PASSWORD_INCORRECT: {
		code: 422,
		message: 'Current password is incorrect',
	},
	PASSWORD_CHANGE_FIELD_REQUIED: {
		code: 422,
		message: 'All fields are required. [current password, new password]',
	},
	PASSWORD_CHANGE_SOCIAL_VALIDATION: {
		code: 422,
		message: 'Can not change passord for social signup user',
	},
	PASSWORD_CHANGED_SUCCESSFUL: {
		code: 200,
		message: 'Password changed successfully',
	},
	ALL_USER_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'All user retrieved successfully',
	},
	ROLE_NOT_FOUND: {
		code: 404,
		message: 'No role found',
	},
	LOGIN_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [email, password]',
	},
	INVALID_LOGIN_METHOD: {
		code: 422,
		message:
			'Try signing in with the same method with which you have signed up before',
	},
	LOGIN_SUCCESSFUL: {
		code: 200,
		message: 'Logged in successfully',
	},
	LOGOUT_SUCCESSFUL: {
		code: 200,
		message: 'Logged out successfully',
	},
	INCORRECT_EMAIL_OR_PASSWORD: {
		code: 422,
		message: 'Incorrect email or password',
	},
	PHONE_DOES_NOT_EXISTS: {
		code: 403,
		message: 'The phone number you are trying to login with does not exist',
	},
	PHONE_VERIFY_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [phone, fullname, password]',
	},
	RESET_PASSWORD_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [email, new-password]',
	},
	PASSWORD_LENGTH_VALIDATION: {
		code: 422,
		message: 'Password must be at least 9 characters',
	},
	OTP_VERIFIED: {
		code: 200,
		message: 'Otp verified successfully',
	},
	OTP_VERIFICATION_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [otp, email]',
	},
	LOGIN_OTP_VERIFICATION_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [otp, email, password]',
	},
	OTP_SEND_LIMIT: {
		code: 422,
		message: 'Otp limit exceeded',
	},
	OTP_SENT: {
		code: 200,
		message: 'Otp sent successfully',
	},
	OTP_INCORRECT: {
		code: 422,
		message: 'Otp is incorrect',
	},
	OTP_EXPIRED: {
		code: 422,
		message: 'Otp is expired',
	},
	OPT_NOT_VERIFIED: {
		code: 422,
		message: 'Otp is not verified',
	},
	OTP_INVALID_EXPIRED: {
		code: 422,
		message: 'Otp is invalid or expired',
	},
	OTP_USED: {
		code: 422,
		message: 'Otp is already used',
	},
	CONFIRM_PASSWORD_FAILED: {
		code: 404,
		message: 'Confirm password does not match',
	},
	PASSWORD_RESET_SUCCESSFUL: {
		code: 200,
		message: 'Password reset successfully',
	},
	SHOP_FIELDS_REQUIRED: {
		code: 422,
		message:
			'All fields are required. [studio id, studio name, official name, street, city, owner] ',
	},
	STUDIO_ID_EXISTS: {
		code: 422,
		message: 'Shop with this studio id already exists',
	},
	STUDIO_SLUG_EXISTS: {
		code: 422,
		message: 'Shop with this studio slug already exists',
	},
	SHOP_CREATED_SUCCESSFUL: {
		code: 200,
		message: 'Shop created successfully',
	},
	STUDIO_NAME_EXISTS: {
		code: 422,
		message: 'Shop with this studio name already exists',
	},
	SHOP_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Shop retrieved successfully',
	},
	SHOP_NOT_FOUND: {
		code: 404,
		message: 'Shop not found',
	},
	SHOP_INACTIVE: {
		code: 422,
		message: 'Shop is inactive',
	},
	STUDIO_NOT_FOUND: {
		code: 404,
		message: 'Invalid Studio-ID',
	},
	STUDIO_INACTIVE: {
		code: 422,
		message: 'no longer accepts gift card',
	},
	SHOP_UPDATED_SUCCESSFUL: {
		code: 200,
		message: 'Shop updated successfully',
	},
	SHOP_HERO_SECTION_UPDATED_SUCCESSFUL: {
		code: 200,
		message: 'Shop hero section updated successfully',
	},
	SHOP_ABOUT_SECTION_UPDATED_SUCCESSFUL: {
		code: 200,
		message: 'Shop about section updated successfully',
	},
	SHOP_CONTACT_SECTION_UPDATED_SUCCESSFUL: {
		code: 200,
		message: 'Shop contact section updated successfully',
	},
	SHOP_FAQ_SECTION_UPDATED_SUCCESSFUL: {
		code: 200,
		message: 'Shop faq section updated successfully',
	},
	GIFTCARD_CONFIG_UPDATED_SUCCESSFUL: {
		code: 200,
		message: 'Gift card configuration updated successfully',
	},
	GIFTCARD_PURCHASE_REQUIRED_FIELDS: {
		code: 422,
		message: 'All fields are required. [cart, shop_id, email]',
	},
	GIFTCARD_PURCHASE_FEE_AMOUNT_EXCEEDED: {
		code: 422,
		message: 'Total payment fee exceed a total cart amount',
	},
	GIFTCARD_NOT_FOUND: {
		code: 422,
		message: 'Gift card not exists',
	},
	GIFTCARD_EXPIRED: {
		code: 422,
		message: 'Gift card expired on ',
	},
	GIFTCARD_PAYMENT_PENDING: {
		code: 422,
		message: 'Gift card has pending payment',
	},
	GIFTCARD_INACTIVE: {
		code: 422,
		message: 'Gift card is inactive',
	},
	GIFTCARD_BLOCKED: {
		code: 422,
		message: 'Gift card is blocked',
	},
	GIFTCARD_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Gift card retrieved successfully',
	},
	DEMO_GIFTCARD_CANNOT_BE_REDEEMED_IN_LIVE_MODE: {
		code: 422,
		message: 'Demo gift cards cannot be redeemed in live mode',
	},
	LIVE_GIFTCARD_CANNOT_BE_REDEEMED_IN_DEMO_MODE: {
		code: 422,
		message: 'Live gift cards cannot be redeemed in demo mode',
	},
	REDEEM_AT_DEMO_MODE_WHILE_ISSUER_IS_LIVE: {
		code: 422,
		message:
			'Cannot redeem as redeemed at studio is demo while issuer studio is live',
	},
	REDEEM_AT_LIVE_MODE_WHILE_ISSUER_IS_DEMO: {
		code: 422,
		message:
			'Cannot redeem as redeemed at studio is live mode while issuer studio is demo',
	},
	GIFTCARD_AMOUNT_EXCEEDED: {
		code: 422,
		message: 'Gift card amount exceeded',
	},
	GIFTCARD_PIN_INCORRECT_AND_BLOCKED: {
		code: 422,
		message:
			'Invalid gift card PIN. Your gift card has been blocked. Please contact customer support for assistance.',
	},
	GIFTCARDS_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Gift cards retrieved successfully',
	},
	GIFTCARD_UPDATED_SUCCESSFULLY: {
		code: 200,
		message: 'Gift card updated successfully',
	},
	GIFTCARD_REDEEMED_SUCCESSFUL: {
		code: 200,
		message: 'Gift card redeemed successfully',
	},
	REDEEMPTIONS_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Redemptions retrieved successfully',
	},
	REDEEMPTION_NOT_FOUND: {
		code: 404,
		message: 'Redemption not found',
	},
	REDEEMPTION_UPDATED_SUCCESSFULLY: {
		code: 200,
		message: 'Redemption updated successfully',
	},
	REDEEM_AT_SHOP_CAN_NOT_ADMIN_ON_ADMIN_ISSUED_GIFTCARDS: {
		code: 422,
		message:
			'Redeem at shop can not be admin studio on admin issued gift cards',
	},
	REDEMPTION_AMOUNT_SHOP_WITH_INVOICE_CANNOT_BE_UPDATED: {
		code: 422,
		message:
			'Redemption amount and redeem at shop with negotiation invoice cannot be updated',
	},
	REDEEM_AT_SHOP_UPDATE_ONLY_ON_ADMIN_ISSUED_GIFTCARDS: {
		code: 422,
		message:
			"The 'redeem at shop' can only be updated when the issuer is an admin studio",
	},
	REDEEM_AT_SHOP_CAN_NOT_BE_ADMIN_STUDIO_ON_ADMIN_ISSUED_GIFTCARDS: {
		code: 422,
		message:
			"The 'redeem at shop' can not be admin studio on admin issued gift cards",
	},
	GIFTCARD_TEMPLATES_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Gift card templates retrieved successfully',
	},
	GIFTCARD_TEMPLATE_NOT_FOUND: {
		code: 404,
		message: 'Gift card template not found',
	},
	GIFTCARD_TEMPLATE_UPDATED_SUCCESSFULLY: {
		code: 200,
		message: 'Gift card template updated successfully',
	},
	GIFTCARD_TEMPLATE_CREATED_SUCCESSFULLY: {
		code: 200,
		message: 'Gift card template created successfully',
	},
	GIFTCARD_TEMPLATE_DELETED_SUCCESSFULLY: {
		code: 200,
		message: 'Gift card template deleted successfully',
	},
	GIFTCARD_TEMPLATE_IMAGE_REQUIRED: {
		code: 422,
		message: 'Gift card template empty and filled image is required',
	},
	INVOICE_NOT_FOUND: {
		code: 404,
		message: 'Invoice not found',
	},
	INVOICE_FETCHED_SUCCESSFUL: {
		code: 200,
		message: 'Invoice retrieved successfully',
	},
	INVOICES_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Invoices retrieved successfully',
	},
	INVOICE_UPDATED_SUCCESSFULLY: {
		code: 200,
		message: 'Invoice updated successfully',
	},
	USER_SETTINGS_UPDATED_SUCCESSFULLY: {
		code: 200,
		message: 'User settings updated successfully',
	},
	USER_SETTINGS_NOT_FOUND: {
		code: 404,
		message: 'User settings not found',
	},
	USER_SETTINGS_FETCHED_SUCCESSFULLY: {
		code: 200,
		message: 'User settings retrieved successfully',
	},
	USER_SETTINGS_DELETED_SUCCESSFULLY: {
		code: 200,
		message: 'User settings deleted successfully',
	},
	USER_SETTINGS_CREATED_SUCCESSFULLY: {
		code: 200,
		message: 'User settings created successfully',
	},
	INTERNAL_SERVER_ERROR: {
		code: 500,
		message: 'Something went wrong. Please try again',
	},
	VALIDATION_ERROR: {
		code: 422,
		message: 'Validation error',
	},
	FORBIDDEN: {
		code: 403,
		message: 'Forbidden',
	},
	ACCESS_DENIED: {
		code: 403,
		message: 'Access denied',
	},
	SESSION_EXPIRED: {
		code: 401,
		message: 'Authentication error',
	},
	UNABLE_TO_GENERATE_UNIQUE_CODE: {
		code: 404,
		message: 'Unable to generate unique gift card code. Please try again.',
	},
	DASHBOARD_DATA_FETCHED: {
		code: 200,
		message: 'Dashboard data fetched successfully',
	},
	DATE_RANGE_FIELD_REQUIRED: {
		code: 422,
		message: 'Fields are required [start_date, end_date]',
	},
	NEGOTIATION_INVOICES_FETCHED_SUCCESSFULLY: {
		code: 200,
		message: 'Negotiation invoices fetched successfully',
	},
	NEGOTIATION_INVOICE_PDF_DATE_RETRIEVED_SUCCESSFULLY: {
		code: 200,
		message: 'Negotiation invoice pdf date retrieved successfully',
	},
	INVOICE_FILE_REQUIRED: {
		code: 422,
		message: 'Invoice file is required',
	},
	REDEMPTIONS_NOT_FOUND_FOR_INVOICE: {
		code: 404,
		message: 'No redemptions found to generate invoice',
	},
	NEGOTIATION_INVOICE_GENERATED_SUCCESSFULLY: {
		code: 200,
		message: 'Negotiation invoice generated successfully',
	},
	PAYMENT_INVOICES_FETCHED_SUCCESSFULLY: {
		code: 200,
		message: 'Payment invoices fetched successfully',
	},
	PAYMENT_INVOICE_PDF_DATE_RETRIEVED_SUCCESSFULLY: {
		code: 200,
		message: 'Payment invoice pdf date retrieved successfully',
	},
	PURCHASES_FOUND_SUCCESSFUL: {
		code: 200,
		message: 'Purchases retrieved successfully',
	},
	PURCHASES_NOT_FOUND_FOR_INVOICE: {
		code: 404,
		message: 'No purchases found to generate invoice',
	},
	PAYMENT_INVOICE_GENERATED_SUCCESSFULLY: {
		code: 200,
		message: 'Payment invoice generated successfully',
	},
	INVOICE_NUMBER_EXISTS: {
		code: 422,
		message: 'Invoice number already exists. Please try again',
	},
	INVOICE_NUMBER_MISMATCH: {
		code: 422,
		message:
			'Invoice number does not match. Please try again to fetch data with latest invoice number',
	},
	INVALID_CUSTOMER_INVOICE_ID: {
		code: 422,
		message: 'Invalid customer invoice id',
	},
	ELIGIBLE_GIFTCARD_REFUND_FETCHED_SUCCESSFULLY: {
		code: 200,
		message: 'Eligible gift cards for refund fetched successfully',
	},
	ELIGIBLE_GIFTCARD_REFUND_NOT_FOUND: {
		code: 404,
		message: 'There is no eligible gift cards for refund',
	},
	DEMO_INVOICE_REFUND_NOT_ALLOWED: {
		code: 422,
		message: 'Demo invoice cannot be refunded',
	},
	INVOICE_PAYMENT_ID_NOT_EXISTS: {
		code: 404,
		message: 'Invoice payment id does not exists',
	},
	ONE_OF_GIFTCARD_NOT_BELONG_TO_INVOICE_REFUND: {
		code: 422,
		message:
			'One of the gift cards does not belong to requested refund invoice',
	},
	REFUND_INVOICE_PDF_DATA_RETRIEVED_SUCCESSFULLY: {
		code: 200,
		message: 'Refund invoice pdf data retrieved successfully',
	},
	REFUND_INVOICE_GENERATED_SUCCESSFULLY: {
		code: 200,
		message: 'Refund invoice generated successfully',
	},
	REFUND_INVOICES_FETCHED_SUCCESSFULLY: {
		code: 200,
		message: 'Refund invoices fetched successfully',
	},
	GIFTCARD_REFUNDED: {
		code: 200,
		message: 'Gift card is refunded',
	},
	REFUND_FAILED_FROM_STRIPE: {
		code: 200,
		message: 'Could not process refund from stripe. Please try again',
	},
	TAX_TYPE_NOT_FOUND: {
		code: 404,
		message: 'Tax type not found',
	},
	LISTING_CREATED_SUCCESSFUL: {
		code: 200,
		message: 'listing created',
	},
	REQUEST_VOUCHER_SUCCESSFUL: {
		code: 200,
		message: 'Voucher successfully requested',
	},
	LISTING_NOT_FOUND: {
		code: 404,
		message: 'Listing not found',
	},
	REVIEW_CREATED_SUCCESS: {
		code: 201,
		message: 'review created successfully',
	},
	REVIEW_CREATION_ERROR: {
		code: 400,
		message: 'error creating review',
	},
	REVIEW_NOT_FOUND: {
		code: 404,
		message: 'review not found',
	},
	REVIEW_UPDATED_SUCCESS: {
		code: 200,
		message: 'review updated successfully',
	},
	REVIEW_UPDATE_ERROR: {
		code: 500,
		message: 'error updating review',
	},
	REVIEW_SUBMITTED_SUCCESS: {
		code: 201,
		message: 'review submitted successfully',
	},
	REVIEW_SUBMISSION_ERROR: {
		code: 500,
		message: 'review submittion error',
	},
	SUGGESTION_SUBMITTED_SUCCESS: {
		code: 201,
		message: 'Suggestion submitted successfully',
	},
	SUGGESTION_SUBMISSION_ERROR: {
		code: 400,
		message: 'Error submitting suggestion',
	},
	SUGGESTION_REJECTED_SUCCESS: {
		code: 200,
		message: 'Suggestion rejected successfully',
	},
	SUGGESTION_APPROVED_SUCCESS: {
		code: 200,
		message: 'Suggestion approved successfully',
	},
	INVALID_ACTION_ERROR: {
		code: 400,
		message: 'Invalid action. Please specify "approve" or "reject".',
	},
	VOUCHER_REQUEST_SUCCESS: {
		code: 200,
		message: 'Voucher request sent successfully.',
	},
	UNIQUE_CITIES_RETRIEVED_SUCCESS: {
		code: 200,
		message: 'Unique cities with studios retrieved successfully',
	},
	SUGGESTION_NOT_FOUND: {
		code: 404,
		message: 'Suggestion not found.',
	},
	REVIEWS_FOUND: {
		code: 200,
		message: 'Reviews found successfully.',
	},
	REVIEW_PIN_REQUIRED: {
		code: 422,
		message: 'PIN is required to submit a review',
	},
	REVIEW_PIN_INVALID: {
		code: 422,
		message: 'Invalid or expired PIN',
	},
	REVIEWER_EMAIL_REQUIRED: {
		code: 422,
		message: 'reviewer email required',
	},
	LISTING_UPDATED_SUCCESSFUL: {
		message: 'Listing updated successfully.',
		code: 200,
	},
	LISTINGS_FETCHED_SUCCESSFUL: {
		message: 'Listings fetched successfully.',
		code: 200,
	},
	LISTING_DELETED_SUCCESSFUL: {
		message: 'Listing deleted successfully.',
		code: 200,
	},
	SUGGESTIONS_FETCH_SUCCESS: {
		message: 'Suggestions fetched successfully',
		code: 200,
	},
	SUGGESTIONS_FETCH_ERROR: {
		message: 'Error fetching suggestions',
		code: 500,
	},
	REQUEST_VOUCHERS_RETRIEVED: {
		message: 'Voucher requests retrieved successfully.',
		code: 200,
	},
	FACEBOOK_LOGIN_FAILED: {
		message: 'Facebook login failed. Please try again.',
		code: 400,
	},
	REGISTRATION_REQUIRED_FIELDS: {
		message: 'Email, password, and name are required fields.',
		code: 400, // Bad Request
	},
	USER_ALREADY_EXISTS: {
		message: 'A user with this email already exists.',
		code: 409, // Conflict
	},
	VERIFICATION_EMAIL_SENT: {
		message: 'Verification email has been sent. Please check your inbox.',
		code: 200, // OK
	},
	INVALID_TOKEN: {
		message: 'The verification token is invalid or has expired.',
		code: 401, // Unauthorized
	},
	EMAIL_VERIFICATION_SUCCESS: {
		message: 'Email verification successful. You can now log in.',
		code: 200, // OK
	},
	RECAPTCHA_VERIFICATION_FAILED: {
		message: 'reCAPTCHA verification failed. Please try again.',
		code: 403,
	},
	SETTINGS_UPDATE_SUCCESS: {
		message: 'Settings updated successfully',
		code: 200,
	},
	ERROR_UPDATING_SETTINGS: {
		message: 'Error updating settings',
		code: 500,
	},
	REVIEW_DELETED_SUCCESS: {
		message: 'Review deleted successfully.',
		code: 200,
	},
	REVIEW_DELETION_ERROR: {
		message: 'Error deleting review.',
		code: 500,
	},
	LISTING_CLAIMED_SUCCESSFUL: {
		message: 'Listing claimed successfully.',
		code: 200, // HTTP status code for success
	},
	INVALID_REPORT_REASON: {
		message: 'Invalid report reason provided',
		code: 400,
	},
	REVIEW_REPORTED_SUCCESSFULLY: {
		message: 'Review reported successfully',
		code: 200,
	},
	REVIEW_ALREADY_REPORTED: {
		message: 'Review has already been reported with this reason',
		code: 400,
	},
	REPORTED_REVIEWS_RETRIEVED_SUCCESSFULLY: {
		message: 'Reported reviews retrieved successfully.',
		code: 200,
	},
	REPORTED_REVIEWS_FETCH_FAILED: {
		message: 'Failed to retrieve reported reviews.',
		code: 400,
	},
	GIFTCARD_BLOCKED_TEMPORARILY: {
		message: 'Gift card is temporarily blocked for an hour',
		code: 400,
	},
	INVALID_EMAIL_FORMAT: {
		message: 'We do not accept disposable emails',
		code: 400,
	},
	PIN_ALREADY_TRIED: {
		message:
			'You have already tried this PIN, please try a different one or wait.',
		code: 422,
	},
	EMAIL_VALIDATED: {
		message: 'Email Validated ',
		code: 200,
	},
	BACKGROUND_TEMPLATE_ADDED_SUCCESSFULLY: {
		message: 'Template image added successfully',
		code: 200,
	},
	BACKGROUND_IMAGE_REQUIRED: {
		message: 'Image required',
		code: 422,
	},
	GIFTCARD_TEMPLATE_UPDATE_FIELDS_REQUIRED: {
		message: 'Giftcard update field required',
		code: 422,
	},
	BACKGROUND_IMAGES_FETCHED_SUCCESSFULLY: {
		message: "Background Image fetched successfully ", 
		code: 200
	}, 
	NO_BACKGROUND_IMAGES_FOUND: {
		message: "No Background Images found", 
		code: 422
	},
	INVALID_UPLOAD_TYPE: {
		message: "Invalid upload type", 
		code: 422
	}, 
	MISSING_UPLOADED_BY: {
		message: "Missing Uploaded by field", 
		code: 422
	}, 
	BACKGROUND_TEMPLATE_DELETED_SUCCESSFULLY: {
		message: "Background Template deleated successfully", 
		code: 422
	}
};
