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

export class ActivityLogService {
  /**
   * Get activity log with filters
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

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by workspace - this requires joining with the payload
    if (workspaceId) {
      conditions.push(`(
        payload->>'workspaceId' = $${paramIndex}
        OR payload->>'workspace_id' = $${paramIndex}
      )`);
      params.push(workspaceId);
      paramIndex++;
    }

    // Filter by board
    if (boardId) {
      conditions.push(`(
        payload->>'boardId' = $${paramIndex}
        OR payload->>'board_id' = $${paramIndex}
      )`);
      params.push(boardId);
      paramIndex++;
    }

    // Filter by user
    if (userId) {
      conditions.push(`e.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    // Filter by event types
    if (eventTypes && eventTypes.length > 0) {
      conditions.push(`e.event_type = ANY($${paramIndex}::text[])`);
      params.push(eventTypes);
      paramIndex++;
    }

    // Filter by date range
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

    // Exclude certain event types that are too noisy
    const excludedEvents = [
      'presence.cursor.moved',
      'presence.user.typing',
      'presence.user.typing.stopped',
      'document.cursor.moved',
      'document.selection.changed',
    ];
    conditions.push(`e.event_type != ALL($${paramIndex}::text[])`);
    params.push(excludedEvents);
    paramIndex++;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM events e
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Get entries with user info
    const query = `
      SELECT 
        e.id,
        e.event_type,
        e.payload,
        e.user_id,
        e.timestamp,
        e.created_at,
        u.name as user_name,
        u.avatar as user_avatar
      FROM events e
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Enrich entries with additional context
    const entries: ActivityLogEntry[] = await Promise.all(
      result.rows.map(async (row) => {
        const entry: ActivityLogEntry = {
          id: row.id,
          eventType: row.event_type,
          payload: { ...row.payload }, // Create a copy of the payload
          userId: row.user_id,
          userName: row.user_name,
          userAvatar: row.user_avatar,
          timestamp: parseInt(row.timestamp),
          createdAt: row.created_at,
        };

        // Extract workspace info from payload
        if (row.payload.workspaceId || row.payload.workspace_id) {
          entry.workspaceId = row.payload.workspaceId || row.payload.workspace_id;
          // Optionally fetch workspace name
          try {
            const wsResult = await pool.query('SELECT name FROM workspaces WHERE id = $1', [
              entry.workspaceId,
            ]);
            if (wsResult.rows.length > 0) {
              entry.workspaceName = wsResult.rows[0].name;
            }
          } catch (error) {}
        }

        // Extract board info from payload
        if (row.payload.boardId || row.payload.board_id) {
          entry.boardId = row.payload.boardId || row.payload.board_id;
          try {
            const boardResult = await pool.query('SELECT name FROM boards WHERE id = $1', [
              entry.boardId,
            ]);
            if (boardResult.rows.length > 0) {
              entry.boardName = boardResult.rows[0].name;
            }
          } catch (error) {}
        }

        // Enrich workspace.member.invited events with invitee name if missing
        if (row.event_type === 'workspace.member.invited' && !row.payload.inviteeName) {
          try {
            const inviteeId = row.payload.inviteeId || row.payload.invitee_id;
            if (inviteeId) {
              const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [
                inviteeId,
              ]);
              if (userResult.rows.length > 0) {
                entry.payload.inviteeName = userResult.rows[0].name;
              }
            }
          } catch (error) {}
        }

        // Extract target info based on event type
        if (row.event_type.startsWith('card.')) {
          entry.targetType = 'card';
          entry.targetId = row.payload.cardId || row.payload.card_id;
          entry.targetName = row.payload.title || row.payload.cardTitle;
        } else if (row.event_type.startsWith('board.')) {
          entry.targetType = 'board';
          entry.targetId = row.payload.boardId || row.payload.board_id;
          entry.targetName = row.payload.name || row.payload.boardName;
        } else if (row.event_type.startsWith('list.')) {
          entry.targetType = 'list';
          entry.targetId = row.payload.listId || row.payload.list_id;
          entry.targetName = row.payload.name || row.payload.listName;
        } else if (row.event_type.startsWith('document.')) {
          entry.targetType = 'document';
          entry.targetId = row.payload.documentId || row.payload.document_id;
          entry.targetName = row.payload.title || row.payload.documentTitle;
        }

        return entry;
      })
    );

    return {
      entries,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get activity summary/stats for a workspace
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

    // Total events
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM events
       WHERE (payload->>'workspaceId' = $1 OR payload->>'workspace_id' = $1)
       AND created_at >= $2`,
      [workspaceId, since]
    );
    const totalEvents = parseInt(totalResult.rows[0]?.total || '0');

    // Events by type
    const typeResult = await pool.query(
      `SELECT event_type, COUNT(*) as count
       FROM events
       WHERE (payload->>'workspaceId' = $1 OR payload->>'workspace_id' = $1)
       AND created_at >= $2
       GROUP BY event_type
       ORDER BY count DESC`,
      [workspaceId, since]
    );
    const eventsByType: Record<string, number> = {};
    typeResult.rows.forEach((row) => {
      eventsByType[row.event_type] = parseInt(row.count);
    });

    // Top contributors
    const contributorsResult = await pool.query(
      `SELECT e.user_id, u.name as user_name, COUNT(*) as count
       FROM events e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE (payload->>'workspaceId' = $1 OR payload->>'workspace_id' = $1)
       AND created_at >= $2
       GROUP BY e.user_id, u.name
       ORDER BY count DESC
       LIMIT 5`,
      [workspaceId, since]
    );
    const topContributors = contributorsResult.rows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      count: parseInt(row.count),
    }));

    // Recent activity (grouped by day)
    const activityResult = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM events
       WHERE (payload->>'workspaceId' = $1 OR payload->>'workspace_id' = $1)
       AND created_at >= $2
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [workspaceId, since]
    );
    const recentActivity = activityResult.rows.map((row) => ({
      date: row.date,
      count: parseInt(row.count),
    }));

    return {
      totalEvents,
      eventsByType,
      topContributors,
      recentActivity,
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
        'workspace.member.roleChanged',
      ] as EventType[],
      board: [
        'board.created',
        'board.updated',
        'board.deleted',
        'board.archived',
        'board.unarchived',
        'board.renamed',
        'board.description.changed',
      ] as EventType[],
      card: [
        'card.created',
        'card.updated',
        'card.deleted',
        'card.moved',
        'card.completed',
        'card.uncompleted',
        'card.renamed',
        'card.description.changed',
        'card.duedate.set',
        'card.duedate.changed',
        'card.duedate.removed',
        'card.priority.changed',
        'card.member.assigned',
        'card.member.unassigned',
        'card.label.added',
        'card.label.removed',
        'card.archived',
        'card.unarchived',
      ] as EventType[],
      document: [
        'document.created',
        'document.updated',
        'document.deleted',
        'document.title.changed',
        'document.version.created',
        'document.version.restored',
        'document.exported',
      ] as EventType[],
      comment: [
        'comment.created',
        'comment.updated',
        'comment.deleted',
        'comment.mentioned',
      ] as EventType[],
    };
  }
}

export const activityLogService = new ActivityLogService();
