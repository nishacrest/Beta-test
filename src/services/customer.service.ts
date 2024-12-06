import { stripe } from '../utils/stripe.helper';
import CustomerModel from '../database/models/customers';
import { Types } from 'mongoose';

const createCustomer = async (
	email: string,
	shop_id: Types.ObjectId,
	stripeAccount?: string
): Promise<string> => {
	try {
		// Create a customer in Stripe
		const stripeCustomer = await stripe.customers.create(
			{ email },
			stripeAccount ? { stripeAccount } : undefined
		);
		const customer = new CustomerModel({
			customer_email: email,
			shop_id,
			stripe_customer_id: stripeCustomer.id,
		});
		await customer.save();

		return stripeCustomer.id;
	} catch (error) {
		console.error('Error creating customer:');
		throw new Error('Failed to create customer');
	}
};

const findCustomer = async (email: string, shop_id: Types.ObjectId) => {
	try {
		const customer = await CustomerModel.findOne({
			customer_email: email,
			shop_id: shop_id,
		}).exec();
		return customer;
	} catch (error) {
		console.error('Error finding customer');
		throw new Error('Failed to find customer');
	}
};

const findCustomerByEmail = async (email: string) => {
	try {
		const customer = await CustomerModel.findOne({
			customer_email: email,
		}).exec();
		return customer?.stripe_customer_id;
	} catch (error) {
		console.error('Error finding customer');
		throw new Error('Failed to find customer');
	}
};

const updateCustomerEmail = async ({
	customerId,
	currentEmail,
	newEmail,
	stripeAccount,
}: {
	customerId?: string,
	currentEmail?: string; 
	newEmail: string;
	stripeAccount?: string;
}) => {
	try {
		const customer = await CustomerModel.findOne({
			customer_email: currentEmail,
			// shop_id,
		}).exec();

		if (!customer) {
			throw new Error('Customer not found');
		}

		// Update the email in Stripe
		const stripeOptions = stripeAccount ? { stripeAccount } : undefined;
		await stripe.customers.update(
			customer.stripe_customer_id,
			{ email: newEmail },
			stripeOptions
		);

		// Update the email in the database using updateOne
		const result = await CustomerModel.updateOne(
			{ _id: customer._id }, 
			{ $set: { customer_email: newEmail } } 
		);

		if (result.modifiedCount === 0) {
			throw new Error('Failed to update email in the database');
		}


		return { success: true, message: 'Customer email updated' };
	} catch (error) {
		console.error('Error updating customer email:', error);
	}
};

const findCustomerByStripeId = async (
	stripeCustomerId: string
): Promise<string | undefined> => {
	try {
		const customer = await CustomerModel.findOne({
			stripe_customer_id: stripeCustomerId,
		})
			.select('customer_email') 
			.exec();

		return customer?.customer_email;
	} catch (error) {
		console.error('Error finding customer by Stripe ID:', error);
	}
};

export default {
	createCustomer,
	findCustomer,
	findCustomerByEmail,
	updateCustomerEmail,
	findCustomerByStripeId,
};
