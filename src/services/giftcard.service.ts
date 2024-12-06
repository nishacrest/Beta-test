import {
	GiftCardAttributes,
	GiftCardInput,
	GiftCardPdf,
	GiftCardStatus,
	giftCardReddemSchema,
	giftCardUpdateSchema,
	giftcardPurchaseSchema,
} from '../types/giftcards';
import { AnyKeyObject } from '../types';
import { GiftCardModel } from '../database/models';
import { customAlphabet, nanoid } from 'nanoid';
import {
	AWS_S3_BUCKET_KEYS,
	EJS_TEMPLATES,
	LAMBDA_FUNCTION,
	apiResponse,
} from '../utils/constant';
import QRCode from 'qrcode';
import htmlToPdf from 'html-pdf-node';
import AWS from 'aws-sdk';
// import puppeteer from 'puppeteer';
import {
	getNumberInLocalFormat,
	Lambda,
	renderEjsFile,
	sendMail,
} from '../utils/helper';
import { ClientSession, Types } from 'mongoose';
import invoiceService from './invoice.service';
import { InvoiceOrderStatus } from '../types/invoices';
import { ShopAttributes } from '../types/shops';
import giftcard_templateService from './giftcard_template.service';

const pdfOptions = { format: 'A4' };
const s3 = new AWS.S3({
	region: process.env.AWS_S3_REGION,
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});

/**
 * Asynchronously creates gift cards by inserting multiple gift card data entries into the database.
 *
 * @param {GiftCardInput[]} giftcardsData - An array of gift card data to be inserted
 * @return {Promise<GiftCardAttributes[]>} A promise that resolves to an array of created gift card attributes
 */
const createGiftcards = async (
	giftcardsData: GiftCardInput[],
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const giftcard: any = await GiftCardModel.insertMany(giftcardsData, {
			session: clientSession,
		});
		return giftcard as GiftCardAttributes[];
	} catch (error) {
		throw error;
	}
};

/**
 * Asynchronously finds gift cards that match the given conditions.
 *
 * @param {AnyKeyObject} conditions - The conditions to match against the gift cards.
 * @return {Promise<GiftCardAttributes[]>} A promise that resolves to an array of gift card attributes that match the conditions.
 * @throws {Error} If there is an error while finding the gift cards.
 */
const findGiftcards = async (
	conditions: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const giftcards: GiftCardAttributes[] = await GiftCardModel.find({
			...conditions,
			deleted_at: null,
		})
			.session(clientSession)
			.lean();
		return giftcards;
	} catch (error) {
		throw error;
	}
};

/**
 * Updates gift cards that match the given conditions with the specified update fields.
 *
 * @param {AnyKeyObject} condition - The conditions to match against the gift cards.
 * @param {Partial<GiftCardInput>} updateFields - The fields to update in the gift cards.
 */
