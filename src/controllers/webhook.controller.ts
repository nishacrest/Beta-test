import { Request, Response } from 'express';
import shopService from '../services/shop.service';
import { StripeOnboardingStatus } from '../types/shops';
import invoiceService from '../services/invoice.service';
import {
	InvoiceAttributes,
	InvoiceInput,
	InvoiceOrderStatus,
	InvoiceTransactioStatus,
	PaymentTypes,
} from '../types/invoices';
import { stripe } from '../utils/stripe.helper';
import giftcardService from '../services/giftcard.service';
import { Types } from 'mongoose';
import { GiftCardStatus, GroupedGiftCard } from '../types/giftcards';
import userSettingsService from '../services/user_settings.service';
import Stripe from 'stripe';
import { WebhookLogModel } from '../database/models';
import refundService from '../services/refund.service';

const PaymentIntentFailedOrCanceled = async (paymentIntentId: string) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: paymentIntentId,
		});
		if (!invoiceData) return;
		const [shopData] = await shopService.findShops({
			_id: invoiceData.shop,
		});
		if (!shopData) return;
		const paymentIntent = await stripe.paymentIntents.retrieve(
			paymentIntentId,
			{
				expand: ['payment_method'],
			},
			{
				stripeAccount: shopData.stripe_account ?? undefined,
			}
		);

		if (InvoiceTransactioStatus.IN_PROGRESS) {
			await fullFillFailedOrder(invoiceData._id.toString(), invoiceData.email);
		}

		await invoiceService.updateInvoices(
			{ _id: invoiceData._id },
			{
				transaction_status: InvoiceTransactioStatus.CANCELLED,
				order_status: InvoiceOrderStatus.CANCELLED,
			}
		);
	} catch (error) {
		throw error;
	}
};

// PaymentIntentRequireAction
const partiallyFunded = async (session: Stripe.PaymentIntent) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: session.id,
		});

		const [refundData] = await refundService.getRefundInvoice({
			shop: invoiceData.shop,
		});

		if (!invoiceData) return;

		if (
			invoiceData.transaction_status === InvoiceTransactioStatus.PARTIAL_PAYMENT
		)
			return;

		// // Retrieve payment intent details
		// const paymentIntent = await stripe.paymentIntents.retrieve(session.id);
		const total_amount = session.amount / 100;
		const amountRemaining =
			session.next_action?.display_bank_transfer_instructions?.amount_remaining;
		if (!amountRemaining) return null;
		const to_pay = amountRemaining / 100;
		const received_amount = total_amount - to_pay;
		// Set transaction status to PARTIAL_PAYMENT for partially funded cases
		await invoiceService.updateInvoices(
			{ _id: invoiceData._id },
			{
				transaction_status: InvoiceTransactioStatus.PARTIAL_PAYMENT,
				order_status: InvoiceOrderStatus.PENDING,
				received_amount: received_amount,
			}
		);

		const mailData = {
			orderId: invoiceData.order_id || '',
			totalAmount: total_amount,
			receivedAmount: received_amount,
			toPay: to_pay,
			BankDetails: invoiceData.bank_transfer,
		};
		const refundMailData = {
			orderId: invoiceData.order_id || '',
			totalAmount: total_amount,
			receivedAmount: received_amount,
			toPay: to_pay,
			BankDetails: invoiceData.bank_transfer,
		};
		await refundService.sendPartialPaymentMail(
			refundData.owner || '',
			refundData.studio_name || '',
			refundMailData
		);
		await invoiceService.sendPaymentRemainderMail(
			invoiceData.email,
			invoiceData.fullname as string,
			mailData
		);
	} catch (error) {
		console.error('Error in partiallyFunded function:', error);
		throw error;
	}
};

