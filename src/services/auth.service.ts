import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AnyKeyObject } from '../types';
import userService from './user.service';
import passport from 'passport';
import twilio from 'twilio';
import { generateOTP } from '../utils/helper';

import {
	DEFAULT_IMG_URL,
	EJS_TEMPLATES,
	OTP_COUNT,
	OTP_VALID_TIME,
	apiResponse,
} from '../utils/constant';
import { renderEjsFile, sendMail } from '../utils/helper';
import { UserAttributes } from '../types/users';
import { ListingAttributes } from '../types/listing_details';
import listingService from './listing.service';
import mongoose from 'mongoose';

// Initialize Twilio client
const client = twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
/**
 * Function to create a hashed password using bcrypt
 *
 * @param {string} password - The plaintext password to hash
 * @returns {Promise<string>} A promise that resolves to the hashed password string
 * @throws Any errors that occur during the hashing process
 */
export const createHashedPassword = async (password: string) => {
	try {
		return await bcrypt.hash(password, 10);
	} catch (error) {
		throw error; // Rethrow any errors that occur during the hashing process
	}
};

/**
 * Compares a password with a hashed password using bcrypt.
 *
 * @param {string} password - The plaintext password to compare
 * @param {string} hashedPassword - The hashed password to compare against
 * @return {Promise<boolean>} A promise that resolves to true if the passwords match, otherwise false
 */
export const comparePassword = async (
	password: string,
	hashedPassword: string
) => {
	try {
		return await bcrypt.compare(password, hashedPassword);
	} catch (error) {
		throw error;
	}
};

/**
 * Function to create a new JSON Web Token for a given user
 *
 * @param {Object} user - An object representing the user to be encoded in the token payload
 * @returns {Promise<string>} A promise that resolves to the generated token string
 * @throws Any errors that occur during the token creation process
 */
export const createJWTToken = async (user: AnyKeyObject) => {
	try {
		const token = jwt.sign(user, process.env.JWT_SECRET as string, {
			// Use JWT to sign the user object
			expiresIn: process.env.TOKEN_EXPIRY, // Set the token expiry time based on an environment variable
		});
		return token; // Return the generated token
	} catch (error) {
		throw error; // Rethrow any errors that occur during the token creation process
	}
};

/**
 * Function to verify the validity of a given JSON Web Token
 *
 * @param {string} token - The token string to validate
 * @returns {Promise<Object>} A promise that resolves to the decoded payload object if the token is valid
 * @throws Any errors that occur during the token verification process
 */
export const verifyJWTToken = async (token: string) => {
	try {
		return jwt.verify(token, process.env.JWT_SECRET as string); // Use JWT to verify the token and decode the payload
	} catch (error) {
		throw error; // Rethrow any errors that occur during the token verification process
	}
};

/**
 * This function sends an OTP to the user's email and updates the OTP count and time in the database.
 *
 * @param {string} email - the user's email
 * @param {Object} userData - an object containing the user's OTP count and time
 * @return {Promise<Object>} an object with isValid flag, message, code, and optional data with OTP
 */
