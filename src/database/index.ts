import mongoose from 'mongoose';

const DB = process.env.DB_URI as string;
const connection = mongoose.connection;
const databaseOptions = {
	connectTimeoutMS: 30000,
};

export const connectDatabase = () => {
	mongoose.connect(DB, databaseOptions);
	if (process.env.NODE_ENV === 'development') {
		mongoose.set('debug', true);
	}
};

connection
	.on('connected', () => {
		// eslint-disable-next-line no-console
		console.log('%s Database Connected', '✔');
	})
	.on('disconnected', () => {
		// eslint-disable-next-line no-console
		console.log('%s Database Disconnected', '✗');
	})
	.on('error', (err: any) => {
		console.dir(err, { depth: null });
		// eslint-disable-next-line no-console
		console.log(
			'%s MongoDB connection error. Please make sure MongoDB is running.',
			'✗'
		);
		// eslint-disable-next-line no-undef
		process.exit();
	});
