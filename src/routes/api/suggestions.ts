import express from 'express';

import {
	fetchAllSuggestions,
	handleSuggestionAction,
	submitSuggestion,
} from '../../controllers/suggestions.controller';
import {
	approveSuggestion,
	declineSuggestion,
} from '../../services/suggestions.service';

const router = express.Router();

// Step 1: Request OTP
router.post('/', submitSuggestion);
// router.post('/approve', approveSuggestion);
// router.post('/decline', declineSuggestion);
router.post('/:id/action', handleSuggestionAction);
// Step 2: Submit review with OTP verification
router.get('/', fetchAllSuggestions);
export default router;
