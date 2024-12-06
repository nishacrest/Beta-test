import mongoose from 'mongoose';
import { ShopModel, TaxTypeModel, UserModel, ShopUiModel } from '../models';
import dotenv from 'dotenv';
import {
	ShopInput,
	ShopStatus,
	StripeOnboardingStatus,
	StudioMode,
} from '../../types/shops';
import { UserRoles } from '../../types/users';
import { createHashedPassword } from '../../services/auth.service';
import shopService from '../../services/shop.service';
import userSettingsService from '../../services/user_settings.service';
import { AvailableTaxTypes } from '../../utils/constant';
import { StudioIntegrations } from '../../types/user_settings';
dotenv.config();

async function seed() {
	// Connect to the database
	const DB = process.env.DB_URI as string;
	const databaseOptions = {
		connectTimeoutMS: 30000,
	};
	await mongoose.connect(DB, databaseOptions);

	const adminData = await UserModel.findOne({ email: 'admin@giftcard.com' });
	if (adminData) {
		throw new Error('Admin user already exists');
	}

	const taxType = await TaxTypeModel.findOne({
		title: AvailableTaxTypes.VAT_FREE,
	});
	if (!taxType) {
		throw new Error('Tax type not found');
	}

	// Check if admin already exists
	const existingShop = await ShopModel.findOne({ studio_id: 100001 });
	if (existingShop) {
		throw new Error('Shop already exists');
	}

	const hashedPassword = await createHashedPassword('admin@123');

	const userData = await UserModel.create({
		email: 'admin@giftcard.com',
		hashed_password: hashedPassword,
		role: UserRoles.ADMIN,
		deleted_at: null,
	});

	const shopDetails: ShopInput = {
		owner: 'admin@gmail.com',
		studio_id: 100001,
		studio_name: 'Admin Studio',
		shop_url: 'admin.mine.com',
		studio_slug: 'admin-studio',
		logo_url: 'http://localhost:3000/api/assets/logo.png',
		giftcard_limit: 10,
		default_giftcard_value: 20,
		standard_text: '<p>Standard Text</p>',
		official_name: 'Admin Studio',
		country: {
			name: 'Germany',
			code: 'DE',
		},
		street: 'Admin Street',
		city: 'Admin City',
		status: ShopStatus.ACTIVE,
		studio_mode: StudioMode.LIVE,
		stripe_onboarding_status: StripeOnboardingStatus.PENDING,
		stripe_account: null,
		tax_type: taxType._id,
		platform_fee: 0,
		fixed_payment_fee: 0,
		tax_id: null,
		user: userData._id,
		comment: null,
		phone: '+493012345678',
		templates: [],
		deleted_at: null,
		platform_redeem_fee: 0,
		fixed_payment_redeem_fee: 0,
		iban: 'DE89370400440532013000',
		bic: 'MARKDEF1100',
		bank_name: 'Admin Bank',
		invoice_reference_number: 0,
		listing_details: null,
		is_giftcard_partner: null
	};

	const shopData = await ShopModel.create(shopDetails);
	const shopUiFields = shopService.getDefaultShopUiData(shopData._id);
	await ShopUiModel.create(shopUiFields);

	await userSettingsService.create({
		shop: shopData._id,
		user: userData._id,
		admin_redeem_notifications: true,
		sale_email_notifications: true,
		studio_redeem_notifications: true,
		negotiation_invoice_notifications: true,
		payment_invoice_notifications: true,
		deleted_at: null,
		refund_invoice_notifications: true,
		studio_integration: StudioIntegrations.UNIVERSAL, // Add this line
	});

	console.log('Shop created successfully');

	// Close the database connection
	await mongoose.disconnect();
}

seed()
	.then(() => {
		console.log('Shop seeding completed');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Error seeding shop:', err.message);
		process.exit(1);
	});
