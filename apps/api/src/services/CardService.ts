// apps/api/src/services/CardService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import type { Card } from '@aether/types';

export class CardService {
  // ============================================================================
  // HELPERS
  // ============================================================================

  private static async getBoardIdFromList(listId: string): Promise<string | null> {
    const result = await pool.query('SELECT board_id FROM lists WHERE id = $1', [listId]);
    return result.rows[0]?.board_id || null;
  }

  static async getBoardIdFromCard(cardId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT l.board_id FROM cards c
       INNER JOIN lists l ON c.list_id = l.id
       WHERE c.id = $1`,
      [cardId]
    );
    return result.rows[0]?.board_id || null;
  }

  static async getWorkspaceIdFromBoard(boardId: string): Promise<string | null> {
    const result = await pool.query('SELECT workspace_id FROM boards WHERE id = $1', [boardId]);
    return result.rows[0]?.workspace_id || null;
  }

  private static async getUserName(userId: string): Promise<string> {
    const result = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.name ?? 'Usuario desconocido';
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  static async getCardsByListId(listId: string): Promise<Card[]> {
    const result = await pool.query(
      `SELECT
        c.*,
        json_agg(DISTINCT jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        )) FILTER (WHERE u.id IS NOT NULL) as members,
        json_agg(DISTINCT jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'color', l.color
        )) FILTER (WHERE l.id IS NOT NULL) as labels,
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'id', ci.id,
                'cardId', ci.card_id,
                'title', ci.title,
                'completed', ci.completed,
                'position', ci.position,
                'createdBy', ci.created_by,
                'createdAt', ci.created_at,
                'updatedAt', ci.updated_at
              ) ORDER BY ci.position ASC, ci.created_at ASC
            )
            FROM card_checklist_items ci WHERE ci.card_id = c.id
          ),
          '[]'::json
        ) as checklist_items,
        (
          SELECT COUNT(*)::int
          FROM comments
          WHERE card_id = c.id
        ) as comment_count,
        (
          SELECT COUNT(*)::int
          FROM card_dependencies cd
          INNER JOIN cards bc ON cd.blocking_card_id = bc.id
          WHERE cd.blocked_card_id = c.id AND bc.completed = FALSE
        ) as blocked_by_pending_count,
        (
          SELECT COUNT(*)::int
          FROM card_dependencies cd
          WHERE cd.blocking_card_id = c.id
        ) as blocking_count
       FROM cards c
       LEFT JOIN card_members cm ON c.id = cm.card_id
       LEFT JOIN users u ON cm.user_id = u.id
       LEFT JOIN card_labels cl ON c.id = cl.card_id
       LEFT JOIN labels l ON cl.label_id = l.id
       WHERE c.list_id = $1
       GROUP BY c.id
       ORDER BY c.position ASC`,
      [listId]
    );
    return result.rows.map((row) => this.mapCard(row));
  }

  static async getCardById(cardId: string): Promise<Card | null> {
    const result = await pool.query(
      `SELECT
        c.*,
        json_agg(DISTINCT jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        )) FILTER (WHERE u.id IS NOT NULL) as members,
        json_agg(DISTINCT jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'color', l.color
        )) FILTER (WHERE l.id IS NOT NULL) as labels,
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'id', ci.id,
                'cardId', ci.card_id,
                'title', ci.title,
                'completed', ci.completed,
                'position', ci.position,
                'createdBy', ci.created_by,
                'createdAt', ci.created_at,
                'updatedAt', ci.updated_at
              ) ORDER BY ci.position ASC, ci.created_at ASC
            )
            FROM card_checklist_items ci WHERE ci.card_id = c.id
          ),
          '[]'::json
        ) as checklist_items,
        (
          SELECT COUNT(*)::int
          FROM card_dependencies cd
          INNER JOIN cards bc ON cd.blocking_card_id = bc.id
          WHERE cd.blocked_card_id = c.id AND bc.completed = FALSE
        ) as blocked_by_pending_count,
        (
          SELECT COUNT(*)::int
          FROM card_dependencies cd
          WHERE cd.blocking_card_id = c.id
        ) as blocking_count
       FROM cards c
       LEFT JOIN card_members cm ON c.id = cm.card_id
       LEFT JOIN users u ON cm.user_id = u.id
       LEFT JOIN card_labels cl ON c.id = cl.card_id
       LEFT JOIN labels l ON cl.label_id = l.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [cardId]
    );
    if (result.rows.length === 0) return null;
    return this.mapCard(result.rows[0]);
  }

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  static async createCard(
    listId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
      startDate?: string;
      dueDate?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    },
    socketId?: string
  ): Promise<Card> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const maxPosResult = await client.query(
        'SELECT COALESCE(MAX(position), 0) as max_pos FROM cards WHERE list_id = $1',
        [listId]
      );
      const newPosition = maxPosResult.rows[0].max_pos + 1;

      const result = await client.query(
        `INSERT INTO cards (id, list_id, title, description, position, start_date, due_date, priority, created_by, updated_at)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING *`,
        [listId, data.title, data.description || null, newPosition,
         data.startDate || null, data.dueDate || null, data.priority || null, userId]
      );

      const card = this.mapCard(result.rows[0]);
      await client.query('COMMIT');

      const boardId     = await this.getBoardIdFromList(listId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');
      const actorName   = await this.getUserName(userId);

      const listResult = await pool.query('SELECT name FROM lists WHERE id = $1', [listId]);
      const listName   = listResult.rows[0]?.name ?? 'Lista desconocida';

      await eventStore.emit({
        type:    'card.created',
        actor:   { id: userId, name: actorName },
        subject: { type: 'card', id: card.id, name: card.title },
        context: { workspaceId: workspaceId ?? '', boardId: boardId ?? undefined, listId },
        payload: { position: newPosition },
        socketId,
      });

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateCard(
    cardId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
      completed?: boolean;
      completedAt?: string | null;
      listId?: string;
    },
    socketId?: string
  ): Promise<Card> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const currentCardResult = await client.query('SELECT * FROM cards WHERE id = $1', [cardId]);
      if (currentCardResult.rows.length === 0) throw new Error('Card not found');

      const currentCard   = currentCardResult.rows[0];
      const originalListId = currentCard.list_id;

      // Validar dependencias bloqueantes al completar
      if (data.completed === true && !currentCard.completed) {
        const blockedByResult = await client.query(
          `SELECT COUNT(*)::int as count
           FROM card_dependencies cd
           INNER JOIN cards bc ON cd.blocking_card_id = bc.id
           WHERE cd.blocked_card_id = $1 AND bc.completed = FALSE`,
          [cardId]
        );
        const pendingBlockers = blockedByResult.rows[0].count;
        if (pendingBlockers > 0) {
          const error: any = new Error(
            `Esta card tiene ${pendingBlockers} dependencia${pendingBlockers !== 1 ? 's' : ''} bloqueante${pendingBlockers !== 1 ? 's' : ''} pendiente${pendingBlockers !== 1 ? 's' : ''}. Completa esas cards primero.`
          );
          error.code = 'BLOCKED_BY_DEPENDENCY';
          error.pendingBlockers = pendingBlockers;
          throw error;
        }
      }

      const updates: string[] = [];
      const values: any[]     = [];
      let paramCount = 1;

      if (data.title !== undefined)       { updates.push(`title = $${paramCount++}`);       values.push(data.title); }
      if (data.description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(data.description); }
      if (data.startDate !== undefined)   { updates.push(`start_date = $${paramCount++}`);  values.push(data.startDate); }
      if (data.dueDate !== undefined)     { updates.push(`due_date = $${paramCount++}`);    values.push(data.dueDate); }
      if (data.priority !== undefined)    { updates.push(`priority = $${paramCount++}`);    values.push(data.priority); }

      if (data.completed !== undefined) {
        updates.push(`completed = $${paramCount++}`);
        values.push(data.completed);
        if (data.completed && data.completedAt === undefined) {
          updates.push(`completed_at = NOW()`);
        } else if (!data.completed) {
          updates.push(`completed_at = NULL`);
        }
      }

      if (data.completedAt !== undefined && data.completed === undefined) {
        updates.push(`completed_at = $${paramCount++}`);
        values.push(data.completedAt);
      }

      if (data.listId !== undefined && data.listId !== originalListId) {
        const listExists = await client.query('SELECT id FROM lists WHERE id = $1', [data.listId]);
        if (listExists.rows.length === 0) throw new Error('Target list not found');

        const maxPosResult = await client.query(
          'SELECT COALESCE(MAX(position), 0) as max_pos FROM cards WHERE list_id = $1',
          [data.listId]
        );
        const newPosition = maxPosResult.rows[0].max_pos + 1;
        updates.push(`list_id = $${paramCount++}`);   values.push(data.listId);
        updates.push(`position = $${paramCount++}`);  values.push(newPosition);
      }

      updates.push(`updated_at = NOW()`);
      values.push(cardId);

      const result = await client.query(
        `WITH updated AS (
           UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *
         )
         SELECT
           u.*,
           (SELECT COUNT(*)::int FROM card_dependencies cd
            INNER JOIN cards bc ON cd.blocking_card_id = bc.id
            WHERE cd.blocked_card_id = u.id AND bc.completed = FALSE) as blocked_by_pending_count,
           (SELECT COUNT(*)::int FROM card_dependencies cd
            WHERE cd.blocking_card_id = u.id) as blocking_count
         FROM updated u`,
        values
      );

      const card = this.mapCard(result.rows[0]);
      await client.query('COMMIT');

      const boardId     = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');
      const actorName   = await this.getUserName(userId);

      const ctx = {
        workspaceId: workspaceId ?? '',
        boardId:     boardId ?? undefined,
        listId:      card.listId,
        cardId,
      };

      if (data.listId && data.listId !== originalListId) {
        // card.moved
        const fromListResult = await pool.query('SELECT name FROM lists WHERE id = $1', [originalListId]);
        const toListResult   = await pool.query('SELECT name FROM lists WHERE id = $1', [data.listId]);

        await eventStore.emit({
          type:    'card.moved',
          actor:   { id: userId, name: actorName },
          subject: { type: 'card', id: cardId, name: card.title },
          context: { ...ctx, listId: data.listId },
          delta: {
            before: { listId: originalListId, listName: fromListResult.rows[0]?.name ?? '', position: currentCard.position },
            after:  { listId: data.listId,    listName: toListResult.rows[0]?.name ?? '',   position: card.position },
          },
          payload: {},
          socketId,
        });
        return card;
      }

      // Emitir eventos específicos según qué campo cambió
      if (data.completed !== undefined && data.completed !== currentCard.completed) {
        // card.status.changed — también notificar a miembros asignados
        const membersResult = await pool.query(
          'SELECT user_id FROM card_members WHERE card_id = $1',
          [cardId]
        );

        await eventStore.emit({
          type:    'card.status-changed',
          actor:   { id: userId, name: actorName },
          subject: { type: 'card', id: cardId, name: card.title },
          context: ctx,
          delta: {
            before: { completed: currentCard.completed },
            after:  { completed: data.completed },
          },
          payload: {},
          socketId,
        });

        for (const { user_id: memberId } of membersResult.rows) {
          if (memberId !== userId) {
            await eventStore.emit({
              type:          'card.status-changed',
              actor:         { id: userId, name: actorName },
              subject:       { type: 'card', id: cardId, name: card.title },
              context:       ctx,
              delta:         { before: { completed: currentCard.completed }, after: { completed: data.completed } },
              payload:       {},
              targetUserId:  memberId,
            });
          }
        }
      }

      if (data.title !== undefined && data.title !== currentCard.title) {
        await eventStore.emit({
          type:    'card.updated',
          actor:   { id: userId, name: actorName },
          subject: { type: 'card', id: cardId, name: card.title },
          context: ctx,
          delta: {
            before: { title: currentCard.title },
            after:  { title: data.title },
          },
          payload: {},
          socketId,
        });
      }

      if (data.description !== undefined && data.description !== currentCard.description) {
        await eventStore.emit({
          type:    'card.updated',
          actor:   { id: userId, name: actorName },
          subject: { type: 'card', id: cardId, name: card.title },
          context: ctx,
          delta: {
            before: { description: currentCard.description },
            after:  { description: data.description },
          },
          payload: {},
          socketId,
        });
      }

      if (data.dueDate !== undefined && data.dueDate !== currentCard.due_date) {
        if (!data.dueDate) {
          await eventStore.emit({
            type:    'card.due-date.removed',
            actor:   { id: userId, name: actorName },
            subject: { type: 'card', id: cardId, name: card.title },
            context: ctx,
            delta: { before: { dueDate: currentCard.due_date }, after: { dueDate: null } },
            payload: {},
            socketId,
          });
        } else {
          await eventStore.emit({
            type:    'card.due-date.set',
            actor:   { id: userId, name: actorName },
            subject: { type: 'card', id: cardId, name: card.title },
            context: ctx,
            delta: { before: { dueDate: currentCard.due_date ?? null }, after: { dueDate: data.dueDate } },
            payload: {},
            socketId,
          });
        }
      }

      if (data.priority !== undefined && data.priority !== currentCard.priority) {
        await eventStore.emit({
          type:    'card.priority.changed',
          actor:   { id: userId, name: actorName },
          subject: { type: 'card', id: cardId, name: card.title },
          context: ctx,
          delta: {
            before: { priority: currentCard.priority },
            after:  { priority: data.priority },
          },
          payload: {},
          socketId,
        });
      }

      // Siempre emitir card.updated para que el cliente sincronice el estado
      await eventStore.emit({
        type:    'card.updated',
        actor:   { id: userId, name: actorName },
        subject: { type: 'card', id: cardId, name: card.title },
        context: ctx,
        payload: {},
        socketId,
      });

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async moveCard(
    cardId: string,
    userId: string,
    data: { toListId: string; position: number },
    socketId?: string
  ): Promise<Card> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const currentResult = await client.query('SELECT * FROM cards WHERE id = $1', [cardId]);
      const currentCard   = currentResult.rows[0];
      if (!currentCard) throw new Error('Card not found');

      const fromListId    = currentCard.list_id;
      const fromPosition  = currentCard.position;

      if (fromListId !== data.toListId) {
        await client.query(
          'UPDATE cards SET position = position - 1 WHERE list_id = $1 AND position > $2',
          [fromListId, fromPosition]
        );
      }

      await client.query(
        'UPDATE cards SET position = position + 1 WHERE list_id = $1 AND position >= $2',
        [data.toListId, data.position]
      );

      const result = await client.query(
        `WITH updated AS (
           UPDATE cards SET list_id = $1, position = $2, updated_at = NOW() WHERE id = $3 RETURNING *
         )
         SELECT u.*,
           (SELECT COUNT(*)::int FROM card_dependencies cd
            INNER JOIN cards bc ON cd.blocking_card_id = bc.id
            WHERE cd.blocked_card_id = u.id AND bc.completed = FALSE) as blocked_by_pending_count,
           (SELECT COUNT(*)::int FROM card_dependencies cd
            WHERE cd.blocking_card_id = u.id) as blocking_count
         FROM updated u`,
        [data.toListId, data.position, cardId]
      );

      const card = this.mapCard(result.rows[0]);
      await client.query('COMMIT');

      const boardId     = await this.getBoardIdFromList(data.toListId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');
      const actorName   = await this.getUserName(userId);

      const fromListResult = await pool.query('SELECT name FROM lists WHERE id = $1', [fromListId]);
      const toListResult   = await pool.query('SELECT name FROM lists WHERE id = $1', [data.toListId]);

      await eventStore.emit({
        type:    'card.moved',
        actor:   { id: userId, name: actorName },
        subject: { type: 'card', id: cardId, name: currentCard.title },
        context: { workspaceId: workspaceId ?? '', boardId: boardId ?? undefined, listId: data.toListId, cardId },
        delta: {
          before: { listId: fromListId,      listName: fromListResult.rows[0]?.name ?? '', position: fromPosition },
          after:  { listId: data.toListId,   listName: toListResult.rows[0]?.name ?? '',   position: data.position },
        },
        payload: {},
        socketId,
      });

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteCard(cardId: string, userId: string, socketId?: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const cardResult = await client.query('SELECT * FROM cards WHERE id = $1', [cardId]);
      const card       = cardResult.rows[0];
      if (!card) throw new Error('Card not found');

      const boardId     = await this.getBoardIdFromList(card.list_id);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      await client.query('DELETE FROM cards WHERE id = $1', [cardId]);
      await client.query(
        'UPDATE cards SET position = position - 1 WHERE list_id = $1 AND position > $2',
        [card.list_id, card.position]
      );

      await client.query('COMMIT');

      const actorName = await this.getUserName(userId);

      await eventStore.emit({
        type:    'card.deleted',
        actor:   { id: userId, name: actorName },
        subject: { type: 'card', id: cardId, name: card.title },
        context: { workspaceId: workspaceId ?? '', boardId: boardId ?? undefined, listId: card.list_id },
        payload: {},
        socketId,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async assignMember(
    cardId: string,
    memberId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM card_members WHERE card_id = $1 AND user_id = $2',
        [cardId, memberId]
      );
      if (existingResult.rows.length > 0) throw new Error('Member already assigned');

      await client.query('INSERT INTO card_members (card_id, user_id) VALUES ($1, $2)', [cardId, memberId]);
      await client.query('COMMIT');

      const boardId     = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      const [cardResult, actorResult, memberResult] = await Promise.all([
        pool.query('SELECT title FROM cards WHERE id = $1', [cardId]),
        pool.query('SELECT name FROM users WHERE id = $1', [userId]),
        pool.query('SELECT name FROM users WHERE id = $1', [memberId]),
      ]);

      const cardTitle  = cardResult.rows[0]?.title   ?? 'Card desconocida';
      const actorName  = actorResult.rows[0]?.name   ?? 'Usuario desconocido';
      const memberName = memberResult.rows[0]?.name  ?? 'Usuario desconocido';

      const ctx = { workspaceId: workspaceId ?? '', boardId: boardId ?? undefined, cardId };

      await eventStore.emit({
        type:         'card.member.assigned',
        actor:        { id: userId, name: actorName },
        subject:      { type: 'member', id: memberId, name: memberName },
        context:      { ...ctx, cardId },
        payload:      { memberId, memberName },
        socketId,
        targetUserId: memberId,
      });

      const { notificationService } = await import('./NotificationService');
      await notificationService.createCardAssignedNotification({
        assignedUserId: memberId,
        assignerId: userId,
        assignerName: actorName,
        cardId,
        cardTitle,
        boardId: boardId || '',
        workspaceId: workspaceId || undefined,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async unassignMember(
    cardId: string,
    memberId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM card_members WHERE card_id = $1 AND user_id = $2', [cardId, memberId]);
      await client.query('COMMIT');

      const boardId     = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      const [cardResult, actorResult, memberResult] = await Promise.all([
        pool.query('SELECT title FROM cards WHERE id = $1', [cardId]),
        pool.query('SELECT name FROM users WHERE id = $1', [userId]),
        pool.query('SELECT name FROM users WHERE id = $1', [memberId]),
      ]);

      const cardTitle  = cardResult.rows[0]?.title   ?? 'Card desconocida';
      const actorName  = actorResult.rows[0]?.name   ?? 'Usuario desconocido';
      const memberName = memberResult.rows[0]?.name  ?? 'Usuario desconocido';

      await eventStore.emit({
        type:         'card.member.removed',
        actor:        { id: userId, name: actorName },
        subject:      { type: 'member', id: memberId, name: memberName },
        context:      { workspaceId: workspaceId ?? '', boardId: boardId ?? undefined, cardId },
        payload:      { memberId, memberName },
        socketId,
        targetUserId: memberId,
      });

      try {
        const { notificationService } = await import('./NotificationService');
        await notificationService.createCardUnassignedNotification({
          unassignedUserId: memberId,
          removerId: userId,
          removerName: actorName,
          cardId,
          cardTitle,
          boardId: boardId || '',
          workspaceId: workspaceId || undefined,
        });
      } catch {}
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async addLabel(
    cardId: string,
    labelId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM card_labels WHERE card_id = $1 AND label_id = $2',
        [cardId, labelId]
      );
      if (existingResult.rows.length > 0) throw new Error('Label already added');

      await client.query('INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)', [cardId, labelId]);
      await client.query('COMMIT');

      const boardId     = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      const [cardResult, labelResult, actorResult] = await Promise.all([
        pool.query('SELECT title FROM cards WHERE id = $1', [cardId]),
        pool.query('SELECT name, color FROM labels WHERE id = $1', [labelId]),
        pool.query('SELECT name FROM users WHERE id = $1', [userId]),
      ]);

      const labelName  = labelResult.rows[0]?.name  ?? 'Label desconocida';
      const labelColor = labelResult.rows[0]?.color ?? undefined;
      const actorName  = actorResult.rows[0]?.name  ?? 'Usuario desconocido';

      await eventStore.emit({
        type:    'card.label.added',
        actor:   { id: userId, name: actorName },
        subject: { type: 'label', id: labelId, name: labelName },
        context: { workspaceId: workspaceId ?? '', boardId: boardId ?? undefined, cardId },
        payload: { labelId, labelName, ...(labelColor && { color: labelColor }) },
        socketId,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async removeLabel(
    cardId: string,
    labelId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const [cardResult, labelResult, actorResult] = await Promise.all([
        pool.query('SELECT title FROM cards WHERE id = $1', [cardId]),
        pool.query('SELECT name FROM labels WHERE id = $1', [labelId]),
        pool.query('SELECT name FROM users WHERE id = $1', [userId]),
      ]);

      const labelName = labelResult.rows[0]?.name ?? 'Label desconocida';
      const actorName = actorResult.rows[0]?.name ?? 'Usuario desconocido';

      await client.query('DELETE FROM card_labels WHERE card_id = $1 AND label_id = $2', [cardId, labelId]);
      await client.query('COMMIT');

      const boardId     = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      await eventStore.emit({
        type:    'card.label.removed',
        actor:   { id: userId, name: actorName },
        subject: { type: 'label', id: labelId, name: labelName },
        context: { workspaceId: workspaceId ?? '', boardId: boardId ?? undefined, cardId },
        payload: { labelId, labelName },
        socketId,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // MAPPER
  // ============================================================================

  private static mapCard(row: any): Card {
    const card: any = {
      id:                   row.id,
      listId:               row.list_id,
      title:                row.title,
      description:          row.description,
      position:             row.position,
      startDate:            row.start_date,
      dueDate:              row.due_date,
      priority:             row.priority,
      completed:            row.completed || false,
      completedAt:          row.completed_at || null,
      createdBy:            row.created_by,
      createdAt:            row.created_at,
      updatedAt:            row.updated_at,
      members:              row.members || [],
      labels:               row.labels || [],
      checklistItems:       row.checklist_items || [],
      blockedByPendingCount: row.blocked_by_pending_count ?? 0,
      blockingCount:        row.blocking_count ?? 0,
    };

    if (row.comment_count !== undefined) {
      card._count = { comments: row.comment_count };
    }

    return card;
  }
}
