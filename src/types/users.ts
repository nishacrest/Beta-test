import { Types } from 'mongoose';

export enum UserRoles {
	ADMIN = 'admin',
	SHOP = 'shop',
	USER = 'user',
}

export enum AuthProvider {
	FACEBOOK = 'facebook',
	GOOGLE = 'google',
}

export interface UserAttributes {
	_id: Types.ObjectId;
	role: UserRoles;
	email: string;
	hashed_password: string;
	otp: number | null;
	otp_count: number;
	otp_time: Date | null;
	otp_verified: boolean;
	otp_used: boolean;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
	auth_provider: AuthProvider | null;
	verificationToken: String | null; // Add verification token field
	verified: Boolean; // Add verification status
}


export type UserInput = Omit<
	UserAttributes,
	'_id' | 'created_at' | 'updated_at'
>;
