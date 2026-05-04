// apps/api/src/controllers/SearchController.ts

import { Request, Response } from 'express';
import { pool } from '../lib/db';

export class SearchController {
  /**
   * GET /api/search?q=<query>
   * Busca en cards, proyectos, boards, workspaces y documentos del usuario.
   */
  async search(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const q = ((req.query.q as string) || '').trim();

    if (!q || q.length < 2) {
      return res.json({ success: true, data: { cards: [], projects: [], boards: [], workspaces: [], documents: [] } });
    }

    const pattern = `%${q}%`;

    try {
      const [cardsRes, projectsRes, boardsRes, workspacesRes, docsRes] = await Promise.all([
        // Cards — visibles para el usuario (en boards de workspaces donde es miembro)
        pool.query(
          `SELECT DISTINCT ON (c.id)
              c.id, c.title, c.priority, c.due_date,
              l.name  AS list_name,
              b.id    AS board_id, b.name AS board_name,
              w.id    AS workspace_id, w.name AS workspace_name
           FROM cards c
           JOIN lists l ON l.id = c.list_id
           JOIN boards b ON b.id = l.board_id
           JOIN workspaces w ON w.id = b.workspace_id
           JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           WHERE c.title ILIKE $2
           ORDER BY c.id, c.updated_at DESC
           LIMIT 8`,
          [userId, pattern]
        ),

        // Proyectos
        pool.query(
          `SELECT p.id, p.name, p.status, p.color,
                  w.id AS workspace_id, w.name AS workspace_name
           FROM projects p
           JOIN workspaces w ON w.id = p.workspace_id
           JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           WHERE p.name ILIKE $2
           ORDER BY p.updated_at DESC
           LIMIT 5`,
          [userId, pattern]
        ),

        // Boards
        pool.query(
          `SELECT b.id, b.name,
                  w.id AS workspace_id, w.name AS workspace_name
           FROM boards b
           JOIN workspaces w ON w.id = b.workspace_id
           JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           WHERE b.name ILIKE $2
             AND b.archived = false
           ORDER BY b.updated_at DESC
           LIMIT 5`,
          [userId, pattern]
        ),

        // Workspaces
        pool.query(
          `SELECT w.id, w.name, w.description, w.color
           FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           WHERE w.name ILIKE $2
           ORDER BY w.updated_at DESC
           LIMIT 5`,
          [userId, pattern]
        ),

        // Documentos
        pool.query(
          `SELECT d.id, d.title,
                  w.id AS workspace_id, w.name AS workspace_name
           FROM documents d
           JOIN workspaces w ON w.id = d.workspace_id
           JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           WHERE d.title ILIKE $2
           ORDER BY d.updated_at DESC
           LIMIT 5`,
          [userId, pattern]
        ),
      ]);

      return res.json({
        success: true,
        data: {
          cards: cardsRes.rows.map((r) => ({
            id: r.id,
            title: r.title,
            priority: r.priority,
            dueDate: r.due_date,
            listName: r.list_name,
            boardId: r.board_id,
            boardName: r.board_name,
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name,
          })),
          projects: projectsRes.rows.map((r) => ({
            id: r.id,
            name: r.name,
            status: r.status,
            color: r.color,
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name,
          })),
          boards: boardsRes.rows.map((r) => ({
            id: r.id,
            name: r.name,
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name,
          })),
          workspaces: workspacesRes.rows.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            color: r.color,
          })),
          documents: docsRes.rows.map((r) => ({
            id: r.id,
            title: r.title,
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name,
          })),
        },
      });
    } catch (err: any) {
      console.error('search error:', err);
      return res.status(500).json({ success: false, error: { code: 'SEARCH_ERROR', message: err.message } });
    }
  }
}

export const searchController = new SearchController();
