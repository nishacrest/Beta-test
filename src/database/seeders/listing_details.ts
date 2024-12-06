import mongoose from 'mongoose';
import { ListingDetailsModel, ShopModel } from '../models'; // Ensure these imports are correct
import dotenv from 'dotenv';
import {
	AmenityFeatureType,
	AvailableServiceType,
	ListingAttributes,
	PaymentOptionType,
} from '../../types/listing_details'; // Adjust based on your type definitions
dotenv.config();

async function seedListingDetails() {
	// Connect to the database
	const DB = process.env.DB_URI as string;
	const databaseOptions = {
		connectTimeoutMS: 30000,
	};
	await mongoose.connect(DB, databaseOptions);

	// Find an existing shop to associate the listing with
	const existingShop = await ShopModel.findOne({ studio_id: 100001 });
	if (!existingShop) {
		throw new Error('Shop not found');
	}

	// Sample listing details data
	const listingDetails: ListingAttributes = {
		shop: existingShop._id, // Reference to the shop
		studio_name: 'new studio',
		description:
			'Lotus Thai Massage is a serene space for relaxation and rejuvenation.',
		opening_hours_specification: [
			{
				day_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
				opening_time: '09:00',
				closing_time: '13:00',
			},
			{
				day_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
				opening_time: '15:00',
				closing_time: '20:00',
			},
			{
				day_of_week: ['Saturday'],
				opening_time: '10:00',
				closing_time: '18:00',
			},
		],
		postal_code: '10115',
		available_service: [
			{ name: AvailableServiceType.TraditionalThaiMassage, value: true },
			{ name: AvailableServiceType.AromaOilMassage, value: true },
			{ name: AvailableServiceType.FootLegMassage, value: true },
		],
		amenity_feature: [
			{ name: AmenityFeatureType.AirConditioning, value: true },
			{ name: AmenityFeatureType.WheelchairAccessible, value: true },
			{ name: AmenityFeatureType.GoodParking, value: true },
			{ name: AmenityFeatureType.Shower, value: true },
		],
		payment_options: [
			{ name: PaymentOptionType.Cash, value: true },
			{ name: PaymentOptionType.CreditCard, value: true },
			{ name: PaymentOptionType.ECCard, value: true },
			{ name: PaymentOptionType.PayPal, value: true },
		],
		social_links: {
			Whatsapp: 'https://wa.me/491701234567',
			Facebook: 'https://www.facebook.com/lotusthaimassage',
			Website: 'https://www.lotusthaimassage.de',
		},
		telephone: [{ phone: '+49 30 12345678', mobile_phone: null }],
		makes_offer: [
			{
				itemOffered: {
					name: 'Premium Subscription',
				},
				description: 'Access to premium content and features',
				prices: [
					{
						duration: '1 month',
						price: '10.00',
						priceCurrency: 'USD',
					},
					{
						duration: '6 months',
						price: '50.00',
						priceCurrency: 'USD',
					},
					{
						duration: '1 year',
						price: '90.00',
						priceCurrency: 'USD',
					},
				],
			},
		],
		is_verified: true,
		image_urls: null,
		city_image_url: null,
		reviewPin: null,
	};

	// Create listing details
	const listingData = await ListingDetailsModel.create(listingDetails);

	// Close the database connection
	await mongoose.disconnect();
}

seedListingDetails()
	.then(() => {
		console.log('Listing seeding completed');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Error seeding listing:', err.message);
		process.exit(1);
	});
