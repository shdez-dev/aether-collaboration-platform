// apps/api/src/routes/teams.ts

import { Router } from 'express';
import { teamController } from '../controllers/TeamController';
import { authenticateJWT } from '../middleware/auth';
import { requireTeamAccess } from '../middleware/team';

const router = Router();

router.use(authenticateJWT);

// ── Listado y creación ─────────────────────────────────────────────────────────
router.get('/',    (req, res) => teamController.list(req, res));
router.post('/',   (req, res) => teamController.create(req, res));

// ── Invitaciones (deben ir antes de /:id) ─────────────────────────────────────
router.get('/invitations',                               (req, res) => teamController.getPendingTeamInvitations(req, res));
router.post('/invitations/:invitationId/accept',         (req, res) => teamController.acceptTeamInvitation(req, res));
router.post('/invitations/:invitationId/reject',         (req, res) => teamController.rejectTeamInvitation(req, res));

// ── Equipo individual ──────────────────────────────────────────────────────────
router.get('/:id',    requireTeamAccess(), (req, res) => teamController.getById(req, res));
router.put('/:id',    requireTeamAccess(true), (req, res) => teamController.update(req, res));
router.delete('/:id', requireTeamAccess(true), (req, res) => teamController.delete(req, res));

// ── Workspaces activos (derivados de project_teams) ───────────────────────────
router.get('/:id/projects', requireTeamAccess(), (req, res) => teamController.getProjects(req, res));
router.get('/:id/workspaces', requireTeamAccess(), (req, res) => teamController.getWorkspaces(req, res));

// ── Actividad ──────────────────────────────────────────────────────────────────
router.get('/:id/activity', requireTeamAccess(), (req, res) => teamController.getActivity(req, res));

// ── Miembros ───────────────────────────────────────────────────────────────────
router.get('/:id/members',             requireTeamAccess(), (req, res) => teamController.getMembers(req, res));
router.post('/:id/members',            requireTeamAccess(true), (req, res) => teamController.addMember(req, res));
router.put('/:id/members/:userId',     requireTeamAccess(true), (req, res) => teamController.changeMemberRole(req, res));
router.delete('/:id/members/:userId',  requireTeamAccess(true), (req, res) => teamController.removeMember(req, res));

export default router;
