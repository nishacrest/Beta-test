import {
	AnyKeyObject,
	IAdminUserWithShop,
	IUserProfileDetails,
} from '../types';
import {
	AuthProvider,
	UserAttributes,
	UserInput,
	UserRoles,
} from '../types/users';
import { omitFromObject } from '../utils/helper';
import { UserModel } from '../database/models';
import { ClientSession, Types } from 'mongoose';
import invoiceService from './invoice.service';

const findUsers = async (
	condition: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const usersData: UserAttributes[] = await UserModel.find({
			...condition,
			deleted_at: null,
		})
			.session(clientSession)
			.lean();
		return usersData;
	} catch (error) {
		throw error;
	}
};

const create = async (userData: UserInput, session?: ClientSession | null) => {
	try {
		const clientSession = session || null;
		const user: any[] = await UserModel.create([userData], {
			session: clientSession,
		});
		return user[0] as UserAttributes;
	} catch (error) {
		throw error;
	}
};

const update = async (
	condition: AnyKeyObject,
	data: Partial<UserInput>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await UserModel.updateMany(condition, data, {
			session: clientSession,
		});
	} catch (error) {
		throw error;
	}
};

const getProfileDetails = async (user_id: string) => {
	try {
		const userData: any = UserModel.aggregate([
			{ $match: { _id: new Types.ObjectId(user_id) } },
			{
				$lookup: {
					from: 'shops',
					localField: '_id',
					foreignField: 'user',
					as: 'shop',
					pipeline: [
						{
							$lookup: {
								from: 'tax_types',
								localField: 'tax_type',
								foreignField: '_id',
								as: 'tax_type',
								pipeline: [{ $project: { _id: 1, title: 1 } }],
							},
						},
						{
							$unwind: '$tax_type',
						},
						{
							$project: {
								deleted_at: 0,
								created_at: 0,
								updated_at: 0,
							},
						},
					],
				},
			},
			{ $unwind: '$shop' },
			{
				$lookup: {
					from: 'user_settings',
					localField: '_id',
					foreignField: 'user',
					as: 'user_settings',
					pipeline: [
						{
							$project: {
								deleted_at: 0,
								created_at: 0,
								updated_at: 0,
								user: 0,
								shop: 0,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: '$user_settings',
					preserveNullAndEmptyArrays: true,
				},
			},
			{ $project: { _id: 1, role: 1, email: 1, shop: 1, user_settings: 1 } },
		]);

		return userData as IUserProfileDetails[];
	} catch (error) {
		throw error;
	}
};

const getAdminUserWithShop = async (session: ClientSession | null) => {
	try {
		const userData = await UserModel.aggregate([
			{
				$match: {
					deleted_at: null,
					role: UserRoles.ADMIN,
				},
			},
			{
				$lookup: {
					from: 'shops',
					localField: '_id',
					foreignField: 'user',
					as: 'shop',
					pipeline: [
						{
							$project: {
								created_at: 0,
								updated_at: 0,
								deleted_at: 0,
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
					email: 1,
					role: 1,
					shop: 1,
				},
			},
		]).session(session);

		return userData as IAdminUserWithShop[];
	} catch (error) {
		throw error;
	}
};

// Find user by Facebook ID
const findUserByFacebookId = async (facebookId: string) => {
	return await UserModel.findOne({ 'facebook.id': facebookId });
};

// Update the access token of an existing user
const updateUserToken = async (userId: string, token: string) => {
	await UserModel.findByIdAndUpdate(userId, {
		'facebook.token': token,
	});
};

// Create a new user from a Facebook profile
const createUserFromFacebookProfile = async ({
	email,
	facebookId,
	facebookToken,
	name,
	role,
}: {
	email: string;
	facebookId: string;
	facebookToken: string;
	name: string;
	role: string;
}) => {
	const user = await UserModel.create({
		email,
		facebook: {
			id: facebookId,
			token: facebookToken,
		},
		name,
		role,
		authProvider: AuthProvider.FACEBOOK,
		verified: true,
	});

	const mailData = {
		email,
		name,
		role,
		authProvider: AuthProvider.FACEBOOK, // Fixed the use of AuthProvider here
	};

	// Send the Facebook registration email
	await invoiceService.sendFacebookRegistrationMail(email, name, mailData);

	return user;
};

export default {
	findUsers,
	create,
	update,
	getProfileDetails,
	getAdminUserWithShop,
	findUserByFacebookId,
	createUserFromFacebookProfile,
	updateUserToken,
};
