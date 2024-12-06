import express from 'express';
import authentication from '../../middleware/authentication';
import controller from '../../controllers/user.controller';

const router = express.Router();

router.post('/change-password', authentication, controller.changePassword);
router.get('/', authentication, controller.getProfile);

export default router;
