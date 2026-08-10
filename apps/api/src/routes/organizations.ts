import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { organizationController } from '../controllers/OrganizationController';

const router = Router();
router.use(authenticateJWT);
router.post('/', (req, res) => organizationController.create(req, res));
router.get('/', (req, res) => organizationController.list(req, res));
router.get('/:id', (req, res) => organizationController.getById(req, res));
router.put('/:id', (req, res) => organizationController.update(req, res));

export default router;
