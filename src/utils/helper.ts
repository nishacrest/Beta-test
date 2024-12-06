import _ from 'lodash';
import { AnyKeyObject } from '../types';
import ejs from 'ejs';
import nodemailer, { SendMailOptions, SentMessageInfo } from 'nodemailer';
import AWS from 'aws-sdk';
import axios from 'axios';
import { ListingInput, SocialLinks, Telephone } from '../types/listing_details';
// import iban from 'iban';
// const MAPBOX_API_KEY = 'sk.eyJ1IjoidGhhaS1tYXNzYWdlIiwiYSI6ImNtMXQ1MDltdTAweGEyanFyNDBvYzBtcGwifQ.Z3NGNQM0UY3Bl_y04SZCpQ';
const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;
const bicRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const transporter = nodemailer.createTransport({
	host: process.env.AWS_SMTP_HOST as string,
	port: process.env.AWS_SMTP_PORT as unknown as number,
	secure: true,
	auth: {
		user: process.env.AWS_SMTP_USER,
		pass: process.env.AWS_SMTP_PASS,
	},
});

export const Lambda = new AWS.Lambda({
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	region: process.env.AWS_S3_REGION,
});

export const omitFromObject = (object: AnyKeyObject, omitKeys: string[]) => {
	return _.omit(object, [...omitKeys]);
};

export const getPagination = (
	page: string | number = 0,
	size: string | number = 10
): { limit: number; offset: number } => {
	const limit = +size;
	const offset = +page * limit;
	return { limit, offset };
};

export const renderEjsFile = (filePath: string, data: AnyKeyObject) => {
	return new Promise((resolve, reject) => {
		ejs.renderFile(filePath, data, (error: any, renderedHtml: any) => {
			if (error) {
				reject(error);
			}
			resolve(renderedHtml);
		});
	}) as Promise<string>;
};

export const sendMail = (mailOptions: SendMailOptions) => {
	return new Promise((resolve, reject) => {
		transporter.sendMail(mailOptions, (error: any, data: any) => {
			if (error) {
				reject(error);
			}
			resolve(data);
		});
	}) as Promise<SentMessageInfo>;
};

export function truncateToDecimals(
	num: string | number,
	decimals: number,
	mathFunction: 'floor' | 'round' = 'round'
) {
	const number = +num;
	if (isNaN(number)) {
		return '';
	}
	const factor = Math.pow(10, decimals);

	if (mathFunction === 'round') {
		return (Math.round(number * factor) / factor).toFixed(decimals);
	}

	return (Math.floor(number * factor) / factor).toFixed(decimals);
}

export function getNumberInLocalFormat(num: string | number, decimals = 2) {
	const number = +truncateToDecimals(num, decimals);
	if (isNaN(number)) {
		return '';
	}
	return number.toLocaleString('de', {
		minimumFractionDigits: decimals,
	});
}

export function calculateInclusiveTax(amount: number, taxRate: number) {
	const rawTaxAmount = amount - amount / (1 + taxRate / 100);
	const taxAmount = parseFloat(truncateToDecimals(rawTaxAmount, 2));
	const netAmount = parseFloat(truncateToDecimals(amount - taxAmount, 2));

	return {
		taxAmount,
		netAmount,
	};
}

export const formatGiftCardCode = (data: string) => {
	const removedDash = data.split('-').join('');
	let finalString = '';
	for (let i = 0; i < removedDash.length; i += 4) {
		finalString += removedDash.slice(i, i + 4) + '-';
	}
	return finalString.slice(0, -1);
};

