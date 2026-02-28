// apps/api/src/controllers/SprintController.ts

import { Response } from 'express';
import { z } from 'zod';
import { SprintService } from '../services/SprintService';
import { WorkspaceRequest } from '../middleware/workspace';

const createSprintSchema = z.object({
  name: z.string().min(1).max(255),
  goal: z.string().max(1000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).optional(),
});

const updateSprintSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  goal: z.string().max(1000).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).optional(),
  position: z.number().int().optional(),
});

const createMilestoneSchema = z.object({
  name: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(1000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  sprintId: z.string().uuid().optional(),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().max(1000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  sprintId: z.string().uuid().nullable().optional(),
});

function canEdit(role?: string) {
  return role === 'ADMIN' || role === 'OWNER';
}

export class SprintController {
  // ── Sprints ────────────────────────────────────────────────────────────────

  static async getSprints(req: WorkspaceRequest, res: Response) {
    try {
      const { boardId } = req.params;
      const sprints = await SprintService.getBoardSprints(boardId);
      return res.json({ success: true, data: { sprints } });
    } catch (e: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async createSprint(req: WorkspaceRequest, res: Response) {
    try {
      const { boardId } = req.params;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
      if (!canEdit(req.workspace?.role))
        return res
          .status(403)
          .json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } });

      const v = createSprintSchema.safeParse(req.body);
      if (!v.success)
        return res
          .status(400)
          .json({ success: false, error: { code: 'VALIDATION_ERROR', details: v.error.errors } });

      const sprint = await SprintService.createSprint(boardId, userId, v.data);
      return res.status(201).json({ success: true, data: { sprint } });
    } catch (e: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async updateSprint(req: WorkspaceRequest, res: Response) {
    try {
      const { sprintId } = req.params;
      if (!canEdit(req.workspace?.role))
        return res
          .status(403)
          .json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } });

      const v = updateSprintSchema.safeParse(req.body);
      if (!v.success)
        return res
          .status(400)
          .json({ success: false, error: { code: 'VALIDATION_ERROR', details: v.error.errors } });

      const sprint = await SprintService.updateSprint(sprintId, v.data);
      return res.json({ success: true, data: { sprint } });
    } catch (e: any) {
      if (e.message === 'Sprint not found')
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async deleteSprint(req: WorkspaceRequest, res: Response) {
    try {
      const { sprintId } = req.params;
      if (!canEdit(req.workspace?.role))
        return res
          .status(403)
          .json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } });
      await SprintService.deleteSprint(sprintId);
      return res.json({ success: true, data: { message: 'Sprint eliminado' } });
    } catch (e: any) {
      if (e.message === 'Sprint not found')
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async addCardToSprint(req: WorkspaceRequest, res: Response) {
    try {
      const { sprintId } = req.params;
      const { cardId } = req.body;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
      if (!cardId)
        return res
          .status(400)
          .json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'cardId requerido' },
          });
      await SprintService.addCardToSprint(sprintId, cardId, userId);
      return res.json({ success: true, data: { message: 'Card añadida al sprint' } });
    } catch (e: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async removeCardFromSprint(req: WorkspaceRequest, res: Response) {
    try {
      const { sprintId, cardId } = req.params;
      await SprintService.removeCardFromSprint(sprintId, cardId);
      return res.json({ success: true, data: { message: 'Card eliminada del sprint' } });
    } catch (e: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  // ── Hitos ──────────────────────────────────────────────────────────────────

  static async getMilestones(req: WorkspaceRequest, res: Response) {
    try {
      const { boardId } = req.params;
      const milestones = await SprintService.getBoardMilestones(boardId);
      return res.json({ success: true, data: { milestones } });
    } catch (e: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async createMilestone(req: WorkspaceRequest, res: Response) {
    try {
      const { boardId } = req.params;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
      if (!canEdit(req.workspace?.role))
        return res
          .status(403)
          .json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } });

      const v = createMilestoneSchema.safeParse(req.body);
      if (!v.success)
        return res
          .status(400)
          .json({ success: false, error: { code: 'VALIDATION_ERROR', details: v.error.errors } });

      const milestone = await SprintService.createMilestone(boardId, userId, v.data);
      return res.status(201).json({ success: true, data: { milestone } });
    } catch (e: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async updateMilestone(req: WorkspaceRequest, res: Response) {
    try {
      const { milestoneId } = req.params;
      if (!canEdit(req.workspace?.role))
        return res
          .status(403)
          .json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } });

      const v = updateMilestoneSchema.safeParse(req.body);
      if (!v.success)
        return res
          .status(400)
          .json({ success: false, error: { code: 'VALIDATION_ERROR', details: v.error.errors } });

      const milestone = await SprintService.updateMilestone(milestoneId, v.data as any);
      return res.json({ success: true, data: { milestone } });
    } catch (e: any) {
      if (e.message === 'Milestone not found')
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }

  static async deleteMilestone(req: WorkspaceRequest, res: Response) {
    try {
      const { milestoneId } = req.params;
      if (!canEdit(req.workspace?.role))
        return res
          .status(403)
          .json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } });
      await SprintService.deleteMilestone(milestoneId);
      return res.json({ success: true, data: { message: 'Hito eliminado' } });
    } catch (e: any) {
      if (e.message === 'Milestone not found')
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
    }
  }
}
