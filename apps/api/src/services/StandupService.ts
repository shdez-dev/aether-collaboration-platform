// apps/api/src/services/StandupService.ts

import { pool } from '../lib/db';

export interface StandupItem {
  id: string;
  text: string;
}

export interface Standup {
  id: string;
  userId: string;
  workspaceId: string;
  date: string;
  yesterdayItems: StandupItem[];
  todayItems: StandupItem[];
  blockers: StandupItem[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class StandupService {
  async getTodayStandup(userId: string, workspaceId: string): Promise<Standup | null> {
    const result = await pool.query(
      `SELECT * FROM standups WHERE user_id = $1 AND workspace_id = $2 AND date = CURRENT_DATE`,
      [userId, workspaceId]
    );
    if (result.rows.length === 0) return null;
    return this.format(result.rows[0]);
  }

  async upsertStandup(
    userId: string,
    workspaceId: string,
    data: {
      yesterdayItems?: StandupItem[];
      todayItems?: StandupItem[];
      blockers?: StandupItem[];
    }
  ): Promise<Standup> {
    const result = await pool.query(
      `INSERT INTO standups (id, user_id, workspace_id, date, yesterday_items, today_items, blockers, updated_at)
       VALUES (uuid_generate_v4(), $1, $2, CURRENT_DATE, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, workspace_id, date) DO UPDATE
         SET yesterday_items = EXCLUDED.yesterday_items,
             today_items     = EXCLUDED.today_items,
             blockers        = EXCLUDED.blockers,
             updated_at      = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        workspaceId,
        JSON.stringify(data.yesterdayItems ?? []),
        JSON.stringify(data.todayItems ?? []),
        JSON.stringify(data.blockers ?? []),
      ]
    );
    return this.format(result.rows[0]);
  }

  async publishStandup(userId: string, workspaceId: string): Promise<Standup | null> {
    const result = await pool.query(
      `UPDATE standups
       SET published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND workspace_id = $2 AND date = CURRENT_DATE
       RETURNING *`,
      [userId, workspaceId]
    );
    if (result.rows.length === 0) return null;
    return this.format(result.rows[0]);
  }

  private format(row: any): Standup {
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      date: typeof row.date === 'string' ? row.date : row.date?.toISOString?.().split('T')[0] ?? '',
      yesterdayItems: row.yesterday_items ?? [],
      todayItems: row.today_items ?? [],
      blockers: row.blockers ?? [],
      publishedAt: row.published_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const standupService = new StandupService();
