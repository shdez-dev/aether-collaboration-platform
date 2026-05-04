// apps/api/src/routes/search.ts

import { Router } from 'express';
import { searchController } from '../controllers/SearchController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

/**
 * GET /api/search?q=<query>
 * Búsqueda global: cards, proyectos, boards, workspaces, documentos
 */
router.get('/', (req, res) => searchController.search(req, res));

export default router;
