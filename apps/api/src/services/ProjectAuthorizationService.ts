import { pool } from '../lib/db';
import {
  ORGANIZATION_ACCESS_PERMISSION_KEYS,
  type OrganizationAccessPermission,
  type OrganizationAccessRolePermissions,
} from '@aether/types';

export type ProjectAction =
  | 'READ' | 'CONTRIBUTE' | 'MANAGE'
  | 'MANAGE_PROJECT' | 'MANAGE_MEMBERS' | 'MANAGE_BOARDS' | 'MANAGE_PLANNING'
  | 'MANAGE_RISKS' | 'MANAGE_TRACEABILITY' | 'MANAGE_DOCUMENTS' | 'MANAGE_TEAMS'
  | 'CREATE_WORK' | 'EDIT_WORK' | 'COMMENT_WORK' | 'DELETE_WORK';
export type ProjectAccessLevel = 'READ' | 'CONTRIBUTE' | 'MANAGE';

export type ProjectAccess = {
  projectId: string;
  workspaceId: string;
  level: ProjectAccessLevel;
  external: boolean;
  permissions: OrganizationAccessRolePermissions;
  grantedAction?: ProjectAction;
};

const noPermissions = (): OrganizationAccessRolePermissions =>
  Object.fromEntries(ORGANIZATION_ACCESS_PERMISSION_KEYS.map((key) => [key, false])) as OrganizationAccessRolePermissions;

function legacyRolePermissions(role: string | null | undefined): OrganizationAccessRolePermissions {
  const permissions = noPermissions();
  if (role === 'ADMIN') return Object.fromEntries(ORGANIZATION_ACCESS_PERMISSION_KEYS.map((key) => [key, true])) as OrganizationAccessRolePermissions;
  permissions['project.view'] = role === 'MEMBER' || role === 'VIEWER';
  if (role === 'MEMBER') {
    permissions['work.create'] = true;
    permissions['work.edit'] = true;
    permissions['work.comment'] = true;
  }
  return permissions;
}

function mergePermissions(...sources: Array<unknown>): OrganizationAccessRolePermissions {
  const result = noPermissions();
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of ORGANIZATION_ACCESS_PERMISSION_KEYS) {
      if ((source as Record<string, unknown>)[key] === true) result[key] = true;
    }
  }
  return result;
}

function rolePermissions(row: any, directRole: string | null) {
  if (directRole) return mergePermissions(row.direct_role_permissions ?? legacyRolePermissions(directRole));
  const teamRoles = Array.isArray(row.team_role_permissions) ? row.team_role_permissions : [];
  return mergePermissions(...teamRoles, row.legacy_team_role ? legacyRolePermissions(row.legacy_team_role) : null);
}

function hasWorkContribution(permissions: OrganizationAccessRolePermissions) {
  return permissions['work.create'] || permissions['work.edit'] || permissions['work.comment'];
}

function actionPermission(action: ProjectAction): OrganizationAccessPermission | 'work.contribute' {
  switch (action) {
    case 'READ': return 'project.view';
    case 'CONTRIBUTE': return 'work.contribute';
    case 'MANAGE':
    case 'MANAGE_PROJECT': return 'project.manage';
    case 'MANAGE_MEMBERS': return 'members.manage';
    case 'MANAGE_BOARDS': return 'boards.manage';
    case 'MANAGE_PLANNING': return 'planning.manage';
    case 'MANAGE_RISKS': return 'risks.manage';
    case 'MANAGE_TRACEABILITY': return 'traceability.manage';
    case 'MANAGE_DOCUMENTS': return 'documents.manage';
    case 'MANAGE_TEAMS': return 'teams.manage';
    case 'CREATE_WORK': return 'work.create';
    case 'EDIT_WORK': return 'work.edit';
    case 'COMMENT_WORK': return 'work.comment';
    case 'DELETE_WORK': return 'work.delete';
  }
}

