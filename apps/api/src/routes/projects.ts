// apps/api/src/routes/projects.ts

import { NextFunction, Request, Response, Router } from 'express';
import { pool } from '../lib/db';
import { projectController } from '../controllers/ProjectController';
import { projectPlanningController } from '../modules/projects/ProjectPlanningController';
import { projectSprintController } from '../modules/projects/ProjectSprintController';
import { projectEpicController } from '../modules/projects/ProjectEpicController';
import { projectMethodologyController } from '../modules/projects/ProjectMethodologyController';
import { projectActivityController } from '../modules/projects/ProjectActivityController';
import { projectRiskController } from '../controllers/ProjectRiskController';
import { projectTraceabilityController } from '../controllers/ProjectTraceabilityController';
import { projectDocumentationController } from '../controllers/ProjectDocumentationController';
import { authenticateJWT } from '../middleware/auth';
import { requireProjectAccess, requireProjectEditor, requireProjectMembership, requireProjectScrumRole } from '../middleware/project';

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

// ── Registro de riesgos ───────────────────────────────────────────────────────
router.get('/:id/risks', (req, res) => projectRiskController.list(req, res));
router.post('/:id/risks', requireProjectAccess('MANAGE_RISKS'), (req, res) => projectRiskController.create(req, res));
router.patch('/:id/risks/:riskId', requireProjectAccess('MANAGE_RISKS'), (req, res) => projectRiskController.update(req, res));

// ── Decisiones y línea base ──────────────────────────────────────────────────
router.get('/:id/traceability', (req, res) => projectTraceabilityController.getTraceability(req, res));
router.put('/:id/traceability/objective', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.saveObjective(req, res));
router.post('/:id/traceability/deliverables', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.createDeliverable(req, res));
router.patch('/:id/traceability/deliverables/:deliverableId', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.updateDeliverable(req, res));
router.delete('/:id/traceability/deliverables/:deliverableId', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.deleteDeliverable(req, res));
router.post('/:id/traceability/deliverables/:deliverableId/requirements', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.createRequirement(req, res));
router.patch('/:id/traceability/deliverables/:deliverableId/requirements/:requirementId', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.updateRequirement(req, res));
router.delete('/:id/traceability/deliverables/:deliverableId/requirements/:requirementId', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.deleteRequirement(req, res));
router.patch('/:id/traceability/milestones/:milestoneId/deliverable', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.linkMilestone(req, res));
router.post('/:id/traceability/outcomes', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.createOutcome(req, res));
router.delete('/:id/traceability/outcomes/:outcomeId', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.deleteOutcome(req, res));
router.get('/:id/decisions', (req, res) => projectTraceabilityController.listDecisions(req, res));
router.post('/:id/decisions', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.createDecision(req, res));
router.get('/:id/baselines', (req, res) => projectTraceabilityController.listBaselines(req, res));
router.post('/:id/baselines', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectTraceabilityController.createBaseline(req, res));