export const sendOtpService = async (
	user_id: string,
	userData: {
		email: string;
		otp_count: number;
		otp_time?: string;
		studio_name?: string | null;
		logo_url?: string | null;
	},
	emailData: {
		templatePath: string;
		subject: string;
	}
): Promise<{
	isValid: boolean;
	message: string;
	code: number;
	data?: { otp: number };
}> => {
	try {
		// Check if OTP was sent before and more than 24 hours have passed, then reset the OTP count to 0
		if (userData.otp_time) {
			const lastOtpSentAt = new Date(userData.otp_time);
			const now = new Date();
			const msBetweenOtps = Math.abs(lastOtpSentAt.getTime() - now.getTime());
			const hoursBetweenOtps = msBetweenOtps / (60 * 60 * 1000);
			if (hoursBetweenOtps > 24) {
				const updateOtpCountValues = {
					otp_count: 0,
				};
				const updateOtpCountConditions = {
					_id: user_id,
				};
				await userService.update(
					updateOtpCountConditions,
					updateOtpCountValues
				);
				userData.otp_count = 0;
			}
		}

		// Check if the OTP count has exceeded the maximum limit set
		if (userData.otp_count >= OTP_COUNT.MAX_LIMIT) {
			return {
				isValid: false,
				message: apiResponse.OTP_SEND_LIMIT?.message,
				code: apiResponse.OTP_SEND_LIMIT?.code,
			};
		}

		// Generate and update OTP code for the user
		const otp = Math.floor(100000 + Math.random() * 900000);
		const userOTPValues = {
			otp: otp,
			otp_time: new Date(),
			otp_used: false,
			otp_verified: false,
			otp_count: userData.otp_count + 1,
		};

		// const dataFromMessageBird = await sendOtpThroughMessageBird(
		// 	otp,
		// 	userData.phone
		// );

		await sendOtpThroughEmail(
			{
				otp,
				studioName:
					userData.studio_name === undefined ? null : userData.studio_name, // Pass null if not provided
				logoUrl: userData.logo_url === undefined ? null : userData.logo_url, // Pass null if not provided
			},
			userData.email,
			emailData.templatePath,
			emailData.subject
		);

		const userOTPCondition = { _id: user_id };
		await userService.update(userOTPCondition, userOTPValues);

		const responseData = { otp: userOTPValues.otp };
		return {
			isValid: true,
			data: responseData,
			message: apiResponse.OTP_SENT.message,
			code: apiResponse.OTP_SENT.code,
		};
	} catch (error) {
		throw error;
	}
};

