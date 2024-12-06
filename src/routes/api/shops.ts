import expess from 'express';
import controller from '../../controllers/shop.controller';
import {
	imageFileForGiftcardTemplate,
	imageFileForShopLogo,
} from '../../middleware/upload';
import authentication from '../../middleware/authentication';
import { checkAdmin, checkShopOwner } from '../../middleware/authorization';

const router = expess.Router();

router.get(
	'/',
	//  authentication,
	//  checkAdmin,
	controller.getAllShops
);
router.get('/dropdown', authentication, controller.getAllShopsForDropdown);
router.get(
	'/redeem-dropdown',
	// authentication,
	// checkAdmin,
	controller.getAllShopsForReemption
);

router.post(
	'/listing',
	// authentication,
	controller.getFilteredShops
);

router.get(
	'/list-cities',
	// authentication,
	controller.getCitiesWithStudiosController
);

router.post(
	'/request-voucher',
	// authentication,
	// checkAdmin,
	// imageFileForListedCity.array('images'),
	controller.requestVoucherController
);
router.get('/request-vouchers', controller.getRequestVoucherController);
router.get('/:studio_slug/studio-slug', controller.getShopDetailsByStudioSlug);
router.get('/:studio_id/studio', controller.getShopDetailsByStudioId);
router.get(
	'/:shop_id',
	authentication,
	checkShopOwner,
	controller.getShopDetailsById
);
router.post(
	'/',
	authentication,
	checkAdmin,
	imageFileForShopLogo.single('image'),
	controller.createShop
);
router.post(
	'/:shop_id/giftcard-settings',
	authentication,
	checkShopOwner,
	controller.updateGiftCardSettings
);
router.patch(
	'/:shop_id',
	authentication,
	checkShopOwner,
	imageFileForShopLogo.single('image'),
	controller.updateShop
);
router.patch(
	'/:shop_id/purchase-hero-section',
	authentication,
	checkShopOwner,
	imageFileForGiftcardTemplate.array('images'),
	controller.updatePurchaseHeroSection
);
router.patch(
	'/:shop_id/purchase-about-section',
	authentication,
	checkShopOwner,
	controller.updatePurchaseAboutUsSection
);
router.patch(
	'/:shop_id/purchase-faq-section',
	authentication,
	checkShopOwner,
	controller.updatePurchaseFaqSection
);
router.patch(
	'/:shop_id/purchase-contact-section',
	authentication,
	checkShopOwner,
	controller.updatePurchaseContactUsSection
);
router.patch(
	'/:shop_id/upload-logo',
	authentication,
	checkShopOwner,
	imageFileForShopLogo.single('image'),
	controller.uploadShopLogo
);

export default router;

/**
 * @swagger
 * tags:
 *   name: Shops
 *   description: Shop management and filtering
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     shopListingRequest:
 *       type: object
 *       properties:
 *         page:
 *           type: string
 *           description: Page number for pagination
 *         size:
 *           type: string
 *           description: Number of items per page for pagination
 *         sort_by:
 *           type: string
 *           description: Field to sort by, default is 'created_at'
 *           example: created_at
 *         sort_order:
 *           type: string
 *           enum: [asc, desc]
 *           description: Sort order, either ascending or descending
 *           example: desc
 *         search_value:
 *           type: string
 *           description: Value to search for in shop listings
 *         city:
 *           type: string
 *           description: City to filter shops by
 *           example: New York
 *         available_service:
 *           type: string
 *           description: Available service to filter shops by
 *           example: "WiFi"
 *         studio_integration:
 *           type: string
 *           description: Filter by studio integration status
 *         is_open:
 *           type: boolean
 *           description: Filter shops by their open/closed status
 *         is_verified:
 *           type: string
 *           description: Filter shops by their verified status
 *           example: true
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     shopListingResponse:
 *       type: object
 *       properties:
 *         shops:
 *           type: array
 *           description: List of filtered shops
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               city:
 *                 type: string
 *               is_verified:
 *                 type: boolean
 *               opening_hours_specification:
 *                 type: array
 *                 description: Array of opening hours by day
 *                 items:
 *                   type: object
 *                   properties:
 *                     day_of_week:
 *                       type: string
 *                     opening_time:
 *                       type: string
 *                     closing_time:
 *                       type: string
 *         total_shops:
 *           type: integer
 *           description: Total number of shops after filtering
 */

/**
 * @swagger
 * /api/shops/listing:
 *   get:
 *     summary: Get a list of filtered shops
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: available_service
 *         schema:
 *           type: string
 *         description: Filter by available service
 *       - in: query
 *         name: studio_integration
 *         schema:
 *           type: string
 *         description: Filter by studio integration status
 *       - in: query
 *         name: is_open
 *         schema:
 *           type: boolean
 *         description: Filter by open/closed status
 *       - in: query
 *         name: is_verified
 *         schema:
 *           type: string
 *         description: Filter by verified status
 *     responses:
 *       '200':
 *         description: List of shops
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/shopListingResponse'
 *       '400':
 *         description: Validation error
 *       '500':
 *         description: Internal server error
 */
