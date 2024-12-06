import mongoose from 'mongoose';
import { TaxTypeModel } from '../models';
import dotenv from 'dotenv';
import { TaxTypeInput, TaxTypeAttributes } from '../../types/tax_types';
import { AvailableTaxTypes } from '../../utils/constant';
dotenv.config();

async function seed() {
	// Connect to the database
	const DB = process.env.DB_URI as string;
	const databaseOptions = {
		connectTimeoutMS: 30000,
	};
	await mongoose.connect(DB, databaseOptions);

	const taxTypeData: TaxTypeInput[] = [
		{
			stripe_id: 'txr_1PM3sh2Lh4t3no9EAFlB5sf6',
			title: AvailableTaxTypes.STANDARD,
			description: 'VAT of 19%',
			percentage: 19,
			deleted_at: null,
		},
		{
			stripe_id: 'txr_1PMUZr2Lh4t3no9EKXZHarbs',
			title: AvailableTaxTypes.VAT_FREE,
			description: 'VAT free due to some reason',
			percentage: 0,
			deleted_at: null,
		},
		{
			stripe_id: 'txr_1PMUaL2Lh4t3no9Eu4Hydiox',
			title: AvailableTaxTypes.SMALL_BUSINESS,
			description: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
			percentage: 0,
			deleted_at: null,
		},
	];

	await TaxTypeModel.insertMany(taxTypeData);

	// Close the database connection
	await mongoose.disconnect();
}

seed()
	.then(() => {
		console.log('Tax type seeding completed');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Error seeding tax type:', err.message);
		process.exit(1);
	});
