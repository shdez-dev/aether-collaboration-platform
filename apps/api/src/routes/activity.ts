import { Router } from 'express';
import { activityLogController } from '../controllers/ActivityLogController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get event categories
router.get('/categories', (req, res) => activityLogController.getEventCategories(req, res));

export default router;