const handleOverpayment = async (transaction: any) => {
	try {
		const { type, ending_balance, customer, applied_to_payment } = transaction;

		// Ensure required data is present
		if (!customer) {
			console.error('Customer ID is missing.');
			return;
		}

		if (type === 'funded') {
			return;
		}

		if (type === 'applied_to_payment') {
			const paymentIntentId = applied_to_payment?.payment_intent;
			if (!paymentIntentId) {
				console.error('Payment Intent ID is missing in applied_to_payment.');
				return;
			}

			// Check if there's an overpayment
			if (ending_balance > 0) {
				const [invoiceData] = await invoiceService.findInvoices({
					payment_id: paymentIntentId,
				});
				if (!invoiceData) {
					console.error('No associated invoice found.');
					return;
				}
				await invoiceService.updateInvoices(
					{ _id: invoiceData._id },
					{
						refunded_amount: ending_balance / 100,
						payment_overPaid: true,
					}
				);
			}
		} else {
			console.log('Unhandled transaction type:', type);
		}
	} catch (error) {
		console.error('Error in handleOverpayment function:', error);
		throw error;
	}
};

const fullFillOrder = async (invoice_id: string, email: string) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			_id: invoice_id,
		});

		const giftCards = await giftcardService.getGiftCardDataForPdf(invoice_id);

		// generate invoice and send mail
		await generateInvoice(invoiceData);

		// generate giftcard and send mail
		await giftcardService.createPdfForGiftcards(
			//"unpaid"
			giftCards,
			email,
			invoiceData.fullname as string,
			invoice_id
		);

		await giftcardService.updateGiftCard(
			//checkout async
			{ invoice: new Types.ObjectId(invoice_id) },
			{ status: GiftCardStatus.ACTIVE }
		);
	} catch (error) {
		console.log(error);
	}
};

const fullFillOrderForAsync = async (invoice_id: string, email: string) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			_id: invoice_id,
		});

		// generate invoice and send mail
		await generateInvoice(invoiceData);

		await giftcardService.updateGiftCard(
			//checkout async
			{ invoice: new Types.ObjectId(invoice_id) },
			{ status: GiftCardStatus.ACTIVE }
		);
	} catch (error) {
		console.log(error);
	}
};

const generateInvoice = async (invoiceData: InvoiceAttributes) => {
	try {
		await invoiceService.generatePdfOfInvoice(invoiceData._id.toString());
		const [userSettingsData] = await userSettingsService.find({
			shop: invoiceData.shop,
		});
		if (userSettingsData.sale_email_notifications) {
			// send sale mail to studio
			invoiceService.sendGiftCardSaleMail(invoiceData._id.toString());
		}
	} catch (error) {
		console.log(error);
	}
};

const fullFillFailedOrder = async (invoice_id: string, email: string) => {
	try {
		await giftcardService.updateGiftCard(
			{ invoice: new Types.ObjectId(invoice_id) },
			{ status: GiftCardStatus.INACTIVE, deleted_at: new Date() }
		);
	} catch (error) {
		console.log(error);
	}
};

