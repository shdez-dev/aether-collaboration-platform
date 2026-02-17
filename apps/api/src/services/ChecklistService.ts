// apps/api/src/services/ChecklistService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import type { ChecklistItem } from '@aether/types';

export class ChecklistService {
  // ── Helpers ─────────────────────────────────────────────────────────────────

  private static async getBoardAndWorkspaceFromCard(cardId: string) {
    const result = await pool.query(
      `SELECT l.board_id, b.workspace_id
       FROM cards c
       INNER JOIN lists l ON c.list_id = l.id
       INNER JOIN boards b ON l.board_id = b.id
       WHERE c.id = $1`,
      [cardId]
    );
    return result.rows[0] || null;
  }

  private static mapItem(row: any): ChecklistItem {
    return {
      id: row.id,
      cardId: row.card_id,
      title: row.title,
      completed: row.completed,
      position: row.position,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  /**
   * Obtener todos los ítems del checklist de una card, ordenados por posición
   */
  static async getItems(cardId: string): Promise<ChecklistItem[]> {
    const result = await pool.query(
      `SELECT * FROM card_checklist_items
       WHERE card_id = $1
       ORDER BY position ASC, created_at ASC`,
      [cardId]
    );
    return result.rows.map(this.mapItem);
  }

  /**
   * Crear un nuevo ítem en el checklist
   */
  static async createItem(
    cardId: string,
    userId: string,
    title: string,
    socketId?: string
  ): Promise<ChecklistItem> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Calcular posición: max + 1
      const maxPosResult = await client.query(
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM card_checklist_items WHERE card_id = $1',
        [cardId]
      );
      const newPosition = maxPosResult.rows[0].max_pos + 1;

      const result = await client.query(
        `INSERT INTO card_checklist_items (card_id, title, position, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [cardId, title.trim(), newPosition, userId]
      );

      const item = this.mapItem(result.rows[0]);

      // Emitir evento realtime
      const meta = await this.getBoardAndWorkspaceFromCard(cardId);
      if (meta) {
        await eventStore.emit(
          'checklist.item.created' as any,
          { cardId, item },
          userId as any,
          meta.board_id,
          socketId
        );
      }

      await client.query('COMMIT');
      return item;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Actualizar título y/o estado completado de un ítem
   */
  static async updateItem(
    itemId: string,
    cardId: string,
    userId: string,
    data: { title?: string; completed?: boolean },
    socketId?: string
  ): Promise<ChecklistItem> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];
      let idx = 1;

      if (data.title !== undefined) {
        setClauses.push(`title = $${idx++}`);
        values.push(data.title.trim());
      }
      if (data.completed !== undefined) {
        setClauses.push(`completed = $${idx++}`);
        values.push(data.completed);
      }

      values.push(itemId, cardId);
      const result = await client.query(
        `UPDATE card_checklist_items
         SET ${setClauses.join(', ')}
         WHERE id = $${idx++} AND card_id = $${idx++}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Checklist item not found');
      }

      const item = this.mapItem(result.rows[0]);

      // Emitir evento realtime
      const meta = await this.getBoardAndWorkspaceFromCard(cardId);
      if (meta) {
        await eventStore.emit(
          'checklist.item.updated' as any,
          { cardId, item },
          userId as any,
          meta.board_id,
          socketId
        );
      }

      await client.query('COMMIT');
      return item;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar un ítem del checklist
   */
  static async deleteItem(
    itemId: string,
    cardId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'DELETE FROM card_checklist_items WHERE id = $1 AND card_id = $2 RETURNING position',
        [itemId, cardId]
      );

      if (result.rows.length === 0) {
        throw new Error('Checklist item not found');
      }

      const deletedPosition = result.rows[0].position;

      // Compactar posiciones
      await client.query(
        `UPDATE card_checklist_items
         SET position = position - 1
         WHERE card_id = $1 AND position > $2`,
        [cardId, deletedPosition]
      );

      // Emitir evento realtime
      const meta = await this.getBoardAndWorkspaceFromCard(cardId);
      if (meta) {
        await eventStore.emit(
          'checklist.item.deleted' as any,
          { cardId, itemId },
          userId as any,
          meta.board_id,
          socketId
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
