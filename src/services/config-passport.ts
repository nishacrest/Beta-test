import passport from 'passport';
import FacebookTokenStrategy from 'passport-facebook-token';
import userService from './user.service';
import { UserAttributes, UserInput, UserRoles } from '../types/users';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { apiResponse, BASE_DOMAIN } from '../utils/constant';
import invoiceService from './invoice.service';
import { createJWTToken } from './auth.service';

export const configurePassport = () => {
	passport.use(
		new FacebookStrategy(
			{
				clientID: process.env.FACEBOOK_APP_ID!,
				clientSecret: process.env.FACEBOOK_APP_SECRET!,
				callbackURL: `http://localhost:3000/home`, // This should be your callback URL
				profileFields: ['id', 'emails', 'name'],
			},
			async (accessToken, refreshToken, profile, done) => {
				try {
					const userEmail = profile.emails?.[0]?.value || null;
					if (!userEmail) {
						throw new Error(apiResponse.ACCESS_DENIED.message);
					}
					const userName =
						`${profile.name?.givenName} ${profile.name?.familyName}` || '';

					// Check if the user already exists
					const existingUser = await userService.findUsers({
						email: userEmail,
					});

					let user;
					if (existingUser.length > 0) {
						// User exists, return the existing user
						user = existingUser[0];
					} else {
						// User does not exist, create a new user
						user = await userService.createUserFromFacebookProfile({
							email: userEmail,
							facebookId: profile.id,
							facebookToken: accessToken,
							name: userName,
							role: UserRoles.SHOP,
						});
					}

					return done(null, user);
				} catch (error) {
					return done(error, false);
				}
			}
		)
	);
	passport.serializeUser((user: any, done) => {
		done(null, user._id.toString()); // Serialize using the _id property
	});

	passport.deserializeUser(async (id: string, done) => {
		try {
			const user = await userService.findUsers({ _id: id });
			done(null, user);
		} catch (error) {
			done(error);
		}
	});
};
