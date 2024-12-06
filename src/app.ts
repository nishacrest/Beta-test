import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import i18n from 'i18n';
import path from 'path';
import indexRoutes from './routes/index';
import cors from 'cors';
import { connectDatabase } from './database';
import fs from 'fs';
import invoiceService from './services/invoice.service';
import cron from 'node-cron';
import swaggerOptions from './config/swagger';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import passport, { session } from 'passport';
import { configurePassport } from './services/config-passport';

const app = express();
const PORT = process.env.PORT || 3000;
console.log('PORT === >>> ', PORT);

// Configure i18n
i18n.configure({
	locales: ['en', 'de', 'th'],
	defaultLocale: 'en',
	fallbacks: {
		'de': 'en',
	},
	directory: path.join(__dirname, '../locales'),
	objectNotation: true,
	updateFiles: false,
});

app.use(cors());
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', express.static(path.join(__dirname, '../public')));
app.use(i18n.init);

app.use((req, res, next) => {
	let locale = 'en';
	const requestedLocale = req.headers['accept-language'];
	const supportedLocales = ['en', 'de', 'th'];
	if (requestedLocale && supportedLocales.includes(requestedLocale))
		locale = requestedLocale;

	res.setLocale(locale);
	next();
});
const specs = swaggerJsDoc(swaggerOptions);
configurePassport();

app.use(
	require('express-session')({
		secret: process.env.SESSION_SECRET,
		resave: true,
		saveUninitialized: true,
	})
);
app.use(passport.initialize());
app.use(passport.session()); // Only if you're using sessions
app.use('/', indexRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use('/', indexRoutes);
connectDatabase();

const cronTime = process.env.CRON_TIME || 5;

const job = cron.schedule(`0 ${cronTime} * * *`, async () => {
	try {
		const foundEmails = await invoiceService.findPendingInvoice();
	} catch (error) {
		console.log('error while running cron::', error);
	}
});

app.listen(PORT, async () => {
	try {
		const uploadFolderPath = path.join(__dirname, './upload');
		if (!fs.existsSync(uploadFolderPath)) {
			fs.mkdirSync(uploadFolderPath);
		}
	} catch (error: any) {
		console.log(error.message);
	}
	console.log(`Server running at http://localhost:${PORT}`);
});
