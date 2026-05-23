// apps/api/src/services/CalendarEventService.ts

import { pool } from '../lib/db';
import { notificationRepository } from '../repositories/NotificationRepository';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id:          string;
  title:       string;
  description: string | null;
  startTime:   string;
  endTime:     string;
  allDay:      boolean;
  color:       string;
  type:        'personal' | 'workspace' | 'team';
  workspaceId: string | null;
  teamId:      string | null;
  createdBy:   string;
  createdAt:   string;
  updatedAt:   string;
  attendees:   Attendee[];
}

export interface Attendee {
  id:     string;
  name:   string;
  avatar: string | null;
}

export interface CreateCalendarEventInput {
  title:       string;
  description?: string;
  startTime:   string;
  endTime:     string;
  allDay?:     boolean;
  color?:      string;
  type:        'personal' | 'workspace' | 'team';
  workspaceId?: string;
  teamId?:     string;
}

export interface UpdateCalendarEventInput {
  title?:       string;
  description?: string | null;
  startTime?:   string;
  endTime?:     string;
  allDay?:      boolean;
  color?:       string;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapEvent(row: any, attendees: Attendee[] = []): CalendarEvent {
  return {
    id:          row.id,
    title:       row.title,
    description: row.description ?? null,
    startTime:   new Date(row.start_time).toISOString(),
    endTime:     new Date(row.end_time).toISOString(),
    allDay:      row.all_day,
    color:       row.color,
    type:        row.type,
    workspaceId: row.workspace_id ?? null,
    teamId:      row.team_id ?? null,
    createdBy:   row.created_by,
    createdAt:   new Date(row.created_at).toISOString(),
    updatedAt:   new Date(row.updated_at).toISOString(),
    attendees,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CalendarEventService {

  // ── Crear evento ────────────────────────────────────────────────────────────
  async create(userId: string, userName: string, input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insertar evento
      const evResult = await client.query(
        `INSERT INTO calendar_events
           (title, description, start_time, end_time, all_day, color, type, workspace_id, team_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.title,
          input.description ?? null,
          input.startTime,
          input.endTime,
          input.allDay ?? false,
          input.color ?? '#5ec5ff',
          input.type,
          input.workspaceId ?? null,
          input.teamId ?? null,
          userId,
        ]
      );
      const event = evResult.rows[0];

      // 2. Resolver asistentes según el tipo
      let memberIds: string[] = [];

      if (input.type === 'workspace' && input.workspaceId) {
        const membersResult = await client.query(
          `SELECT user_id FROM workspace_members WHERE workspace_id = $1`,
          [input.workspaceId]
        );
        memberIds = membersResult.rows.map((r: any) => r.user_id as string);
      } else if (input.type === 'team' && input.teamId) {
        const membersResult = await client.query(
          `SELECT user_id FROM team_members WHERE team_id = $1`,
          [input.teamId]
        );
        memberIds = membersResult.rows.map((r: any) => r.user_id as string);
      }

      // 3. Siempre incluir al creador como asistente
      const allAttendeeIds = Array.from(new Set([userId, ...memberIds]));

      for (const attendeeId of allAttendeeIds) {
        await client.query(
          `INSERT INTO calendar_event_attendees (event_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (event_id, user_id) DO NOTHING`,
          [event.id, attendeeId]
        );
      }

      await client.query('COMMIT');

      // 4. Leer asistentes con sus datos para la respuesta
      const attendees = await this._getAttendees(event.id);

      // 5. Enviar notificaciones a los demás miembros (fuera de la transacción)
      if (memberIds.length > 0) {
        const otherMembers = memberIds.filter((id) => id !== userId);
        await this._notifyAttendees({
          eventId:      event.id,
          eventTitle:   event.title,
          startTime:    new Date(event.start_time),
          type:         input.type,
          creatorId:    userId,
          creatorName:  userName,
          attendeeIds:  otherMembers,
          workspaceId:  input.workspaceId,
          teamId:       input.teamId,
        });
      }

      return mapEvent(event, attendees);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ── Obtener eventos del usuario ─────────────────────────────────────────────
  async getForUser(userId: string, from?: string, to?: string): Promise<CalendarEvent[]> {
    let query = `
      SELECT DISTINCT ce.*
      FROM calendar_events ce
      INNER JOIN calendar_event_attendees cea ON cea.event_id = ce.id
      WHERE cea.user_id = $1
    `;
    const params: any[] = [userId];

    if (from) {
      params.push(from);
      query += ` AND ce.start_time >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND ce.end_time <= $${params.length}`;
    }

    query += ` ORDER BY ce.start_time ASC`;

    const result = await pool.query(query, params);

    // Cargar asistentes de todos los eventos en una sola query
    if (result.rows.length === 0) return [];

    const eventIds = result.rows.map((r: any) => r.id);
    const attendeesResult = await pool.query(
      `SELECT cea.event_id, u.id, u.name, u.avatar
       FROM calendar_event_attendees cea
       INNER JOIN users u ON u.id = cea.user_id
       WHERE cea.event_id = ANY($1)`,
      [eventIds]
    );

    const attendeesByEvent = new Map<string, Attendee[]>();
    for (const row of attendeesResult.rows) {
      if (!attendeesByEvent.has(row.event_id)) attendeesByEvent.set(row.event_id, []);
      attendeesByEvent.get(row.event_id)!.push({ id: row.id, name: row.name, avatar: row.avatar });
    }

    return result.rows.map((row: any) => mapEvent(row, attendeesByEvent.get(row.id) ?? []));
  }

  // ── Obtener un evento por ID ─────────────────────────────────────────────────
  async getById(eventId: string, userId: string): Promise<CalendarEvent | null> {
    const result = await pool.query(
      `SELECT ce.*
       FROM calendar_events ce
       INNER JOIN calendar_event_attendees cea ON cea.event_id = ce.id
       WHERE ce.id = $1 AND cea.user_id = $2`,
      [eventId, userId]
    );
    if (!result.rows.length) return null;

    const attendees = await this._getAttendees(eventId);
    return mapEvent(result.rows[0], attendees);
  }

  // ── Actualizar evento ────────────────────────────────────────────────────────
  async update(eventId: string, userId: string, input: UpdateCalendarEventInput): Promise<CalendarEvent | null> {
    // Solo el creador puede editar
    const check = await pool.query(
      `SELECT id FROM calendar_events WHERE id = $1 AND created_by = $2`,
      [eventId, userId]
    );
    if (!check.rows.length) return null;

    const fields: string[] = [];
    const params: any[]    = [];
    let idx = 1;

    if (input.title       !== undefined) { fields.push(`title = $${idx++}`);       params.push(input.title); }
    if (input.description !== undefined) { fields.push(`description = $${idx++}`); params.push(input.description); }
    if (input.startTime   !== undefined) { fields.push(`start_time = $${idx++}`);  params.push(input.startTime); }
    if (input.endTime     !== undefined) { fields.push(`end_time = $${idx++}`);    params.push(input.endTime); }
    if (input.allDay      !== undefined) { fields.push(`all_day = $${idx++}`);     params.push(input.allDay); }
    if (input.color       !== undefined) { fields.push(`color = $${idx++}`);       params.push(input.color); }

    if (fields.length === 0) return this.getById(eventId, userId);

    fields.push(`updated_at = NOW()`);
    params.push(eventId);

    const result = await pool.query(
      `UPDATE calendar_events SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    const attendees = await this._getAttendees(eventId);
    return mapEvent(result.rows[0], attendees);
  }

  // ── Eliminar evento ──────────────────────────────────────────────────────────
  async delete(eventId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM calendar_events WHERE id = $1 AND created_by = $2 RETURNING id`,
      [eventId, userId]
    );
    return result.rows.length > 0;
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private async _getAttendees(eventId: string): Promise<Attendee[]> {
    const result = await pool.query(
      `SELECT u.id, u.name, u.avatar
       FROM calendar_event_attendees cea
       INNER JOIN users u ON u.id = cea.user_id
       WHERE cea.event_id = $1`,
      [eventId]
    );
    return result.rows.map((r: any) => ({ id: r.id, name: r.name, avatar: r.avatar }));
  }

  private async _notifyAttendees(data: {
    eventId:     string;
    eventTitle:  string;
    startTime:   Date;
    type:        'personal' | 'workspace' | 'team';
    creatorId:   string;
    creatorName: string;
    attendeeIds: string[];
    workspaceId?: string;
    teamId?:     string;
  }): Promise<void> {
    const dateStr = data.startTime.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const timeStr = data.startTime.toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit',
    });

    for (const attendeeId of data.attendeeIds) {
      try {
        await notificationRepository.create({
          userId:  attendeeId,
          type:    'CALENDAR_EVENT_INVITE' as any,
          title:   'Nuevo evento en tu calendario',
          message: `${data.creatorName} te agendó "${data.eventTitle}" para el ${dateStr} a las ${timeStr}`,
          data: {
            eventId:     data.eventId,
            eventTitle:  data.eventTitle,
            creatorId:   data.creatorId,
            creatorName: data.creatorName,
            ...(data.workspaceId && { workspaceId: data.workspaceId }),
            ...(data.teamId      && { teamId:      data.teamId }),
          },
        });
      } catch (_) {
        // Silencioso — no bloquear la creación del evento
      }
    }
  }
}

export const calendarEventService = new CalendarEventService();
