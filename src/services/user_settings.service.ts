import { AnyKeyObject } from '../types';
import {
	UserSettingsAttributes,
	UserSettingsInput,
	userSettingsUpdateSchema,
} from '../types/user_settings';
import { UserSettingsModel } from '../database/models';
import { ClientSession } from 'mongoose';

const find = async (
	condition: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const userSettingsData: UserSettingsAttributes[] =
			await UserSettingsModel.find({ ...condition, deleted_at: null })
				.session(clientSession)
				.lean();
		return userSettingsData;
	} catch (error) {
		throw error;
	}
};

const create = async (
	data: UserSettingsInput,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const userSetting: any[] = await UserSettingsModel.create([data], {
			session: clientSession,
		});
		return userSetting[0] as UserSettingsAttributes;
	} catch (error) {
		throw error;
	}
};

const update = async (
	condition: AnyKeyObject,
	data: Partial<UserSettingsAttributes>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await UserSettingsModel.updateMany(condition, data, {
			session: clientSession,
		});
	} catch (error) {
		throw error;
	}
};

const validateUserSettingsUpdate = async (data: any) => {
	try {
		const parsedData = await userSettingsUpdateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});

		return parsedData;
	} catch (error) {
		throw error;
	}
};

export default { find, create, update, validateUserSettingsUpdate };
