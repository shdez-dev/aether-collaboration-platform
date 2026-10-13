// apps/api/src/routes/projects.ts

import { NextFunction, Request, Response, Router } from 'express';
import { pool } from '../lib/db';
import { projectController } from '../controllers/ProjectController';
import { projectPlanningController } from '../modules/projects/ProjectPlanningController';
import { projectSprintController } from '../modules/projects/ProjectSprintController';
import { projectEpicController } from '../modules/projects/ProjectEpicController';
import { projectActivityController } from '../modules/projects/ProjectActivityController';
import { authenticateJWT } from '../middleware/auth';
import { requireProjectEditor, requireProjectMembership } from '../middleware/project';

const router = Router();

async function requireOrganizationProjectPlanning(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT o.type AS organization_type FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       JOIN organizations o ON o.id = w.organization_id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (result.rows[0]?.organization_type === 'PERSONAL') {
      return res.status(409).json({ success: false, error: { code: 'ORGANIZATION_PLANNING_REQUIRED', message: 'El cronograma está disponible en organizaciones.' } });
    }
    return next();
  } catch {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo validar la disponibilidad de planificación.' } });
  }
}

async function requireOrganizationProjectMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT o.type AS organization_type FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       JOIN organizations o ON o.id = w.organization_id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (result.rows[0]?.organization_type === 'PERSONAL') {
      return res.status(409).json({ success: false, error: { code: 'ORGANIZATION_MEMBERS_REQUIRED', message: 'Los miembros de proyecto solo están disponibles en organizaciones de equipo, instituciones y redes de colaboración.' } });
    }
    return next();
  } catch {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo validar la disponibilidad de miembros del proyecto.' } });
  }
}

async function requireOrganizationScrumProject(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT p.methodology, o.type AS organization_type FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       JOIN organizations o ON o.id = w.organization_id
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (result.rows[0]?.organization_type === 'PERSONAL') {
      return res.status(409).json({ success: false, error: { code: 'ORGANIZATION_PLANNING_REQUIRED', message: 'La planificación de sprints está disponible en organizaciones.' } });
    }
    if (result.rows[0]?.methodology !== 'SCRUM') {
      return res.status(409).json({ success: false, error: { code: 'SCRUM_REQUIRED', message: 'Las épicas y los sprints están disponibles en proyectos Scrum.' } });
    }
    return next();
  } catch {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo validar la disponibilidad de Scrum.' } });
  }
}

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
router.get('/:id/timeline-cards', requireOrganizationProjectPlanning, (req, res) => projectController.getTimelineCards(req, res));
router.get('/:id/backlog',         (req, res) => projectPlanningController.getBacklog(req, res));
router.get('/:id/sprints', requireOrganizationScrumProject, (req, res) => projectSprintController.list(req, res));
router.post('/:id/sprints', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectSprintController.create(req, res));
router.patch('/:id/sprints/:sprintId', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectSprintController.update(req, res));
router.put('/:id/sprints/:sprintId/cards', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectSprintController.setCards(req, res));
router.delete('/:id/sprints/:sprintId', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectSprintController.remove(req, res));
router.get('/:id/epics', requireOrganizationScrumProject, (req, res) => projectEpicController.list(req, res));
router.post('/:id/epics', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectEpicController.create(req, res));
router.patch('/:id/epics/:epicId', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectEpicController.update(req, res));
router.delete('/:id/epics/:epicId', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectEpicController.remove(req, res));
router.put('/:id/cards/:cardId/epic', requireProjectEditor, requireOrganizationScrumProject, (req, res) => projectEpicController.setCardEpic(req, res));

// ── Boards del proyecto ────────────────────────────────────────────────────────
router.post('/:id/boards', requireProjectEditor, (req, res) => projectController.addBoard(req, res));
router.delete('/:id/boards/:boardId', requireProjectEditor, (req, res) => projectController.removeBoard(req, res));

// ── Milestones ─────────────────────────────────────────────────────────────────
router.post('/:id/milestones', requireProjectEditor, requireOrganizationProjectPlanning, (req, res) => projectController.createMilestone(req, res));
router.put('/:id/milestones/:milestoneId', requireProjectEditor, requireOrganizationProjectPlanning, (req, res) => projectController.updateMilestone(req, res));
router.delete('/:id/milestones/:milestoneId', requireProjectEditor, requireOrganizationProjectPlanning, (req, res) => projectController.deleteMilestone(req, res));

// ── Teams del proyecto ─────────────────────────────────────────────────────────
router.get('/:id/teams', requireOrganizationProjectPlanning, (req, res) => projectController.getTeams(req, res));
router.get('/:id/team-members', requireOrganizationProjectPlanning, (req, res) => projectController.getTeamMembers(req, res));
router.post('/:id/teams', requireProjectEditor, requireOrganizationProjectPlanning, (req, res) => projectController.assignTeam(req, res));
router.delete('/:id/teams/:teamId', requireProjectEditor, requireOrganizationProjectPlanning, (req, res) => projectController.removeTeam(req, res));

// ── Miembros directos del proyecto ─────────────────────────────────────────────
router.get('/:id/members', requireOrganizationProjectMembers, (req, res) => projectController.getDirectMembers(req, res));
router.post('/:id/members', requireProjectEditor, requireOrganizationProjectMembers, (req, res) => projectController.addDirectMember(req, res));
router.patch('/:id/members/:userId', requireProjectEditor, requireOrganizationProjectMembers, (req, res) => projectController.updateDirectMemberRole(req, res));
router.delete('/:id/members/:userId', requireProjectEditor, requireOrganizationProjectMembers, (req, res) => projectController.removeDirectMember(req, res));

// ── Actividad del proyecto ──────────────────────────────────────────────────────
router.get('/:id/activity', (req, res) => projectActivityController.list(req, res));

export default router;
