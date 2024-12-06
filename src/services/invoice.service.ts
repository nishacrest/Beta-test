import {
	BankTransferDetails,
	InvoiceOrderStatus,
	InvoiceTransactioStatus,
	PaymentTypes,
} from './../types/invoices';
import {
	InvoiceAttributes,
	InvoiceInput,
	InvoiceMode,
	invoiceUpdateSchema,
} from '../types/invoices';
import { AnyKeyObject } from '../types';
import {
	GiftCardModel,
	InvoiceModel,
	NegotiationInvoiceModel,
	PaymentInvoiceModel,
} from '../database/models';
import mongoose, { ClientSession, Types } from 'mongoose';
import {
	calculateInclusiveTax,
	getNumberInLocalFormat,
	Lambda,
	renderEjsFile,
	sendMail,
	truncateToDecimals,
} from '../utils/helper';
import {
	AvailableTaxTypes,
	AWS_S3_BUCKET_KEYS,
	EJS_TEMPLATES,
	LAMBDA_FUNCTION,
} from '../utils/constant';
import shopService from './shop.service';
import tax_typeService from './tax_type.service';
import { StudioMode } from '../types/shops';
import customerService from './customer.service';
import { stripe } from '../utils/stripe.helper';

const findInvoices = async (
	conditions: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const invoiceData: InvoiceAttributes[] = await InvoiceModel.find({
			...conditions,
			deleted_at: null,
		})
			.session(clientSession)
			.lean();
		return invoiceData;
	} catch (error) {
		throw error;
	}
};

const createInvoice = async (
	invoiceData: InvoiceInput,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const invoice: any[] = await InvoiceModel.create([invoiceData], {
			session: clientSession,
		});
		return invoice[0] as InvoiceAttributes;
	} catch (error) {
		throw error;
	}
};

const updateInvoices = async (
	condition: AnyKeyObject,
	updateFields: Partial<InvoiceInput>,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || undefined;
		await InvoiceModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields,
			{ session: clientSession }
		);
	} catch (error) {
		throw error;
	}
};

const getInvoiceDetails = async (id: string) => {
	try {
		const invoice = await InvoiceModel.aggregate([
			{
				$match: {
					_id: new Types.ObjectId(id),
					deleted_at: null,
				},
			},
			{
				$lookup: {
					from: 'giftcards',
					localField: '_id',
					foreignField: 'invoice',
					as: 'giftcards',
					pipeline: [
						{
							$match: {
								deleted_at: null,
							},
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
										},
									},
								],
							},
						},
						{
							$unwind: '$giftcard_template',
						},
						{
							$project: {
								created_at: 0,
								updated_at: 0,
								deleted_at: 0,
								pin: 0,
								incorrect_pin_count: 0,
								message: 0,
							},
						},
					],
				},
			},
			{
				$project: {
					created_at: 0,
					updated_at: 0,
					deleted_at: 0,
				},
			},
		]);
		return invoice;
	} catch (error) {
		throw error;
	}
};

const getLastGeneratedInvoiceOfShop = async (shopId: string) => {
	try {
		const invoice = await InvoiceModel.findOne({
			shop: shopId,
			invoice_number: {
				$ne: null,
			},
			// deleted_at: null,
		}).sort({
			created_at: -1,
		});
		return invoice as InvoiceAttributes | null;
	} catch (error) {
		throw error;
	}
};

