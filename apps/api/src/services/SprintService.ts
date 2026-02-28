// apps/api/src/services/SprintService.ts

import { pool } from '../lib/db';
import type { Sprint, Milestone } from '@aether/types';

function mapSprint(row: any): Sprint {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    goal: row.goal ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    position: row.position,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMilestone(row: any): Milestone {
  return {
    id: row.id,
    boardId: row.board_id,
    sprintId: row.sprint_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    date: row.date,
    color: row.color,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class SprintService {
  // ── Sprints ────────────────────────────────────────────────────────────────

  static async getBoardSprints(boardId: string): Promise<Sprint[]> {
    const r = await pool.query(
      `SELECT s.*,
        COALESCE(
          (SELECT json_agg(
            jsonb_build_object(
              'id', c.id, 'title', c.title, 'completed', c.completed,
              'priority', c.priority, 'startDate', c.start_date, 'dueDate', c.due_date,
              'listId', c.list_id, 'position', c.position
            ) ORDER BY c.position
          )
          FROM sprint_cards sc
          JOIN cards c ON sc.card_id = c.id
          WHERE sc.sprint_id = s.id
          ), '[]'::json
        ) as cards
       FROM board_sprints s
       WHERE s.board_id = $1
       ORDER BY s.position ASC, s.start_date ASC`,
      [boardId]
    );
    return r.rows.map((row) => ({ ...mapSprint(row), cards: row.cards }));
  }

  static async createSprint(
    boardId: string,
    userId: string,
    data: { name: string; goal?: string; startDate: string; endDate: string; status?: string }
  ): Promise<Sprint> {
    // Calcular siguiente posición
    const posRes = await pool.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM board_sprints WHERE board_id = $1`,
      [boardId]
    );
    const position = posRes.rows[0].next_pos;

    const r = await pool.query(
      `INSERT INTO board_sprints (board_id, name, goal, start_date, end_date, status, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        boardId,
        data.name,
        data.goal ?? null,
        data.startDate,
        data.endDate,
        data.status ?? 'PLANNED',
        position,
        userId,
      ]
    );
    return mapSprint(r.rows[0]);
  }

  static async updateSprint(
    sprintId: string,
    data: Partial<{
      name: string;
      goal: string;
      startDate: string;
      endDate: string;
      status: string;
      position: number;
    }>
  ): Promise<Sprint> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.goal !== undefined) {
      fields.push(`goal = $${idx++}`);
      values.push(data.goal);
    }
    if (data.startDate !== undefined) {
      fields.push(`start_date = $${idx++}`);
      values.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      fields.push(`end_date = $${idx++}`);
      values.push(data.endDate);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.position !== undefined) {
      fields.push(`position = $${idx++}`);
      values.push(data.position);
    }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(sprintId);
    const r = await pool.query(
      `UPDATE board_sprints SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (r.rows.length === 0) throw new Error('Sprint not found');
    return mapSprint(r.rows[0]);
  }

  static async deleteSprint(sprintId: string): Promise<void> {
    const r = await pool.query(`DELETE FROM board_sprints WHERE id = $1 RETURNING id`, [sprintId]);
    if (r.rows.length === 0) throw new Error('Sprint not found');
  }

  // ── Cards de un sprint ────────────────────────────────────────────────────

  static async addCardToSprint(sprintId: string, cardId: string, userId: string): Promise<void> {
    await pool.query(
      `INSERT INTO sprint_cards (sprint_id, card_id, added_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (sprint_id, card_id) DO NOTHING`,
      [sprintId, cardId, userId]
    );
  }

  static async removeCardFromSprint(sprintId: string, cardId: string): Promise<void> {
    await pool.query(`DELETE FROM sprint_cards WHERE sprint_id = $1 AND card_id = $2`, [
      sprintId,
      cardId,
    ]);
  }

  // ── Hitos ──────────────────────────────────────────────────────────────────

  static async getBoardMilestones(boardId: string): Promise<Milestone[]> {
    const r = await pool.query(
      `SELECT * FROM board_milestones WHERE board_id = $1 ORDER BY date ASC`,
      [boardId]
    );
    return r.rows.map(mapMilestone);
  }

  static async createMilestone(
    boardId: string,
    userId: string,
    data: { name: string; date: string; description?: string; color?: string; sprintId?: string }
  ): Promise<Milestone> {
    const r = await pool.query(
      `INSERT INTO board_milestones (board_id, sprint_id, name, description, date, color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        boardId,
        data.sprintId ?? null,
        data.name,
        data.description ?? null,
        data.date,
        data.color ?? '#f59e0b',
        userId,
      ]
    );
    return mapMilestone(r.rows[0]);
  }

  static async updateMilestone(
    milestoneId: string,
    data: Partial<{
      name: string;
      description: string;
      date: string;
      color: string;
      sprintId: string | null;
    }>
  ): Promise<Milestone> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.date !== undefined) {
      fields.push(`date = $${idx++}`);
      values.push(data.date);
    }
    if (data.color !== undefined) {
      fields.push(`color = $${idx++}`);
      values.push(data.color);
    }
    if ('sprintId' in data) {
      fields.push(`sprint_id = $${idx++}`);
      values.push(data.sprintId);
    }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(milestoneId);
    const r = await pool.query(
      `UPDATE board_milestones SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (r.rows.length === 0) throw new Error('Milestone not found');
    return mapMilestone(r.rows[0]);
  }

  static async deleteMilestone(milestoneId: string): Promise<void> {
    const r = await pool.query(`DELETE FROM board_milestones WHERE id = $1 RETURNING id`, [
      milestoneId,
    ]);
    if (r.rows.length === 0) throw new Error('Milestone not found');
  }
}
