import mongoose from 'mongoose';
import { RedeemGiftCardModel } from '../models';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
	// Connect to the database
	const DB = process.env.DB_URI as string;
	console.log('DB === >>> ', DB);
	const databaseOptions = {
		connectTimeoutMS: 30000,
	};
	await mongoose.connect(DB, databaseOptions);

	const redemptions = await RedeemGiftCardModel.aggregate([
		{
			$lookup: {
				from: 'giftcards',
				localField: 'giftcard',
				foreignField: '_id',
				as: 'giftcard',
				pipeline: [
					{
						$project: {
							_id: 1,
							shop: 1,
						},
					},
				],
			},
		},
		{
			$unwind: '$giftcard',
		},
		{
			$project: {
				_id: 1,
				giftcard: 1,
			},
		},
	]);

	for (let redemption of redemptions) {
		const { _id, giftcard } = redemption;
		await RedeemGiftCardModel.updateOne(
			{ _id },
			{
				$set: {
					issuer_shop: giftcard.shop,
				},
			}
		);
	}

	// Close the database connection
	await mongoose.disconnect();
}

seed()
	.then(() => {
		console.log('Redemption issuer seeding completed');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Error seeding redemption issuer:', err.message);
		process.exit(1);
	});
