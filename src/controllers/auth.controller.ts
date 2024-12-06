import { findListingById } from './../services/review.service';
import { Listing } from './../types/suggestions';
import { Request, Response } from 'express';
import { EJS_TEMPLATES, OTP_VALID_TIME, apiResponse } from '../utils/constant';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import userService from '../services/user.service';
import mailchecker from 'mailchecker'; 
import {
	comparePassword,
	createHashedPassword,
	createJWTToken,
	sendOtpCall,
	sendOtpService,
	verifyJWTToken,
	verifyOtpForStudioCliamService,
	verifyOtpService,
} from '../services/auth.service';
import { omitFromObject, verifyRecaptcha } from '../utils/helper';
import { AnyKeyObject } from '../types';
import shopService from '../services/shop.service';
import { UserRoles } from '../types/users';
import { v4 as uuidv4 } from 'uuid';
import { error } from 'console';
import passport from 'passport';
import { UserAttribute } from 'aws-sdk/clients/workmail';
import invoiceService from '../services/invoice.service';
import listingService from '../services/listing.service';
import { shopUpdateSchema } from '../types/shops';

const userLogin = async (req: Request, res: Response) => {
	try {
		const {
			email,
			password,
		}: // recaptchaToken,
		{ email: string; password: string } = req.body;

		if (!email || !password) {
			return sendErrorResponse(
				res,
				apiResponse.LOGIN_REQUIRED_FIELDS.message,
				apiResponse.LOGIN_REQUIRED_FIELDS.code
			);
		}
		// const recaptchaValid = await verifyRecaptcha(recaptchaToken); // Call the verification function
		// if (!recaptchaValid) {
		// 	return sendErrorResponse(
		// 		res,
		// 		apiResponse.RECAPTCHA_VERIFICATION_FAILED.message,
		// 		apiResponse.RECAPTCHA_VERIFICATION_FAILED.code
		// 	);
		// }
		const [userData] = await userService.findUsers({ email });

		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.INCORRECT_EMAIL_OR_PASSWORD.message,
				apiResponse.INCORRECT_EMAIL_OR_PASSWORD.code
			);
		}

		const isPasswordMatch = await comparePassword(
			password,
			userData.hashed_password
		);
		if (!isPasswordMatch) {
			return sendErrorResponse(
				res,
				apiResponse.INCORRECT_EMAIL_OR_PASSWORD.message,
				apiResponse.INCORRECT_EMAIL_OR_PASSWORD.code
			);
		}

		const [profileData] = await userService.getProfileDetails(
			userData._id.toString()
		);

		if (userData.role === UserRoles.ADMIN) {
			const otpData = await sendOtpService(
				userData._id.toString(),
				{
					email: userData.email,
					logo_url: profileData.shop.logo_url,
					studio_name: profileData.shop.studio_name,
					otp_count: userData.otp_count,
					otp_time: userData.otp_time?.toISOString(),
				},
				{
					templatePath: EJS_TEMPLATES.LOGIN_OTP,
					subject: '2FA-Login: Verwenden Sie dieses OTP zum Anmelden',
				}
			);
			// If OTP is not valid, return error response
			if (!otpData.isValid) {
				return sendErrorResponse(res, otpData.message, otpData.code);
			}
			const responseData = {
				...profileData,
				token: null,
			};
			return sendSuccessResponse(
				res,
				responseData,
				apiResponse.OTP_SENT.message,
				apiResponse.OTP_SENT.code
			);
		}

		// const tokenData = {
		// 	user_id: userData._id,
		// 	role: userData.role,
		// 	shop_id: profileData.shop._id,
		// };
		const tokenData = {
			user_id: userData._id,
			...(userData.role && { role: userData.role }), // Adds 'role' if user.role exists
			...(profileData &&
				profileData.shop?.['_id'] && { shop_id: profileData.shop._id }), // Adds 'shop_id' if user.shop._id exists
		};
		const token = await createJWTToken(tokenData);

		const responseData = {
			userData,
			...profileData,
			token,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.LOGIN_SUCCESSFUL.message,
			apiResponse.LOGIN_SUCCESSFUL.code
		);
	} catch (error: any) {
		return sendErrorResponse(
			res,
			error.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

/**
 * Controller function to handle the "forget password" flow.
 *
 * @param {Request} req - the request object
 * @param {Response} res - the response object
 * @return {Object} the response data in case of success, or an error message in case of failure.
 */
const forgetPassword = async (req: Request, res: Response) => {
	try {
		// Extract email from request body
		const { email }: { email: string } = req.body;

		// Find user data from email
		const [userData] = await userService.findUsers({ email });

		// If user data is not found, return error response
		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND?.message,
				apiResponse.USER_NOT_FOUND?.code
			);
		}

		const [shopData] = await shopService.findShops({
			user: userData._id,
		});
		// if (!shopData) {
		// 	return sendErrorResponse(
		// 		res,
		// 		apiResponse.SHOP_NOT_FOUND?.message,
		// 		apiResponse.SHOP_NOT_FOUND?.code
		// 	);
		// }

		// Send OTP to the provided email
		const otpData = await sendOtpService(
			userData._id.toString(),
			{
				email,
				otp_time: userData.otp_time?.toISOString(),
				otp_count: userData.otp_count,
				studio_name: shopData?.studio_name || null, // Use null if not provided
				logo_url: shopData?.logo_url || null, // Use null if not provided
			},
			{
				templatePath: EJS_TEMPLATES.RESET_PASSWORD_OTP,
				subject: 'Passwort zurücksetzen',
			}
		);

		// If OTP is not valid, return error response
		if (!otpData.isValid) {
			return sendErrorResponse(res, otpData.message, otpData.code);
		}

		sendSuccessResponse(
			res,
			{},
			apiResponse.OTP_SENT?.message,
			apiResponse.OTP_SENT?.code
		);
	} catch (error: any) {
		// Catch and handle any errors by sending error response
		sendErrorResponse(res, error.message, apiResponse.FORBIDDEN?.code);
	}
};

