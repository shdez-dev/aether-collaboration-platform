import { NextFunction, Request, Response, Router } from 'express';
import { initiativeController } from '../controllers/InitiativeController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);
const action = (handler: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res)).catch(next);
};

router.get('/', action((req, res) => initiativeController.list(req, res)));
router.post('/', action((req, res) => initiativeController.create(req, res)));
// Alias intended for the requester-facing form. It deliberately shares the same
// authorization and validation path as an internally created submission.
router.post('/request', action((req, res) => initiativeController.create(req, res)));
router.get('/reports', action((req, res) => initiativeController.reports(req, res)));
router.get('/settings/:workspaceId', action((req, res) => initiativeController.getSettings(req, res)));
router.put('/settings/:workspaceId', action((req, res) => initiativeController.updateSettings(req, res)));
router.get('/:id', action((req, res) => initiativeController.getById(req, res)));
router.patch('/:id', action((req, res) => initiativeController.update(req, res)));
router.post('/:id/participants', action((req, res) => initiativeController.addParticipant(req, res)));
router.delete('/:id/participants/:userId', action((req, res) => initiativeController.removeParticipant(req, res)));
router.post('/:id/transition', action((req, res) => initiativeController.transition(req, res)));
router.post('/:id/convert', action((req, res) => initiativeController.convert(req, res)));

export default router;
