// apps/api/src/routes/documents.ts

import { Router } from 'express';
import { documentController } from '../controllers/DocumentController';
import { documentService } from '../services/DocumentService';
import { authenticateJWT } from '../middleware/auth';
import { checkWorkspaceMembership } from '../middleware/workspace';

const router = Router();

router.use(authenticateJWT);

// CREATE - requires workspace membership
router.post('/workspaces/:workspaceId/documents', checkWorkspaceMembership, (req, res) =>
  documentController.create(req, res)
);

// LIST - requires workspace membership
router.get('/workspaces/:workspaceId/documents', checkWorkspaceMembership, (req, res) =>
  documentController.list(req, res)
);

// GET BY ID - NO middleware (verification inside controller)
router.get('/documents/:id', (req, res) => documentController.getById(req, res));

// UPDATE - NO middleware (verification inside controller)
router.put('/documents/:id', (req, res) => documentController.update(req, res));

// DELETE - NO middleware (verification inside controller)
router.delete('/documents/:id', (req, res) => documentController.delete(req, res));

// VERSION ROUTES - NO middleware
router.post('/documents/:id/versions', (req, res) => documentController.createVersion(req, res));

router.get('/documents/:id/versions', (req, res) => documentController.getVersions(req, res));

router.post('/documents/:id/versions/:versionId/restore', (req, res) =>
  documentController.restoreVersion(req, res)
);

// PERMISSIONS - NO middleware
router.put('/documents/:id/permissions', (req, res) =>
  documentController.updatePermission(req, res)
);

router.get('/documents/:id/members', (req, res) => documentController.getDocumentMembers(req, res));

// SAVE YJS STATE - Auto-guardado
router.put('/documents/:id/yjs-state', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { yjsState } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
      });
    }

    if (!yjsState || !Array.isArray(yjsState)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'yjsState inválido' },
      });
    }

    const hasAccess = await documentService.checkDocumentAccess(id, userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'No tienes acceso a este documento' },
      });
    }

    const permission = await documentService.getEffectiveUserPermission(id, userId);
    if (permission !== 'EDIT') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'No tienes permiso de edición' },
      });
    }

    const yjsBuffer = new Uint8Array(yjsState);
    await documentService.updateYjsState(id, yjsBuffer);


    return res.json({
      success: true,
      data: { message: 'Estado guardado exitosamente' },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error al guardar estado' },
    });
  }
});

export default router;
