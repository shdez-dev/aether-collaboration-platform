import type { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../lib/db';

const scrumAssignmentInput = z.object({
  role: z.enum(['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER']),
});
const productGoalInput = z.object({
  productGoal: z.string().trim().max(8000).nullable(),
});

async function getAssignments(projectId: string, workspaceId: string, organizationId: string) {
  const result = await pool.query(
    `WITH participants AS (
       SELECT owner_id AS user_id FROM projects WHERE id = $1
       UNION SELECT user_id FROM project_members WHERE project_id = $1
       UNION SELECT tm.user_id FROM team_members tm
         JOIN project_teams pt ON pt.team_id = tm.team_id WHERE pt.project_id = $1
       UNION SELECT user_id FROM project_role_assignments
         WHERE project_id = $1 AND ended_at IS NULL
     )
     SELECT participants.user_id AS "userId", u.name, u.email,
            COALESCE(a.role, 'DEVELOPER') AS role
       FROM participants
       JOIN users u ON u.id = participants.user_id
       JOIN workspace_members wm ON wm.workspace_id = $2 AND wm.user_id = participants.user_id
       LEFT JOIN project_methodology_assignments a
         ON a.project_id = $1 AND a.user_id = participants.user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_access_revocations r
         WHERE r.organization_id = $3 AND r.user_id = participants.user_id
      )
      ORDER BY CASE COALESCE(a.role, 'DEVELOPER')
        WHEN 'PRODUCT_OWNER' THEN 1 WHEN 'SCRUM_MASTER' THEN 2 ELSE 3 END, u.name`,
    [projectId, workspaceId, organizationId],
  );
  return result.rows;
}

export class ProjectMethodologyController {
  async updateProductGoal(req: Request, res: Response) {
    const parsed = productGoalInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'El objetivo del producto debe tener 8000 caracteres o menos.' },
      });
    }

    try {
      const result = await pool.query(
        `UPDATE projects SET product_goal = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND methodology = 'SCRUM'
          RETURNING product_goal AS "productGoal"`,
        [req.params.id, parsed.data.productGoal || null],
      );
      if (!result.rows.length) {
        return res.status(409).json({
          success: false,
          error: { code: 'SCRUM_REQUIRED', message: 'El objetivo del producto solo está disponible en proyectos Scrum.' },
        });
      }
      return res.json({ success: true, data: { productGoal: result.rows[0].productGoal } });
    } catch (cause) {
      console.error('[ProjectMethodologyController.updateProductGoal]', cause);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'No se pudo guardar el objetivo del producto.' },
      });
    }
  }

  async updateScrumAssignment(req: Request, res: Response) {
    const parsed = scrumAssignmentInput.safeParse(req.body);
    const userId = z.string().uuid().safeParse(req.params.userId);
    if (!parsed.success || !userId.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Selecciona una responsabilidad Scrum válida.' },
      });
    }

    const projectId = req.params.id;
    const targetUserId = userId.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const project = await client.query(
        `SELECT p.workspace_id, w.organization_id
           FROM projects p JOIN workspaces w ON w.id = p.workspace_id
          WHERE p.id = $1 AND p.methodology = 'SCRUM' FOR UPDATE OF p`,
        [projectId],
      );
      if (!project.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: { code: 'SCRUM_REQUIRED', message: 'Las responsabilidades Scrum requieren un proyecto Scrum.' },
        });
      }

      const { workspace_id: workspaceId, organization_id: organizationId } = project.rows[0];
      const participant = await client.query(
        `SELECT 1
           FROM users u JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = $2
          WHERE u.id = $3
            AND NOT EXISTS (
              SELECT 1 FROM organization_access_revocations r
               WHERE r.organization_id = $4 AND r.user_id = u.id
            )
            AND (
              EXISTS (SELECT 1 FROM projects p WHERE p.id = $1 AND p.owner_id = u.id)
              OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = u.id)
              OR EXISTS (
                SELECT 1 FROM project_teams pt JOIN team_members tm ON tm.team_id = pt.team_id
                 WHERE pt.project_id = $1 AND tm.user_id = u.id
              )
              OR EXISTS (
                SELECT 1 FROM project_role_assignments pra
                 WHERE pra.project_id = $1 AND pra.user_id = u.id AND pra.ended_at IS NULL
              )
            )`,
        [projectId, workspaceId, targetUserId, organizationId],
      );
      if (!participant.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: { code: 'PROJECT_PARTICIPANT_REQUIRED', message: 'La persona no participa en este proyecto.' },
        });
      }

      if (parsed.data.role !== 'DEVELOPER') {
        // Scrum has one Product Owner and one Scrum Master. The previous
        // assignee returns to the Developers responsibility automatically.
        await client.query(
          `UPDATE project_methodology_assignments SET role = 'DEVELOPER'
            WHERE project_id = $1 AND role = $2 AND user_id <> $3`,
          [projectId, parsed.data.role, targetUserId],
        );
      }
      await client.query(
        `INSERT INTO project_methodology_assignments (id, project_id, user_id, role)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [projectId, targetUserId, parsed.data.role],
      );
      await client.query('COMMIT');

      const assignments = await getAssignments(projectId, workspaceId, organizationId);
      return res.json({ success: true, data: { assignments } });
    } catch (cause) {
      await client.query('ROLLBACK');
      console.error('[ProjectMethodologyController.updateScrumAssignment]', cause);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'No se pudo actualizar la responsabilidad Scrum.' },
      });
    } finally {
      client.release();
    }
  }
}

export const projectMethodologyController = new ProjectMethodologyController();
