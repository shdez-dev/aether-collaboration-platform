// apps/api/src/services/CardService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import { userActivityService } from './UserActivityService';
import type { Card } from '@aether/types';

export class CardService {
  /**
   * Helper: Obtener boardId desde listId
   */
  private static async getBoardIdFromList(listId: string): Promise<string | null> {
    const result = await pool.query('SELECT board_id FROM lists WHERE id = $1', [listId]);
    return result.rows[0]?.board_id || null;
  }

  /**
   * Helper: Obtener boardId desde cardId
   */
  private static async getBoardIdFromCard(cardId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT l.board_id FROM cards c
       INNER JOIN lists l ON c.list_id = l.id
       WHERE c.id = $1`,
      [cardId]
    );
    return result.rows[0]?.board_id || null;
  }

  /**
   * Helper: Obtener workspaceId desde boardId
   */
  private static async getWorkspaceIdFromBoard(boardId: string): Promise<string | null> {
    const result = await pool.query('SELECT workspace_id FROM boards WHERE id = $1', [boardId]);
    return result.rows[0]?.workspace_id || null;
  }

  /**
   * Obtener todas las cards de una lista
   */
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
        )) FILTER (WHERE l.id IS NOT NULL) as labels
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

  /**
   * Crear una card en una lista
   */
  static async createCard(
    listId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
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
        `INSERT INTO cards (list_id, title, description, position, due_date, priority, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          listId,
          data.title,
          data.description || null,
          newPosition,
          data.dueDate || null,
          data.priority || null,
          userId,
        ]
      );

      const card = this.mapCard(result.rows[0]);

      await client.query('COMMIT');

