import { Types } from 'mongoose';

export interface RequestVoucherAttributes {
  name: string;
  email: string;
  phone?: string;
  numberOfVouchers: number;
  valuePerVoucher: number;
  additionalInfo?: string;
  studioOwner: string;
  studioEmail: string;
  requestedAt?: Date;
}

export type RequestVoucherInput = Omit<
  RequestVoucherAttributes,
  'requestedAt'
>;
