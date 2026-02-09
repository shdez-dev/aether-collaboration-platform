// apps/api/src/controllers/DocumentController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { documentService } from '../services/DocumentService';
import { WorkspaceRequest } from '../middleware/workspace';

/**
 * Validation schemas
 */
const createDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  templateId: z.string().optional(),
  content: z.any().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
});

const updatePermissionSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['VIEW', 'COMMENT', 'EDIT']),
});

class DocumentController {
  /**
   * POST /api/workspaces/:workspaceId/documents
   * Create document
   */
  async create(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { workspaceId } = req.params;
      const userRole = req.workspace?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden crear documentos',
          },
        });
      }

      const validation = createDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: validation.error.errors,
          },
        });
      }

      const document = await documentService.createDocument(workspaceId, userId, validation.data);

      return res.status(201).json({
        success: true,
        data: { document },
      });
    } catch (error) {
      console.error('[DocumentController] Create error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al crear documento' },
      });
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/documents
   * List documents
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { workspaceId } = req.params;
      const { search, sortBy, sortOrder, limit, offset } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const result = await documentService.getWorkspaceDocuments(workspaceId, {
        search: search as string,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[DocumentController] List error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al obtener documentos' },
      });
    }
  }

  /**
   * GET /api/documents/:id
   * Get document by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(id, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'No tienes acceso a este documento' },
        });
      }

      const document = await documentService.getDocumentWithDetails(id, userId);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Documento no encontrado' },
        });
      }

      return res.json({
        success: true,
        data: { document },
      });
    } catch (error) {
      console.error('[DocumentController] GetById error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al obtener documento' },
      });
    }
  }

  /**
   * PUT /api/documents/:id
   * Update document
   */
  async update(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
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

      const validation = updateDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: validation.error.errors,
          },
        });
      }

      const document = await documentService.updateDocument(id, userId, validation.data);

      return res.json({
        success: true,
        data: { document },
      });
    } catch (error) {
      console.error('[DocumentController] Update error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al actualizar documento' },
      });
    }
  }

  /**
   * DELETE /api/documents/:id
   * Delete document
   */
  async delete(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(id, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'No tienes acceso a este documento' },
        });
      }

      // Obtener el documento para saber el workspace
      const document = await documentService.getDocumentById(id);

      if (!document) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Documento no encontrado' },
        });
      }

      // Verificar si el usuario es el creador del documento o OWNER/ADMIN del workspace
      const isCreator = document.createdBy === userId;

      if (!isCreator) {
        // Si no es el creador, verificar rol en el workspace
        const { pool } = await import('../lib/db');
        const roleResult = await pool.query(
          `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
          [document.workspaceId, userId]
        );

        if (roleResult.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: { code: 'ACCESS_DENIED', message: 'No eres miembro de este workspace' },
          });
        }

        const userRole = roleResult.rows[0].role;

        if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message:
                'Solo el creador del documento o ADMIN/OWNER del workspace pueden eliminar documentos',
            },
          });
        }
      }

      await documentService.deleteDocument(id, userId);

      return res.json({
        success: true,
        data: { message: 'Documento eliminado exitosamente' },
      });
    } catch (error: any) {
      console.error('[DocumentController] Delete error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * POST /api/documents/:id/versions
   * Create version
   */
  async createVersion(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { description } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(id, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'No tienes acceso a este documento' },
        });
      }

      const version = await documentService.createVersion(id, userId, { description });

      return res.status(201).json({
        success: true,
        data: { version },
      });
    } catch (error: any) {
      console.error('[DocumentController] CreateVersion error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/documents/:id/versions
   * Get versions
   */
  async getVersions(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(id, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'No tienes acceso a este documento' },
        });
      }

      const versions = await documentService.getVersions(id);

      return res.json({
        success: true,
        data: { versions },
      });
    } catch (error) {
      console.error('[DocumentController] GetVersions error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al obtener versiones' },
      });
    }
  }

  /**
   * POST /api/documents/:id/versions/:versionId/restore
   * Restore version
   */
  async restoreVersion(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id, versionId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
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

      const document = await documentService.restoreVersion(id, versionId, userId);

      return res.json({
        success: true,
        data: { document },
      });
    } catch (error: any) {
      console.error('[DocumentController] RestoreVersion error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * PUT /api/documents/:id/permissions
   * Update permissions
   */
  async updatePermission(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(id, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'No tienes acceso a este documento' },
        });
      }

      // Check if user is document creator or workspace owner
      const document = await documentService.getDocumentById(id);
      const workspaceId = document?.workspaceId;

      if (!workspaceId) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Documento no encontrado' },
        });
      }

      const workspaceMemberResult = await documentService.checkUserIsOwnerOrCreator(
        id,
        userId,
        workspaceId
      );

      if (!workspaceMemberResult) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message:
              'Solo el creador del documento o el propietario del workspace pueden modificar permisos',
          },
        });
      }

      const validation = updatePermissionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: validation.error.errors,
          },
        });
      }

      await documentService.updatePermission(
        id,
        validation.data.userId,
        validation.data.permission,
        userId
      );

      return res.json({
        success: true,
        data: { message: 'Permiso actualizado exitosamente' },
      });
    } catch (error) {
      console.error('[DocumentController] UpdatePermission error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al actualizar permiso' },
      });
    }
  }

  /**
   * GET /api/documents/:id/members
   * Get workspace members with their permissions for this document
   */
  async getDocumentMembers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(id, userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'No tienes acceso a este documento' },
        });
      }

      const members = await documentService.getWorkspaceMembersWithPermissions(id);

      return res.json({
        success: true,
        data: { members },
      });
    } catch (error) {
      console.error('[DocumentController] GetDocumentMembers error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al obtener miembros' },
      });
    }
  }
}

export const documentController = new DocumentController();