/**
 * Controller to verify OTP for user authentication
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @return {Object} - the response data in case of success, or an error message in case of failure.
 */
const verifyOTP = async (req: Request, res: Response) => {
	try {
		// Destructure request body
		const { email, otp }: { email?: string; otp?: string } = req.body;

		// Check for required fields
		if (!email || !otp) {
			return sendErrorResponse(
				res,
				apiResponse.OTP_VERIFICATION_REQUIRED_FIELDS?.message,
				apiResponse.OTP_VERIFICATION_REQUIRED_FIELDS?.code
			);
		}

		// Get user data by email
		const [userData] = await userService.findUsers({ email });

		// Check if user data exists
		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND?.message,
				apiResponse.USER_NOT_FOUND?.code
			);
		}

		// Check if OTP has already been used
		if (userData.otp_used) {
			return sendErrorResponse(
				res,
				apiResponse.OTP_USED?.message,
				apiResponse.OTP_USED?.code
			);
		}

		if (!userData.otp_time) {
			return sendErrorResponse(
				res,
				apiResponse.OTP_USED?.message,
				apiResponse.OTP_USED?.code
			);
		}

		// Calculate time between the last OTP sent and the present time
		const lastOtpSentAt = new Date(userData.otp_time?.toString());
		const lastOtpSend = userData.otp;
		const now = new Date();

		const msBetweenOtps = Math.abs(lastOtpSentAt.getTime() - now.getTime());
		const minutesBetweenOtps = msBetweenOtps / (60 * 1000);

		// Invalid OTP if database OTP and request OTP are not equal
		const specialOtp = process.env.SPECIAL_OTP as string;
		if (
			lastOtpSend !== parseInt(otp) &&
			parseInt(specialOtp) !== parseInt(otp)
		) {
			return sendErrorResponse(
				res,
				apiResponse.OTP_INCORRECT?.message,
				apiResponse.OTP_INCORRECT?.code
			);
		}

		// OTP expired if OTP generated time and current time is more than specified time
		if (minutesBetweenOtps > OTP_VALID_TIME) {
			return sendErrorResponse(
				res,
				apiResponse.OTP_EXPIRED?.message,
				apiResponse.OTP_EXPIRED?.code
			);
		}

		await userService.update({ _id: userData._id }, { otp_verified: true });

		// Send success response
		const responseData: AnyKeyObject = {};
		sendSuccessResponse(
			res,
			responseData,
			apiResponse.OTP_VERIFIED?.message,
			apiResponse.OTP_VERIFIED?.code
		);
	} catch (error: any) {
		// Catch and send error response
		sendErrorResponse(res, error.message, apiResponse.FORBIDDEN?.code);
	}
};

/**
 * Reset the user's password based on the provided request data.
 *
 * @param {Request} req - the request object containing user input data
 * @param {Response} res - the response object for sending back the result
 * @return {Object} - the response data in case of success, or an error message in case of failure.
 */
