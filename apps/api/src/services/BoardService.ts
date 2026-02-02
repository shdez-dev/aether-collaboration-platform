// apps/api/src/services/BoardService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import { userActivityService } from './UserActivityService';
import type {
  Board,
  BoardCreatedPayload,
  BoardUpdatedPayload,
  BoardArchivedPayload,
} from '@aether/types';

export class BoardService {
  /**
   * Crear un nuevo board en un workspace con lista "Backlog" por defecto
   */
  async createBoard(
    workspaceId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
    }
  ): Promise<Board> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const positionResult = await client.query(
        `SELECT COALESCE(MAX(position), 0) as max_position 
         FROM boards 
         WHERE workspace_id = $1 AND archived = false`,
        [workspaceId]
      );

      const nextPosition = positionResult.rows[0].max_position + 1;

      const boardResult = await client.query(
        `INSERT INTO boards (workspace_id, name, description, position, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [workspaceId, data.name, data.description || null, nextPosition, userId]
      );

      const board = boardResult.rows[0];

      await client.query(
        `INSERT INTO lists (board_id, name, position, created_by)
         VALUES ($1, $2, $3, $4)`,
        [board.id, 'Backlog', 1, userId]
      );

      await client.query('COMMIT');

      const payload: BoardCreatedPayload = {
        boardId: board.id as any,
        workspaceId: workspaceId as any,
        name: board.name,
        description: board.description,
        createdBy: userId as any,
        position: board.position,
      };

      await eventStore.emit('board.created', payload, userId as any, board.id);

      return this.formatBoard(board);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener todos los boards de un workspace (no archivados)
   */
  async getWorkspaceBoards(workspaceId: string): Promise<Board[]> {
    const result = await pool.query(
      `SELECT 
        b.*,
        COUNT(DISTINCT l.id) as list_count,
        COUNT(DISTINCT c.id) as card_count
       FROM boards b
       LEFT JOIN lists l ON b.id = l.board_id
       LEFT JOIN cards c ON l.id = c.list_id
       WHERE b.workspace_id = $1 AND b.archived = false
       GROUP BY b.id
       ORDER BY b.position ASC`,
      [workspaceId]
    );

    return result.rows.map((row) => ({
      ...this.formatBoard(row),
      listCount: parseInt(row.list_count) || 0,
      cardCount: parseInt(row.card_count) || 0,
    }));
  }

  /**
   * Obtener un board por ID con todas sus listas y cards
   */
  async getBoardById(boardId: string): Promise<Board | null> {
    const client = await pool.connect();

    try {
      const boardResult = await client.query(`SELECT * FROM boards WHERE id = $1`, [boardId]);

      if (boardResult.rows.length === 0) {
        return null;
      }

      const board = this.formatBoard(boardResult.rows[0]);

      const listsResult = await client.query(
        `SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC`,
        [boardId]
      );

      const cardsResult = await client.query(
        `SELECT c.*, l.id as list_id
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         WHERE l.board_id = $1
         ORDER BY c.position ASC`,
        [boardId]
      );

      const cardsByList: Record<string, any[]> = {};
      cardsResult.rows.forEach((card) => {
        if (!cardsByList[card.list_id]) {
          cardsByList[card.list_id] = [];
        }
        cardsByList[card.list_id].push({
          id: card.id,
          listId: card.list_id,
          title: card.title,
          description: card.description,
          position: card.position,
          dueDate: card.due_date,
          priority: card.priority,
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        });
      });

      const lists = listsResult.rows.map((list) => ({
        id: list.id,
        boardId: list.board_id,
        name: list.name,
        position: list.position,
        createdAt: list.created_at,
        updatedAt: list.updated_at,
        cards: cardsByList[list.id] || [],
      }));

      return {
        ...board,
        lists,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Actualizar un board
   */
  async updateBoard(
    boardId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
    }
  ): Promise<Board> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(boardId);

      const result = await client.query(
        `UPDATE boards 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      const board = result.rows[0];

      await client.query('COMMIT');

      const payload: BoardUpdatedPayload = {
        boardId: board.id as any,
        changes: data,
        updatedBy: userId as any,
        name: board.name,
        workspaceId: board.workspace_id,
      };

      await eventStore.emit('board.updated', payload, userId as any, boardId);

      return this.formatBoard(board);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Archivar un board (soft delete)
   */
  async archiveBoard(boardId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const boardResult = await client.query(
        `UPDATE boards SET archived = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING workspace_id`,
        [boardId]
      );

      const workspaceId = boardResult.rows[0]?.workspace_id;

      await client.query('COMMIT');

      const payload: BoardArchivedPayload = {
        boardId: boardId as any,
        archivedBy: userId as any,
        workspaceId,
      };

      await eventStore.emit('board.archived', payload, userId as any, boardId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar un board permanentemente
   */
  async deleteBoard(boardId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const boardResult = await client.query(
        `SELECT archived, workspace_id FROM boards WHERE id = $1`,
        [boardId]
      );

      if (boardResult.rows.length === 0) {
        throw new Error('Board not found');
      }

      if (!boardResult.rows[0].archived) {
        throw new Error('Board must be archived before deleting');
      }

      const workspaceId = boardResult.rows[0].workspace_id;

      const listsResult = await client.query(
        `SELECT COUNT(*) as count FROM lists WHERE board_id = $1`,
        [boardId]
      );

      if (parseInt(listsResult.rows[0].count) > 0) {
        throw new Error('Cannot delete board with lists. Delete lists first.');
      }

      await client.query(`DELETE FROM boards WHERE id = $1`, [boardId]);

      await client.query('COMMIT');

      const payload = {
        boardId: boardId as any,
        deletedBy: userId as any,
        workspaceId,
      };

      await eventStore.emit('board.deleted', payload, userId as any);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verificar si un usuario tiene acceso a un board
   */
  async checkBoardAccess(boardId: string, userId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT b.workspace_id
       FROM boards b
       INNER JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
       WHERE b.id = $1 AND wm.user_id = $2`,
      [boardId, userId]
    );

    return result.rows.length > 0 ? result.rows[0].workspace_id : null;
  }

  /**
   * Formatear board desde resultado de DB
   */
  private formatBoard(row: any): Board {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description,
      position: row.position,
      archived: row.archived,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const boardService = new BoardService();