      const boardId = await this.getBoardIdFromList(listId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      const payload = {
        cardId: card.id as any,
        listId: card.listId as any,
        title: card.title,
        description: card.description,
        position: card.position,
        createdBy: userId as any,
        boardId,
        workspaceId,
      };

      await eventStore.emit('card.created', payload, userId as any, boardId || undefined, socketId);

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener card por ID con relaciones
   */
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
        )) FILTER (WHERE l.id IS NOT NULL) as labels
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

  /**
   * Actualizar card (incluyendo movimiento entre listas)
   */
  static async updateCard(
    cardId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
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

      if (currentCardResult.rows.length === 0) {
        throw new Error('Card not found');
      }

      const currentCard = currentCardResult.rows[0];
      const originalListId = currentCard.list_id;

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(data.title);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }

      if (data.dueDate !== undefined) {
        updates.push(`due_date = $${paramCount++}`);
        values.push(data.dueDate);
      }

      if (data.priority !== undefined) {
        updates.push(`priority = $${paramCount++}`);
        values.push(data.priority);
      }

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

        if (listExists.rows.length === 0) {
          throw new Error('Target list not found');
        }

        const maxPosResult = await client.query(
          'SELECT COALESCE(MAX(position), 0) as max_pos FROM cards WHERE list_id = $1',
          [data.listId]
        );

        const newPosition = maxPosResult.rows[0].max_pos + 1;

        updates.push(`list_id = $${paramCount++}`);
        values.push(data.listId);

        updates.push(`position = $${paramCount++}`);
        values.push(newPosition);
      }

      updates.push(`updated_at = NOW()`);
      values.push(cardId);

      const result = await client.query(
        `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      const card = this.mapCard(result.rows[0]);

      await client.query('COMMIT');

      const boardId = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      if (data.listId && data.listId !== originalListId) {
        const movePayload = {
          cardId: card.id as any,
          fromListId: originalListId as any,
          toListId: data.listId as any,
          fromPosition: currentCard.position,
          toPosition: card.position,
          movedBy: userId as any,
          title: card.title,
          boardId,
          workspaceId,
        };

        await eventStore.emit(
          'card.moved',
          movePayload,
          userId as any,
          boardId || undefined,
          socketId
        );
      } else {
        const changes: any = {};
        if (data.title !== undefined) changes.title = data.title;
        if (data.description !== undefined) changes.description = data.description;
        if (data.dueDate !== undefined) changes.dueDate = data.dueDate;
        if (data.priority !== undefined) changes.priority = data.priority;
        if (data.completed !== undefined) changes.completed = data.completed;
        if (data.completedAt !== undefined) changes.completedAt = data.completedAt;

        // Si cambió el estado de completed, emitir evento específico y notificar a miembros
        if (data.completed !== undefined && data.completed !== currentCard.completed) {
          // Obtener miembros asignados a la card
          const membersResult = await client.query(
            'SELECT user_id FROM card_members WHERE card_id = $1',
            [cardId]
          );
          const assignedMembers = membersResult.rows.map((row) => row.user_id);

          const completionPayload = {
            cardId: card.id as any,
            completed: data.completed,
            completedAt: card.completedAt,
            completedBy: userId as any,
            title: card.title,
            boardId,
            workspaceId,
          };

          // Emitir al board
          await eventStore.emit(
            data.completed ? 'card.completed' : 'card.uncompleted',
            completionPayload,
            userId as any,
            boardId || undefined,
            socketId
          );

          // Notificar directamente a cada miembro asignado
          for (const memberId of assignedMembers) {
            if (memberId !== userId) {
              // No enviar al usuario que hizo el cambio
              await eventStore.emit(
                data.completed ? 'card.completed' : 'card.uncompleted',
                completionPayload,
                userId as any,
                undefined, // No enviar al board de nuevo
                undefined, // No hay socketId para estos envíos directos
                memberId // Enviar directamente al miembro
              );
            }
          }
        }

        const updatePayload = {
          cardId: card.id as any,
          changes,
          updatedBy: userId as any,
          title: card.title,
          boardId,
          workspaceId,
        };

        await eventStore.emit(
          'card.updated',
          updatePayload,
          userId as any,
          boardId || undefined,
          socketId
        );
      }

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mover card con control preciso de posición
   */
  static async moveCard(
    cardId: string,
    userId: string,
    data: {
      toListId: string;
      position: number;
    },
    socketId?: string
  ): Promise<Card> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const currentResult = await client.query('SELECT * FROM cards WHERE id = $1', [cardId]);
      const currentCard = currentResult.rows[0];

      if (!currentCard) {
        throw new Error('Card not found');
      }

      const fromListId = currentCard.list_id;
      const fromPosition = currentCard.position;

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
        `UPDATE cards 
         SET list_id = $1, position = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [data.toListId, data.position, cardId]
      );

      const card = this.mapCard(result.rows[0]);

      await client.query('COMMIT');

      const boardId = await this.getBoardIdFromList(data.toListId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      const payload = {
        cardId: card.id as any,
        fromListId: fromListId as any,
        toListId: data.toListId as any,
        fromPosition,
        toPosition: data.position,
        movedBy: userId as any,
        title: currentCard.title,
        boardId,
        workspaceId,
      };

      await eventStore.emit('card.moved', payload, userId as any, boardId || undefined, socketId);

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar card
   */
  static async deleteCard(cardId: string, userId: string, socketId?: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const cardResult = await client.query('SELECT * FROM cards WHERE id = $1', [cardId]);
      const card = cardResult.rows[0];

      if (!card) {
        throw new Error('Card not found');
      }

      const boardId = await this.getBoardIdFromList(card.list_id);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      await client.query('DELETE FROM cards WHERE id = $1', [cardId]);

      await client.query(
        'UPDATE cards SET position = position - 1 WHERE list_id = $1 AND position > $2',
        [card.list_id, card.position]
      );

      await client.query('COMMIT');

      const payload = {
        cardId: card.id as any,
        listId: card.list_id as any,
        deletedBy: userId as any,
        title: card.title,
        boardId,
        workspaceId,
      };

      await eventStore.emit('card.deleted', payload, userId as any, boardId || undefined, socketId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Asignar miembro a card
   */
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

      if (existingResult.rows.length > 0) {
        throw new Error('Member already assigned');
      }

      await client.query('INSERT INTO card_members (card_id, user_id) VALUES ($1, $2)', [
        cardId,
        memberId,
      ]);

      await client.query('COMMIT');

      const boardId = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      // Obtener información de la card y del usuario que asignó
      const cardResult = await client.query('SELECT title FROM cards WHERE id = $1', [cardId]);
      const cardTitle = cardResult.rows[0]?.title || 'Unknown card';

      const userResult = await client.query('SELECT name, email FROM users WHERE id = $1', [
        userId,
      ]);
      const assignerName = userResult.rows[0]?.name || 'Unknown user';

      const payload = {
        cardId: cardId as any,
        userId: memberId as any,
        assignedBy: {
          id: userId,
          name: assignerName,
        },
        title: cardTitle,
        boardId,
        workspaceId,
      };

      // Emitir evento tanto al board como directamente al usuario asignado
      await eventStore.emit(
        'card.member.assigned',
        payload,
        userId as any,
        boardId || undefined,
        socketId,
        memberId // 👈 Enviar directamente al usuario asignado
      );

      // Crear notificación de asignación
      const { notificationService } = await import('./NotificationService');
      await notificationService.createCardAssignedNotification({
        assignedUserId: memberId,
        assignerId: userId,
        assignerName,
        cardId,
        cardTitle,
        boardId: boardId || '',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Desasignar miembro de card
   */
  static async unassignMember(
    cardId: string,
    memberId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM card_members WHERE card_id = $1 AND user_id = $2', [
        cardId,
        memberId,
      ]);

      await client.query('COMMIT');

      const boardId = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      // Obtener información de la card para el evento
      const cardResult = await client.query('SELECT title FROM cards WHERE id = $1', [cardId]);
      const cardTitle = cardResult.rows[0]?.title || 'Unknown card';

      const payload = {
        cardId: cardId as any,
        userId: memberId as any,
        unassignedBy: userId as any,
        title: cardTitle,
        boardId,
        workspaceId,
      };

      // Emitir evento tanto al board como directamente al usuario desasignado
      await eventStore.emit(
        'card.member.unassigned',
        payload,
        userId as any,
        boardId || undefined,
        socketId,
        memberId // 👈 Enviar directamente al usuario desasignado
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Agregar label a card
   */
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

      if (existingResult.rows.length > 0) {
        throw new Error('Label already added');
      }

      await client.query('INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)', [
        cardId,
        labelId,
      ]);

      await client.query('COMMIT');

      const boardId = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      const payload = {
        cardId: cardId as any,
        labelId: labelId as any,
        addedBy: userId as any,
        boardId,
        workspaceId,
      };

      await eventStore.emit(
        'card.label.added',
        payload,
        userId as any,
        boardId || undefined,
        socketId
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remover label de card
   */
  static async removeLabel(
    cardId: string,
    labelId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM card_labels WHERE card_id = $1 AND label_id = $2', [
        cardId,
        labelId,
      ]);

      await client.query('COMMIT');

      const boardId = await this.getBoardIdFromCard(cardId);
      const workspaceId = await this.getWorkspaceIdFromBoard(boardId || '');

      const payload = {
        cardId: cardId as any,
        labelId: labelId as any,
        removedBy: userId as any,
        boardId,
        workspaceId,
      };

      await eventStore.emit(
        'card.label.removed',
        payload,
        userId as any,
        boardId || undefined,
        socketId
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mapear card de base de datos a modelo
   */
  private static mapCard(row: any): Card {
    return {
      id: row.id,
      listId: row.list_id,
      title: row.title,
      description: row.description,
      position: row.position,
      dueDate: row.due_date,
      priority: row.priority,
      completed: row.completed || false,
      completedAt: row.completed_at || null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      members: row.members || [],
      labels: row.labels || [],
    };
  }
}