// ── Documentación y evidencias vinculadas ───────────────────────────────────
router.get('/:id/documentation', (req, res) => projectDocumentationController.list(req, res));
router.put('/:id/documents/:documentId/classification', requireProjectAccess('MANAGE_DOCUMENTS'), (req, res) => projectDocumentationController.classify(req, res));
router.post('/:id/evidence', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectDocumentationController.createEvidence(req, res));
router.patch('/:id/evidence/:evidenceId', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectDocumentationController.setEvidenceStatus(req, res));
router.delete('/:id/evidence/:evidenceId', requireProjectAccess('MANAGE_TRACEABILITY'), (req, res) => projectDocumentationController.removeEvidence(req, res));

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get('/:id/stats',           (req, res) => projectController.getStats(req, res));
router.get('/:id/timeline-cards', requireOrganizationProjectPlanning, (req, res) => projectController.getTimelineCards(req, res));
router.get('/:id/backlog',         (req, res) => projectPlanningController.getBacklog(req, res));
router.get('/:id/sprints', requireOrganizationScrumProject, (req, res) => projectSprintController.list(req, res));
router.post('/:id/sprints', requireOrganizationScrumProject, requireProjectScrumRole('SCRUM_MASTER'), (req, res) => projectSprintController.create(req, res));
router.patch('/:id/sprints/:sprintId', requireOrganizationScrumProject, requireProjectScrumRole('SCRUM_MASTER'), (req, res) => projectSprintController.update(req, res));
router.put('/:id/sprints/:sprintId/cards', requireOrganizationScrumProject, requireProjectScrumRole('PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER'), (req, res) => projectSprintController.setCards(req, res));
router.delete('/:id/sprints/:sprintId', requireOrganizationScrumProject, requireProjectScrumRole('SCRUM_MASTER'), (req, res) => projectSprintController.remove(req, res));
router.get('/:id/epics', requireOrganizationScrumProject, (req, res) => projectEpicController.list(req, res));
router.post('/:id/epics', requireOrganizationScrumProject, requireProjectScrumRole('PRODUCT_OWNER'), (req, res) => projectEpicController.create(req, res));
router.patch('/:id/epics/:epicId', requireOrganizationScrumProject, requireProjectScrumRole('PRODUCT_OWNER'), (req, res) => projectEpicController.update(req, res));
router.delete('/:id/epics/:epicId', requireOrganizationScrumProject, requireProjectScrumRole('PRODUCT_OWNER'), (req, res) => projectEpicController.remove(req, res));
router.put('/:id/cards/:cardId/epic', requireOrganizationScrumProject, requireProjectScrumRole('PRODUCT_OWNER'), (req, res) => projectEpicController.setCardEpic(req, res));
router.patch('/:id/product-goal', requireOrganizationScrumProject, requireProjectScrumRole('PRODUCT_OWNER'), (req, res) => projectMethodologyController.updateProductGoal(req, res));
router.patch('/:id/scrum-assignments/:userId', requireProjectAccess('MANAGE_PLANNING'), requireOrganizationScrumProject, (req, res) => projectMethodologyController.updateScrumAssignment(req, res));

// ── Boards del proyecto ────────────────────────────────────────────────────────
router.post('/:id/boards', requireProjectAccess('MANAGE_BOARDS'), (req, res) => projectController.addBoard(req, res));
router.delete('/:id/boards/:boardId', requireProjectAccess('MANAGE_BOARDS'), (req, res) => projectController.removeBoard(req, res));

// ── Milestones ─────────────────────────────────────────────────────────────────
router.post('/:id/milestones', requireProjectAccess('MANAGE_PLANNING'), requireOrganizationProjectPlanning, (req, res) => projectController.createMilestone(req, res));
router.put('/:id/milestones/:milestoneId', requireProjectAccess('MANAGE_PLANNING'), requireOrganizationProjectPlanning, (req, res) => projectController.updateMilestone(req, res));
router.delete('/:id/milestones/:milestoneId', requireProjectAccess('MANAGE_PLANNING'), requireOrganizationProjectPlanning, (req, res) => projectController.deleteMilestone(req, res));

// ── Teams del proyecto ─────────────────────────────────────────────────────────
router.get('/:id/teams', requireOrganizationProjectPlanning, (req, res) => projectController.getTeams(req, res));
router.get('/:id/team-members', requireOrganizationProjectPlanning, (req, res) => projectController.getTeamMembers(req, res));
router.post('/:id/teams', requireProjectAccess('MANAGE_MEMBERS'), requireOrganizationProjectPlanning, (req, res) => projectController.assignTeam(req, res));
router.delete('/:id/teams/:teamId', requireProjectAccess('MANAGE_MEMBERS'), requireOrganizationProjectPlanning, (req, res) => projectController.removeTeam(req, res));

// ── Miembros directos del proyecto ─────────────────────────────────────────────
router.get('/:id/members', requireOrganizationProjectMembers, (req, res) => projectController.getDirectMembers(req, res));
router.post('/:id/members', requireProjectAccess('MANAGE_MEMBERS'), requireOrganizationProjectMembers, (req, res) => projectController.addDirectMember(req, res));
router.patch('/:id/members/:userId', requireProjectAccess('MANAGE_MEMBERS'), requireOrganizationProjectMembers, (req, res) => projectController.updateDirectMemberRole(req, res));
router.delete('/:id/members/:userId/role', requireProjectAccess('MANAGE_MEMBERS'), requireOrganizationProjectMembers, (req, res) => projectController.resetDirectMemberRole(req, res));
router.delete('/:id/members/:userId', requireProjectAccess('MANAGE_MEMBERS'), requireOrganizationProjectMembers, (req, res) => projectController.removeDirectMember(req, res));

// ── Actividad del proyecto ──────────────────────────────────────────────────────
router.get('/:id/activity', (req, res) => projectActivityController.list(req, res));

export default router;
