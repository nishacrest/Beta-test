import mongoose from 'mongoose';
import { UserSettingsModel, ShopModel } from '../models';
import dotenv from 'dotenv';
import {
	UserSettingsAttributes,
	UserSettingsInput,
} from '../../types/user_settings';
import { StudioIntegrations } from '../../types/user_settings';
dotenv.config();

async function seed() {
	// Connect to the database
	const DB = process.env.DB_URI as string;
	console.log('DB === >>> ', DB);
	const databaseOptions = {
		connectTimeoutMS: 30000,
	};
	await mongoose.connect(DB, databaseOptions);

	const existingUserSettingsData = await UserSettingsModel.find({});
	const existingDataShopIds = existingUserSettingsData.map((data) => data.shop);

	const shopData = await ShopModel.find(
		{ _id: { $nin: existingDataShopIds } },
		{ _id: 1, user: 1 }
	).lean();

	if (shopData.length) {
		const userSettingsFields: UserSettingsInput[] = [];
		for (let shop of shopData) {
			userSettingsFields.push({
				shop: shop._id,
				user: shop.user,
				admin_redeem_notifications: true,
				sale_email_notifications: true,
				studio_redeem_notifications: true,
				deleted_at: null,
				negotiation_invoice_notifications: true,
				payment_invoice_notifications: true,
				refund_invoice_notifications: true,
				studio_integration: StudioIntegrations.UNIVERSAL,
			});
		}

		await UserSettingsModel.insertMany(userSettingsFields);
	}

	// Close the database connection
	await mongoose.disconnect();
}

seed()
	.then(() => {
		console.log('User settings seeding completed');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Error seeding user settings:', err.message);
		process.exit(1);
	});
