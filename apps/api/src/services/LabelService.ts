// apps/api/src/services/LabelService.ts

import { pool } from '../lib/db';
import type { Label } from '@aether/types';

export class LabelService {
  /**
   * Crear un label en un workspace
   */
  static async createLabel(
    workspaceId: string,
    userId: string,
    data: {
      name: string;
      color: string;
    }
  ): Promise<Label | null> {
    const result = await pool.query(
      `INSERT INTO labels (id, workspace_id, name, color)
       SELECT uuid_generate_v4(), wm.workspace_id, $3, $4
       FROM workspace_members wm
       WHERE wm.workspace_id = $1 AND wm.user_id = $2
       RETURNING *`,
      [workspaceId, userId, data.name, data.color]
    );

    return result.rows[0] ? this.mapLabel(result.rows[0]) : null;
  }

  /**
   * Obtener todos los labels de un workspace
   */
  static async getWorkspaceLabels(workspaceId: string, userId: string): Promise<Label[]> {
    const result = await pool.query(
      `SELECT l.* FROM labels l
       WHERE l.workspace_id = $1
         AND EXISTS (
           SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = l.workspace_id AND wm.user_id = $2
         )
       ORDER BY l.name ASC`,
      [workspaceId, userId]
    );

    return result.rows.map(this.mapLabel);
  }

  /**
   * Obtener label por ID
   */
  static async getLabelById(labelId: string, userId: string): Promise<Label | null> {
    const result = await pool.query(
      `SELECT l.* FROM labels l
        WHERE l.id = $1
          AND EXISTS (
            SELECT 1 FROM workspace_members wm
             WHERE wm.workspace_id = l.workspace_id AND wm.user_id = $2
          )`,
      [labelId, userId]
    );

    if (result.rows.length === 0) return null;

    return this.mapLabel(result.rows[0]);
  }

  /**
   * Actualizar label
   */
  static async updateLabel(
    labelId: string,
    userId: string,
    data: {
      name?: string;
      color?: string;
    }
  ): Promise<Label | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(data.color);
    }

    updates.push(`updated_at = NOW()`);
    values.push(labelId);
    values.push(userId);

    const result = await pool.query(
      `UPDATE labels SET ${updates.join(', ')}
        WHERE id = $${paramCount}
          AND EXISTS (
            SELECT 1 FROM workspace_members wm
             WHERE wm.workspace_id = labels.workspace_id AND wm.user_id = $${paramCount + 1}
          )
        RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapLabel(result.rows[0]) : null;
  }

  /**
   * Eliminar label
   */
  static async deleteLabel(
    labelId: string,
    userId: string,
  ): Promise<'deleted' | 'not_found' | 'cross_workspace_association'> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const labelResult = await client.query(
        `SELECT l.workspace_id
           FROM labels l
           JOIN workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = $2
          WHERE l.id = $1
          FOR UPDATE OF l, wm`,
        [labelId, userId]
      );

      if (!labelResult.rows.length) {
        await client.query('COMMIT');
        return 'not_found';
      }

      const foreignAssociation = await client.query(
        `SELECT 1
           FROM card_labels cl
           JOIN cards c ON c.id = cl.card_id
           JOIN lists li ON li.id = c.list_id
           JOIN boards b ON b.id = li.board_id
          WHERE cl.label_id = $1 AND b.workspace_id <> $2
          LIMIT 1`,
        [labelId, labelResult.rows[0].workspace_id]
      );

      if (foreignAssociation.rows.length) {
        await client.query('COMMIT');
        return 'cross_workspace_association';
      }

      await client.query('DELETE FROM labels WHERE id = $1', [labelId]);
      await client.query('COMMIT');
      return 'deleted';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mapear label de base de datos a modelo
   */
  private static mapLabel(row: any): Label {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
