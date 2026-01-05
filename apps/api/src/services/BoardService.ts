// apps/api/src/services/BoardService.ts

import { pool } from '../lib/db';
import { EventStoreService } from './EventStoreService';
import type {
  Board,
  BoardCreatedPayload,
  BoardUpdatedPayload,
  BoardArchivedPayload,
} from '@aether/types';

const eventStore = new EventStoreService();

export class BoardService {
  /**
   * Crear un nuevo board en un workspace
   * @param workspaceId - ID del workspace donde se crea el board
   * @param userId - ID del usuario que crea el board
   * @param data - Datos del board (name, description)
   * @returns Board creado
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

      // 1. Obtener la posición máxima actual de boards en el workspace
      const positionResult = await client.query(
        `SELECT COALESCE(MAX(position), 0) as max_position 
         FROM boards 
         WHERE workspace_id = $1 AND archived = false`,
        [workspaceId]
      );

      const nextPosition = positionResult.rows[0].max_position + 1;

      // 2. Crear el board
      const boardResult = await client.query(
        `INSERT INTO boards (workspace_id, name, description, position, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [workspaceId, data.name, data.description || null, nextPosition, userId]
      );

      const board = boardResult.rows[0];

      // 3. Emitir evento
      const payload: BoardCreatedPayload = {
        boardId: board.id as any,
        workspaceId: workspaceId as any,
        name: board.name,
        description: board.description,
        createdBy: userId as any,
        position: board.position,
      };

      await eventStore.emit('board.created', payload, userId as any);

      await client.query('COMMIT');

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
   * @param workspaceId - ID del workspace
   * @returns Lista de boards ordenados por posición
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
   * @param boardId - ID del board
   * @returns Board completo con listas anidadas
   */
  async getBoardById(boardId: string): Promise<Board | null> {
    const client = await pool.connect();

    try {
      // 1. Obtener el board
      const boardResult = await client.query(`SELECT * FROM boards WHERE id = $1`, [boardId]);

      if (boardResult.rows.length === 0) {
        return null;
      }

      const board = this.formatBoard(boardResult.rows[0]);

      // 2. Obtener todas las listas del board ordenadas por posición
      const listsResult = await client.query(
        `SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC`,
        [boardId]
      );

      // 3. Obtener todas las cards de las listas ordenadas por posición
      const cardsResult = await client.query(
        `SELECT c.*, l.id as list_id
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         WHERE l.board_id = $1
         ORDER BY c.position ASC`,
        [boardId]
      );

      // 4. Agrupar cards por lista
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

      // 5. Construir listas con sus cards
      const lists = listsResult.rows.map((list) => ({
        id: list.id,
        boardId: list.board_id,
        name: list.name,
        position: list.position,
        createdAt: list.created_at,
        updatedAt: list.updated_at,
        cards: cardsByList[list.id] || [],
      }));

      // 6. Devolver board completo
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
   * @param boardId - ID del board
   * @param userId - ID del usuario que actualiza
   * @param data - Datos a actualizar
   * @returns Board actualizado
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

      // Construir query dinámicamente
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

      // Emitir evento
      const payload: BoardUpdatedPayload = {
        boardId: board.id as any,
        changes: data,
        updatedBy: userId as any,
      };

      await eventStore.emit('board.updated', payload, userId as any);

      await client.query('COMMIT');

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
   * @param boardId - ID del board
   * @param userId - ID del usuario que archiva
   */
  async archiveBoard(boardId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Marcar como archivado
      await client.query(
        `UPDATE boards SET archived = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [boardId]
      );

      // Emitir evento
      const payload: BoardArchivedPayload = {
        boardId: boardId as any,
        archivedBy: userId as any,
      };

      await eventStore.emit('board.archived', payload, userId as any);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar un board permanentemente
   * Solo se puede eliminar si está archivado y no tiene listas
   * @param boardId - ID del board
   * @param userId - ID del usuario que elimina
   */
  async deleteBoard(boardId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que el board esté archivado
      const boardResult = await client.query(`SELECT archived FROM boards WHERE id = $1`, [
        boardId,
      ]);

      if (boardResult.rows.length === 0) {
        throw new Error('Board not found');
      }

      if (!boardResult.rows[0].archived) {
        throw new Error('Board must be archived before deleting');
      }

      // Verificar que no tenga listas
      const listsResult = await client.query(
        `SELECT COUNT(*) as count FROM lists WHERE board_id = $1`,
        [boardId]
      );

      if (parseInt(listsResult.rows[0].count) > 0) {
        throw new Error('Cannot delete board with lists. Delete lists first.');
      }

      // Eliminar board
      await client.query(`DELETE FROM boards WHERE id = $1`, [boardId]);

      // Emitir evento
      await eventStore.emit(
        'board.deleted',
        { boardId: boardId as any, deletedBy: userId as any },
        userId as any
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verificar si un usuario tiene acceso a un board
   * (debe ser miembro del workspace)
   * @param boardId - ID del board
   * @param userId - ID del usuario
   * @returns workspace_id si tiene acceso, null si no
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
