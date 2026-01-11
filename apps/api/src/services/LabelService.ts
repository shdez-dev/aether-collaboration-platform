// apps/api/src/services/LabelService.ts

import { pool } from '../lib/db';
import type { Label } from '@aether/types';

export class LabelService {
  /**
   * Crear un label en un workspace
   */
  static async createLabel(
    workspaceId: string,
    data: {
      name: string;
      color: string;
    }
  ): Promise<Label> {
    const result = await pool.query(
      `INSERT INTO labels (workspace_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [workspaceId, data.name, data.color]
    );

    return this.mapLabel(result.rows[0]);
  }

  /**
   * Obtener todos los labels de un workspace
   */
  static async getWorkspaceLabels(workspaceId: string): Promise<Label[]> {
    const result = await pool.query(
      `SELECT * FROM labels 
       WHERE workspace_id = $1 
       ORDER BY name ASC`,
      [workspaceId]
    );

    return result.rows.map(this.mapLabel);
  }

  /**
   * Obtener label por ID
   */
  static async getLabelById(labelId: string): Promise<Label | null> {
    const result = await pool.query('SELECT * FROM labels WHERE id = $1', [labelId]);

    if (result.rows.length === 0) return null;

    return this.mapLabel(result.rows[0]);
  }

  /**
   * Actualizar label
   */
  static async updateLabel(
    labelId: string,
    data: {
      name?: string;
      color?: string;
    }
  ): Promise<Label> {
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

    const result = await pool.query(
      `UPDATE labels SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return this.mapLabel(result.rows[0]);
  }

  /**
   * Eliminar label
   */
  static async deleteLabel(labelId: string): Promise<void> {
    // El CASCADE de la base de datos eliminará automáticamente
    // las relaciones en card_labels
    await pool.query('DELETE FROM labels WHERE id = $1', [labelId]);
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