const updateGiftCard = async (
	condition: AnyKeyObject,
	updateFields: Partial<GiftCardInput>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await GiftCardModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields,
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const generateCode = customAlphabet('0123456789', 16);
const generatePin = customAlphabet('0123456789', 6);

/**
 * Renders an EJS file with the provided gift card data and returns the rendered HTML as a promise.
 *
 * @param {GiftCardPdf} data - The gift card data used to render the EJS file.
 * @return {Promise<string>} A promise that resolves to the rendered HTML as a string.
 */
const getGiftCardHtmlContent: any = (data: GiftCardPdf) => {
	return new Promise((resolve, reject) => {
		QRCode.toDataURL(
			data.code,
			{ margin: 0 },
			async function (err: any, url: any) {
				try {
					if (err) reject(err);
					const formatedCode = data.code.replace(/(.{4})(?=.)/g, '$1-');
					const renderedHtml = await renderEjsFile(EJS_TEMPLATES.GIFTCARD_PDF, {
						...data,
						amount: getNumberInLocalFormat(data.amount),
						code: formatedCode,
						qr: url,
					});
					resolve(renderedHtml);
				} catch (error) {
					reject(error);
				}
			}
		);
	});
};

/**
 * Generates a PDF from the provided HTML data.
 *
 * @param {any} htmlData - The HTML content to generate the PDF from.
 * @return {Promise<Buffer>} A promise that resolves to the generated PDF buffer.
 */
const generatePdf = async (htmlData: any) => {
	return new Promise((resolve, reject) => {
		const file = { content: htmlData };
		// Generate the PDF from the rendered HTML content
		htmlToPdf.generatePdf(file, pdfOptions, (error, pdfBuffer) => {
			if (error) {
				reject(error);
			}
			// const filePath = path.join(__dirname, `../upload/${123}.pdf`);
			// fs.writeFileSync(filePath, pdfBuffer);
			resolve(pdfBuffer);
		});
	}) as Promise<Buffer>;
	// try {
	// 	const browser = await puppeteer.launch({
	// 		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	// 	});
	// 	const page = await browser.newPage();
	// 	await page.setContent(htmlData);
	// 	const pdfBuffer = await page.pdf({
	// 		displayHeaderFooter: false,
	// 		format: 'A4',
	// 		printBackground: true,
	// 	});
	// 	await browser.close();
	// 	return pdfBuffer;
	// } catch (error) {
	// 	throw error;
	// }
};

/**
 * Uploads a PDF file to an S3 bucket.
 *
 * @param {any} pdfBuffer - The buffer containing the PDF file.
 * @param {string} pdfName - The name of the PDF file.
 * @return {Promise<AWS.S3.ManagedUpload.SendData>} A promise that resolves with the data returned by the S3 upload operation.
 */
const uploadPdfToS3 = async (pdfBuffer: any, pdfName: string) => {
	return new Promise((resolve, reject) => {
		// Define parameters for the S3 upload
		const params = {
			Bucket: process.env.AWS_S3_BUCKET_NAME as string,
			Key: `giftcards/${pdfName}.pdf`,
			Body: pdfBuffer,
			ContentType: 'application/pdf',
		};

		// Upload the PDF to S3
		s3.upload(params, (error: Error, data: AWS.S3.ManagedUpload.SendData) => {
			if (error) reject(error);
			resolve(data);
		});
	}) as Promise<AWS.S3.ManagedUpload.SendData>;
};

const sendGiftCardMail = async (
	shopData: { studio_name: string; logo_url: string; shop_url: string },
	receiverMail: string,
	receiverName: string,
	giftCardLocations: {
		templateName: string;
		pdfUrl: string;
	}[]
) => {
	try {
		const renderedHtml = await renderEjsFile(EJS_TEMPLATES.GIFTCARD_EMAIL, {
			studioName: shopData.studio_name,
			logoUrl: shopData.logo_url,
			shopUrl: shopData.shop_url,
			receiverName: receiverName,
			giftCardLocations: giftCardLocations,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `Gutschein von ${shopData.studio_name}`,
			html: renderedHtml,
		};
		await sendMail(mailOptions);
	} catch (error: any) {
		console.log(error.message);
	}
};

const generatePdfFromLambda = async (htmlData: string, fileName: string) => {
	try {
		const response: any = await Lambda.invoke({
			FunctionName: LAMBDA_FUNCTION.PDF_GENERATION,
			InvocationType: 'RequestResponse',
			Payload: JSON.stringify({
				htmlData,
				fileName,
				s3BucketKey: AWS_S3_BUCKET_KEYS.GIFTCARD,
			}),
		}).promise();
		return JSON.parse(response.Payload) as {
			url: string;
		};
	} catch (error) {
		throw error;
	}
};

/**
 * Creates PDF files for gift cards.
 *
 * @param {GiftCardPdf[]} giftcards - An array of gift card data.
 * @return {string[]} An array of S3 locations where the PDF files are stored.
 */
// const createPdfForGiftcards = async (
// 	giftcards: GiftCardPdf[],
// 	receiverMail: string,
// 	receiverName: string,
// 	invoice_id: string
// ) => {
// 	try {
// 		const giftcardLocations: string[] = [];
// 		const pdfBuffers = [];
// 		for (let giftcard of giftcards) {
// 			const renderedHtml = await getGiftCardHtmlContent(giftcard);
// 			console.time();
// 			const pdfBuffer = await generatePdf(renderedHtml);

// 			const pdfName = `${giftcard.template_name}-gutschein-${nanoid(6)}`;
// 			const s3data = await uploadPdfToS3(pdfBuffer, pdfName);
// 			await updateGiftCard({ _id: giftcard._id }, { pdf_url: s3data.Location });
// 			console.timeEnd();
// 			pdfBuffers.push({ buffer: pdfBuffer, name: pdfName });
// 			giftcardLocations.push(s3data.Location);
// 		}
// 		await invoiceService.updateInvoices(
// 			{ _id: invoice_id },
// 			{ order_status: InvoiceOrderStatus.COMPLETED }
// 		);
// 		const shopData = {
// 			studio_name: giftcards[0].studio_name,
// 			logo_url: giftcards[0].logo_url,
// 			shop_url: giftcards[0].shop_url,
// 		};
// 		sendGiftCardMail(shopData, receiverMail, receiverName, giftcardLocations);
// 		return giftcardLocations;
// 	} catch (error) {
// 		throw error;
// 	}
// };

const createPdfForGiftcards = async (
	giftcards: GiftCardPdf[],
	receiverMail: string,
	receiverName: string,
	invoice_id: string
) => {
	try {
		const s3BaseUrl = process.env.S3_BASE_URL || '';
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || '';
		const giftcardLocations: {
			templateName: string;
			pdfUrl: string;
		}[] = [];
		for (let giftcard of giftcards) {
			const renderedHtml = await getGiftCardHtmlContent(giftcard);
			const pdfName = `${giftcard.template_name}-gutschein-${nanoid(6)}`;
			const pdfData = await generatePdfFromLambda(renderedHtml, pdfName);
			const filteredPdfUrl = pdfData.url.replace(s3BaseUrl, cleanBaseUrl);
			await updateGiftCard({ _id: giftcard._id }, { pdf_url: filteredPdfUrl });
			console.timeEnd();
			giftcardLocations.push({
				templateName: giftcard.template_name,
				pdfUrl: filteredPdfUrl,
			});
		}
		await invoiceService.updateInvoices(
			{ _id: invoice_id },
			{ order_status: InvoiceOrderStatus.COMPLETED }
		);
		const shopData = {
			studio_name: giftcards[0].studio_name,
			logo_url: giftcards[0].logo_url,
			shop_url: giftcards[0].shop_url,
		};
		sendGiftCardMail(shopData, receiverMail, receiverName, giftcardLocations);
		return giftcardLocations;
	} catch (error) {
		throw error;
	}
};

const validateGiftCardPurchase = async (data: any) => {
	try {
		const parsedData = await giftcardPurchaseSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validateGiftCardUpdate = async (data: any) => {
	try {
		const parsedData = await giftCardUpdateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const validateGiftCardRedeem = async (data: any) => {
	try {
		const parsedData = await giftCardReddemSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const getAllGiftCards = async (params: {
	limit: number | null;
	offset: number | null;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	search_value?: string;
	column_filters?: { id: string; value: string }[];
	shop_id?: string | null;
	isAdmin: boolean;
}) => {
	try {
		const giftCardConditions: AnyKeyObject = {};
		const shopConditions: AnyKeyObject = {};
		const giftCardAttributes = [
			'_id',
			'code',
			'purchase_date',
			'validtill_date',
			'status',
		];
		const giftCardSearchFields = ['code', 'user', 'status'];
		const shopSearchFields = ['studio_name'];
		const searchCondition: AnyKeyObject = { or: [], and: [] };

		if (params.shop_id) {
			giftCardConditions.shop = new Types.ObjectId(params.shop_id);
		}

		if (!params.search_value && params.column_filters?.length) {
			for (const filter of params.column_filters) {
				switch (filter.id) {
					case 'studio_name':
						searchCondition.and.push({
							'shop.studio_name': {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'purchase_date':
					case 'validtill_date':
						searchCondition.and.push({
							[filter.id]: {
								$gte: new Date(filter.value[0]),
								$lte: new Date(filter.value[1]),
							},
						});
						break;
					case 'available_amount':
					case 'amount':
						searchCondition.and.push({
							[filter.id]: +filter.value,
						});
						break;
					case 'invoice_number':
						searchCondition.and.push({
							'invoice.invoice_number': { $regex: filter.value, $options: 'i' },
						});
						break;
					case 'payment_id':
						searchCondition.and.push({
							'invoice.payment_id': {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'fullname':
						searchCondition.and.push({
							'invoice.fullname': {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					case 'template_name':
						searchCondition.and.push({
							'giftcard_template.title': {
								$regex: filter.value,
								$options: 'i',
							},
						});
						break;
					default:
						searchCondition.and.push({
							[filter.id]: {
								$regex: filter.value,
								$options: 'i',
							},
						});
				}
			}
		}

		if (params.search_value) {
			// giftCardConditions['$or'] = giftCardSearchFields.map((field) => ({
			// 	[field]: {
			// 		$regex: params.search_value,
			// 		$options: 'i',
			// 	},
			// }));
			searchCondition.or.push({
				'code': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'user': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'status': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'giftcard_mode': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			if (!isNaN(+params.search_value)) {
				searchCondition.or.push({
					amount: +params.search_value,
				});
				searchCondition.or.push({
					available_amount: +params.search_value,
				});
			}
			searchCondition.or.push({
				'shop.studio_name': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'invoice.fullname': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'invoice.invoice_number': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'invoice.payment_id': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
			searchCondition.or.push({
				'giftcard_template.title': {
					$regex: params.search_value,
					$options: 'i',
				},
			});
		}

		if (params.sort_by === 'studio_name') {
			params.sort_by = 'shop.studio_name';
		} else if (params.sort_by === 'payment_id') {
			params.sort_by = 'invoice.payment_id';
		} else if (params.sort_by === 'invoice_number') {
			params.sort_by = 'invoice.invoice_number';
		} else if (params.sort_by === 'template_name') {
			params.sort_by = 'giftcard_template.title';
		}

		const giftCards = await GiftCardModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...giftCardConditions,
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
							$match: {
								deleted_at: null,
								// ...shopConditions,
							},
						},
						{
							$project: {
								_id: 1,
								studio_name: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$shop',
			},
			{
				$lookup: {
					from: 'invoices',
					localField: 'invoice',
					foreignField: '_id',
					as: 'invoice',
					pipeline: [
						{
							$project: {
								_id: 1,
								payment_id: 1,
								fullname: 1,
								invoice_number: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$invoice',
			},
			{
				$lookup: {
					from: 'giftcard_templates',
					localField: 'giftcard_template',
					foreignField: '_id',
					as: 'giftcard_template',
					pipeline: [
						{
							$match: {
								deleted_at: null,
							},
						},
						{
							$project: {
								_id: 1,
								title: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$giftcard_template',
			},
			{
				$match: {
					...(searchCondition.or.length ? { $or: searchCondition.or } : {}),
					...(searchCondition.and.length
						? {
								$and: searchCondition.and,
						  }
						: {}),
				},
			},
			{
				$sort: {
					[params.sort_by]: params.sort_order === 'asc' ? 1 : -1,
				},
			},
			...(params.offset !== null ? [{ $skip: params.offset }] : []),
			...(params.limit !== null ? [{ $limit: params.limit }] : []),
			{
				$project: {
					pin: 0,
					message: 0,
					created_at: 0,
					updated_at: 0,
					deleted_at: 0,
				},
			},
		]);

		// const count = await GiftCardModel.estimatedDocumentCount({
		// 	deleted_at: null,
		// 	...giftCardConditions,
		// }).populate({
		// 	path: 'shop',
		// 	select: ['_id', 'studio_name'],
		// 	match: { deleted_at: null, ...shopConditions },
		// });
		const totalGiftCards = await GiftCardModel.aggregate([
			{
				$match: {
					deleted_at: null,
					...giftCardConditions,
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
							$match: {
								deleted_at: null,
								// ...shopConditions,
							},
						},
					],
				},
			},
			{
				$unwind: '$shop',
			},
			{
				$match: {
					...(searchCondition.or.length ? { $or: searchCondition.or } : {}),
					...(searchCondition.and.length
						? {
								$and: searchCondition.and,
						  }
						: {}),
				},
			},
			{
				$count: 'count',
			},
		]);

		const formattedGiftCards = giftCards.map((giftCard) => {
			return { ...giftCard, pdf_url: params.isAdmin ? giftCard.pdf_url : null };
		});

		return { rows: formattedGiftCards, count: totalGiftCards[0]?.count || 0 };
	} catch (error) {
		throw error;
	}
};

const getGiftCardDataForPdf = async (invoice_id: string) => {
	try {
		const giftcards = await GiftCardModel.aggregate([
			{
				$match: {
					invoice: new Types.ObjectId(invoice_id),
					deleted_at: null,
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
								studio_name: 1,
								logo_url: 1,
								standard_text: 1,
								shop_url: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$shop',
			},
			{
				$lookup: {
					from: 'giftcard_templates',
					localField: 'giftcard_template',
					foreignField: '_id',
					as: 'giftcard_template',
					pipeline: [
						{
							$project: {
								_id: 1,
								template_name: 1,
								template_headline: 1,
								primary_color: 1,
								secondary_color: 1,
								template_image: 1,
							},
						},
					],
				},
			},
			{
				$unwind: '$giftcard_template',
			},
			{
				$addFields: {
					'giftcard_template.template_image': {
						$toObjectId: '$giftcard_template.template_image',
					},
				},
			},
			{
				$lookup: {
					from: 'template_bg_imgs',
					localField: 'giftcard_template.template_image',
					foreignField: '_id',
					as: 'template_image_data',
				},
			},
			{
				$unwind: {
					path: '$template_image_data',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$project: {
					_id: 1,
					code: 1,
					pin: 1,
					shop: 1,
					giftcard_template: 1,
					message: 1,
					user: 1,
					amount: 1,
					template_headline: '$giftcard_template.template_headline', 
					primary_color: '$giftcard_template.primary_color', // Include primary color
					secondary_color: '$giftcard_template.secondary_color', // Include secondary color
					template_bg_image: '$template_image_data.image_url',
				},
			},
		]);

		const formatedData: GiftCardPdf[] = giftcards.map((giftcard) => {
			return {
				_id: giftcard._id,
				studio_name: giftcard.shop.studio_name,
				logo_url: giftcard.shop.logo_url,
				standard_text: giftcard.shop.standard_text,
				shop_url: giftcard.shop.shop_url,
				code: giftcard.code,
				pin: giftcard.pin,
				message: giftcard.message,
				amount: giftcard.amount,
				template_name: giftcard.giftcard_template.template_name,
				template_headline: giftcard.template_headline,
				image_url: giftcard.template_bg_image,
				primary_color: giftcard.primary_color,
				secondary_color: giftcard.secondary_color,
			};
		});

		return formatedData;
	} catch (error) {
		throw error;
	}
};

const getUniqueCode = async (
	retryCount: number,
	maxRetries: number,
	session: ClientSession | null
): Promise<string> => {
	try {
		const code = generateCode();
		const giftcard = await GiftCardModel.findOne({
			code,
			deleted_at: null,
		})
			.select('code')
			.session(session)
			.lean();
		if (giftcard) {
			if (retryCount >= maxRetries) {
				throw new Error(apiResponse.UNABLE_TO_GENERATE_UNIQUE_CODE.message);
			}
			const increasedRetryCount = retryCount + 1;
			return await getUniqueCode(increasedRetryCount, maxRetries, session);
		}
		return code;
	} catch (error) {
		throw error;
	}
};

const getUniqueGiftCardCodes = async (
	totalGiftCards: number,
	session: ClientSession | null
) => {
	try {
		const giftCardCodes: string[] = [];
		for (let i = 1; i <= totalGiftCards; i++) {
			const code = await getUniqueCode(1, 10, session);
			giftCardCodes.push(code);
		}

		return giftCardCodes;
	} catch (error) {
		throw error;
	}
};

const fullFillOrder = async (
	invoice_id: string,
	email: string,
	receiverName: string
) => {
	try {
		await updateGiftCard(
			{ invoice: new Types.ObjectId(invoice_id) },
			{ status: GiftCardStatus.ACTIVE }
		);
		const giftCards = await getGiftCardDataForPdf(invoice_id);
		const data = await createPdfForGiftcards(
			giftCards,
			email,
			receiverName,
			invoice_id
		);
	} catch (error) {
		console.log(error);
	}
};

export default {
	createGiftcards,
	findGiftcards,
	updateGiftCard,
	generateCode,
	generatePin,
	validateGiftCardPurchase,
	validateGiftCardUpdate,
	validateGiftCardRedeem,
	createPdfForGiftcards,
	getAllGiftCards,
	getGiftCardDataForPdf,
	getUniqueGiftCardCodes,
	fullFillOrder,
};
