// apps/api/src/routes/projects.ts

import { Router } from 'express';
import { projectController } from '../controllers/ProjectController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

// ── Global list (sidebar) ──────────────────────────────────────────────────────
// GET /api/projects — todos los proyectos activos/planificados del usuario
router.get('/', (req, res) => projectController.list(req, res));

// ── Proyecto individual ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => projectController.getById(req, res));
router.put('/:id', (req, res) => projectController.update(req, res));
router.delete('/:id', (req, res) => projectController.delete(req, res));

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get('/:id/stats', (req, res) => projectController.getStats(req, res));

// ── Boards del proyecto ────────────────────────────────────────────────────────
router.post('/:id/boards', (req, res) => projectController.addBoard(req, res));
router.delete('/:id/boards/:boardId', (req, res) => projectController.removeBoard(req, res));

// ── Milestones ─────────────────────────────────────────────────────────────────
router.post('/:id/milestones', (req, res) => projectController.createMilestone(req, res));
router.put('/:id/milestones/:milestoneId', (req, res) => projectController.updateMilestone(req, res));
router.delete('/:id/milestones/:milestoneId', (req, res) => projectController.deleteMilestone(req, res));

// ── Teams del proyecto ─────────────────────────────────────────────────────────
router.get('/:id/teams', (req, res) => projectController.getTeams(req, res));
router.post('/:id/teams', (req, res) => projectController.assignTeam(req, res));
router.delete('/:id/teams/:teamId', (req, res) => projectController.removeTeam(req, res));

export default router;
