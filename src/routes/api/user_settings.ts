import express from 'express';
import controller from '../../controllers/user_settings.controller';
import authentication from '../../middleware/authentication';

const router = express.Router();

router.patch('/', authentication, controller.updateUserSettings);

export default router;
