// apps/api/src/routes/ai.ts

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { aiPlannerController } from '../controllers/AiPlannerController';

const router = Router();

router.use(authenticateJWT);

router.get('/credits', (req, res) => aiPlannerController.getCredits(req, res));
router.post('/plan',   (req, res) => aiPlannerController.generatePlan(req, res));
router.post('/build',  (req, res) => aiPlannerController.buildWorkspace(req, res));

export default router;
