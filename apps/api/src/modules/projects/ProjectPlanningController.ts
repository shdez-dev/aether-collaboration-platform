import type { Request, Response } from 'express';
import { pool } from '../../lib/db';

/** Read model for project planning surfaces. */
export class ProjectPlanningController {
  async getBacklog(req: Request, res: Response) {
    try {
      const projectId = req.params.id;

      const result = await pool.query(
        `SELECT c.id, c.title, c.priority, c.due_date,
                b.id AS board_id, b.name AS board_name,
                l.id AS list_id, l.name AS list_name
         FROM project_boards pb
         JOIN boards b ON b.id = pb.board_id AND b.archived = false
         JOIN lists l ON l.board_id = b.id
         JOIN cards c ON c.list_id = l.id AND c.completed = false
         WHERE pb.project_id = $1
         ORDER BY CASE c.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'LOW' THEN 2 ELSE 3 END,
                  c.due_date NULLS LAST, c.created_at DESC`,
        [projectId]
      );

      return res.json({
        success: true,
        data: {
          cards: result.rows.map((row) => ({
            id: row.id,
            title: row.title,
            priority: row.priority,
            dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
            boardId: row.board_id,
            boardName: row.board_name,
            listId: row.list_id,
            listName: row.list_name,
          })),
        },
      });
    } catch {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al obtener backlog del proyecto' } });
    }
  }
}

export const projectPlanningController = new ProjectPlanningController();
