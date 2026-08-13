import { pool } from '../lib/db';

export type ProjectAction = 'READ' | 'CONTRIBUTE' | 'MANAGE';
export type ProjectAccessLevel = 'READ' | 'CONTRIBUTE' | 'MANAGE';

export type ProjectAccess = {
  projectId: string;
  workspaceId: string;
  level: ProjectAccessLevel;
  external: boolean;
};

/**
 * The single authority for project-scoped access.
 *
 * Workspace membership grants access to the platform and resources that are
 * not attached to a project. It deliberately does not grant project access to
 * MEMBER/VIEWER users. Workspace OWNER/ADMIN keep governance access.
 */
export class ProjectAuthorizationService {
  async getAccess(projectId: string, userId: string): Promise<ProjectAccess | null> {
    const result = await pool.query(
      `SELECT
         p.workspace_id,
         (p.owner_id = $2 AND EXISTS (
           SELECT 1 FROM workspace_members wm
           WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $2
         )) AS is_project_owner,
         EXISTS (
           SELECT 1 FROM workspace_members wm
           WHERE wm.workspace_id = p.workspace_id
             AND wm.user_id = $2
             AND wm.role IN ('OWNER', 'ADMIN')
         ) AS is_workspace_admin,
         EXISTS (
           SELECT 1 FROM project_members pm
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pm.user_id
           WHERE pm.project_id = p.id AND pm.user_id = $2
         ) AS is_direct_member,
         EXISTS (
           SELECT 1 FROM project_members pm
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pm.user_id
           WHERE pm.project_id = p.id AND pm.user_id = $2
             AND pm.role IN ('OWNER', 'ADMIN')
         ) AS is_direct_manager,
         EXISTS (
           SELECT 1 FROM project_members pm
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pm.user_id
           WHERE pm.project_id = p.id AND pm.user_id = $2
             AND pm.role IN ('OWNER', 'ADMIN', 'MEMBER')
         ) AS is_direct_contributor,
         EXISTS (
           SELECT 1 FROM team_members tm
           JOIN project_teams pt ON pt.team_id = tm.team_id
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = tm.user_id
           WHERE pt.project_id = p.id AND tm.user_id = $2
         ) AS is_team_member,
         EXISTS (
           SELECT 1 FROM team_members tm
           JOIN project_teams pt ON pt.team_id = tm.team_id
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = tm.user_id
           WHERE pt.project_id = p.id AND tm.user_id = $2
             AND tm.role IN ('ADMIN', 'MEMBER')
         ) AS is_team_contributor,
         EXISTS (
           SELECT 1 FROM project_role_assignments pra
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pra.user_id
           WHERE pra.project_id = p.id AND pra.user_id = $2 AND pra.ended_at IS NULL
         ) AS has_operational_role,
         EXISTS (
           SELECT 1 FROM project_role_assignments pra
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pra.user_id
           WHERE pra.project_id = p.id AND pra.user_id = $2 AND pra.ended_at IS NULL
             AND pra.role = 'PROJECT_LEAD'
         ) AS is_project_lead,
         EXISTS (
           SELECT 1 FROM project_role_assignments pra
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pra.user_id
           WHERE pra.project_id = p.id AND pra.user_id = $2 AND pra.ended_at IS NULL
             AND pra.role IN ('COLLABORATOR', 'MENTOR')
         ) AS is_operational_contributor,
         COALESCE((
           SELECT g.permission FROM network_access_grants g
           WHERE g.resource_type = 'PROJECT' AND g.resource_id = p.id AND g.user_id = $2
             AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
           ORDER BY g.created_at DESC
           LIMIT 1
         ), '') AS external_permission
       FROM projects p
       WHERE p.id = $1`,
      [projectId, userId],
    );

    const row = result.rows[0];
    if (!row) return null;

    const isExternal = Boolean(row.external_permission);
    const canManage = Boolean(
      row.is_project_owner || row.is_workspace_admin || row.is_direct_manager || row.is_project_lead,
    );
    const canContribute = canManage || Boolean(
      row.is_direct_contributor || row.is_team_contributor || row.is_operational_contributor || row.external_permission === 'EDIT',
    );
    const canRead = canContribute || Boolean(
      row.is_direct_member || row.is_team_member || row.has_operational_role || isExternal,
    );

    if (!canRead) return null;
    return {
      projectId,
      workspaceId: row.workspace_id,
      level: canManage ? 'MANAGE' : canContribute ? 'CONTRIBUTE' : 'READ',
      external: isExternal,
    };
  }

  async can(projectId: string, userId: string, action: ProjectAction): Promise<ProjectAccess | null> {
    const access = await this.getAccess(projectId, userId);
    if (!access) return null;
    if (action === 'READ') return access;
    if (action === 'CONTRIBUTE' && access.level !== 'READ') return access;
    if (action === 'MANAGE' && access.level === 'MANAGE') return access;
    return null;
  }

  async getAccessibleProjectIds(userId: string, workspaceId?: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT p.id
       FROM projects p
       WHERE ($2::uuid IS NULL OR p.workspace_id = $2::uuid)
         AND (
           (p.owner_id = $1 AND EXISTS (
             SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $1
           ))
           OR EXISTS (
             SELECT 1 FROM workspace_members wm
             WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $1 AND wm.role IN ('OWNER', 'ADMIN')
           )
           OR EXISTS (
             SELECT 1 FROM project_members pm
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pm.user_id
             WHERE pm.project_id = p.id AND pm.user_id = $1
           )
           OR EXISTS (
             SELECT 1 FROM project_teams pt
             JOIN team_members tm ON tm.team_id = pt.team_id
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = tm.user_id
             WHERE pt.project_id = p.id AND tm.user_id = $1
           )
           OR EXISTS (
             SELECT 1 FROM project_role_assignments pra
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pra.user_id
             WHERE pra.project_id = p.id AND pra.user_id = $1 AND pra.ended_at IS NULL
           )
           OR EXISTS (
             SELECT 1 FROM network_access_grants g
             WHERE g.resource_type = 'PROJECT' AND g.resource_id = p.id AND g.user_id = $1
               AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
           )
         )`,
      [userId, workspaceId ?? null],
    );
    return result.rows.map((row) => row.id as string);
  }

  /**
   * A board must be readable through every project it belongs to. This keeps a
   * legacy shared board from becoming a side-channel when it is rendered from
   * one of its linked projects.
   */
  async getVisibleBoardIds(projectId: string, userId: string): Promise<string[]> {
    const accessibleProjectIds = await this.getAccessibleProjectIds(userId);
    if (!accessibleProjectIds.includes(projectId)) return [];

    const result = await pool.query(
      `SELECT pb.board_id
       FROM project_boards pb
       WHERE pb.project_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM project_boards other
           WHERE other.board_id = pb.board_id
             AND NOT (other.project_id = ANY($2::uuid[]))
         )`,
      [projectId, accessibleProjectIds],
    );
    return result.rows.map((row) => row.board_id as string);
  }
}

export const projectAuthorizationService = new ProjectAuthorizationService();
