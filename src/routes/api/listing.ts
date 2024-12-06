import { getAllListings } from './../../services/listing.service';
import expess from 'express';
import controller from '../../controllers/listing.controller';
import {
    imageFileForListing,
} from '../../middleware/upload';
import authentication from '../../middleware/authentication';
import { checkAdmin, checkShopOwner } from '../../middleware/authorization';

const router = expess.Router();
router.post(
	'/',
	// authentication,
	// checkAdmin,
    imageFileForListing,
	// imageFileForListedCity.array('cityImages', 10),
	controller.createListing
);

router.patch(
	'/:id',
	// authentication,
	// checkAdmin,
    imageFileForListing,
	controller.updateListingController
);
// Route for fetching all listings
router.get(
    '/',
    // authentication, // Ensure the user is authenticated
    controller.getAllListingsController // Controller function for fetching all listings
);

// Route for deleting a listing
router.delete(
    '/:id',
    // authentication, // Ensure the user is authenticated
    // checkAdmin, // Only an admin can delete listings
    controller.deleteListingController // Controller function for deleting a listing
);

router.get(
    '/:id',
    // authentication, // Ensure the user is authenticated
    // checkAdmin, // Only an admin can delete listings
    controller.getListingByIdController // Controller function for deleting a listing
);
export default router;




/**
 * @swagger
 * components:
 *   schemas:
 *     Listing:
 *       type: object
 *       required:
 *         - shop
 *         - description
 *       properties:
 *         shop:
 *           type: string
 *           description: The shop ID associated with the listing
 *         description:
 *           type: string
 *           description: The description of the listing
 *         opening_hours_specification:
 *           type: string
 *           description: The opening hours of the shop
 *         postal_code:
 *           type: string
 *           description: The postal code of the shop
 *         available_service:
 *           type: array
 *           items:
 *             type: string
 *           description: Available services offered by the shop
 *         amenity_feature:
 *           type: array
 *           items:
 *             type: string
 *           description: Amenities available in the shop
 *         makes_offer:
 *           type: array
 *           items:
 *             type: object
 *           description: Offers related to the shop
 *       example:
 *         shop: "6123456789abcdef01234567"
 *         description: "A great place for services"
 *         opening_hours_specification: "Mon-Fri: 9am - 5pm"
 *         postal_code: "12345"
 *         available_service: ["Delivery", "Online Payment"]
 *         amenity_feature: ["Wi-Fi", "Parking"]
 */

/**
 * @swagger
 * /listings:
 *   post:
 *     summary: Create a new listing
 *     tags: [Listings]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Listing'
 *     responses:
 *       201:
 *         description: Listing created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Shop not found
 */
/**
 * @swagger
 * /listings/{id}:
 *   patch:
 *     summary: Update an existing listing
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Listing'
 *     responses:
 *       200:
 *         description: Listing updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Listing not found
 */
/**
 * @swagger
 * /listings:
 *   get:
 *     summary: Fetch all listings
 *     tags: [Listings]
 *     responses:
 *       200:
 *         description: A list of listings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Listing'
 */
/**
 * @swagger
 * /listings/{id}:
 *   get:
 *     summary: Fetch a listing by ID
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The listing ID
 *     responses:
 *       200:
 *         description: Listing found
 *       404:
 *         description: Listing not found
 */

/**
 * @swagger
 * /listings/{id}:
 *   delete:
 *     summary: Delete a listing
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The listing ID
 *     responses:
 *       200:
 *         description: Listing deleted successfully
 *       404:
 *         description: Listing not found
 */