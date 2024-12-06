import mongoose from 'mongoose';
import { AuthProvider, UserInput, UserRoles } from '../../types/users';

const { Schema } = mongoose;

const userSchema = new Schema<UserInput>(
	{
		email: {
			type: String,
			unique: true,
		},
		hashed_password: {
			type: String,
		},
		role: {
			type: String,
			enum: Object.values(UserRoles),
		},
		otp: {
			type: Schema.Types.Number,
		},
		otp_count: {
			type: Schema.Types.Number,
			default: 0,
		},
		otp_time: {
			type: Schema.Types.Date,
		},
		otp_verified: {
			type: Schema.Types.Boolean,
			default: false,
		},
		otp_used: {
			type: Schema.Types.Boolean,
			default: false,
		},
		deleted_at: {
			type: Date,
			default: null,
		},
		auth_provider: {
			type: Schema.Types.String,
			enum: Object.values(AuthProvider),
			default: null,
		},
		verificationToken: { type: Schema.Types.String, unique: true },
		verified: { type: Boolean, default: false },
	},
	{
		timestamps: {
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		},
		versionKey: false,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

export default mongoose.model<UserInput>('users', userSchema);
