// apps/api/src/routes/labels.ts

import { Router } from 'express';
import { LabelController } from '../controllers/LabelController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * ==================== RUTAS DE LABELS ====================
 *
 * Todas las rutas requieren autenticación
 */

// Crear label en workspace
router.post('/workspaces/:workspaceId/labels', authenticateJWT, LabelController.createLabel);

// Obtener todos los labels de un workspace
router.get('/workspaces/:workspaceId/labels', authenticateJWT, LabelController.getWorkspaceLabels);

// Obtener label por ID
router.get('/labels/:id', authenticateJWT, LabelController.getLabel);

// Actualizar label
router.put('/labels/:id', authenticateJWT, LabelController.updateLabel);

// Eliminar label
router.delete('/labels/:id', authenticateJWT, LabelController.deleteLabel);

export default router;
