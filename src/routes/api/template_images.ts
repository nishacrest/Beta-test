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

router.post(
	'/bg-image',
	authentication,
	uploadFields,
	controller.addBackgroundTemplateImage
);
router.get('/bg-image', authentication, controller.getBackgroundImages);
router.delete(
	'/bg-image',
	authentication,
	controller.deleteBackgroundTemplateImage
);

export default router;