const PaymentIntentRequireAction = async (paymentIntentId: string) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: paymentIntentId,
		});
		if (!invoiceData) return;
		const [shopData] = await shopService.findShops({
			_id: invoiceData.shop,
		});
		if (!shopData) return;
		// Retrieve the payment intent from Stripe
		const paymentIntent: any = await stripe.paymentIntents.retrieve(
			paymentIntentId,
			{
				expand: ['payment_method'],
			},
			{
				stripeAccount: shopData.stripe_account ?? undefined,
			}
		);

		const giftCards = await giftcardService.getGiftCardDataForPdf(
			invoiceData._id.toString()
		);

		let bankTransferData = null;
		if (
			typeof paymentIntent.payment_method !== 'string' &&
			paymentIntent.payment_method?.type === 'customer_balance'
		) {
			const financial_details =
				paymentIntent.next_action?.display_bank_transfer_instructions
					?.financial_addresses?.[0]?.iban;
			if (!financial_details) return null;
			const reference =
				paymentIntent.next_action?.display_bank_transfer_instructions
					?.reference;
			if (!reference) return null;

			// Set bank_transfer data if 'customer_balance'
			bankTransferData = {
				account_holder_name: financial_details?.account_holder_name,
				bic: financial_details?.bic,
				iban: financial_details?.iban,
				reference: reference,
				address: financial_details,
			};
		}
		const invoiceUpdateFields: Partial<InvoiceInput> = {
			payment_id: paymentIntent.id,
			// order_id: orderId,
			fullname: paymentIntent?.payment_method?.billing_details?.name,
			address: {
				city:
					paymentIntent?.payment_method?.billing_details?.address?.city ?? null,
				country:
					paymentIntent?.payment_method?.billing_details?.address?.country ??
					null,
				line1:
					paymentIntent?.payment_method?.billing_details?.address?.line1 ??
					null,
				line2:
					paymentIntent?.payment_method?.billing_details?.address?.line2 ??
					null,
				postal_code:
					paymentIntent?.payment_method?.billing_details?.address
						?.postal_code ?? null,
				state:
					paymentIntent?.payment_method?.billing_details?.address?.state ??
					null,
			},

			payment_method:
				typeof paymentIntent.payment_method !== 'string'
					? paymentIntent.payment_method?.type
					: null,
			...(bankTransferData && { bank_transfer: bankTransferData }),
		};

		const financialDetails =
			paymentIntent.next_action?.display_bank_transfer_instructions
				?.financial_addresses?.[0]?.iban;
		const reference =
			paymentIntent.next_action?.display_bank_transfer_instructions?.reference;

		if (financialDetails && reference) {
			bankTransferData = {
				account_holder_name: financialDetails.account_holder_name,
				bic: financialDetails.bic,
				iban: financialDetails.iban,
				reference: reference,
				address: financialDetails,
			};
		}
		// }

		// Generate and send PDFs for gift cards
		await giftcardService.createPdfForGiftcards(
			giftCards,
			invoiceData.email,
			invoiceData.fullname as string,
			invoiceData._id.toString()
		);
		await invoiceService.updateInvoices(
			{ _id: invoiceData._id },
			{
				...invoiceUpdateFields,
				transaction_status: InvoiceTransactioStatus.IN_PROGRESS,
				order_status: InvoiceOrderStatus.IN_PROGRESS,
			}
		);
		// Group gift cards for email
		const groupedGiftCards = giftCards.reduce(
			(acc: GroupedGiftCard[], card) => {
				const existingCard = acc.find(
					(item) => item.template_name === card.template_name
				);
				if (existingCard) {
					existingCard.count += 1;
					existingCard.totalAmount += card.amount;
				} else {
					acc.push({
						template_name: card.template_name,
						count: 1,
						unitPrice: card.amount,
						totalAmount: card.amount,
					});
				}
				return acc;
			},
			[]
		);

		// Prepare and send order confirmation email
		const mailData = {
			orderId: invoiceData.order_id || '',
			Number: groupedGiftCards.map((card) => card.count),
			Product: groupedGiftCards.map((card) => card.template_name),
			UnitPrice: groupedGiftCards.map((card) => card.unitPrice),
			TotalPrice: groupedGiftCards.map((card) => card.totalAmount),
			BankDetails: bankTransferData,
		};

		await invoiceService.sendOrderConfirmationMail(
			invoiceData.email,
			invoiceData.fullname as string,
			mailData
		);
	} catch (error) {
		console.error(
			'Error handling PaymentIntent with requires_action status:',
			error
		);
		throw error;
	}
};

