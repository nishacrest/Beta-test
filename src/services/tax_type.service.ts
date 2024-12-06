import { TaxTypeModel } from '../database/models';
import { TaxTypeInput, TaxTypeAttributes } from '../types/tax_types';
import { AnyKeyObject } from '../types';
import { ClientSession, Types } from 'mongoose';

const findTaxTypes = async (
	conditions: AnyKeyObject,
	session?: ClientSession | null
) => {
	try {
		const clientSession = session || null;
		const taxTypeData: TaxTypeAttributes[] = await TaxTypeModel.find({
			...conditions,
			deleted_at: null,
		})
			.session(clientSession)
			.lean();
		return taxTypeData;
	} catch (error) {
		throw error;
	}
};

const createTaxType = async (taxTypeData: TaxTypeInput) => {
	try {
		const taxType: any = await TaxTypeModel.create(taxTypeData);
		return taxType as TaxTypeAttributes;
	} catch (error) {
		throw error;
	}
};

const updateTaxType = async (
	condition: AnyKeyObject,
	updateFields: Partial<TaxTypeInput>
) => {
	try {
		await TaxTypeModel.updateMany(
			{ ...condition, deleted_at: null },
			updateFields
		);
	} catch (error) {
		throw error;
	}
};

const getAllTaxTypes = async () => {
	try {
		const taxTypeData: TaxTypeAttributes[] = await TaxTypeModel.find({
			deleted_at: null,
		})
			.select(['-created_at', '-updated_at', '-deleted_at'])
			.lean();
		return taxTypeData;
	} catch (error) {
		throw error;
	}
};

export default { findTaxTypes, createTaxType, updateTaxType, getAllTaxTypes };
