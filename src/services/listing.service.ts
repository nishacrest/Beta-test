import {
	ListingDetailsModel,
	ShopModel,
	ShopUiModel,
	UserModel,
} from '../database/models';
import { ClientSession, FilterQuery, Types, UpdateQuery } from 'mongoose';
import { ListingAttributes, ListingInput } from '../types/listing_details';


export const createListing = async (
    listingFields: ListingInput,
    session?: ClientSession | null
): Promise<ListingAttributes | null> => {
    try {
        const options = session ? { session } : {}; // Pass session only if it's provided

        const listingData = await ListingDetailsModel.create([listingFields], options);

        if (listingData.length === 0) {
            throw new Error('Failed to create listing, no data returned.');
        }

        return listingData[0] as ListingAttributes;
    } catch (error: any) {
        console.error('Error creating listing:', error.message);
        throw new Error(`Error creating listing: ${error.message}`);
    }
};

export const updateListing = async (
    listingId: Types.ObjectId,
    updatedFields: Partial<ListingInput>,
    session?: ClientSession | null
): Promise<ListingAttributes | null> => {
    try {
        const options = session ? { session } : {}; // Pass session only if it's available

        // Find and update the listing
        const listingData = await ListingDetailsModel.findOneAndUpdate(
            { _id: listingId }, 
            { $set: updatedFields }, 
            { new: true, ...options } // Return the updated document and apply session options
        );

        // Check if any listing was updated
        if (!listingData) {
            throw new Error('Failed to update listing, no data returned.');
        }

        return listingData as ListingAttributes; // Return the updated listing
    } catch (error: any) {
        console.error('Error updating listing:', error.message); // Log the error for debugging
        throw new Error(`Error updating listing: ${error.message}`); // Add context to the error
    }
};

export const getAllListings = async (
    session?: ClientSession | null
): Promise<ListingAttributes[]> => {
    try {
        const clientSession = session || null;

        // Fetch all listings
        const listings = await ListingDetailsModel.find({}, null, {
            session: clientSession, // Ensure session is used here
        }).lean();

        return listings as ListingAttributes[];
    } catch (error: any) {
        console.error('Error fetching all listings:', error.message); // Log the error for debugging
        throw new Error(`Error fetching all listings: ${error.message}`); // Add context to the error
    }
};

export const deleteListing = async (
    listingId: Types.ObjectId,
    session?: ClientSession
): Promise<boolean> => {
    try {
        // Attempt to delete the listing by ID
        const deleteResult = await ListingDetailsModel.findByIdAndDelete(listingId, {
            session, // Use the session passed as an argument directly
        });

        // Check if the listing was deleted
        if (!deleteResult) {
            return false; // Return false if the listing was not found
        }

        return true; // Return true if the listing was deleted
    } catch (error: any) {
        console.error('Error deleting listing:', error.message); // Log the error for debugging
        throw new Error(`Error deleting listing: ${error.message}`); // Add context to the error
    }
};

export const getListingByIdService = async (
    listingId: string,
    session?: ClientSession | null
) => {
    try {
        const listing = await ListingDetailsModel.findById(listingId, null, { session }).lean();
        
        if (!listing) {
            throw new Error('Listing not found');
        }
        
        return listing;
    } catch (error: any) {
        console.error('Error fetching listing:', error.message);
        throw new Error(`Error fetching listing: ${error.message}`);
    }
};

const findListingByShop = async (shopId: string, session: ClientSession | null = null) => {
	try {
		const query = ListingDetailsModel.findOne({ shop: shopId });

		// If a session is provided, pass it to the query for transaction support
		if (session) {
			query.session(session);
		}

		const listing = await query.exec();
		return listing; // Returns null if no listing is found
	} catch (error) {
		console.error('Error finding listing by shop:', error);
		throw new Error('Could not retrieve listing for the specified shop.');
	}
};

export default {
	createListing, 
    updateListing, 
    getAllListings,
    deleteListing,
    getListingByIdService,
    findListingByShop

};
