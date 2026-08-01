import type { Request, Response } from 'express';
import { activityLogService } from '../../services/ActivityLogService';

/** Project-scoped activity read model. Membership is enforced by the project router. */
export class ProjectActivityController {
  async list(req: Request, res: Response) {
    try {
      const projectId = req.params.id;
      const requestedLimit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      const requestedOffset = Number.parseInt(String(req.query.offset ?? '0'), 10);
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
      const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
      const result = await activityLogService.getProjectActivity(projectId, { limit, offset });

      return res.json({
        success: true,
        data: {
          events: result.entries,
          pagination: { total: result.total, limit, offset, hasMore: result.hasMore },
        },
      });
    } catch {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al obtener actividad del proyecto' } });
    }
  }
}

export const projectActivityController = new ProjectActivityController();
