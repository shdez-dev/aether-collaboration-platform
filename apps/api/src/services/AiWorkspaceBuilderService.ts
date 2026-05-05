// apps/api/src/services/AiWorkspaceBuilderService.ts
// Crea una workspace completa desde un AiWorkspacePlan en una transacción SQL única

import { pool } from '../lib/db';
import type { AiWorkspacePlan } from './AiPlannerService';

export interface BuildResult {
  workspaceId: string;
}

class AiWorkspaceBuilderService {
  async buildWorkspace(plan: AiWorkspacePlan, userId: string): Promise<BuildResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Crear workspace
      const wsResult = await client.query(
        `INSERT INTO workspaces (id, name, description, owner_id, icon, color, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          plan.workspace.name,
          plan.workspace.description,
          userId,
          plan.workspace.icon ?? null,
          plan.workspace.color ?? '#3b82f6',
        ]
      );
      const workspaceId: string = wsResult.rows[0].id;

      // 2. Agregar creador como OWNER
      await client.query(
        `INSERT INTO workspace_members (id, workspace_id, user_id, role)
         VALUES (gen_random_uuid(), $1, $2, 'OWNER')`,
        [workspaceId, userId]
      );

      // 3. Crear proyectos
      for (const project of plan.projects) {
        const projResult = await client.query(
          `INSERT INTO projects (id, workspace_id, name, description, status, owner_id, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           RETURNING id`,
          [workspaceId, project.name, project.description ?? null, project.status ?? 'PLANNING', userId]
        );
        const projectId: string = projResult.rows[0].id;

        // 4. Crear hitos del proyecto
        for (const milestone of project.milestones ?? []) {
          await client.query(
            `INSERT INTO project_milestones (id, project_id, name, description, date, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [
              projectId,
              milestone.name,
              milestone.description ?? null,
              milestone.dueDate ?? null,
            ]
          );
        }

        // 5. Crear boards del proyecto
        for (let bIdx = 0; bIdx < (project.boards ?? []).length; bIdx++) {
          const board = project.boards[bIdx];

          const boardResult = await client.query(
            `INSERT INTO boards (id, workspace_id, name, description, position, created_by, color, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, '#3b82f6', CURRENT_TIMESTAMP)
             RETURNING id`,
            [workspaceId, board.name, board.description ?? null, bIdx, userId]
          );
          const boardId: string = boardResult.rows[0].id;

          // 6. Vincular board al proyecto
          await client.query(
            `INSERT INTO project_boards (id, project_id, board_id)
             VALUES (gen_random_uuid(), $1, $2) ON CONFLICT DO NOTHING`,
            [projectId, boardId]
          );

          // 7. Crear listas del board
          // Track title→id for dependency resolution within this board
          const cardTitleToId = new Map<string, string>();
          const pendingDeps: Array<{ blockingTitle: string; blockedId: string }> = [];

          for (let lIdx = 0; lIdx < (board.lists ?? []).length; lIdx++) {
            const list = board.lists[lIdx];

            const listResult = await client.query(
              `INSERT INTO lists (id, board_id, name, position, created_by, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, CURRENT_TIMESTAMP)
               RETURNING id`,
              [boardId, list.name, lIdx, userId]
            );
            const listId: string = listResult.rows[0].id;

            // 8. Crear cards de la lista
            for (let cIdx = 0; cIdx < (list.cards ?? []).length; cIdx++) {
              const card = list.cards[cIdx];

              const cardResult = await client.query(
                `INSERT INTO cards (id, list_id, title, description, position, priority, due_date, completed, created_by, updated_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, $7, CURRENT_TIMESTAMP)
                 RETURNING id`,
                [
                  listId,
                  card.title,
                  card.description ?? null,
                  cIdx,
                  card.priority ?? null,
                  card.dueDate ?? null,
                  userId,
                ]
              );
              const cardId: string = cardResult.rows[0].id;
              cardTitleToId.set(card.title, cardId);

              // 8a. Crear checklist items
              for (let iIdx = 0; iIdx < (card.checklistItems ?? []).length; iIdx++) {
                const itemTitle = card.checklistItems![iIdx];
                await client.query(
                  `INSERT INTO card_checklist_items (id, card_id, title, completed, position, created_by, updated_at)
                   VALUES (gen_random_uuid(), $1, $2, false, $3, $4, CURRENT_TIMESTAMP)`,
                  [cardId, itemTitle, iIdx, userId]
                );
              }

              // 8b. Registrar dependencias pendientes para resolver después
              for (const depTitle of (card.dependsOn ?? [])) {
                pendingDeps.push({ blockingTitle: depTitle, blockedId: cardId });
              }
            }
          }

          // 9. Resolver y crear dependencias entre cards del board
          for (const dep of pendingDeps) {
            const blockingId = cardTitleToId.get(dep.blockingTitle);
            if (!blockingId || blockingId === dep.blockedId) continue;
            await client.query(
              `INSERT INTO card_dependencies (id, blocking_card_id, blocked_card_id, created_by)
               VALUES (gen_random_uuid(), $1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [blockingId, dep.blockedId, userId]
            );
          }
        }
      }

      await client.query('COMMIT');
      return { workspaceId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const aiWorkspaceBuilderService = new AiWorkspaceBuilderService();
