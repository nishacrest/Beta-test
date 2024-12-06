import express, { Request, Response } from 'express';
import apiRoutes from './api/index';

const router = express.Router();

router.use('/api', apiRoutes);
router.use('*', (req: Request, res: Response) => {
	res.status(404).json({ message: 'Page Not Found' });
});

export default router;
