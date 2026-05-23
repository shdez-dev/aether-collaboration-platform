// apps/api/src/controllers/CalendarEventController.ts

import type { Request, Response } from 'express';
import { z } from 'zod';
import { calendarEventService } from '../services/CalendarEventService';

// ─── Schemas de validación ─────────────────────────────────────────────────────

const createSchema = z.object({
  title:       z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  startTime:   z.string().datetime({ offset: true }),
  endTime:     z.string().datetime({ offset: true }),
  allDay:      z.boolean().optional(),
  color:       z.string().max(50).optional(),
  type:        z.enum(['personal', 'workspace', 'team']),
  workspaceId: z.string().uuid().optional(),
  teamId:      z.string().uuid().optional(),
}).refine((d) => {
  if (d.type === 'workspace') return !!d.workspaceId;
  if (d.type === 'team')      return !!d.teamId;
  return true;
}, { message: 'workspaceId es requerido para tipo workspace, teamId para tipo team' });

const updateSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  startTime:   z.string().datetime({ offset: true }).optional(),
  endTime:     z.string().datetime({ offset: true }).optional(),
  allDay:      z.boolean().optional(),
  color:       z.string().max(50).optional(),
});

const querySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to:   z.string().datetime({ offset: true }).optional(),
});

// ─── Controller ───────────────────────────────────────────────────────────────

class CalendarEventController {

  // POST /api/events
  async create(req: Request, res: Response) {
    const userId   = (req as any).user?.id as string;
    const userName = (req as any).user?.name as string ?? 'Usuario';

    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'No autenticado' } });
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Datos inválidos', details: parsed.error.errors },
      });
    }

    try {
      const event = await calendarEventService.create(userId, userName, parsed.data);
      return res.status(201).json({ success: true, data: { event } });
    } catch (error: any) {
      console.error('[CalendarEventController.create]', error);
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // GET /api/events/me
  async getMyEvents(req: Request, res: Response) {
    const userId = (req as any).user?.id as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'No autenticado' } });
    }

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parámetros inválidos', details: parsed.error.errors },
      });
    }

    try {
      const events = await calendarEventService.getForUser(userId, parsed.data.from, parsed.data.to);
      return res.json({ success: true, data: { events } });
    } catch (error: any) {
      console.error('[CalendarEventController.getMyEvents]', error);
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // GET /api/events/:id
  async getById(req: Request, res: Response) {
    const userId  = (req as any).user?.id as string;
    const eventId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'No autenticado' } });
    }

    try {
      const event = await calendarEventService.getById(eventId, userId);
      if (!event) {
        return res.status(404).json({ success: false, error: { message: 'Evento no encontrado' } });
      }
      return res.json({ success: true, data: { event } });
    } catch (error: any) {
      console.error('[CalendarEventController.getById]', error);
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // PATCH /api/events/:id
  async update(req: Request, res: Response) {
    const userId  = (req as any).user?.id as string;
    const eventId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'No autenticado' } });
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Datos inválidos', details: parsed.error.errors },
      });
    }

    try {
      const event = await calendarEventService.update(eventId, userId, parsed.data);
      if (!event) {
        return res.status(404).json({ success: false, error: { message: 'Evento no encontrado o sin permisos' } });
      }
      return res.json({ success: true, data: { event } });
    } catch (error: any) {
      console.error('[CalendarEventController.update]', error);
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }

  // DELETE /api/events/:id
  async delete(req: Request, res: Response) {
    const userId  = (req as any).user?.id as string;
    const eventId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'No autenticado' } });
    }

    try {
      const deleted = await calendarEventService.delete(eventId, userId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: { message: 'Evento no encontrado o sin permisos' } });
      }
      return res.json({ success: true, data: { message: 'Evento eliminado' } });
    } catch (error: any) {
      console.error('[CalendarEventController.delete]', error);
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
}

export const calendarEventController = new CalendarEventController();
