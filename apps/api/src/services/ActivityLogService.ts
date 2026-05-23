import { pool } from '../lib/db';
import type { EventType } from '@aether/types';

export interface ActivityLogFilters {
  workspaceId?: string;
  boardId?: string;
  userId?: string;
  eventTypes?: EventType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityLogEntry {
  id: string;
  eventType: EventType;
  payload: any;
  delta?: any;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: number;
  createdAt: Date;
  // Enriched data
  targetName?: string;
  targetType?: string;
  targetId?: string;
  workspaceId?: string;
  workspaceName?: string;
  boardId?: string;
  boardName?: string;
}

// Excluded noisy event types
const EXCLUDED_EVENTS = [
  'presence.cursor.moved',
  'presence.user.typing',
  'presence.user.typing.stopped',
  'document.cursor.moved',
  'document.selection.changed',
];

export class ActivityLogService {
  /**
   * Get activity log with filters (events table v2 schema)
   */
  async getActivityLog(filters: ActivityLogFilters): Promise<{
    entries: ActivityLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      workspaceId,
      boardId,
      userId,
      eventTypes,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (workspaceId) {
      conditions.push(`e.workspace_id = $${paramIndex}`);
      params.push(workspaceId);
      paramIndex++;
    }

    if (boardId) {
      conditions.push(`e.board_id = $${paramIndex}`);
      params.push(boardId);
      paramIndex++;
    }

    if (userId) {
      conditions.push(`e.actor_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (eventTypes && eventTypes.length > 0) {
      conditions.push(`e.type = ANY($${paramIndex}::text[])`);
      params.push(eventTypes);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`e.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`e.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    conditions.push(`e.type != ALL($${paramIndex}::text[])`);
    params.push(EXCLUDED_EVENTS);
    paramIndex++;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM events e ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query
    const dataParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT
        e.id,
        e.type         AS event_type,
        e.payload,
        e.delta,
        e.actor_id     AS user_id,
        e.actor_name   AS user_name,
        e.timestamp,
        e.created_at,
        e.workspace_id,
        e.board_id,
        e.subject_type,
        e.subject_id,
        e.subject_name
       FROM events e
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    // Build entries — no extra per-row queries needed since columns are top-level
    const workspaceNameCache = new Map<string, string>();
    const boardNameCache = new Map<string, string>();

    const entries: ActivityLogEntry[] = await Promise.all(
      result.rows.map(async (row) => {
        const entry: ActivityLogEntry = {
          id: row.id,
          eventType: row.event_type as EventType,
          payload: row.payload ?? {},
          delta: row.delta,
          userId: row.user_id,
          userName: row.user_name,
          timestamp: typeof row.timestamp === 'bigint' ? Number(row.timestamp) : parseInt(row.timestamp),
          createdAt: row.created_at,
          targetType: row.subject_type,
          targetId: row.subject_id,
          targetName: row.subject_name,
          workspaceId: row.workspace_id ?? undefined,
          boardId: row.board_id ?? undefined,
        };

        // Resolve workspace name (cached)
        if (row.workspace_id) {
          if (!workspaceNameCache.has(row.workspace_id)) {
            try {
              const r = await pool.query('SELECT name FROM workspaces WHERE id = $1', [row.workspace_id]);
              workspaceNameCache.set(row.workspace_id, r.rows[0]?.name ?? '');
            } catch { workspaceNameCache.set(row.workspace_id, ''); }
          }
          entry.workspaceName = workspaceNameCache.get(row.workspace_id);
        }

        // Resolve board name (cached)
        if (row.board_id) {
          if (!boardNameCache.has(row.board_id)) {
            try {
              const r = await pool.query('SELECT name FROM boards WHERE id = $1', [row.board_id]);
              boardNameCache.set(row.board_id, r.rows[0]?.name ?? '');
            } catch { boardNameCache.set(row.board_id, ''); }
          }
          entry.boardName = boardNameCache.get(row.board_id);
        }

        return entry;
      })
    );

    return { entries, total, hasMore: offset + limit < total };
  }

  /**
   * Get activity summary/stats for a workspace (events table v2 schema)
   */
  async getActivityStats(
    workspaceId: string,
    days: number = 30
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    topContributors: Array<{ userId: string; userName: string; count: number }>;
    recentActivity: Array<{ date: string; count: number }>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalResult, typeResult, contributorsResult, activityResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total FROM events WHERE workspace_id = $1 AND created_at >= $2`,
        [workspaceId, since]
      ),
      pool.query(
        `SELECT type as event_type, COUNT(*) as count
         FROM events
         WHERE workspace_id = $1 AND created_at >= $2
         GROUP BY type ORDER BY count DESC`,
        [workspaceId, since]
      ),
      pool.query(
        `SELECT actor_id as user_id, actor_name as user_name, COUNT(*) as count
         FROM events
         WHERE workspace_id = $1 AND created_at >= $2
         GROUP BY actor_id, actor_name ORDER BY count DESC LIMIT 5`,
        [workspaceId, since]
      ),
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM events
         WHERE workspace_id = $1 AND created_at >= $2
         GROUP BY DATE(created_at) ORDER BY date DESC`,
        [workspaceId, since]
      ),
    ]);

    const eventsByType: Record<string, number> = {};
    typeResult.rows.forEach((row) => {
      eventsByType[row.event_type] = parseInt(row.count);
    });

    return {
      totalEvents: parseInt(totalResult.rows[0]?.total || '0'),
      eventsByType,
      topContributors: contributorsResult.rows.map((row) => ({
        userId: row.user_id,
        userName: row.user_name,
        count: parseInt(row.count),
      })),
      recentActivity: activityResult.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count),
      })),
    };
  }

  /**
   * Get event type categories for filtering
   */
  getEventCategories(): Record<string, EventType[]> {
    return {
      workspace: [
        'workspace.created',
        'workspace.updated',
        'workspace.deleted',
        'workspace.member.invited',
        'workspace.member.joined',
        'workspace.member.removed',
        'workspace.member.role-changed',
      ] as EventType[],
      board: [
        'board.created',
        'board.updated',
        'board.deleted',
        'board.archived',
        'board.restored',
      ] as EventType[],
      card: [
        'card.created',
        'card.updated',
        'card.deleted',
        'card.moved',
        'card.status-changed',
        'card.due-date.set',
        'card.due-date.removed',
        'card.priority.changed',
        'card.member.assigned',
        'card.member.removed',
        'card.label.added',
        'card.label.removed',
        'card.archived',
        'card.restored',
      ] as EventType[],
      document: [
        'document.created',
        'document.updated',
        'document.deleted',
        'document.version.saved',
        'document.version.restored',
        'document.exported',
      ] as EventType[],
      comment: [
        'comment.created',
        'comment.updated',
        'comment.deleted',
        'comment.mention-added',
      ] as EventType[],
    };
  }
}

export const activityLogService = new ActivityLogService();
