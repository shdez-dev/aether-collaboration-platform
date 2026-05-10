// apps/api/src/routes/teams.ts

import { Router } from 'express';
import { teamController } from '../controllers/TeamController';
import { authenticateJWT } from '../middleware/auth';

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
router.get('/:id',    (req, res) => teamController.getById(req, res));
router.put('/:id',    (req, res) => teamController.update(req, res));
router.delete('/:id', (req, res) => teamController.delete(req, res));

// ── Workspaces activos (derivados de project_teams) ───────────────────────────
router.get('/:id/workspaces', (req, res) => teamController.getWorkspaces(req, res));

// ── Actividad ──────────────────────────────────────────────────────────────────
router.get('/:id/activity', (req, res) => teamController.getActivity(req, res));

// ── Miembros ───────────────────────────────────────────────────────────────────
router.get('/:id/members',             (req, res) => teamController.getMembers(req, res));
router.post('/:id/members',            (req, res) => teamController.addMember(req, res));
router.put('/:id/members/:userId',     (req, res) => teamController.changeMemberRole(req, res));
router.delete('/:id/members/:userId',  (req, res) => teamController.removeMember(req, res));

export default router;