const getAllInvoices = async (params: {
	limit: number | null;
	offset: number | null;
	sort_by: string;
	sort_order: 'asc' | 'desc';
	search_value?: string;
	column_filters?: { id: string; value: string }[];
	shop_id?: string | null;
	invoice_mode: InvoiceMode;
}) => {
	try {
		const invoiceConditions: AnyKeyObject = {};
		const searchCondition: AnyKeyObject = { or: [], and: [] };

		invoiceConditions.invoice_mode = params.invoice_mode;
		if (params.shop_id) {
			invoiceConditions.shop = new Types.ObjectId(params.shop_id);
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
					case 'date':
						searchCondition.and.push({
							[filter.id]: {
								$gte: new Date(filter.value[0]),
								$lte: new Date(filter.value[1]),
							},
						});
						break;
					case 'tax_amount':
					case 'net_amount':
					case 'total_amount':
						searchCondition.and.push({
							[filter.id]: +filter.value,
						});
						break;
					case 'transaction_status':
					case 'order_status':
					case 'invoice_mode':
						searchCondition.and.push({
							[filter.id]: filter.value,
						});
						break;
					case 'tax_type':
						searchCondition.and.push({
							'tax_type._id': new Types.ObjectId(filter.value),
						});
						break;
					case 'address':
						searchCondition.and.push({
							'merged_address': {
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
			searchCondition.or.push(
				...[
					{
						invoice_number: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						order_id: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						'shop.studio_name': {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						payment_id: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						transaction_status: params.search_value,
					},
					{
						order_status: params.search_value,
					},
					{
						invoice_mode: params.search_value,
					},
					{
						'tax_type.title': {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						email: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						fullname: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
					{
						payment_method: {
							$regex: params.search_value,
							$options: 'i',
						},
					},
				]
			);
			if (!isNaN(+params.search_value)) {
				searchCondition.or.push({
					total_amount: +params.search_value,
				});
				searchCondition.or.push({
					tax_amount: +params.search_value,
				});
				searchCondition.or.push({
					net_amount: +params.search_value,
				});
			}
		}

		if (params.sort_by === 'studio_name') {
			params.sort_by = 'shop.studio_name';
		}
		if (params.sort_by === 'tax_type') {
			params.sort_by = 'tax_type.title';
		}

		const rawInvoices = await InvoiceModel.aggregate([
			{
				$match: {
					...invoiceConditions,
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
							$match: {
								deleted_at: null,
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
				$unwind: {
					path: '$shop',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
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
				$unwind: {
					path: '$tax_type',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$addFields: {
					merged_address: {
						$concat: [
							{ $ifNull: ['$address.line1', ''] },
							',',
							{ $ifNull: ['$address.line2', ''] },
							',',
							{ $ifNull: ['$address.city', ''] },
							',',
							{ $ifNull: ['$address.state', ''] },
							',',
							{ $ifNull: ['$address.country', ''] },
							',',
							{ $ifNull: ['$address.postal_code', ''] },
						],
					},
				},
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
					created_at: 0,
					updated_at: 0,
					deleted_at: 0,
					merged_address: 0,
				},
			},
		]);

		const invoices = rawInvoices.map((invoice) => {
			let address = '';
			if (invoice.address?.line1) address += `${invoice.address?.line1}, `;
			if (invoice.address?.line2) address += `${invoice.address?.line2}, `;
			if (invoice.address?.city) address += `${invoice.address?.city}, `;
			if (invoice.address?.state) address += `${invoice.address?.state}, `;
			if (invoice.address?.country) address += `${invoice.address?.country}, `;
			if (invoice.address?.postal_code)
				address += `${invoice.address?.postal_code}`;
			return {
				...invoice,
				shop: invoice.shop ? invoice.shop : null,
				tax_type: invoice.tax_type ? invoice.tax_type : null,
				address: address,
			};
		});

		const totalInvoices = await InvoiceModel.aggregate([
			{
				$match: {
					...invoiceConditions,
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
							$match: {
								deleted_at: null,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: '$shop',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$lookup: {
					from: 'tax_types',
					localField: 'tax_type',
					foreignField: '_id',
					as: 'tax_type',
					pipeline: [
						{
							$match: {
								deleted_at: null,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: '$tax_type',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$addFields: {
					merged_address: {
						$concat: [
							{ $ifNull: ['$address.line1', ''] },
							',',
							{ $ifNull: ['$address.line2', ''] },
							',',
							{ $ifNull: ['$address.city', ''] },
							',',
							{ $ifNull: ['$address.state', ''] },
							',',
							{ $ifNull: ['$address.country', ''] },
							',',
							{ $ifNull: ['$address.postal_code', ''] },
						],
					},
				},
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

		return { rows: invoices, count: totalInvoices[0]?.count || 0 };
	} catch (error) {
		throw error;
	}
};

const formatDateforInvoice = (dateString: string) => {
	const date = new Date(dateString);
	const formatter = new Intl.DateTimeFormat('de-DE', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	return formatter.format(date);
};

const getInvoiceDataForPdf = async (invoice_id: string) => {
	try {
		const [invoiceData] = await findInvoices({ _id: invoice_id });
		if (!invoiceData) {
			throw new Error('Invoice not found');
		}

		const [shopData] = await shopService.findShops({ _id: invoiceData.shop });
		if (!shopData) {
			throw new Error('Shop not found');
		}

		const [taxTypeData] = await tax_typeService.findTaxTypes({
			_id: invoiceData.tax_type,
		});

		if (!taxTypeData) {
			throw new Error('Tax type not found');
		}
		if (shopData.invoice_reference_number === undefined) {
			throw new Error('invoice reference number not defined');
		}
		const referenceNumber = shopData.invoice_reference_number + 1;
		const invoiceNumber = `RE-${
			shopData.studio_id
		}-${new Date().getFullYear()}${referenceNumber}`;
		await shopService.updateShop(
			{
				_id: shopData._id,
			},
			{ invoice_reference_number: referenceNumber }
		);
		await updateInvoices(
			{ _id: invoiceData._id },
			{ invoice_number: invoiceNumber }
		);

		const giftCardsData = await GiftCardModel.aggregate([
			{
				$match: {
					invoice: invoiceData._id,
				},
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
								title: 1,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: '$giftcard_template',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$group: {
					_id: {
						template_id: '$giftcard_template._id',
						template_title: '$giftcard_template.title',
						amount: '$amount',
						message: '$message',
					},
					quantity: {
						$count: {},
					},
				},
			},
			{
				$project: {
					_id: 0,
					template: '$_id.template_title',
					amount: '$_id.amount',
					message: '$_id.message',
					quantity: 1,
				},
			},
		]);
		for (let giftCard of giftCardsData) {
			const amount = giftCard.amount * giftCard.quantity;
			const { netAmount } = calculateInclusiveTax(
				amount,
				taxTypeData.percentage
			);
			giftCard.tax = `${taxTypeData.percentage}%`;
		}

		const invoiceItems = giftCardsData.map((giftCard) => {
			return {
				description: giftCard.template,
				unitPrice: getNumberInLocalFormat(giftCard.amount) + ' €',
				quantity: giftCard.quantity,
				tax: giftCard.tax,
				amount:
					getNumberInLocalFormat(giftCard.amount * giftCard.quantity) + ' €',
			};
		});

		const showTax = taxTypeData.title === AvailableTaxTypes.STANDARD;
		let totalsTaxLabel = '';
		if (taxTypeData.title === AvailableTaxTypes.STANDARD) {
			totalsTaxLabel = `${taxTypeData.percentage}% USt`;
		}
		const invoiceTotalLabels = [
			{
				label: 'Gesamtbetrag',
				amount: getNumberInLocalFormat(invoiceData.total_amount) + ' €',
			},
			{
				label: 'Nettobetrag ',
				amount: getNumberInLocalFormat(invoiceData.net_amount) + ' €',
			},
			{
				label: totalsTaxLabel,
				amount: getNumberInLocalFormat(invoiceData.tax_amount) + ' €',
			},
		];

		const formatedData = {
			invoiceNumber: invoiceNumber,
			datePaid: formatDateforInvoice(invoiceData.date.toISOString()),
			paymentMethod: invoiceData.payment_method,
			sellerOfficialName: shopData.official_name,
			sellerShopName: shopData.studio_name,
			sellerAddress1: shopData.street,
			sellerCity: shopData.city,
			sellerCountry: shopData.country?.name,
			sellerPhone: shopData.phone,
			sellerEmail: shopData.owner,
			sellerLogo: shopData.logo_url,
			sellerTaxNumber: shopData.tax_id?.code,
			buyerName: invoiceData.fullname,
			buyerAddress1: invoiceData.address?.line1,
			buyerAddress2: invoiceData.address?.line2,
			buyerCountry: invoiceData.address?.country,
			buyerCity: invoiceData.address?.city,
			buyerPostalCode: invoiceData.address?.postal_code,
			buyerEmail: invoiceData.email,
			items: invoiceItems,
			totals: invoiceTotalLabels,
			showTax: showTax,
			taxRebatMessage:
				taxTypeData.title === AvailableTaxTypes.SMALL_BUSINESS
					? 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen'
					: null,
		};

		return formatedData;
	} catch (error) {
		throw error;
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
				s3BucketKey: AWS_S3_BUCKET_KEYS.INVOICE,
			}),
		}).promise();
		return JSON.parse(response.Payload) as {
			url: string;
		};
	} catch (error) {
		throw error;
	}
};

const sendInvoiceMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		invoiceNumber: string;
		invoiceDate: string;
		invoiceUrl: string;
		studioName: string;
		logoUrl: string;
	}
) => {
	try {
		const hmtl = await renderEjsFile(EJS_TEMPLATES.INVOICE_EMAIL, {
			receiverName,
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `Rechnung von ${mailData.studioName}`,
			html: hmtl,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendPaymentRemainderMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		orderId: string;
		totalAmount: Number;
		receivedAmount: Number | null;
		toPay: Number;
		BankDetails: BankTransferDetails;
	}
) => {
	try {
		const hmtl = await renderEjsFile(EJS_TEMPLATES.PAYMENT_REMAINDER_MAIL, {
			receiverName,
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `Zahlungserinnerung ${mailData.orderId}`,
			html: hmtl,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendRequestVoucherMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		name: string;
		email: string;
		number: Number | null;
		value_per_voucher: Number;
		message: string;
	}
) => {
	try {
		const hmtl = await renderEjsFile(EJS_TEMPLATES.REQUEST_VOUCHER_MAIL, {
			receiverName,
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `voucher aanvraag `,
			html: hmtl,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendSuggestionProcessingMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		user_name: string;
		user_email: string;
		reason: string;
		suggested_text: string;
	}
) => {
	try {
		const html = await renderEjsFile(EJS_TEMPLATES.SUGGESTION_PROCESSING_MAIL, {
			receiverName,
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `your suggestion is proceeding`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendOrderConfirmationMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		Number: number[];
		Product: string[];
		UnitPrice: number[];
		TotalPrice: number[];
		orderId: string;
		BankDetails: BankTransferDetails | null;
	}
) => {
	try {
		const hmtl = await renderEjsFile(EJS_TEMPLATES.ORDER_CONFIRMATION_MAIL, {
			receiverName,
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `Bestellbestätigung ${mailData.orderId}`,
			html: hmtl,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendOrderCancellationMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		logoUrl: string;
		customerName: string;
		orderId: string;
	}
) => {
	try {
		// Rendering the EJS cancellation mail template
		const html = await renderEjsFile(EJS_TEMPLATES.ORDER_CANCELLATION_MAIL, {
			receiverName,
			...mailData,
		});
		// Email options for sending the cancellation mail
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL, // Sender email from environment variables
			to: [receiverMail], // Receiver email
			subject: `Stornierungsbestätigung für Bestellung ${mailData.orderId}`, // Subject line for cancellation
			html: html, // Rendered HTML content
		};

		// Sending the mail using the sendMail function
		await sendMail(mailOptions);
	} catch (error) {
		console.log('Error sending cancellation mail: ', error);
	}
};
const sendFacebookRegistrationMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		// logoUrl: string;
		name: string;
		role: string;
		authProvider: string;
	}
) => {
	try {
		// Render the EJS Facebook registration mail template
		const html = await renderEjsFile(EJS_TEMPLATES.FACEBOOK_REGISTRATION_MAIL, {
			receiverName,
			...mailData, // Spread the mail data which includes logoUrl, name, role, and authProvider
		});

		// Define mail options for the registration email
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL, // Sender email from environment variables
			to: receiverMail, // Single receiver email
			subject: `Willkommen bei ${mailData.authProvider} Registrierung`, // Subject line for Facebook registration
			html, // Rendered HTML content
		};

		// Send the email using the sendMail utility
		await sendMail(mailOptions);
	} catch (error) {
		console.error('Error sending Facebook registration mail: ', error);
	}
};

const sendVerificationMail = async (
	receiverMail: string, // Receiver's email address
	// receiverName: string,       // Receiver's name (optional)
	verificationLink: string // Link to verify the email
) => {
	try {
		// Render the EJS verification mail template
		const html = await renderEjsFile(EJS_TEMPLATES.EMAIL_VERIFICATION, {
			// receiverName,          // Name of the receiver
			verificationLink, // Include the verification link in the template
		});

		// Define mail options for the verification email
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL, // Sender email from environment variables
			to: receiverMail, // Single receiver email
			subject: 'Please Verify Your Email Address', // Subject line for verification
			html, // Rendered HTML content
		};

		// Send the email using the sendMail utility
		const mailsend = await sendMail(mailOptions);
	} catch (error) {
		console.error('Error sending verification mail: ', error);
	}
};

const generatePdfOfInvoice = async (invoiceId: string) => {
	try {
		const s3BaseUrl = process.env.S3_BASE_URL || '';
		const cleanBaseUrl = process.env.CLEAN_BASE_URL || '';
		const pdfData = await getInvoiceDataForPdf(invoiceId);
		const html = await renderEjsFile(EJS_TEMPLATES.INVOICE_PDF, {
			...pdfData,
		});
		const fileName = `invoice-${pdfData.invoiceNumber}`;
		const pdfUrl = await generatePdfFromLambda(html, fileName);
		// Filter the PDF URL
		const filteredPdfUrl = pdfUrl.url.replace(s3BaseUrl, cleanBaseUrl);
		await updateInvoices({ _id: invoiceId }, { pdf_url: filteredPdfUrl });

		const mailData = {
			invoiceNumber: pdfData.invoiceNumber,
			invoiceDate: pdfData.datePaid,
			invoiceUrl: filteredPdfUrl,
			studioName: pdfData.sellerShopName || '',
			logoUrl: pdfData.sellerLogo || '',
		};
		sendInvoiceMail(pdfData.buyerEmail, pdfData.buyerName as string, mailData);
	} catch (error) {
		console.log(error);
	}
};

const getDataForGiftCardSaleMail = async (invoice_id: string) => {
	try {
		const [invoiceData] = await findInvoices({ _id: invoice_id });
		if (!invoiceData) {
			throw new Error('Invoice not found');
		}

		const [shopData] = await shopService.findShops({ _id: invoiceData.shop });
		if (!invoiceData) {
			throw new Error('Shop not found');
		}

		const giftCardsData = await GiftCardModel.aggregate([
			{
				$match: {
					invoice: invoiceData._id,
				},
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
								title: 1,
							},
						},
					],
				},
			},
			{
				$unwind: {
					path: '$giftcard_template',
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$group: {
					_id: {
						template_id: '$giftcard_template._id',
						template_title: '$giftcard_template.title',
						amount: '$amount',
						message: '$message',
					},
					quantity: {
						$count: {},
					},
				},
			},
			{
				$project: {
					_id: 0,
					template: '$_id.template_title',
					amount: '$_id.amount',
					message: '$_id.message',
					quantity: 1,
				},
			},
		]);

		const invoiceItems = giftCardsData.map((giftCard) => {
			return {
				description: giftCard.template,
				unitPrice: getNumberInLocalFormat(giftCard.amount) + ' €',
				quantity: giftCard.quantity,
				amount:
					getNumberInLocalFormat(giftCard.amount * giftCard.quantity) + ' €',
			};
		});

		const responseData = {
			logoUrl: shopData.logo_url,
			studioName: shopData.studio_name,
			studioEmail: shopData.owner,
			invoiceItems: invoiceItems,
			totalAmount: getNumberInLocalFormat(invoiceData.total_amount) + ' €',
			invoiceUrl: invoiceData.pdf_url,
		};

		return responseData;
	} catch (error) {
		throw error;
	}
};

const sendGiftCardSaleMail = async (invoice_id: string) => {
	try {
		const mailData = await getDataForGiftCardSaleMail(invoice_id);

		const html = await renderEjsFile(EJS_TEMPLATES.GIFTCARD_SALE_MAIL, {
			...mailData,
		});

		const receiverMail = mailData.studioEmail as string;
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `New Gift Card Sale - ${mailData.studioName}`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};
const sendReviewMailToStudio = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		studioName: string;
		reviewText: string;
		reviewerEmail: string | null;
		rating: number;
	}
) => {
	try {
		// Render the EJS template with provided data
		const html = await renderEjsFile(EJS_TEMPLATES.REVIEW_EMAIL, {
			receiverName,
			studioName: mailData.studioName,
			reviewText: mailData.reviewText,
			reviewerEmail: mailData.reviewerEmail,
			rating: mailData.rating,
		});

		// Email options
		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `New Review for ${mailData.studioName}`,
			html: html,
		};

		// Send the email
		await sendMail(mailOptions);
	} catch (error) {
		console.error('Failed to send review email:', error);
	}
};

const validateInvoiceUpdate = async (data: any) => {
	try {
		const parsedData = await invoiceUpdateSchema.validate(data, {
			abortEarly: true,
			stripUnknown: false,
		});
		return parsedData;
	} catch (error) {
		throw error;
	}
};

const checkForUniqueInvoiceNumber = async (
	invoiceNumber: string,
	session: ClientSession | null
) => {
	try {
		const customerInvoice = await InvoiceModel.findOne(
			{
				invoice_number: invoiceNumber,
				deleted_at: null,
			},
			{ _id: 1 }
		).session(session);
		if (customerInvoice) {
			return false;
		}
		const negotiationInvoice = await NegotiationInvoiceModel.findOne(
			{
				invoice_number: invoiceNumber,
				deleted_at: null,
			},
			{ _id: 1 }
		).session(session);
		if (negotiationInvoice) {
			return false;
		}
		const payment_invoice = await PaymentInvoiceModel.findOne(
			{
				invoice_number: invoiceNumber,
				deleted_at: null,
			},
			{
				_id: 1,
			}
		).session(session);
		if (payment_invoice) {
			return false;
		}

		return true;
	} catch (error) {
		throw error;
	}
};

const findPendingInvoice = async () => {
	try {
		//48 hours logic
		const fortyEightHoursAgoStart = new Date();
		fortyEightHoursAgoStart.setDate(fortyEightHoursAgoStart.getDate() - 2);
		fortyEightHoursAgoStart.setHours(23, 59, 59, 999);

		const fortyEightHoursAgoEnd = new Date();
		fortyEightHoursAgoEnd.setMinutes(fortyEightHoursAgoEnd.getMinutes() - 1);

		const twoDaysOverPaidEmails = await InvoiceModel.find({
			payment_overPaid: true,
			created_at: {
				// $gte: fortyEightHoursAgoEnd,
				$lt: fortyEightHoursAgoStart,
			},
		});
		for (const email of twoDaysOverPaidEmails) {
			const [shopData] = await shopService.findShops({
				_id: email.shop,
			});
			if (!shopData) return;
			const originalPaymentIntent = email?.payment_id;
			if (!originalPaymentIntent) return;
			const { customer } = await stripe.paymentIntents.retrieve(
				originalPaymentIntent,
				shopData.stripe_account
					? { stripeAccount: shopData.stripe_account }
					: undefined
			);
			// console.log("customer: ", customer)
			if (!customer || typeof customer !== 'string') return;
			if (!email.refunded_amount) return;
			const refund = await stripe.refunds.create(
				{
					amount: email.refunded_amount * 100,
					currency: 'eur',
					customer: customer,
					origin: 'customer_balance',
				},
				shopData.stripe_account
					? { stripeAccount: shopData.stripe_account }
					: undefined
			);

			// const [invoiceData] = await findInvoices({
			// 	_id: email._id,
			// });

			await updateInvoices(
				{ _id: email._id },
				{
					payment_overPaid: false,
				}
			);
		}
		// 10 days logic
		const pending_expiry_time = new Date();
		const pending_time = parseInt(process.env.PENDING_EXPIRY_TIME || '') || 10;
		pending_expiry_time.setDate(pending_expiry_time.getDate() - pending_time);
		pending_expiry_time.setHours(23, 59, 59, 999);

		//6 days ago
		const partial_expiry_time = new Date();
		const partial_time = parseInt(process.env.PARTIAL_EXPIRY_TIME || '') || 6;
		partial_expiry_time.setDate(partial_expiry_time.getDate() - partial_time);
		partial_expiry_time.setHours(23, 59, 59, 999);

		const PendingEmailsForExpiration = await InvoiceModel.find({
			transaction_status: 'pending',
			created_at: { $lt: pending_expiry_time },
		});

		const PartialEmailsForExpiration = await InvoiceModel.find({
			transaction_status: 'partial_payment',
			created_at: { $lt: partial_expiry_time },
		});
		// Update transaction status to 'cancelled' for 14-day pending invoices
		for (const invoice of PendingEmailsForExpiration) {
			if (
				invoice.transaction_status === InvoiceTransactioStatus.PENDING &&
				invoice.payment_method == 'customer_balance'
			) {
				const [invoiceData] = await findInvoices({
					_id: invoice._id,
				});

				if (!invoiceData.payment_id) return;

				const [shopData] = await shopService.findShops({
					_id: invoiceData.shop,
				});
				if (!shopData) return;

				const paymentIntent = await stripe.paymentIntents.cancel(
					invoiceData?.payment_id,
					shopData.stripe_account
						? { stripeAccount: shopData.stripe_account }
						: undefined
				);

				const mailData = {
					logoUrl: shopData.logo_url || '',
					customerName: invoiceData.fullname || '',
					orderId: invoiceData.order_id || '',
					// supportEmail: invoiceData.email,
				};

				try {
					await sendOrderCancellationMail(
						invoice.email,
						invoice.fullname as string,
						mailData
					);
				} catch (err) {
					console.error(
						`Failed to send order cancellation email to ${invoice.email} for order ${invoice.order_id}`,
						err
					);
				}
			}
			invoice.transaction_status = InvoiceTransactioStatus.CANCELLED; // Make sure to use the correct status enum
			invoice.order_status = InvoiceOrderStatus.CANCELLED;
			await invoice.save();
		}
		// Update transaction status to 'cancelled' for 14-day partial payment invoices
		for (const invoice of PartialEmailsForExpiration) {
			const [invoiceData] = await findInvoices({
				_id: invoice._id,
			});

			if (!invoiceData.payment_id) return;

			const [shopData] = await shopService.findShops({
				_id: invoiceData.shop,
			});
			if (!shopData) return;

			if (
				invoice.transaction_status === InvoiceTransactioStatus.PARTIAL_PAYMENT
			) {
				// const stripe_customer_id = await customerService.findCustomerByEmail(
				// 	invoice.email
				// );
				const stripe_customer = await customerService.findCustomer(
					invoice.email,
					shopData._id
				);
				const stripe_customer_id = stripe_customer?.stripe_customer_id;
				if (!stripe_customer_id) return;
				if (!invoice.received_amount) return;

				const paymentIntent = await stripe.paymentIntents.cancel(
					invoiceData?.payment_id,
					shopData.stripe_account
						? { stripeAccount: shopData.stripe_account }
						: undefined
				);

				const mailData = {
					logoUrl: shopData.logo_url || '',
					customerName: invoiceData.fullname || '',
					orderId: invoiceData.order_id || '',
					// supportEmail: invoiceData.email,
				};

				try {
					await sendOrderCancellationMail(
						invoice.email,
						invoice.fullname as string,
						mailData
					);
				} catch (err) {
					console.error(
						`Failed to send order cancellation email to ${invoice.email} for order ${invoice.order_id}`,
						err
					);
				}
				const balance = await stripe.customers.retrieveCashBalance(
					stripe_customer_id,
					shopData.stripe_account
						? { stripeAccount: shopData.stripe_account }
						: undefined
				);
				if (!balance) return;
				const availableBalance = balance?.available?.eur;
				if (availableBalance && availableBalance >= invoice.received_amount) {
					const refund = await stripe.refunds.create(
						{
							amount: invoice.received_amount * 100,
							currency: 'eur',
							customer: stripe_customer_id,
							instructions_email: invoice.email,
							origin: 'customer_balance',
						},
						shopData.stripe_account
							? { stripeAccount: shopData.stripe_account }
							: undefined
					);
				}
				invoice.transaction_status = InvoiceTransactioStatus.CANCELLED; // Make sure to use the correct status enum
				invoice.order_status = InvoiceOrderStatus.CANCELLED;
				await invoice.save();
			}
		}

		// 4 days logic (after processing 10-day cancellations)
		const fourDayAgo = new Date();
		fourDayAgo.setDate(fourDayAgo.getDate() - 4);
		fourDayAgo.setHours(23, 59, 59, 999);

		const fourDayPendingEmails = await InvoiceModel.find({
			payment_method: 'customer_balance',
			transaction_status: 'pending',
			created_at: { $lt: fourDayAgo },
		});

		// const fourDayPartialPendingEmails = await InvoiceModel.find({
		// 	transaction_status: 'partial_payment',
		// 	created_at: { $lt: fourDayAgo },
		// });

		// Send payment reminder for 4-day pending invoices
		for (const invoice of fourDayPendingEmails) {
			const receivedAmount = invoice.received_amount || 0;
			const mailData = {
				orderId: invoice.order_id || '',
				totalAmount: invoice.total_amount,
				receivedAmount: invoice.received_amount || 0,
				toPay: invoice.total_amount - receivedAmount,
				BankDetails: invoice.bank_transfer,
			};

			try {
				await sendPaymentRemainderMail(
					invoice.email,
					invoice.fullname as string,
					mailData
				);
			} catch (err) {
				console.error(
					`Failed to send payment reminder to ${invoice.email} for order ${invoice.order_id}`,
					err
				);
			}
		}
	} catch (error) {
		console.error('Error in findPendingInvoice:', error);
	}
};

const sendSuggestionApprovalMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		// studio_id: string;
		suggested_text: string;
	}
) => {
	try {
		const html = await renderEjsFile(EJS_TEMPLATES.SUGGESTION_APPROVAL_MAIL, {
			receiverName,
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `Your suggestion has been approved!`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendStudioNotificationMailForApproval = async (
	studioEmail: string,
	studioName: string,
	mailData: {
		user_name: string;
		suggested_text: string;
	}
) => {
	try {
		const html = await renderEjsFile(
			EJS_TEMPLATES.STUDIO_SUGGESTION_NOTIFICATION_MAIL,
			{
				studioName,
				...mailData,
			}
		);

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [studioEmail],
			subject: `A suggestion has been approved for your studio!`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

const sendSuggestionRejectionMail = async (
	receiverMail: string,
	receiverName: string,
	mailData: {
		user_name: string;
		reason: string;
		suggested_text: string;
	}
) => {
	try {
		const html = await renderEjsFile(EJS_TEMPLATES.SUGGESTION_REJECTION_MAIL, {
			receiverName,
			...mailData,
		});

		const mailOptions = {
			from: process.env.AWS_SENDER_MAIL,
			to: [receiverMail],
			subject: `Your suggestion was rejected`,
			html: html,
		};
		await sendMail(mailOptions);
	} catch (error) {
		console.log(error);
	}
};

export default {
	findInvoices,
	createInvoice,
	updateInvoices,
	getInvoiceDetails,
	getLastGeneratedInvoiceOfShop,
	getAllInvoices,
	generatePdfOfInvoice,
	sendGiftCardSaleMail,
	validateInvoiceUpdate,
	checkForUniqueInvoiceNumber,
	sendPaymentRemainderMail,
	sendOrderConfirmationMail,
	findPendingInvoice,
	sendFacebookRegistrationMail,
	sendVerificationMail,
	sendReviewMailToStudio,
	sendRequestVoucherMail,
	sendSuggestionProcessingMail,
	sendSuggestionApprovalMail,
	sendStudioNotificationMailForApproval,
	sendSuggestionRejectionMail,
};
