import express from 'express';
import controller from '../../controllers/giftcard_templates.controller';
import { imageFileForGiftcardTemplate } from '../../middleware/upload';
import authentication from '../../middleware/authentication';
import { checkAdmin } from '../../middleware/authorization';
const router = express.Router();

const uploadFields = imageFileForGiftcardTemplate.fields([
	{ name: 'image', maxCount: 1 },
	{ name: 'filled_image', maxCount: 1 },
]);

router.get('/', authentication, controller.getAllGiftCardTemplates);
router.post(
	'/',
	authentication,
	uploadFields,
	controller.addGiftCardTemplate
);
router.patch(
	'/:template_id',
	authentication,
	// checkAdmin,
	uploadFields,
	controller.updateGiftCardTemplate
);
router.delete(
	'/:template_id',
	authentication,
	// checkAdmin,
	controller.deleteGiftCardTemplate
);

router.get(
	'/:shop_id/eligible-giftcards',
	authentication,
	controller.getAllEligibleTemplates
);

router.get(
	'/get-templates',
	authentication,
	controller.getGiftCardTemplatesByShop
);

export default router;
