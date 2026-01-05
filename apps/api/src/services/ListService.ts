// apps/api/src/services/ListService.ts

import { pool } from '../lib/db';
import { EventStoreService } from './EventStoreService';
import type {
  List,
  ListCreatedPayload,
  ListUpdatedPayload,
  ListReorderedPayload,
  ListDeletedPayload,
} from '@aether/types';

const eventStore = new EventStoreService();

export class ListService {
  /**
   * Crear una nueva lista en un board
   * @param boardId - ID del board donde se crea la lista
   * @param userId - ID del usuario que crea la lista
   * @param data - Datos de la lista (name)
   * @returns Lista creada
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

      // 1. Obtener la posición máxima actual de listas en el board
      const positionResult = await client.query(
        `SELECT COALESCE(MAX(position), 0) as max_position 
         FROM lists 
         WHERE board_id = $1`,
        [boardId]
      );

      const nextPosition = positionResult.rows[0].max_position + 1;

      // 2. Crear la lista
      const listResult = await client.query(
        `INSERT INTO lists (board_id, name, position)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [boardId, data.name, nextPosition]
      );

      const list = listResult.rows[0];

      // 3. Emitir evento
      const payload: ListCreatedPayload = {
        listId: list.id as any,
        boardId: boardId as any,
        name: list.name,
        position: list.position,
        createdBy: userId as any,
      };

      await eventStore.emit('list.created', payload, userId as any);

      await client.query('COMMIT');

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
   * @param boardId - ID del board
   * @returns Lista de listas ordenadas por posición
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
   * @param listId - ID de la lista
   * @returns Lista o null si no existe
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
   * @param listId - ID de la lista
   * @param userId - ID del usuario que actualiza
   * @param data - Datos a actualizar (name)
   * @returns Lista actualizada
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

      // Emitir evento
      const payload: ListUpdatedPayload = {
        listId: list.id as any,
        changes: data,
        updatedBy: userId as any,
      };

      await eventStore.emit('list.updated', payload, userId as any);

      await client.query('COMMIT');

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
   * @param listId - ID de la lista a mover
   * @param userId - ID del usuario que reordena
   * @param newPosition - Nueva posición de la lista
   */
  async reorderList(listId: string, userId: string, newPosition: number): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Obtener la lista actual
      const currentListResult = await client.query(`SELECT * FROM lists WHERE id = $1`, [listId]);

      if (currentListResult.rows.length === 0) {
        throw new Error('List not found');
      }

      const currentList = currentListResult.rows[0];
      const oldPosition = currentList.position;
      const boardId = currentList.board_id;

      // 2. Si la posición no cambió, no hacer nada
      if (oldPosition === newPosition) {
        await client.query('COMMIT');
        return;
      }

      // 3. Ajustar posiciones de otras listas
      if (newPosition < oldPosition) {
        // Mover hacia arriba: incrementar posición de listas entre newPosition y oldPosition
        await client.query(
          `UPDATE lists 
           SET position = position + 1, updated_at = CURRENT_TIMESTAMP
           WHERE board_id = $1 AND position >= $2 AND position < $3`,
          [boardId, newPosition, oldPosition]
        );
      } else {
        // Mover hacia abajo: decrementar posición de listas entre oldPosition y newPosition
        await client.query(
          `UPDATE lists 
           SET position = position - 1, updated_at = CURRENT_TIMESTAMP
           WHERE board_id = $1 AND position > $2 AND position <= $3`,
          [boardId, oldPosition, newPosition]
        );
      }

      // 4. Actualizar posición de la lista movida
      await client.query(
        `UPDATE lists 
         SET position = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPosition, listId]
      );

      // 5. Emitir evento
      const payload: ListReorderedPayload = {
        listId: listId as any,
        boardId: boardId as any,
        oldPosition,
        newPosition,
        reorderedBy: userId as any,
      };

      await eventStore.emit('list.reordered', payload, userId as any);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar una lista
   * Solo se puede eliminar si no tiene cards
   * @param listId - ID de la lista
   * @param userId - ID del usuario que elimina
   */
  async deleteList(listId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Verificar que la lista no tenga cards
      const cardsResult = await client.query(
        `SELECT COUNT(*) as count FROM cards WHERE list_id = $1`,
        [listId]
      );

      if (parseInt(cardsResult.rows[0].count) > 0) {
        throw new Error('Cannot delete list with cards. Move or delete cards first.');
      }

      // 2. Obtener boardId antes de eliminar
      const listResult = await client.query(`SELECT board_id FROM lists WHERE id = $1`, [listId]);

      if (listResult.rows.length === 0) {
        throw new Error('List not found');
      }

      const boardId = listResult.rows[0].board_id;

      // 3. Eliminar la lista
      await client.query(`DELETE FROM lists WHERE id = $1`, [listId]);

      // 4. Emitir evento
      const payload: ListDeletedPayload = {
        listId: listId as any,
        boardId: boardId as any,
        deletedBy: userId as any,
      };

      await eventStore.emit('list.deleted', payload, userId as any);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verificar si un usuario tiene acceso a una lista
   * (debe ser miembro del workspace del board)
   * @param listId - ID de la lista
   * @param userId - ID del usuario
   * @returns boardId si tiene acceso, null si no
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
