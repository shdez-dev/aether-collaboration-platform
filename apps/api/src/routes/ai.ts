// apps/api/src/routes/ai.ts

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { aiPlannerController } from '../controllers/AiPlannerController';
import { aiBuilderDocumentController } from '../controllers/AiBuilderDocumentController';

const router = Router();

router.use(authenticateJWT);

// AI Planner
router.get('/credits', (req, res) => aiPlannerController.getCredits(req, res));
router.post('/plan',   (req, res) => aiPlannerController.generatePlan(req, res));
router.post('/build',  (req, res) => aiPlannerController.buildWorkspace(req, res));

// AI Builder planning documents (no workspace affiliation)
router.get('/documents',           (req, res) => aiBuilderDocumentController.list(req, res));
router.post('/documents',          (req, res) => aiBuilderDocumentController.create(req, res));
router.get('/documents/:id',       (req, res) => aiBuilderDocumentController.getById(req, res));
router.put('/documents/:id',       (req, res) => aiBuilderDocumentController.update(req, res));
router.patch('/documents/:id/used',(req, res) => aiBuilderDocumentController.markUsed(req, res));
router.delete('/documents/:id',    (req, res) => aiBuilderDocumentController.delete(req, res));

export default router;
