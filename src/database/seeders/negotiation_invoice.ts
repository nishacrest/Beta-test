import mongoose from 'mongoose';
import { RedeemGiftCardModel, ShopModel, UserModel } from '../models';
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

	const availableShops = await ShopModel.find({
		deleted_at: null,
	});
	if (availableShops.length) {
		await ShopModel.updateMany({}, { $set: { invoice_reference_number: 0 } });
		for (let shop of availableShops) {
			const lastInvoice = await InvoiceService.getLastGeneratedInvoiceOfShop(
				shop._id.toString()
			);
			if (lastInvoice) {
				const customerInvoice = lastInvoice.invoice_number as string;
				const thirdInvoiceParameter = customerInvoice.split('-')[2] || '';
				const invoiceNumber = +thirdInvoiceParameter.substring(
					4,
					thirdInvoiceParameter.length
				);
				if (!isNaN(invoiceNumber)) {
					await ShopModel.updateMany(
						{
							_id: shop._id,
						},
						{ invoice_reference_number: invoiceNumber }
					);
				}
			}
		}
	}

	const adminUser = await UserModel.findOne({
		role: UserRoles.ADMIN,
	});
	if (!adminUser) {
		throw new Error('Admin user not found');
	}
	const adminShopData = await ShopModel.findOne({ user: adminUser._id });
	if (!adminShopData) {
		throw new Error('Admin shop not found');
	}
	await RedeemGiftCardModel.updateMany({}, { $set: { fees: 0 } });
	const redemptions = await RedeemGiftCardModel.aggregate([
		{
			$match: {
				deleted_at: null,
			},
		},
		{
			$lookup: {
				from: 'giftcards',
				localField: 'giftcard',
				foreignField: '_id',
				as: 'giftcard',
				pipeline: [
					{
						$match: {
							shop: adminShopData._id,
							deleted_at: null,
						},
					},
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
			$lookup: {
				from: 'shops',
				localField: 'redeemed_shop',
				foreignField: '_id',
				as: 'redeemed_shop',
				pipeline: [
					{
						$project: {
							_id: 1,
							platform_redeem_fee: 1,
						},
					},
				],
			},
		},
		{
			$unwind: '$redeemed_shop',
		},
		{
			$project: {
				_id: 1,
				amount: 1,
				giftcard: 1,
				redeemed_shop: 1,
			},
		},
	]);

	if (redemptions.length) {
		for (let redemption of redemptions) {
			const fees =
				(redemption.amount * redemption.redeemed_shop.platform_redeem_fee) /
				100;
			await RedeemGiftCardModel.updateMany(
				{ _id: redemption._id },
				{ $set: { fees: +truncateToDecimals(fees, 2) } }
			);
		}
	}

	// Close the database connection
	await mongoose.disconnect();
}

seed()
	.then(() => {
		console.log('negotiation invoice settings seeding completed');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Error seeding negotiation invoice:', err.message);
		process.exit(1);
	});
