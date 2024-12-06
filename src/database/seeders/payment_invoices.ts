import mongoose, { Types } from 'mongoose';
import {
	GiftCardModel,
	InvoiceModel,
	RedeemGiftCardModel,
	ShopModel,
	UserModel,
} from '../models';
import dotenv from 'dotenv';
import { UserRoles } from '../../types/users';
import { truncateToDecimals } from '../../utils/helper';
import InvoiceService from '../../services/invoice.service';
dotenv.config();

async function seed() {
	// Connect to the database
	const DB = process.env.DB_URI as string;
	console.log('DB === >>> ', DB);
	const databaseOptions = {
		connectTimeoutMS: 30000,
	};
	await mongoose.connect(DB, databaseOptions);

	const adminUser = await UserModel.findOne({
		role: UserRoles.ADMIN,
	}).sort({ created_at: -1 });
	if (!adminUser) {
		throw new Error('Admin user not found');
	}
	const adminShopData = await ShopModel.findOne({ user: adminUser._id });
	if (!adminShopData) {
		throw new Error('Admin shop not found');
	}

	// delete old data
	let oldInvoiceIds: Types.ObjectId[] = [];
	let oldGiftCardsIds: Types.ObjectId[] = [];
	let oldRedemptionsIds: Types.ObjectId[] = [];
	const oldInvoices = await InvoiceModel.find(
		{
			$or: [{ invoice_number: '' }, { invoice_number: null }, { shop: null }],
		},
		{ _id: 1 }
	).lean();
	if (oldInvoices.length) {
		oldInvoiceIds = oldInvoices.map((invoice) => invoice._id);
		const oldGiftCards = await GiftCardModel.find(
			{
				invoice: {
					$in: oldInvoiceIds,
				},
			},
			{ _id: 1 }
		);

		if (oldGiftCards.length) {
			oldGiftCardsIds = oldGiftCards.map((giftcard) => giftcard._id);
			const oldRedeemGiftCards = await RedeemGiftCardModel.find(
				{
					giftcard: {
						$in: oldGiftCardsIds,
					},
				},
				{ _id: 1 }
			);
			if (oldRedeemGiftCards.length) {
				oldRedemptionsIds = oldRedeemGiftCards.map((redeem) => redeem._id);
			}
		}
	}
	await InvoiceModel.deleteMany({
		_id: {
			$in: oldInvoiceIds,
		},
	});
	await GiftCardModel.deleteMany({
		_id: {
			$in: oldGiftCardsIds,
		},
	});
	await RedeemGiftCardModel.deleteMany({
		_id: {
			$in: oldRedemptionsIds,
		},
	});

	console.log('invoices deleted', oldInvoiceIds.length);
	console.log('giftcards deleted', oldGiftCardsIds.length);
	console.log('redemptions deleted', oldRedemptionsIds.length);

	await InvoiceModel.updateMany(
		{},
		{ $set: { fees: 0, payment_invoice: null } }
	);
	const purchases = await InvoiceModel.aggregate([
		{
			$match: {
				deleted_at: null,
				shop: {
					$ne: adminShopData._id,
				},
			},
		},
		{
			$lookup: {
				from: 'shops',
				localField: 'shop',
				foreignField: '_id',
				as: 'shop',
				pipeline: [
					{
						$project: {
							_id: 1,
							platform_fee: 1,
							fixed_payment_fee: 1,
						},
					},
				],
			},
		},
		{
			$unwind: '$shop',
		},
		{
			$project: {
				_id: 1,
				total_amount: 1,
				shop: 1,
			},
		},
	]);

	if (purchases.length) {
		for (let purchase of purchases) {
			const platformFeePercent = purchase.shop.platform_fee;
			const totalPlatformFee = parseFloat(
				((platformFeePercent * purchase.total_amount) / 100).toFixed(2)
			);
			const totalApplicationFee = parseFloat(
				(totalPlatformFee + purchase.shop.fixed_payment_fee).toFixed(2)
			);
			await InvoiceModel.updateMany(
				{ _id: purchase._id },
				{ $set: { fees: +truncateToDecimals(totalApplicationFee, 2) } }
			);
		}
	}

	// Close the database connection
	await mongoose.disconnect();
}

seed()
	.then(() => {
		console.log('payment invoice settings seeding completed');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Error seeding payment invoice:', err.message);
		process.exit(1);
	});