export const formatDateInGermanFormat = (
	dateString: string,
	timeZone: string = 'Europe/Berlin'
) => {
	const date = new Date(dateString);
	const formatter = new Intl.DateTimeFormat('de-DE', {
		timeZone: timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	return formatter.format(date);
};

export const s3 = new AWS.S3({
	region: process.env.AWS_S3_REGION,
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

export const uploadFileToS3 = async (
	buffer: Buffer,
	fileName: string,
	fileType: string,
	bucketKey: string
) => {
	try {
		const params = {
			Bucket: process.env.AWS_S3_BUCKET_NAME as string,
			Key: `${bucketKey}/${fileName}`,
			Body: buffer,
			ContentType: fileType,
		};
		const s3Upload = await s3.upload(params).promise();

		return s3Upload;
	} catch (error) {
		throw error;
	}
};

export const convertUtcToLocal = (
	dateString: string,
	timeZone: string = 'Europe/Berlin'
) => {
	try {
		const date = new Date(dateString);

		// Separate formatters for each part
		const dayFormatter = new Intl.DateTimeFormat('de-DE', {
			day: '2-digit',
			timeZone,
		});
		const monthFormatter = new Intl.DateTimeFormat('de-DE', {
			month: '2-digit',
			timeZone,
		});
		const yearFormatter = new Intl.DateTimeFormat('de-DE', {
			year: 'numeric',
			timeZone,
		});

		const day = dayFormatter.format(date);
		const month = monthFormatter.format(date);
		const year = yearFormatter.format(date);

		return {
			day,
			month,
			year,
		};
	} catch (error) {
		throw error;
	}
};

export const validatePhoneNumber = (phoneNumber: string) => {
	let formattedNumber = phoneNumber.replace(/^\++0*/, '');
	formattedNumber = `+${formattedNumber}`;

	const phoneNumberRegex = /^\+\d{10,15}$/;
	const isValid = phoneNumberRegex.test(formattedNumber);
	return {
		number: formattedNumber,
		isValid,
	};
};

// Function to get coordinates for a given city
export const getCoordinatesForCity = async (
	city: string,
	country: string
): Promise<{ lat: number; lng: number } | null> => {
	try {
		const fullAddress = `${city}, ${country}`;
		const response = await axios.get(
			`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
				fullAddress
			)}.json?access_token=${MAPBOX_API_KEY}&limit=1`
		);

		const data = response.data;
		if (data.features && data.features.length > 0) {
			const location = data.features[0].center;
			return {
				lng: location[0], // Longitude is the first value
				lat: location[1], // Latitude is the second value
			};
		}
		return null;
	} catch (error: any) {
		console.error(`Failed to get coordinates for city: `, error);
		return null;
	}
};
// Function to get coordinates for a given street, city, and country
export const getCoordinatesForStudio = async (
	street: string,
	city: string,
	country: string
): Promise<{ lat: number; lng: number } | null> => {
	try {
		const fullAddress = `${street}, ${city}, ${country}`;
		const response = await axios.get(
			`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
				fullAddress
			)}.json?access_token=${MAPBOX_API_KEY}&limit=1`
		);

		const data = response.data;
		if (data.features && data.features.length > 0) {
			const location = data.features[0].center;
			return {
				lng: location[0], // Longitude is the first value
				lat: location[1], // Latitude is the second value
			};
		}
		return null;
	} catch (error) {
		console.error(`Failed to get coordinates for studio at address`, error);
		return null;
	}
};

// Function to generate a random 6-digit OTP
export const generateOTP = (): string => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

// Function to send OTP to the provided email address
export const sendOTP = async (email: string, otp: string): Promise<void> => {
	// Email options
	const mailOptions: SendMailOptions = {
		from: process.env.AWS_SENDER_MAIL, // Sender address from environment variable
		to: email, // Recipient email
		subject: 'Your OTP Code', // Subject
		text: `Your OTP code is: ${otp}. It is valid for a short period.`, // Plain text body
	};

	// Send email
	try {
		// await transporter.sendMail(mailOptions);
		await sendMail(mailOptions);
	} catch (error) {
		throw new Error('Could not send OTP. Please try again later.');
	}
};

export const verifyRecaptcha = async (token: string): Promise<boolean> => {
	try {
		const response = await axios.post(
			`https://www.google.com/recaptcha/api/siteverify`,
			null,
			{
				params: {
					secret: process.env.RECAPTCHA_SECRET_KEY, // Your Secret Key from .env
					response: token,
				},
			}
		);
		return response.data.success; // Returns true if verification is successful
	} catch (error) {
		console.error('Error verifying reCAPTCHA:', error);
		return false; // Return false on error
	}
};

// export const isValidIBAN = (ibanNumber: string): boolean => {
// 	return iban.isValid(ibanNumber);
// };

export const isValidBIC = (bic: string): boolean => {
	return bicRegex.test(bic);
};

export const countNonEmptyFields = (updatedFields: Partial<ListingInput>) => {
	let count = 0;

	const fieldsToCheck = [
		'studio_name',
		'description',
		'opening_hours_specification',
		'address',
	];

	for (const field of fieldsToCheck) {
		const value = updatedFields[field as keyof ListingInput];

		if (field === 'studio_name' || field === 'description') {
			if (
				value !== undefined &&
				value !== null &&
				String(value).trim() !== ''
			) {
				count++;
			}
		} else if (field === 'opening_hours_specification') {
			if (
				value !== undefined &&
				value !== null &&
				String(value).trim() !== ''
			) {
				count++;
			}
		} else if (field === 'address') {
			const address = value as any;
			if (
				address &&
				address.streetAddress &&
				String(address.streetAddress).trim() !== '' &&
				address.addressLocality &&
				String(address.addressLocality).trim() !== '' &&
				address.postalCode &&
				String(address.postalCode).trim() !== '' &&
				address.addressCountry &&
				String(address.addressCountry).trim() !== ''
			) {
				count++;
			}
		} else if (
			value !== undefined &&
			value !== null &&
			String(value).trim() !== ''
		) {
			count++;
		}
	}

	const availableService = updatedFields.available_service as
		| { value: boolean }[]
		| undefined;
	const amenityFeature = updatedFields.amenity_feature as
		| { value: boolean }[]
		| undefined;
	const paymentOptions = updatedFields.payment_options as
		| { value: boolean }[]
		| undefined;

	if (availableService && availableService.some((service) => service.value)) {
		count++;
	}
	if (amenityFeature && amenityFeature.some((amenity) => amenity.value)) {
		count++;
	}
	if (paymentOptions && paymentOptions.some((payment) => payment.value)) {
		count++;
	}
	const socialLinks = updatedFields.social_links as SocialLinks | undefined;
	const telephone = updatedFields.telephone as [Telephone] | undefined;
	if (socialLinks && telephone) {
		const socialLinksComplete =
			socialLinks.Whatsapp &&
			String(socialLinks.Whatsapp).trim() !== '' &&
			socialLinks.Facebook &&
			String(socialLinks.Facebook).trim() !== '' &&
			socialLinks.Website &&
			String(socialLinks.Website).trim() !== '';

		const telephoneComplete =
			telephone[0]?.phone &&
			String(telephone[0].phone).trim() !== '' &&
			telephone[0]?.mobile_phone &&
			String(telephone[0].mobile_phone).trim() !== '';

		if (socialLinksComplete && telephoneComplete) {
			count++;
		}
	}

	return count;
};
