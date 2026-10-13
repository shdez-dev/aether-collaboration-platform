import type { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { projectAuthorizationService } from '../../services/ProjectAuthorizationService';

/** Read model for project planning surfaces. */
export class ProjectPlanningController {
  async getBacklog(req: Request, res: Response) {
    try {
      const projectId = req.params.id;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
      const boardIds = await projectAuthorizationService.getVisibleBoardIds(projectId, userId);
      if (boardIds.length === 0) return res.json({ success: true, data: { cards: [] } });

      const result = await pool.query(
        `SELECT c.id, c.title, c.description, c.acceptance_criteria, c.story_points, epic_membership.epic_id,
                c.priority, c.due_date, c.completed,
                b.id AS board_id, b.name AS board_name,
                l.id AS list_id, l.name AS list_name,
                current_sprint.id AS sprint_id, current_sprint.name AS sprint_name, current_sprint.status AS sprint_status
         FROM project_boards pb
         JOIN boards b ON b.id = pb.board_id AND b.archived = false
         JOIN lists l ON l.board_id = b.id
         JOIN cards c ON c.list_id = l.id
         LEFT JOIN project_epic_cards epic_membership ON epic_membership.project_id = pb.project_id AND epic_membership.card_id = c.id
         LEFT JOIN LATERAL (
           SELECT s.id, s.name, s.status FROM sprint_cards sc
           JOIN board_sprints s ON s.id = sc.sprint_id
           WHERE sc.card_id = c.id AND s.project_id = $1 AND s.status IN ('PLANNED', 'ACTIVE')
           ORDER BY CASE WHEN s.status = 'ACTIVE' THEN 0 ELSE 1 END, s.start_date DESC LIMIT 1
         ) current_sprint ON true
         WHERE pb.project_id = $1 AND b.id = ANY($2::uuid[])
         ORDER BY c.completed ASC, CASE c.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'LOW' THEN 2 ELSE 3 END,
                  c.due_date NULLS LAST, c.created_at DESC`,
        [projectId, boardIds]
      );

      return res.json({
        success: true,
        data: {
          cards: result.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            acceptanceCriteria: row.acceptance_criteria,
            storyPoints: row.story_points,
            epicId: row.epic_id,
            priority: row.priority,
            completed: row.completed,
            dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
            boardId: row.board_id,
            boardName: row.board_name,
            listId: row.list_id,
            listName: row.list_name,
            sprintId: row.sprint_id,
            sprintName: row.sprint_name,
            sprintStatus: row.sprint_status,
          })),
        },
      });
    } catch {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al obtener backlog del proyecto' } });
    }
  }
}

export const projectPlanningController = new ProjectPlanningController();