function allows(permissions: OrganizationAccessRolePermissions, action: ProjectAction) {
  const key = actionPermission(action);
  if (key === 'work.contribute') return hasWorkContribution(permissions);
  return permissions[key];
}

function fullPermissions() {
  return Object.fromEntries(ORGANIZATION_ACCESS_PERMISSION_KEYS.map((key) => [key, true])) as OrganizationAccessRolePermissions;
}

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
         o.type AS organization_type,
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
         (
           SELECT pm.role FROM project_members pm
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pm.user_id
           WHERE pm.project_id = p.id AND pm.user_id = $2
           LIMIT 1
         ) AS direct_project_role,
         (
           SELECT r.permissions FROM organization_access_roles r
           JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2 AND pm.role = r.role_key
           WHERE r.organization_id = w.organization_id LIMIT 1
         ) AS direct_role_permissions,
         COALESCE((
           SELECT jsonb_agg(r.permissions)
             FROM team_members tm
             JOIN project_teams pt ON pt.team_id = tm.team_id
             JOIN organization_access_roles r ON r.organization_id = w.organization_id AND r.role_key = tm.role
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = tm.user_id
            WHERE pt.project_id = p.id AND tm.user_id = $2
         ), '[]'::jsonb) AS team_role_permissions,
         (SELECT tm.role
            FROM team_members tm
            JOIN project_teams pt ON pt.team_id = tm.team_id
            JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = tm.user_id
           WHERE pt.project_id = p.id AND tm.user_id = $2
           ORDER BY CASE tm.role WHEN 'ADMIN' THEN 3 WHEN 'MEMBER' THEN 2 ELSE 1 END DESC
           LIMIT 1) AS legacy_team_role,
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
         EXISTS (
           SELECT 1 FROM project_methodology_assignments pma
           JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pma.user_id
           WHERE pma.project_id = p.id AND pma.user_id = $2 AND p.methodology = 'SCRUM'
             AND NOT EXISTS (
               SELECT 1 FROM organization_access_revocations r
               WHERE r.organization_id = w.organization_id AND r.user_id = $2
             )
             AND (
               p.owner_id = $2
               OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2)
               OR EXISTS (
                 SELECT 1 FROM project_teams pt JOIN team_members tm ON tm.team_id = pt.team_id
                  WHERE pt.project_id = p.id AND tm.user_id = $2
               )
               OR EXISTS (
                 SELECT 1 FROM project_role_assignments pra
                  WHERE pra.project_id = p.id AND pra.user_id = $2 AND pra.ended_at IS NULL
               )
             )
         ) AS has_scrum_role,
         COALESCE((
           SELECT g.permission FROM network_access_grants g
           WHERE g.resource_type = 'PROJECT' AND g.resource_id = p.id AND g.user_id = $2
             AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
           ORDER BY g.created_at DESC
           LIMIT 1
         ), '') AS external_permission
       FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       JOIN organizations o ON o.id = w.organization_id
       WHERE p.id = $1`,
      [projectId, userId],
    );

    const row = result.rows[0];
    if (!row) return null;

    const isPersonalOrganization = row.organization_type === 'PERSONAL';
    const isExternal = !isPersonalOrganization && Boolean(row.external_permission);
    const hasProjectOverride = Boolean(row.direct_project_role);
    const isPrivileged = Boolean(row.is_project_owner || (!isPersonalOrganization && row.is_workspace_admin));
    const hasProjectRelationship = Boolean(
      hasProjectOverride || row.is_team_member || row.has_operational_role,
    );
    const permissions = isPrivileged
      ? fullPermissions()
      : rolePermissions(row, row.direct_project_role ?? null);

    // Operational leads remain project administrators. Other operational roles
    // and Scrum assignments grant work participation without project settings.
    if (!isPersonalOrganization && !hasProjectOverride && row.is_project_lead) {
      Object.assign(permissions, fullPermissions());
    } else if (!isPersonalOrganization && !hasProjectOverride && row.is_operational_contributor) {
      permissions['project.view'] = true;
      permissions['work.create'] = true;
      permissions['work.edit'] = true;
      permissions['work.comment'] = true;
    }
    // Scrum responsibilities are a scoped capability overlay. They let an
    // assigned Scrum participant contribute to project work, while the
    // role-specific routes still protect backlog and sprint administration.
    const canContributeAsScrumParticipant = !isPersonalOrganization
      && Boolean(row.has_scrum_role)
      && hasProjectRelationship;
    if (canContributeAsScrumParticipant) {
      permissions['project.view'] = true;
      permissions['work.create'] = true;
      permissions['work.edit'] = true;
      permissions['work.comment'] = true;
    }
    if (!isPersonalOrganization && row.external_permission === 'EDIT') {
      permissions['project.view'] = true;
      permissions['work.create'] = true;
      permissions['work.edit'] = true;
      permissions['work.comment'] = true;
    } else if (!isPersonalOrganization && isExternal) {
      permissions['project.view'] = true;
    }

    const canManage = isPrivileged || permissions['project.manage'];
    const canContribute = canManage || hasWorkContribution(permissions);
    const canRead = canManage || canContribute || permissions['project.view'];

    if (!canRead) return null;
    return {
      projectId,
      workspaceId: row.workspace_id,
      level: canManage ? 'MANAGE' : canContribute ? 'CONTRIBUTE' : 'READ',
      external: isExternal,
      permissions,
    };
  }

  async can(projectId: string, userId: string, action: ProjectAction): Promise<ProjectAccess | null> {
    const access = await this.getAccess(projectId, userId);
    if (!access) return null;
    const allowed = allows(access.permissions, action);
    return allowed ? { ...access, grantedAction: action } : null;
  }

  async getAccessibleProjectIds(userId: string, workspaceId?: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT p.id
       FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       JOIN organizations o ON o.id = w.organization_id
       WHERE ($2::uuid IS NULL OR p.workspace_id = $2::uuid)
         AND (
           (p.owner_id = $1 AND EXISTS (
             SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $1
           ))
           OR (o.type <> 'PERSONAL' AND EXISTS (
             SELECT 1 FROM workspace_members wm
             WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $1 AND wm.role IN ('OWNER', 'ADMIN')
           ))
           OR (o.type <> 'PERSONAL' AND EXISTS (
             SELECT 1 FROM project_members pm
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pm.user_id
             LEFT JOIN organization_access_roles ar ON ar.organization_id = w.organization_id AND ar.role_key = pm.role
             WHERE pm.project_id = p.id AND pm.user_id = $1
               AND COALESCE((ar.permissions->>'project.view')::boolean, pm.role IN ('ADMIN', 'MEMBER', 'VIEWER'))
           ))
           OR (o.type <> 'PERSONAL' AND EXISTS (
             SELECT 1 FROM project_teams pt
             JOIN team_members tm ON tm.team_id = pt.team_id
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = tm.user_id
             LEFT JOIN organization_access_roles ar ON ar.organization_id = w.organization_id AND ar.role_key = tm.role
             WHERE pt.project_id = p.id AND tm.user_id = $1
               AND NOT EXISTS (
                 SELECT 1 FROM project_members override_member
                  WHERE override_member.project_id = p.id AND override_member.user_id = $1
               )
               AND COALESCE((ar.permissions->>'project.view')::boolean, tm.role IN ('ADMIN', 'MEMBER', 'VIEWER'))
           ))
           OR (o.type <> 'PERSONAL' AND EXISTS (
             SELECT 1 FROM project_role_assignments pra
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pra.user_id
             WHERE pra.project_id = p.id AND pra.user_id = $1 AND pra.ended_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM project_members override_member
                  WHERE override_member.project_id = p.id AND override_member.user_id = $1
               )
           ))
           OR (o.type <> 'PERSONAL' AND EXISTS (
             SELECT 1 FROM network_access_grants g
             WHERE g.resource_type = 'PROJECT' AND g.resource_id = p.id AND g.user_id = $1
               AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
           ))
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
