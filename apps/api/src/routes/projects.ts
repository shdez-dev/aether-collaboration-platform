// apps/api/src/routes/projects.ts

import { Router } from 'express';
import { projectController } from '../controllers/ProjectController';
import { projectPlanningController } from '../modules/projects/ProjectPlanningController';
import { projectActivityController } from '../modules/projects/ProjectActivityController';
import { authenticateJWT } from '../middleware/auth';
import { requireProjectEditor, requireProjectMembership } from '../middleware/project';

const router = Router();

router.use(authenticateJWT);

// ── Global list (sidebar) ──────────────────────────────────────────────────────
// GET /api/projects — todos los proyectos activos/planificados del usuario
router.get('/', (req, res) => projectController.list(req, res));

// Every remaining endpoint is scoped to a concrete project. Keep membership
// validation here instead of duplicating it across controllers.
router.use('/:id', requireProjectMembership);

// ── Proyecto individual ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => projectController.getById(req, res));
router.put('/:id', requireProjectEditor, (req, res) => projectController.update(req, res));
router.delete('/:id', requireProjectEditor, (req, res) => projectController.delete(req, res));
router.post('/:id/adopt-current-standard', requireProjectEditor, (req, res) => projectController.adoptCurrentStandard(req, res));
router.post('/:id/workflow', requireProjectEditor, (req, res) => projectController.transitionWorkflow(req, res));

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get('/:id/stats',           (req, res) => projectController.getStats(req, res));
router.get('/:id/timeline-cards',  (req, res) => projectController.getTimelineCards(req, res));
router.get('/:id/backlog',         (req, res) => projectPlanningController.getBacklog(req, res));

// ── Boards del proyecto ────────────────────────────────────────────────────────
router.post('/:id/boards', requireProjectEditor, (req, res) => projectController.addBoard(req, res));
router.delete('/:id/boards/:boardId', requireProjectEditor, (req, res) => projectController.removeBoard(req, res));

// ── Milestones ─────────────────────────────────────────────────────────────────
router.post('/:id/milestones', requireProjectEditor, (req, res) => projectController.createMilestone(req, res));
router.put('/:id/milestones/:milestoneId', requireProjectEditor, (req, res) => projectController.updateMilestone(req, res));
router.delete('/:id/milestones/:milestoneId', requireProjectEditor, (req, res) => projectController.deleteMilestone(req, res));

// ── Teams del proyecto ─────────────────────────────────────────────────────────
router.get('/:id/teams', (req, res) => projectController.getTeams(req, res));
router.post('/:id/teams', requireProjectEditor, (req, res) => projectController.assignTeam(req, res));
router.delete('/:id/teams/:teamId', requireProjectEditor, (req, res) => projectController.removeTeam(req, res));

// ── Miembros directos del proyecto ─────────────────────────────────────────────
router.get('/:id/members', (req, res) => projectController.getDirectMembers(req, res));
router.post('/:id/members', requireProjectEditor, (req, res) => projectController.addDirectMember(req, res));
router.patch('/:id/members/:userId', requireProjectEditor, (req, res) => projectController.updateDirectMemberRole(req, res));
router.delete('/:id/members/:userId', requireProjectEditor, (req, res) => projectController.removeDirectMember(req, res));

// ── Actividad del proyecto ──────────────────────────────────────────────────────
router.get('/:id/activity', (req, res) => projectActivityController.list(req, res));

export default router;
