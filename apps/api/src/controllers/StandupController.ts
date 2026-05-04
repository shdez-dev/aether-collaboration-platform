// apps/api/src/controllers/StandupController.ts

import { Request, Response } from 'express';
import { standupService } from '../services/StandupService';
import { pool } from '../lib/db';

export class StandupController {
  /**
   * GET /api/users/me/standup?workspaceId=xxx
   * Obtener el standup de hoy del usuario autenticado
   */
  async getTodayStandup(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
      return;
    }

    const { workspaceId } = req.query;
    if (!workspaceId || typeof workspaceId !== 'string') {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'workspaceId requerido' } });
      return;
    }

    const membership = await pool.query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (membership.rows.length === 0) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Sin acceso al workspace' } });
      return;
    }

    const standup = await standupService.getTodayStandup(userId, workspaceId);
    res.json({ success: true, data: standup });
  }

  /**
   * PUT /api/users/me/standup
   * Crear o actualizar el borrador del standup de hoy
   */
  async upsertStandup(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
      return;
    }

    const { workspaceId, yesterdayItems, todayItems, blockers } = req.body;
    if (!workspaceId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'workspaceId requerido' } });
      return;
    }

    const membership = await pool.query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (membership.rows.length === 0) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Sin acceso al workspace' } });
      return;
    }

    const standup = await standupService.upsertStandup(userId, workspaceId, {
      yesterdayItems: Array.isArray(yesterdayItems) ? yesterdayItems : [],
      todayItems: Array.isArray(todayItems) ? todayItems : [],
      blockers: Array.isArray(blockers) ? blockers : [],
    });

    res.json({ success: true, data: standup });
  }

  /**
   * POST /api/users/me/standup/publish
   * Publicar el standup de hoy
   */
  async publishStandup(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } });
      return;
    }

    const { workspaceId } = req.body;
    if (!workspaceId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'workspaceId requerido' } });
      return;
    }

    const membership = await pool.query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (membership.rows.length === 0) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Sin acceso al workspace' } });
      return;
    }

    const standup = await standupService.publishStandup(userId, workspaceId);
    if (!standup) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No hay standup guardado para hoy. Guarda primero el borrador.' },
      });
      return;
    }

    res.json({ success: true, data: standup });
  }
}

export const standupController = new StandupController();