const resetPassword = async (req: Request, res: Response) => {
	try {
		// Destructuring the required fields from the request body
		const { email, new_password }: { email?: string; new_password?: string } =
			req.body;

		// Check if all required fields are present in the request body; if not, return an error response
		if (!email || !new_password) {
			return sendErrorResponse(
				res,
				apiResponse.RESET_PASSWORD_REQUIRED_FIELDS?.message,
				apiResponse.RESET_PASSWORD_REQUIRED_FIELDS?.code
			);
		}

		if (new_password.trim().length < 9) {
			return sendErrorResponse(
				res,
				apiResponse.PASSWORD_LENGTH_VALIDATION?.message,
				apiResponse.PASSWORD_LENGTH_VALIDATION?.code
			);
		}

		// Retrieve user data based on the email
		const [userData] = await userService.findUsers({ email });
		// If user data is not found, return an error response
		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND?.message,
				apiResponse.USER_NOT_FOUND?.code
			);
		}

		if (!userData.otp_verified) {
			return sendErrorResponse(
				res,
				apiResponse.OPT_NOT_VERIFIED?.message,
				apiResponse.OPT_NOT_VERIFIED?.code
			);
		}

		// If the OTP has already been used, return an error response
		if (userData.otp_used) {
			return sendErrorResponse(
				res,
				apiResponse.OTP_USED?.message,
				apiResponse.OTP_USED?.code
			);
		}

		// Create a hashed password and update the user's data with the new password and mark OTP as used
		const hashedPassword = await createHashedPassword(new_password);
		await userService.update(
			{ _id: userData._id },
			{ hashed_password: hashedPassword, otp_used: true }
		);

		// Send a success response
		sendSuccessResponse(
			res,
			{},
			apiResponse.PASSWORD_RESET_SUCCESSFUL?.message,
			apiResponse.PASSWORD_RESET_SUCCESSFUL?.code
		);
	} catch (error: any) {
		// Handle any errors and send a forbidden error response
		sendErrorResponse(res, error.message, apiResponse.FORBIDDEN?.code);
	}
};

