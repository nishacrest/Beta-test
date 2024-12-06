import { Types } from 'mongoose';
import * as yup from 'yup';

export interface SocialLinks {
	Whatsapp?: string | null;
	Facebook?: string | null;
	Website?: string | null;
}

export interface Telephone {
	phone?: string | null;
	mobile_phone?: string | null;
}

export interface MakesOffer {
	itemOffered?: {
		name?: string | null;
	} | null;
	description?: string | null;
	prices?: {
		price?: string | null;
		priceCurrency?: string | null;
		duration?: string | null;
	}[] | null;
}

export interface Address {
	streetAddress?: string | null;
	addressLocality?: string | null;
	postalCode?: string | null;
	addressCountry?: string | null;
}
// Available services enum
export enum AvailableServiceType {
	TraditionalThaiMassage = 'Trad. Thai Massage',
	BackNeckMassage = 'Rücken Nacken Massage',
	AromaOilMassage = 'Aromaöl Massage',
	FootLegMassage = 'Fuss- Beinmassage',
	HerbalStampMassage = 'Kräuterstempel Massage',
	HotStoneMassage = 'Hot Stone Massage',
	CoupleMassage = 'Paarmassage',
	PregnancyMassage = 'Schwangerschaftsmassage',
	Other = 'weitere',
}

// Amenity features enum
export enum AmenityFeatureType {
	FreeDrinks = 'Kostenlose Getränke',
	CertifiedMasseurs = 'Zertifizierte Masseure',
	AirConditioning = 'Klimaanlage',
	FreeWiFi = 'Kostenloses WLAN',
	PublicTransport = 'Öff. Verkehrsmittel',
	GoodParking = 'Gute Parksituation',
	WheelchairAccessible = 'Rollstuhlgerecht',
	Shower = 'Dusche',
}

// Payment options enum
export enum PaymentOptionType {
	Cash = 'Cash',
	CreditCard = 'Credit Card',
	ECCard = 'EC Card',
	PayPal = 'PayPal',
}

export interface ListingAttributes {
	studio_name?: string | null;
	// _id: Types.ObjectId;
	shop?: Types.ObjectId | null;
	description?: string | null;
	email?:  string | null;
	opening_hours_specification?: Array<{
		day_of_week: string[] | null;
		opening_time: string | null;
		closing_time: string | null;
	}> | null;
	address?: Address | null;
	postal_code?: string | null;
	available_service?: Array<{
		name?: AvailableServiceType | null;
		value?: boolean | null;
	}> | null;
	payment_options?: Array<{
		name?: PaymentOptionType | null;
		value?: boolean | null;
	}> | null;
	amenity_feature?: Array<{
		name?: AmenityFeatureType | null;
		value?: boolean | null;
	}> | null;
	social_links?: SocialLinks | null;
	telephone?: Telephone[] | null;
	makes_offer?: MakesOffer[] | null;
	is_verified?: boolean | null;
	claimed_by?: string | null;
	logo_image_url?: string | null;
	title_image_url?: string | null;
	image_urls?: string[] | null;
	city_image_url?: string[] | null;
	reviewPin?: string | null;
	otp?: number | null;
	otp_count?: number;
	otp_time?: Date | null;
	otp_verified?: boolean;
	otp_used?: boolean;
}

export type ListingInput = Omit<
	ListingAttributes,
	'_id' | 'created_at' | 'updated_at'
>;

export const createListingSchema = yup.object().shape({
	// shop: yup.string().required('Shop ID is required'),
	studio_name: yup.string().nullable(),
	description: yup.string().nullable(),
	email: yup.string().nullable(),
	opening_hours_specification: yup
		.array()
		.of(
			yup.object().shape({
				day_of_week: yup.array().of(yup.string()).nullable(),
				opening_time: yup.string().nullable(),
				closing_time: yup.string().nullable(),
			})
		)
		.nullable(),
	address: yup
		.object()
		.shape({
			streetAddress: yup.string().nullable(), 
			addressLocality: yup.string().nullable(),
			postalCode: yup.string().nullable(), 
			addressCountry: yup.string().nullable(), 
		})
		.nullable(),
	postal_code: yup.string().nullable(),
	available_service: yup
		.array()
		.of(
			yup.object().shape({
				name: yup
					.mixed<AvailableServiceType>()
					.oneOf(Object.values(AvailableServiceType))
					.nullable(),
				value: yup.boolean().nullable(),
			})
		)
		.nullable(),
	payment_options: yup
		.array()
		.of(
			yup.object().shape({
				name: yup
					.mixed<PaymentOptionType>()
					.oneOf(Object.values(PaymentOptionType))
					.nullable(),
				value: yup.boolean().nullable(),
			})
		)
		.nullable(),
	amenity_feature: yup
		.array()
		.of(
			yup.object().shape({
				name: yup
					.mixed<AmenityFeatureType>()
					.oneOf(Object.values(AmenityFeatureType))
					.nullable(),
				value: yup.boolean().nullable(),
			})
		)
		.nullable(),
	social_links: yup
		.object()
		.shape({
			Whatsapp: yup.string().nullable(),
			Facebook: yup.string().nullable(),
			Website: yup.string().nullable(),
		})
		.nullable(),
	telephone: yup
		.array()
		.of(
			yup.object().shape({
				phone: yup.string().nullable(),
				mobile_phone: yup.string().nullable(),
			})
		)
		.nullable(),
	makes_offer: yup
		.array()
		.of(
			yup.object().shape({
				itemOffered: yup
					.object()
					.shape({
						name: yup.string().nullable(),
					})
					.nullable(),
				description: yup.string().nullable(),
				price: yup.string().nullable(),
				priceCurrency: yup.string().nullable(),
				duration: yup.string().nullable(),
			})
		)
		.nullable(),
	is_verified: yup.boolean().required('Verification status is required'),
	logo_image_url: yup.string().nullable(),
	title_image_url: yup.string().nullable(),
	image_urls: yup.array().of(yup.string()).nullable(),
	city_image_url: yup.array().of(yup.string()).nullable(),
	reviewPin: yup.string().nullable(),
	otp: yup.number().nullable(),
	otp_count: yup.number().nullable(),
	otp_time: yup.date().nullable(),
	otp_verified: yup.boolean().nullable(),
	otp_used: yup.boolean().nullable(),
});