const paymentIntentCompleted = async (paymentIntentId: string) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: paymentIntentId,
		});
		if (!invoiceData) return;

		const [shopData] = await shopService.findShops({
			_id: invoiceData.shop,
		});
		if (!shopData) return;
		// Fetch payment intent from Stripe
		const paymentIntent: any = await stripe.paymentIntents.retrieve(
			paymentIntentId,
			{
				expand: ['payment_method'],
			},
			{
				stripeAccount: shopData.stripe_account ?? undefined,
			}
		);
		// Find the associated invoice

		const isDirectCharge = invoiceData.payment_type === PaymentTypes.DIRECT;
		const randomDigits = Math.floor(10000 + Math.random() * 90000);
		const orderId = `ODR-${new Date().getFullYear()}${String(
			new Date().getMonth() + 1
		).padStart(2, '0')}${String(new Date().getDate()).padStart(
			2,
			'0'
		)}${randomDigits}`;

		const invoiceUpdateFields: Partial<InvoiceInput> = {
			payment_id: paymentIntent.id,
			order_id: orderId,
			fullname: paymentIntent?.payment_method?.billing_details?.name,
			address: {
				city:
					paymentIntent?.payment_method?.billing_details?.address?.city ?? null,
				country:
					paymentIntent?.payment_method?.billing_details?.address?.country ??
					null,
				line1:
					paymentIntent?.payment_method?.billing_details?.address?.line1 ??
					null,
				line2:
					paymentIntent?.payment_method?.billing_details?.address?.line2 ??
					null,
				postal_code:
					paymentIntent?.payment_method?.billing_details?.address
						?.postal_code ?? null,
				state:
					paymentIntent?.payment_method?.billing_details?.address?.state ??
					null,
			},
			payment_method:
				typeof paymentIntent.payment_method !== 'string'
					? paymentIntent.payment_method?.type
					: null,
			// ...(bankTransferData && { bank_transfer: bankTransferData }),
		};
		// Handle based on payment status
		if (paymentIntent.status === 'succeeded') {
			const invoiceUpdate = await invoiceService.updateInvoices(
				{ _id: invoiceData._id },
				{
					...invoiceUpdateFields,
					transaction_status: InvoiceTransactioStatus.COMPLETED,
					order_status: InvoiceOrderStatus.IN_PROGRESS,
				}
			);
			// Fulfill the order
			fullFillOrder(invoiceData._id.toString(), invoiceData.email);
		}
	} catch (error) {
		console.error('Error handling payment intent:', error);
		throw error;
	}
};

const paymentReceived = async (paymentIntent: any) => {
	try {
		// Find the invoice associated with the session ID (or payment intent ID)
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: paymentIntent.id, // Use the correct session/payment_intent ID
		});
		if (!invoiceData) return;

		// Check if the transaction status is either 'in progress' or 'partial payment'
		if (
			invoiceData.transaction_status === InvoiceTransactioStatus.IN_PROGRESS ||
			invoiceData.transaction_status === InvoiceTransactioStatus.PARTIAL_PAYMENT
		) {
			// Fulfill the order (likely sending a confirmation email or processing the fulfillment)
			await fullFillOrderForAsync(
				invoiceData._id.toString(),
				invoiceData.email
			);

			// Update the invoice to mark the transaction as completed and the order as completed
			await invoiceService.updateInvoices(
				{ _id: invoiceData._id },
				{
					transaction_status: InvoiceTransactioStatus.COMPLETED,
					order_status: InvoiceOrderStatus.COMPLETED,
					received_amount: paymentIntent.amount_received / 100, // Assuming paymentIntent.amount_received is in cents
				}
			);
		}
	} catch (error) {
		// Handle any errors (logging, re-throwing, etc.)
		throw error;
	}
};

const paymentFailed = async (paymentIntent: any) => {
	try {
		// Fetch the invoice data using the payment intent ID (which you get from the session or paymentIntent)
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: paymentIntent.id, // Or use paymentIntent.payment_intent if you have the paymentIntent object directly
		});
		if (!invoiceData) return;

		// If the invoice status is still in progress, mark it as failed
		if (
			invoiceData.transaction_status === InvoiceTransactioStatus.IN_PROGRESS
		) {
			// Fulfill the failed order (can be sending a notification or marking it as failed in the system)
			await fullFillFailedOrder(
				invoiceData._id.toString(),
				paymentIntent.customer_email
			);

			// Update the invoice status to 'FAILED' as the payment failed
			await invoiceService.updateInvoices(
				{ _id: invoiceData._id },
				{
					transaction_status: InvoiceTransactioStatus.FAILED,
					order_status: InvoiceOrderStatus.FAILED,
				}
			);
		}
	} catch (error) {
		// Handle any errors in the process
		throw error;
	}
};

