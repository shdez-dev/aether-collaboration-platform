// apps/api/src/services/ListService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import { userActivityService } from './UserActivityService';
import type {
  List,
  ListCreatedPayload,
  ListUpdatedPayload,
  ListReorderedPayload,
  ListDeletedPayload,
} from '@aether/types';

export class ListService {
  /**
   * Helper: Obtener workspaceId desde boardId
   */
  private async getWorkspaceIdFromBoard(boardId: string): Promise<string | null> {
    const result = await pool.query('SELECT workspace_id FROM boards WHERE id = $1', [boardId]);
    return result.rows[0]?.workspace_id || null;
  }

  /**
   * Crear una nueva lista en un board
   */
  async createList(
    boardId: string,
    userId: string,
    data: {
      name: string;
    }
  ): Promise<List> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const positionResult = await client.query(
        `SELECT COALESCE(MAX(position), 0) as max_position 
         FROM lists 
         WHERE board_id = $1`,
        [boardId]
      );

      const nextPosition = positionResult.rows[0].max_position + 1;

      const listResult = await client.query(
        `INSERT INTO lists (board_id, name, position)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [boardId, data.name, nextPosition]
      );

      const list = listResult.rows[0];

      await client.query('COMMIT');

      const workspaceId = await this.getWorkspaceIdFromBoard(boardId);

      const payload: ListCreatedPayload = {
        listId: list.id as any,
        boardId: boardId as any,
        name: list.name,
        position: list.position,
        createdBy: userId as any,
        workspaceId,
      };

      await eventStore.emit('list.created', payload, userId as any, boardId);

      return this.formatList(list);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener todas las listas de un board
   */
  async getBoardLists(boardId: string): Promise<List[]> {
    const result = await pool.query(
      `SELECT 
        l.*,
        COUNT(c.id) as card_count
       FROM lists l
       LEFT JOIN cards c ON l.id = c.list_id
       WHERE l.board_id = $1
       GROUP BY l.id
       ORDER BY l.position ASC`,
      [boardId]
    );

    return result.rows.map((row) => ({
      ...this.formatList(row),
      cardCount: parseInt(row.card_count) || 0,
    }));
  }

  /**
   * Obtener una lista por ID
   */
  async getListById(listId: string): Promise<List | null> {
    const result = await pool.query(`SELECT * FROM lists WHERE id = $1`, [listId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatList(result.rows[0]);
  }

  /**
   * Actualizar una lista
   */
  async updateList(
    listId: string,
    userId: string,
    data: {
      name?: string;
    }
  ): Promise<List> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE lists 
         SET name = COALESCE($1, name), updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [data.name, listId]
      );

      const list = result.rows[0];

      await client.query('COMMIT');

      const workspaceId = await this.getWorkspaceIdFromBoard(list.board_id);

      const payload: ListUpdatedPayload = {
        listId: list.id as any,
        changes: data,
        updatedBy: userId as any,
        name: list.name,
        boardId: list.board_id,
        workspaceId,
      };

      await eventStore.emit('list.updated', payload, userId as any, list.board_id);

      return this.formatList(list);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reordenar una lista (cambiar su posición)
   */
  async reorderList(listId: string, userId: string, newPosition: number): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const currentListResult = await client.query(`SELECT * FROM lists WHERE id = $1`, [listId]);

      if (currentListResult.rows.length === 0) {
        throw new Error('List not found');
      }

      const currentList = currentListResult.rows[0];
      const oldPosition = currentList.position;
      const boardId = currentList.board_id;

      if (oldPosition === newPosition) {
        await client.query('COMMIT');
        return;
      }

      if (newPosition < oldPosition) {
        await client.query(
          `UPDATE lists 
           SET position = position + 1, updated_at = CURRENT_TIMESTAMP
           WHERE board_id = $1 AND position >= $2 AND position < $3`,
          [boardId, newPosition, oldPosition]
        );
      } else {
        await client.query(
          `UPDATE lists 
           SET position = position - 1, updated_at = CURRENT_TIMESTAMP
           WHERE board_id = $1 AND position > $2 AND position <= $3`,
          [boardId, oldPosition, newPosition]
        );
      }

      await client.query(
        `UPDATE lists 
         SET position = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPosition, listId]
      );

      await client.query('COMMIT');

      const workspaceId = await this.getWorkspaceIdFromBoard(boardId);

      const payload: ListReorderedPayload = {
        listId: listId as any,
        boardId: boardId as any,
        oldPosition,
        newPosition,
        reorderedBy: userId as any,
        workspaceId,
      };

      await eventStore.emit('list.reordered', payload, userId as any, boardId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar una lista
   */
  async deleteList(listId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const cardsResult = await client.query(
        `SELECT COUNT(*) as count FROM cards WHERE list_id = $1`,
        [listId]
      );

      if (parseInt(cardsResult.rows[0].count) > 0) {
        throw new Error('Cannot delete list with cards. Move or delete cards first.');
      }

      const listResult = await client.query(`SELECT board_id FROM lists WHERE id = $1`, [listId]);

      if (listResult.rows.length === 0) {
        throw new Error('List not found');
      }

      const boardId = listResult.rows[0].board_id;

      await client.query(`DELETE FROM lists WHERE id = $1`, [listId]);

      await client.query('COMMIT');

      const workspaceId = await this.getWorkspaceIdFromBoard(boardId);

      const payload: ListDeletedPayload = {
        listId: listId as any,
        boardId: boardId as any,
        deletedBy: userId as any,
        workspaceId,
      };

      await eventStore.emit('list.deleted', payload, userId as any, boardId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verificar si un usuario tiene acceso a una lista
   */
  async checkListAccess(listId: string, userId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT l.board_id
       FROM lists l
       INNER JOIN boards b ON l.board_id = b.id
       INNER JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
       WHERE l.id = $1 AND wm.user_id = $2`,
      [listId, userId]
    );

    return result.rows.length > 0 ? result.rows[0].board_id : null;
  }

  /**
   * Formatear lista desde resultado de DB
   */
  private formatList(row: any): List {
    return {
      id: row.id,
      boardId: row.board_id,
      name: row.name,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const listService = new ListService();
