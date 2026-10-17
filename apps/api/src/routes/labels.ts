// apps/api/src/routes/labels.ts

import { Router } from 'express';
import { LabelController } from '../controllers/LabelController';
import { authenticateJWT } from '../middleware/auth';
import { checkLabelWorkspaceMembership, checkWorkspaceMembership } from '../middleware/workspace';

const router = Router();

router.use(authenticateJWT);

/**
 * ==================== RUTAS DE LABELS ====================
 *
 * Todas las rutas requieren autenticación
 */

// Crear label en workspace
router.post('/workspaces/:workspaceId/labels', checkWorkspaceMembership, LabelController.createLabel);

// Obtener todos los labels de un workspace
router.get('/workspaces/:workspaceId/labels', checkWorkspaceMembership, LabelController.getWorkspaceLabels);

// Obtener label por ID
router.get('/labels/:labelId', checkLabelWorkspaceMembership, LabelController.getLabel);

// Actualizar label
router.put('/labels/:labelId', checkLabelWorkspaceMembership, LabelController.updateLabel);

// Eliminar label
router.delete('/labels/:labelId', checkLabelWorkspaceMembership, LabelController.deleteLabel);

export default router;
