// apps/api/src/controllers/SearchController.ts

import { Request, Response } from 'express';
import { pool } from '../lib/db';
import { projectAuthorizationService } from '../services/ProjectAuthorizationService';

export class SearchController {
  /**
   * GET /api/search?q=<query>
   * Busca en códigos y contenido de cards, proyectos, boards, workspaces y documentos.
   */
  async search(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const q = ((req.query.q as string) || '').trim().replace(/\s+/g, ' ');

    if (!q || q.length < 2) {
      return res.json({ success: true, data: { cards: [], projects: [], boards: [], workspaces: [], documents: [] } });
    }

    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const normalizedText = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const queryTokens = normalizedText.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
    const normalizedQuery = queryTokens.join(' ');

    try {
      const accessibleProjectIds = await projectAuthorizationService.getAccessibleProjectIds(userId);
      const [cardsRes, projectsRes, boardsRes, workspacesRes, docsRes] = await Promise.all([
        // Cards — busca por título, descripción y criterios, incluidas las tarjetas
        // de tableros vinculados a proyectos a los que el usuario puede acceder.
        pool.query(
          `SELECT c.id, c.title, c.card_code, c.description, c.acceptance_criteria, c.priority, c.due_date,
              l.name  AS list_name,
              b.id    AS board_id, b.name AS board_name,
              w.id    AS workspace_id, w.name AS workspace_name,
              (
                SELECT string_agg(DISTINCT p.name, ' / ' ORDER BY p.name)
                FROM project_boards pb
                JOIN projects p ON p.id = pb.project_id
                WHERE pb.board_id = b.id AND p.id = ANY($2::uuid[])
              ) AS project_name
           FROM cards c
           JOIN lists l ON l.id = c.list_id
           JOIN boards b ON b.id = l.board_id
           JOIN workspaces w ON w.id = b.workspace_id
           LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           CROSS JOIN LATERAL (
             SELECT
               translate(lower(c.title), 'áàäâãåāéèëêēíìïîīóòöôõōúùüûūñçýÿ', 'aaaaaaaeeeeeiiiiioooooouuuuuncyy') AS title,
               translate(lower(concat_ws(' ', c.card_code, c.title, c.description, c.acceptance_criteria)), 'áàäâãåāéèëêēíìïîīóòöôõōúùüûūñçýÿ', 'aaaaaaaeeeeeiiiiioooooouuuuuncyy') AS content
           ) AS search_text
           WHERE b.archived = false
             AND cardinality($3::text[]) > 0
             AND (
               wm.user_id IS NOT NULL
               OR EXISTS (
                 SELECT 1 FROM project_boards visible_pb
                 WHERE visible_pb.board_id = b.id AND visible_pb.project_id = ANY($2::uuid[])
               )
             )
             AND NOT EXISTS (
               SELECT 1
               FROM unnest($3::text[]) AS query_terms(term)
               WHERE POSITION(query_terms.term IN search_text.content) = 0
             )
             AND NOT EXISTS (
               SELECT 1 FROM project_boards pb
               WHERE pb.board_id = b.id AND NOT (pb.project_id = ANY($2::uuid[]))
             )
           ORDER BY
             CASE
               WHEN regexp_replace(lower(c.card_code), '[^a-z0-9]', '', 'g') = regexp_replace($4, '[^a-z0-9]', '', 'g') THEN 0
               WHEN search_text.title = $4 THEN 0
               WHEN POSITION($4 IN search_text.title) = 1 THEN 1
               WHEN POSITION($4 IN search_text.title) > 0 THEN 2
               WHEN POSITION($4 IN search_text.content) > 0 THEN 3
               ELSE 4
             END,
             c.updated_at DESC
           LIMIT 10`,
          [userId, accessibleProjectIds, queryTokens, normalizedQuery]
        ),

        // Proyectos
        pool.query(
          `SELECT p.id, p.name, p.status, p.color,
                  w.id AS workspace_id, w.name AS workspace_name
           FROM projects p
           JOIN workspaces w ON w.id = p.workspace_id
           WHERE p.name ILIKE $2 ESCAPE E'\\\\' AND p.id = ANY($1::uuid[])
           ORDER BY p.updated_at DESC
           LIMIT 5`,
          [accessibleProjectIds, pattern]
        ),

        // Boards
        pool.query(
          `SELECT b.id, b.name,
                  w.id AS workspace_id, w.name AS workspace_name
           FROM boards b
           JOIN workspaces w ON w.id = b.workspace_id
           JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           WHERE b.name ILIKE $2 ESCAPE E'\\\\'
             AND b.archived = false
             AND NOT EXISTS (
               SELECT 1 FROM project_boards pb
               WHERE pb.board_id = b.id AND NOT (pb.project_id = ANY($3::uuid[]))
             )
           ORDER BY b.updated_at DESC
           LIMIT 5`,
          [userId, pattern, accessibleProjectIds]
        ),

        // Workspaces
        pool.query(
          `SELECT w.id, w.name, w.description, w.color
           FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
           WHERE w.name ILIKE $2 ESCAPE E'\\\\'
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
           WHERE d.title ILIKE $2 ESCAPE E'\\\\'
             AND (d.project_id IS NULL OR d.project_id = ANY($3::uuid[]))
           ORDER BY d.updated_at DESC
           LIMIT 5`,
          [userId, pattern, accessibleProjectIds]
        ),
      ]);

      return res.json({
        success: true,
        data: {
          cards: cardsRes.rows.map((r) => ({
            id: r.id,
            title: r.title,
            cardCode: r.card_code,
            description: r.description,
            acceptanceCriteria: r.acceptance_criteria,
            priority: r.priority,
            dueDate: r.due_date,
            listName: r.list_name,
            boardId: r.board_id,
            boardName: r.board_name,
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name,
            projectName: r.project_name,
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