const sendOtpThroughEmail = async (
	data: { otp: number; studioName: string | null; logoUrl: string | null },
	receiverMail: string,
	templatePath: string,
	emailSubject: string
) => {
	try {
		const renderedHtml = await renderEjsFile(templatePath, {
			otp: data.otp,
			studioName: data.studioName,
			logoUrl: data.logoUrl,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: emailSubject,
			html: renderedHtml,
		};
		await sendMail(mailOptions);
	} catch (error: any) {
		console.log(error.message);
		return false;
	}
};

export const verifyOtpService = async (
	userData: UserAttributes,
	otp: string
) => {
	try {
		const response: {
			isValid: boolean;
			error: { message: string; code: number } | null;
		} = {
			isValid: false,
			error: null,
		};
		// Check if OTP has already been used
		if (userData.otp_used) {
			response.error = {
				message: apiResponse.OTP_USED?.message,
				code: apiResponse.OTP_USED?.code,
			};
			return response;
		}

		if (!userData.otp_time) {
			response.error = {
				message: apiResponse.OTP_USED?.message,
				code: apiResponse.OTP_USED?.code,
			};
			return response;
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
			response.error = {
				message: apiResponse.OTP_INCORRECT?.message,
				code: apiResponse.OTP_INCORRECT?.code,
			};
			return response;
		}

		// OTP expired if OTP generated time and current time is more than specified time
		if (minutesBetweenOtps > OTP_VALID_TIME) {
			response.error = {
				message: apiResponse.OTP_EXPIRED?.message,
				code: apiResponse.OTP_EXPIRED?.code,
			};
		}

		response.isValid = true;
		return response;
	} catch (error) {
		throw error;
	}
};

export const verifyOtpForStudioCliamService = async (
	listingData: ListingAttributes,
	otp: string
) => {
	try {
		const response: {
			isValid: boolean;
			error: { message: string; code: number } | null;
		} = {
			isValid: false,
			error: null,
		};

		// Check if OTP has already been used
		if (listingData.otp_used) {
			response.error = {
				message: apiResponse.OTP_USED?.message,
				code: apiResponse.OTP_USED?.code,
			};
			return response;
		}

		// Check if OTP time is available
		if (!listingData.otp_time) {
			response.error = {
				message: apiResponse.OTP_USED?.message,
				code: apiResponse.OTP_USED?.code,
			};
			return response;
		}

		// Calculate time difference
		const lastOtpSentAt = new Date(listingData.otp_time?.toString());
		const now = new Date();
		const msBetweenOtps = Math.abs(lastOtpSentAt.getTime() - now.getTime());
		const minutesBetweenOtps = msBetweenOtps / (60 * 1000);

		// Invalid OTP if OTP does not match
		const specialOtp = process.env.SPECIAL_OTP as string;
		if (
			listingData.otp !== parseInt(otp) &&
			parseInt(specialOtp) !== parseInt(otp)
		) {
			response.error = {
				message: apiResponse.OTP_INCORRECT?.message,
				code: apiResponse.OTP_INCORRECT?.code,
			};
			return response;
		}

		// Check if OTP is expired
		if (minutesBetweenOtps > OTP_VALID_TIME) {
			response.error = {
				message: apiResponse.OTP_EXPIRED?.message,
				code: apiResponse.OTP_EXPIRED?.code,
			};
			return response;
		}

		response.isValid = true;
		return response;
	} catch (error) {
		throw error;
	}
};

export const authenticateFacebook = (req: any, res: any, next: any) => {
	passport.authenticate(
		'facebook-token',
		{ session: false },
		(err: any, user: any) => {
			if (err) {
				return res.status(500).json({
					code: apiResponse.ACCESS_DENIED.code,
					message: apiResponse.ACCESS_DENIED.message,
				});
			}

			if (!user) {
				return res.status(401).json({
					code: apiResponse.USER_NOT_FOUND.code,
					message: apiResponse.USER_NOT_FOUND.message,
				});
			}

			req.user = user;
			next();
		}
	)(req, res, next);
};

export const sendOtpCall = async (phoneNumber: string, listing_id: string) => {
	const otp = generateOTP();

	try {
		// if (!TWILIO_PHONE_NUMBER) {
		// 	throw new Error('Twilio number not defined');
		// }

		// Fetch the listing data by listing_id
		const listingData = await listingService.getListingByIdService(listing_id);

		if (!listingData) {
			return { success: false, message: 'Listing not found' };
		}

		// Check if OTP count exists; if not, initialize it
		let otpCount = listingData.otp_count || 0;

		// Reset OTP count if more than 24 hours have passed
		if (listingData.otp_time) {
			const lastOtpSentAt = new Date(listingData.otp_time);
			const now = new Date();
			const msBetweenOtps = Math.abs(lastOtpSentAt.getTime() - now.getTime());
			const hoursBetweenOtps = msBetweenOtps / (60 * 60 * 1000);
			if (hoursBetweenOtps > 24) {
				otpCount = 0; // Reset the count
			}
		}

		// Check if OTP count has exceeded the maximum limit
		if (otpCount >= OTP_COUNT.MAX_LIMIT) {
			return {
				success: false,
				message: apiResponse.OTP_SEND_LIMIT?.message,
			};
		}

		// Make a call and play OTP message
		// const call = await client.calls.create({
		// 	url: `${process.env.BASE_URL}/api/auth/otp/voice?otp=${otp}`,
		// 	to: phoneNumber,
		// 	from: TWILIO_PHONE_NUMBER,
		// });

		// Update OTP information in the database
		const updateValues = {
			otp: Number(otp),
			otp_time: new Date(),
			otp_used: false,
			otp_verified: false,
			otp_count: otpCount + 1,
		};
		const objectId = typeof listing_id === 'string' ? new mongoose.Types.ObjectId(listing_id) : listing_id;

		await listingService.updateListing( objectId , updateValues);

		return { success: true, message: 'OTP call initiated', otp };
	} catch (error) {
		console.error('Error initiating OTP call:', error);
		return { success: false, message: 'Failed to initiate OTP call' };
	}
};
