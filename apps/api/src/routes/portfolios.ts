import { NextFunction, Request, Response, Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { portfolioController } from '../controllers/PortfolioController';

const router = Router();
const action = (handler: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(handler(req, res)).catch(next);

router.use(authenticateJWT);
router.get('/', action((req, res) => portfolioController.list(req, res)));
router.post('/', action((req, res) => portfolioController.create(req, res)));
// Keep concrete read-side paths before /:id so Express does not interpret
// "overview" as a portfolio UUID.
router.get('/:id/overview', action((req, res) => portfolioController.overview(req, res)));
router.get('/:id/alerts', action((req, res) => portfolioController.alerts(req, res)));
router.get('/:id/capacity', action((req, res) => portfolioController.capacity(req, res)));
router.get('/:id/export.csv', action((req, res) => portfolioController.exportCsv(req, res)));
router.get('/:id/projects/candidates', action((req, res) => portfolioController.projectCandidates(req, res)));
router.post('/:id/capacity/availability', action((req, res) => portfolioController.addAvailability(req, res)));
router.put('/:id/capacity/availability/:capacityId', action((req, res) => portfolioController.updateAvailability(req, res)));
router.delete('/:id/capacity/availability/:capacityId', action((req, res) => portfolioController.removeAvailability(req, res)));
router.post('/:id/capacity/allocations', action((req, res) => portfolioController.addAllocation(req, res)));
router.patch('/:id/capacity/allocations/:allocationId', action((req, res) => portfolioController.updateAllocation(req, res)));
router.delete('/:id/capacity/allocations/:allocationId', action((req, res) => portfolioController.removeAllocation(req, res)));
router.patch('/:id/alerts/:alertId', action((req, res) => portfolioController.updateAlert(req, res)));
router.get('/:id', action((req, res) => portfolioController.get(req, res)));
router.patch('/:id', action((req, res) => portfolioController.update(req, res)));
router.post('/:id/archive', action((req, res) => portfolioController.archive(req, res)));
router.post('/:id/members', action((req, res) => portfolioController.addMember(req, res)));
router.delete('/:id/members/:userId', action((req, res) => portfolioController.removeMember(req, res)));
router.post('/:id/projects', action((req, res) => portfolioController.addProject(req, res)));
router.delete('/:id/projects/:projectId', action((req, res) => portfolioController.removeProject(req, res)));

export default router;
