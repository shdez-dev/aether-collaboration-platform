import { Request, Response } from 'express';
import { z } from 'zod';
import { activityLogService } from '../services/ActivityLogService';
import { pool } from '../lib/db';
import type { EventType } from '@aether/types';

// Validation schema
const getActivityLogSchema = z.object({
  // eventTypes puede venir como string separado por comas o como array
  eventTypes: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      if (typeof val === 'string') {
        // Si es un string, dividir por comas y filtrar vacíos
        return val.split(',').filter((v) => v.trim().length > 0);
      }
      return val;
    }),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  boardId: z.string().optional(),
  userId: z.string().optional(),
});

export class ActivityLogController {
  /**
   * GET /api/workspaces/:id/activity
   * Get activity log for a workspace with filters
   */
  async getWorkspaceActivity(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;
      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { id: workspaceId } = req.params;

      // Verify user has access to this workspace
      const memberCheck = await pool.query(
        'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, requestingUserId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this workspace' },
        });
      }

      // Validate query parameters
      const validated = getActivityLogSchema.parse(req.query);

      // Parse filters
      const filters: any = {
        workspaceId,
        limit: validated.limit ? parseInt(validated.limit) : 50,
        offset: validated.offset ? parseInt(validated.offset) : 0,
      };

      if (validated.eventTypes && validated.eventTypes.length > 0) {
        filters.eventTypes = validated.eventTypes as EventType[];
      }

      if (validated.startDate) {
        filters.startDate = new Date(validated.startDate);
      }

      if (validated.endDate) {
        filters.endDate = new Date(validated.endDate);
      }

      if (validated.boardId) {
        filters.boardId = validated.boardId;
      }

      if (validated.userId) {
        filters.userId = validated.userId;
      }

      // Get activity log
      const result = await activityLogService.getActivityLog(filters);

      return res.json({
        success: true,
        data: {
          events: result.entries,
          pagination: {
            total: result.total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: result.hasMore,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
        });
      }

      console.error('[ActivityLogController] GetWorkspaceActivity error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get activity log' },
      });
    }
  }

  /**
   * GET /api/workspaces/:id/activity/stats
   * Get activity statistics for a workspace
   */
  async getWorkspaceActivityStats(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;
      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { id: workspaceId } = req.params;
      const { days } = req.query;

      // Verify user has access to this workspace
      const memberCheck = await pool.query(
        'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, requestingUserId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this workspace' },
        });
      }

      const daysNum = days ? parseInt(days as string) : 30;
      const stats = await activityLogService.getActivityStats(workspaceId, daysNum);

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[ActivityLogController] GetWorkspaceActivityStats error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get activity stats' },
      });
    }
  }

  /**
   * GET /api/activity/categories
   * Get available event categories for filtering
   */
  async getEventCategories(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;
      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const categories = activityLogService.getEventCategories();

      return res.json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      console.error('[ActivityLogController] GetEventCategories error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get event categories' },
      });
    }
  }
}

export const activityLogController = new ActivityLogController();
