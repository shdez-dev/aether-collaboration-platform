// apps/api/src/controllers/LabelController.ts

import { Request, Response } from 'express';
import { LabelService } from '../services/LabelService';
import { z } from 'zod';

// ==================== SCHEMAS DE VALIDACIÓN ====================

/**
 * Schema para crear un label
 */
const createLabelSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
});

/**
 * Schema para actualizar un label
 */
const updateLabelSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
    .optional(),
});

// ==================== CONTROLLER ====================

function requireUserId(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
    });
    return null;
  }
  return userId;
}

export class LabelController {
  /**
   * POST /api/workspaces/:workspaceId/labels
   * Crear un label en un workspace
   */
  static async createLabel(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const userId = requireUserId(req, res);
      if (!userId) return;

      // Validar body
      const validationResult = createLabelSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        });
      }

      const label = await LabelService.createLabel(workspaceId, userId, validationResult.data);
      if (!label) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workspace not found' },
        });
      }

      return res.status(201).json({
        success: true,
        data: { label },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/labels
   * Obtener todos los labels de un workspace
   */
  static async getWorkspaceLabels(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const userId = requireUserId(req, res);
      if (!userId) return;

      const labels = await LabelService.getWorkspaceLabels(workspaceId, userId);

      return res.status(200).json({
        success: true,
        data: { labels },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/labels/:id
   * Obtener un label por ID
   */
  static async getLabel(req: Request, res: Response) {
    try {
      const { labelId } = req.params;
      const userId = requireUserId(req, res);
      if (!userId) return;

      const label = await LabelService.getLabelById(labelId, userId);

      if (!label) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Label not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: { label },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * PUT /api/labels/:id
   * Actualizar un label
   */
  static async updateLabel(req: Request, res: Response) {
    try {
      const { labelId } = req.params;
      const userId = requireUserId(req, res);
      if (!userId) return;

      // Validar body
      const validationResult = updateLabelSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        });
      }

      const label = await LabelService.updateLabel(labelId, userId, validationResult.data);
      if (!label) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Label not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: { label },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * DELETE /api/labels/:id
   * Eliminar un label
   */
  static async deleteLabel(req: Request, res: Response) {
    try {
      const { labelId } = req.params;
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await LabelService.deleteLabel(labelId, userId);
      if (result === 'not_found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Label not found' },
        });
      }
      if (result === 'cross_workspace_association') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CROSS_WORKSPACE_ASSOCIATION',
            message: 'Label has an association outside its workspace and cannot be deleted yet',
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Label deleted successfully' },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }
}
