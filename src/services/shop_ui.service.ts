import { ShopUiModel } from '../database/models';
import {
	FaqSchema,
	ShopUiAttributes,
	ShopUiInput,
	aboutUsSchema,
	contactUsSchema,
} from '../types/shops_ui';
import { AnyKeyObject } from '../types';
import { ClientSession, Types } from 'mongoose';

const createShopUi = async (
	shopUiData: ShopUiInput,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const shopUi: any[] = await ShopUiModel.create([shopUiData], {
			session: clientSession,
		});
		return shopUi[0] as ShopUiAttributes;
	} catch (error) {
		throw error;
	}
};

const findShopUi = async (
	conditions: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const shopUiData: ShopUiAttributes[] = await ShopUiModel.find({
			...conditions,
			deleted_at: null,
		})
			.session(clientSession)
			.lean();
		return shopUiData;
	} catch (error) {
		throw error;
	}
};

const updateShopUi = async (
	condition: AnyKeyObject,
	updateFields: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await ShopUiModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields,
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const validateAboustUsData = async (data: any) => {
	try {
		const parsedData = await aboutUsSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validateFaqData = async (data: any) => {
	try {
		const parsedData = await FaqSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validateContactUsData = async (data: any) => {
	try {
		const parsedData = await contactUsSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const getUiDetailByShopId = async (shop_id: string) => {
	try {
		const data = await ShopUiModel.aggregate([
			{
				$match: {
					shop: new Types.ObjectId(shop_id),
				},
			},
			{
				$set: {
					'hero_section.carousel': {
						$sortArray: {
							input: '$hero_section.carousel',
							sortBy: { index: 1 },
						},
					},
					'about_us.list_items': {
						$sortArray: {
							input: '$about_us.list_items',
							sortBy: { index: 1 },
						},
					},
					'faq.list_items': {
						$sortArray: {
							input: '$faq.list_items',
							sortBy: { index: 1 },
						},
					},
				},
			},
		]);

		return data[0];
	} catch (error) {
		throw error;
	}
};

export default {
	createShopUi,
	findShopUi,
	updateShopUi,
	validateAboustUsData,
	validateFaqData,
	validateContactUsData,
	getUiDetailByShopId,
};