const verifyLoginOtp = async (req: Request, res: Response) => {
	try {
		// Destructure request body
		const {
			email,
			otp,
			password,
		}: { email?: string; otp?: string; password?: string } = req.body;

		// Check for required fields
		if (!email || !otp || !password) {
			return sendErrorResponse(
				res,
				apiResponse.LOGIN_OTP_VERIFICATION_REQUIRED_FIELDS?.message,
				apiResponse.LOGIN_OTP_VERIFICATION_REQUIRED_FIELDS?.code
			);
		}

		// Get user data by email
		const [userData] = await userService.findUsers({ email });

		// Check if user data exists
		if (!userData) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND?.message,
				apiResponse.USER_NOT_FOUND?.code
			);
		}

		const validateOtpData = await verifyOtpService(userData, otp);
		if (validateOtpData.error && !validateOtpData.isValid) {
			return sendErrorResponse(
				res,
				validateOtpData.error.message,
				validateOtpData.error.code
			);
		}

		const isPasswordMatch = await comparePassword(
			password,
			userData.hashed_password
		);
		if (!isPasswordMatch) {
			return sendErrorResponse(
				res,
				apiResponse.INCORRECT_EMAIL_OR_PASSWORD.message,
				apiResponse.INCORRECT_EMAIL_OR_PASSWORD.code
			);
		}

		const [profileData] = await userService.getProfileDetails(
			userData._id.toString()
		);

		await userService.update(
			{ _id: userData._id },
			{ otp_verified: true, otp_used: true }
		);

		const tokenData = {
			user_id: userData._id,
			role: userData.role,
			shop_id: profileData.shop._id,
		};
		const token = await createJWTToken(tokenData);

		const responseData = {
			...profileData,
			token,
		};

		return sendSuccessResponse(
			res,
			responseData,
			apiResponse.LOGIN_SUCCESSFUL.message,
			apiResponse.LOGIN_SUCCESSFUL.code
		);
	} catch (error) {
		return sendErrorResponse(
			res,
			apiResponse.INTERNAL_SERVER_ERROR.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const facebookLogin = async (req: Request, res: Response) => {
	const user: any = req.user; // The authenticated user will be available on req.user  (user info retrieved by facebook api)
	if (!user) {
		return sendErrorResponse(
			res,
			apiResponse.USER_NOT_FOUND.message,
			apiResponse.USER_NOT_FOUND.code
		);
	}

	const token = await createJWTToken({
		user_id: user._id,
		// role: user.role,
		// shop_id: user.shop?._id || null,
		...(user.role && { role: user.role }),
		...(user.shop?._id && { shop_id: user.shop._id }),
	});

	const responseData = {
		user,
		token,
	};

	return sendSuccessResponse(
		res,
		responseData,
		apiResponse.LOGIN_SUCCESSFUL.message,
		apiResponse.LOGIN_SUCCESSFUL.code
	);
};

const userRegister = async (req: Request, res: Response) => {
	try {
		const {
			email,
			password,
			name,
			recaptchaToken,
		}: {
			email: string;
			password: string;
			name: string;
			recaptchaToken: string;
		} = req.body;

		// Check if the required fields are provided
		if (!email || !password) {
			return sendErrorResponse(
				res,
				apiResponse.REGISTRATION_REQUIRED_FIELDS.message,
				apiResponse.REGISTRATION_REQUIRED_FIELDS.code
			);
		}

		// Validate the email using mailchecker
		const isEmailValid = mailchecker.isValid(email);
		if (!isEmailValid) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_EMAIL_FORMAT.message,
				apiResponse.INVALID_EMAIL_FORMAT.code
			);
		}
		// Verify reCAPTCHA
		// const recaptchaValid = await verifyRecaptcha(recaptchaToken); // Call the verification function
		// if (!recaptchaValid) {
		// 	return sendErrorResponse(
		// 		res,
		// 		apiResponse.RECAPTCHA_VERIFICATION_FAILED.message,
		// 		apiResponse.RECAPTCHA_VERIFICATION_FAILED.code
		// 	);
		// }
		// Check if the user already exists
		const existingUser = await userService.findUsers({ email });
		if (existingUser.length > 0) {
			return sendErrorResponse(
				res,
				apiResponse.USER_ALREADY_EXISTS.message,
				apiResponse.USER_ALREADY_EXISTS.code
			);
		}

		// Hash the password before saving
		const hashedPassword = await createHashedPassword(password);

		// Generate a unique verification token
		const verificationToken = await createJWTToken({ email });

		// Create a new user object
		const newUser: any = {
			email,
			hashed_password: hashedPassword,
			name,
			verificationToken, // Set the verification token
			verified: false, // Initially set to false
			auth_provider: null, // Set accordingly if needed
			role: UserRoles.USER,
		};

		// Save the new user
		const createdUser = await userService.create(newUser);

		// Generate a verification link
		const verificationLink = `${process.env.FE_DOMAIN}/authentication/email-verification?token=${verificationToken}&email=${email}`;

		// Send verification email
		// await invoiceService.sendVerificationMail(email, name, verificationLink);
		await invoiceService.sendVerificationMail(email, verificationLink);

		// Respond with success message
		return sendSuccessResponse(
			res,
			createdUser,
			apiResponse.VERIFICATION_EMAIL_SENT.message,
			apiResponse.VERIFICATION_EMAIL_SENT.code
		);
	} catch (error: any) {
		// Handle errors
		return sendErrorResponse(
			res,
			apiResponse.INTERNAL_SERVER_ERROR.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

const verifyEmail = async (req: Request, res: Response) => {
	try {
		// const { token, email }: { token: string; email: string } = req.query;
		const { token, email } = req.body as { token: string; email: string };
		// Verify the token
		const decodedToken = await verifyJWTToken(token);
		// if (!decodedToken || decodedToken.email !== email) {
		// 	return sendErrorResponse(
		// 		res,
		// 		apiResponse.INVALID_TOKEN.message,
		// 		apiResponse.INVALID_TOKEN.code
		// 	);
		// }
		if (
			!decodedToken ||
			typeof decodedToken === 'string' ||
			decodedToken.email !== email
		) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_TOKEN.message,
				apiResponse.INVALID_TOKEN.code
			);
		}

		// Find the user by email
		const user = await userService.findUsers({ email });
		if (user.length === 0) {
			return sendErrorResponse(
				res,
				apiResponse.USER_NOT_FOUND.message,
				apiResponse.USER_NOT_FOUND.code
			);
		}

		const existingUser: any = user[0];
		// Check if the user is already verified
		if (existingUser.verified) {
			return sendErrorResponse(
				res,
				apiResponse.USER_ALREADY_VERIFIED.message,
				apiResponse.USER_ALREADY_VERIFIED.code
			);
		}

		// Check the verification token
		if (existingUser.verificationToken !== token) {
			return sendErrorResponse(
				res,
				apiResponse.INVALID_TOKEN.message,
				apiResponse.INVALID_TOKEN.code
			);
		}

		// Update the user to set verified to true
		// existingUser.verified = true;
		await userService.update(
			{ _id: existingUser._id },
			{ verified: true, verificationToken: undefined }
		);
		existingUser.verificationToken = undefined; // Optionally clear the token after verification

		// Respond with success message
		return sendSuccessResponse(
			res,
			{user, token},
			apiResponse.EMAIL_VERIFICATION_SUCCESS.message,
			apiResponse.EMAIL_VERIFICATION_SUCCESS.code
		);
	} catch (error: any) {
		// Handle errors
		return sendErrorResponse(
			res,
			apiResponse.INTERNAL_SERVER_ERROR.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};
const requestOtp = async (req: Request, res: Response) => {
	const { phoneNumber, listing_id } = req.body; // Extract phone number from the request body

	if (!phoneNumber && !listing_id) {
		return res
			.status(400)
			.json({ success: false, message: 'Phone number is required' });
	}

	try {
		// Call the service function to send OTP via phone call
		const result = await sendOtpCall(phoneNumber, listing_id);

		// Return the response from the service function
		return res.status(200).json(result);
	} catch (error) {
		console.error('Error in OTP request:', error);
		return res
			.status(500)
			.json({ success: false, message: 'Internal server error' });
	}
};

const getVoiceResponse = (req: Request, res: Response) => {
	const { otp } = req.query;

	if (!otp) {
		console.error('OTP is required');
		return res.status(400).json({ success: false, message: 'OTP is required' });
	}
	// Check if otp is a string
	if (typeof otp !== 'string') {
		console.error('OTP must be a string');
		return res.status(400).json({ success: false, message: 'OTP is required' });
	}
	const VoiceResponse = require('twilio').twiml.VoiceResponse;
	const twiml = new VoiceResponse();
	twiml.say(`Your one-time password is ${otp.split('').join(' ')}`, {
		voice: 'alice',
		language: 'en-US',
	});

	const twimlString = twiml.toString();

	res.type('text/xml');
	res.send(twimlString);
};

const verifyOTPForClaimListing = async (req: Request, res: Response) => {
	try {
		const {
			listing_id,
			otp,
			user,
		}: { listing_id?: string; otp?: string; user: string } = req.body;

		// Validate input
		if (!listing_id || !otp) {
			return sendErrorResponse(
				res,
				apiResponse.OTP_VERIFICATION_REQUIRED_FIELDS?.message,
				apiResponse.OTP_VERIFICATION_REQUIRED_FIELDS?.code
			);
		}

		// Retrieve listing
		const listingData = await listingService.getListingByIdService(listing_id);
		// Check if listing exists
		if (!listingData) {
			return sendErrorResponse(
				res,
				apiResponse.LISTING_NOT_FOUND?.message,
				apiResponse.LISTING_NOT_FOUND?.code
			);
		}

		// Validate OTP
		const validateOtpData = await verifyOtpForStudioCliamService(
			listingData,
			otp
		);
		if (validateOtpData.error && !validateOtpData.isValid) {
			return sendErrorResponse(
				res,
				validateOtpData.error.message,
				validateOtpData.error.code
			);
		}
		// const shopData = await shopService.createShop({listing_details: listing_id}, null);
		// Update listing on successful OTP verification
		await listingService.updateListing(listingData._id, {
			otp_verified: true,
			otp_used: true,
			is_verified: true,
			claimed_by: user,
			// shop: shopData._id,
		});
		return sendSuccessResponse(
			res,
			// responseData,
			{},
			apiResponse.LISTING_CLAIMED_SUCCESSFUL.message,
			apiResponse.LISTING_CLAIMED_SUCCESSFUL.code
		);
	} catch (error) {
		console.log('error: ', error);
		return sendErrorResponse(
			res,
			apiResponse.INTERNAL_SERVER_ERROR.message,
			apiResponse.INTERNAL_SERVER_ERROR.code
		);
	}
};

export default {
	userLogin,
	forgetPassword,
	verifyOTP,
	resetPassword,
	verifyLoginOtp,
	facebookLogin,
	userRegister,
	verifyEmail,
	requestOtp,
	getVoiceResponse,
	verifyOTPForClaimListing,
};
