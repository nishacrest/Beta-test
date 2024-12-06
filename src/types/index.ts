import { Types } from 'mongoose';
import { ShopAttributes } from './shops';
import { TaxTypeAttributes } from './tax_types';
import { UserSettingsAttributes } from './user_settings';
import { UserAttributes } from './users';
import { RedeemGiftCardAttributes } from './redeem_giftcards';
import { GiftCardAttributes } from './giftcards';
import { InvoiceAttributes } from './invoices';
import { GiftCardTemplateAttributes } from './giftcard_templates';
import { RefundInvoiceAttributes } from './refunds_invoices';

export interface AnyKeyObject {
	[key: string]: any;
}

export interface UserJwtPayload {
	user_id: string;
	role: string;
	shop_id: string;
}

declare global {
	namespace Express {
		interface Request {
			loggedUser: UserAttributes & { shop_id: string };
			token?: string;
		}
	}
}

declare global {
	namespace Express {
		namespace Multer {
			interface File {
				location?: string; // Define the location property as optional
				key?: string;
				bucket?: string;
				contentType?: string;
			}
		}
	}
}

export type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type IUserProfileDetails = Pick<
	UserAttributes,
	'_id' | 'email' | 'role'
> & {
	shop: Omit<
		ShopAttributes,
		'created_at' | 'updated_at' | 'deleted_at' | 'tax_type'
	> & {
		tax_type: Pick<TaxTypeAttributes, '_id' | 'title'>;
	};
	user_settings: Omit<
		UserSettingsAttributes,
		'user' | 'shop' | 'created_at' | 'updated_at' | 'deleted_at'
	>;
};

export type INegotiationInvoices = {
	shop_id: Types.ObjectId;
	studio_name: string;
	total_amount: number;
	total_fees: number;
	total_payout: number;
	iban: string | null;
	invoice_number: string;
	pdf_url: string;
	invoice_iban: string | null;
	invoice_date: Date;
};

export type INegotiationInvoiceRedemptions = Pick<
	RedeemGiftCardAttributes,
	'_id' | 'amount' | 'redeemed_date' | 'fees'
> & {
	giftcard: Pick<GiftCardAttributes, '_id' | 'code'>;
	payout: number;
};

export type IAdminUserWithShop = Pick<
	UserAttributes,
	'_id' | 'email' | 'role'
> & {
	shop: Omit<ShopAttributes, 'created_at' | 'updated_at' | 'deleted_at'>;
};

export type IPaymentInvoices = {
	shop_id: Types.ObjectId;
	studio_name: string;
	total_amount: number;
	total_fees: number;
	invoice_number: string;
	pdf_url: string;
	invoice_date: Date;
};

export type IPaymentInvoicePurchases = Pick<
	InvoiceAttributes,
	'_id' | 'date' | 'invoice_number' | 'total_amount' | 'fees'
>;

export type IGiftCardsForRefund = Pick<
	GiftCardAttributes,
	'_id' | 'amount' | 'available_amount' | 'status' | 'code' | 'validtill_date'
> & {
	giftcard_template: Pick<GiftCardTemplateAttributes, '_id' | 'template_name'>;
};

export type IGiftCardsForRefundInvoice = Pick<
	GiftCardAttributes,
	'_id' | 'amount' | 'available_amount' | 'invoice' | 'code'
> & {
	giftcard_template: Pick<GiftCardTemplateAttributes, '_id' | 'template_name'>;
};

export type IRefundInvoices = Omit<
	RefundInvoiceAttributes,
	| 'created_at'
	| 'updated_at'
	| 'deleted_at'
	| 'shop'
	| 'customer_invoice'
	| 'reference_number'
> & {
	shop: Pick<ShopAttributes, '_id' | 'studio_name'>;
	customer_invoice: Pick<InvoiceAttributes, '_id' | 'invoice_number'>;
};
