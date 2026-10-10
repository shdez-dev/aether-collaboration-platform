import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { organizationController } from '../controllers/OrganizationController';

const router = Router();
router.use(authenticateJWT);
router.post('/invitations/:token/accept', (req, res) => organizationController.acceptInvitation(req, res));
router.post('/', (req, res) => organizationController.create(req, res));
router.get('/', (req, res) => organizationController.list(req, res));
router.get('/:id/members', (req, res) => organizationController.getMembers(req, res));
router.patch('/:id/members/:userId', (req, res) => organizationController.updateMember(req, res));
router.delete('/:id/members/:userId', (req, res) => organizationController.removeMember(req, res));
router.post('/:id/invitations', (req, res) => organizationController.inviteMember(req, res));
router.get('/:id/invitations', (req, res) => organizationController.getPendingInvitations(req, res));
router.post('/:id/invitations/:invitationId/regenerate', (req, res) => organizationController.regenerateInvitationCode(req, res));
router.delete('/:id/invitations/:invitationId', (req, res) => organizationController.revokeInvitation(req, res));
router.post('/:id/transfer-ownership', (req, res) => organizationController.transferOwnership(req, res));
router.get('/:id', (req, res) => organizationController.getById(req, res));
router.put('/:id', (req, res) => organizationController.update(req, res));
router.delete('/:id', (req, res) => organizationController.remove(req, res));

export default router;