const invoicePaid = async (invoice: any) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: invoice.payment_intent,
		});
		if (!invoiceData) return;
	} catch (error) {
		throw error;
	}
};

const paymentRefunded = async (charge: Stripe.Charge) => {
	try {
		const [invoiceData] = await invoiceService.findInvoices({
			payment_id: charge.payment_intent,
		});
		if (!invoiceData) return;

		if (charge.amount_refunded < charge.amount) {
			return;
		}
		await giftcardService.updateGiftCard(
			{
				invoice: invoiceData._id,
			},
			{ status: GiftCardStatus.INACTIVE }
		);
	} catch (error) {
		throw error;
	}
};
const stripeWebhook = async (req: Request, res: Response) => {
	try {
		const event = req.body;
		switch (event.type) {
			case 'account.updated':
				const account = event.data.object;
				const [shopData] = await shopService.findShops({
					stripe_account: account.id,
				});
				if (!shopData) break;
				if (account)
					if (
						account.charges_enabled &&
						account.payouts_enabled &&
						account.requirements.currently_due?.length === 0 &&
						account.requirements.disabled_reason === null
					) {
						if (account.requirements.eventually_due?.length) {
							await shopService.updateShop(
								{ stripe_account: account.id },
								{
									stripe_onboarding_status: StripeOnboardingStatus.PARTIAL,
								}
							);
						} else {
							await shopService.updateShop(
								{ stripe_account: account.id },
								{ stripe_onboarding_status: StripeOnboardingStatus.COMPLETED }
							);
						}
					} else {
						if (
							shopData.stripe_onboarding_status ===
							StripeOnboardingStatus.COMPLETED
						) {
							await shopService.updateShop(
								{ stripe_account: account.id },
								{ stripe_onboarding_status: StripeOnboardingStatus.PENDING }
							);
						}
					}
				break;
			case 'payment_intent.succeeded':
				console.log('payment_intent.succeeded');
				await paymentIntentCompleted(event.data.object.id);
				break;
			case 'checkout.session.async_payment_succeeded':
				console.log('checkout.session.async_payment_succeeded');
				await paymentReceived(event.data.object);
				break;
			case 'payment_intent.payment_failed':
				console.log('payment_intent.payment_failed');
				await paymentFailed(event.data.object);
				break;
			case 'payment_intent.canceled':
				console.log('payment_intent.canceled');
				await PaymentIntentFailedOrCanceled(event.data.object);
				break;
			case 'payment_intent.requires_action':
				console.log('payment_intent.requires_action ');
				await PaymentIntentRequireAction(event.data.object.id);
				break;
			case 'charge.refunded':
				console.log('charge.refunded');
				// await paymentRefunded(event.data.object);
				break;
			case 'payment_intent.partially_funded':
				console.log('payment_intent.partially_funded');
				await partiallyFunded(event.data.object);
				break;
			case 'customer_cash_balance_transaction.created':
				console.log('customer_cash_balance_transaction');
				await handleOverpayment(event.data.object);
				break;

			case 'refund.created':
				console.log('refund created');
				break;
			// case 'invoice.paid':
			// 	console.log('invoice.paid');
			// 	await invoicePaid(event.data.object);
			// 	break;
			// case 'payment_intent.succeeded':
			// 	await fullFillOrder('123');
			default:
				console.log('Unhandled event type:', event.type);
				break;
		}

		res.status(200).json({ received: true });
	} catch (error: any) {
		console.log(error);
		if (process.env.ENABLE_API_LOGS || false) {
			const webhookLog = new WebhookLogModel({
				api_url: '/webhooks/stripe',
				api_response: JSON.stringify(req?.body),
				error_message: error?.message,
				status_code: error?.code,
				platfrom_type: 'Stripe',
				timestamp: new Date(),
			});
			await webhookLog.save();
		}
		res.status(400).json({ error: error.message });
	}
};

export default { stripeWebhook };
