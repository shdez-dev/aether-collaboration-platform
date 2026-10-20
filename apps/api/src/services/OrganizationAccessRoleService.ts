import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import {
  ORGANIZATION_ACCESS_PERMISSION_KEYS,
  type OrganizationAccessRole,
  type OrganizationAccessRolePermissions,
} from '@aether/types';
import { pool } from '../lib/db';
import { OrganizationServiceError } from './OrganizationServiceError';

const permissionShape = Object.fromEntries(
  ORGANIZATION_ACCESS_PERMISSION_KEYS.map((key) => [key, z.boolean()]),
) as Record<(typeof ORGANIZATION_ACCESS_PERMISSION_KEYS)[number], z.ZodBoolean>;

const accessRoleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(180).default(''),
  permissions: z.object(permissionShape).strict(),
});

export type OrganizationAccessRoleInput = z.infer<typeof accessRoleSchema>;

const defaultPermissions = (): OrganizationAccessRolePermissions =>
  Object.fromEntries(ORGANIZATION_ACCESS_PERMISSION_KEYS.map((key) => [key, key.endsWith('.view')])) as OrganizationAccessRolePermissions;

export const DEFAULT_ORGANIZATION_ACCESS_ROLES: Array<{
  roleKey: string;
  name: string;
  description: string;
  permissions: OrganizationAccessRolePermissions;
  sortOrder: number;
}> = (() => {
  const coordinator = Object.fromEntries(ORGANIZATION_ACCESS_PERMISSION_KEYS.map((key) => [key, true])) as OrganizationAccessRolePermissions;
  const collaborator = defaultPermissions();
  collaborator['work.create'] = true;
  collaborator['work.edit'] = true;
  collaborator['work.comment'] = true;
  const observer = defaultPermissions();
  return [
    { roleKey: 'ADMIN', name: 'Administrador', description: 'Administra permisos y configuración dentro de proyectos y equipos.', permissions: coordinator, sortOrder: 0 },
    { roleKey: 'MEMBER', name: 'Miembro', description: 'Participa en el trabajo: crea y actualiza tarjetas, y comenta.', permissions: collaborator, sortOrder: 1 },
    { roleKey: 'VIEWER', name: 'Observador', description: 'Consulta la información sin modificarla.', permissions: observer, sortOrder: 2 },
  ];
})();

function parseRole(row: any): OrganizationAccessRole {
  return {
    roleKey: row.role_key,
    name: row.name,
    description: row.description ?? '',
    permissions: row.permissions as OrganizationAccessRolePermissions,
    isSystem: Boolean(row.is_system),
    assignedCount: Number(row.assigned_count ?? 0),
  };
}

function validateRoleInput(input: unknown): OrganizationAccessRoleInput {
  const parsed = accessRoleSchema.safeParse(input);
  if (!parsed.success) {
    throw new OrganizationServiceError('VALIDATION_ERROR', 'Revisa el nombre y los permisos del rol.', 400);
  }
  const { permissions } = parsed.data;
  const hasAnyPermission = ORGANIZATION_ACCESS_PERMISSION_KEYS.some((key) => key !== 'project.view' && permissions[key]);
  if (hasAnyPermission && !permissions['project.view']) {
    throw new OrganizationServiceError('PROJECT_VIEW_REQUIRED', 'Un rol debe poder ver el proyecto para usar otros permisos.', 400);
  }
  return parsed.data;
}

async function assertOrganizationMember(organizationId: string, userId: string) {
  const result = await pool.query(
    `SELECT o.type, om.role
       FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2
      WHERE o.id = $1`,
    [organizationId, userId],
  );
  if (!result.rows[0] || result.rows[0].type === 'PERSONAL') {
    throw new OrganizationServiceError('FORBIDDEN', 'No tienes acceso a los roles de esta organización.', 403);
  }
  return result.rows[0] as { type: string; role: string };
}

async function assertOrganizationManager(organizationId: string, userId: string) {
  const member = await assertOrganizationMember(organizationId, userId);
  if (!['OWNER', 'ADMIN'].includes(member.role)) {
    throw new OrganizationServiceError('FORBIDDEN', 'Solo un propietario o administrador puede configurar roles.', 403);
  }
  return member;
}

export async function seedDefaultOrganizationAccessRoles(client: PoolClient, organizationId: string) {
  for (const role of DEFAULT_ORGANIZATION_ACCESS_ROLES) {
    await client.query(
      `INSERT INTO organization_access_roles
         (organization_id, role_key, name, description, permissions, is_system, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, TRUE, $6)
       ON CONFLICT (organization_id, role_key) DO NOTHING`,
      [organizationId, role.roleKey, role.name, role.description, JSON.stringify(role.permissions), role.sortOrder],
    );
  }
}

class OrganizationAccessRoleService {
  async list(organizationId: string, userId: string): Promise<OrganizationAccessRole[]> {
    await assertOrganizationMember(organizationId, userId);
    const result = await pool.query(
      `SELECT r.role_key, r.name, r.description, r.permissions, r.is_system,
              COALESCE(project_assignments.count, 0) + COALESCE(team_assignments.count, 0)
                + COALESCE(pending_invitations.count, 0) AS assigned_count
         FROM organization_access_roles r
         LEFT JOIN (
           SELECT pm.role AS role_key, COUNT(*)::int AS count
             FROM project_members pm
             JOIN projects p ON p.id = pm.project_id
             JOIN workspaces w ON w.id = p.workspace_id
            WHERE w.organization_id = $1
            GROUP BY pm.role
         ) project_assignments ON project_assignments.role_key = r.role_key
         LEFT JOIN (
           SELECT tm.role AS role_key, COUNT(*)::int AS count
             FROM team_members tm
             JOIN teams t ON t.id = tm.team_id
             JOIN workspaces w ON w.id = t.workspace_id
            WHERE w.organization_id = $1
            GROUP BY tm.role
         ) team_assignments ON team_assignments.role_key = r.role_key
         LEFT JOIN (
           SELECT ti.role AS role_key, COUNT(*)::int AS count
             FROM team_invitations ti
             JOIN teams t ON t.id = ti.team_id
             JOIN workspaces w ON w.id = t.workspace_id
            WHERE w.organization_id = $1 AND ti.status = 'PENDING'
            GROUP BY ti.role
         ) pending_invitations ON pending_invitations.role_key = r.role_key
        WHERE r.organization_id = $1
        ORDER BY r.sort_order, r.created_at, r.name`,
      [organizationId],
    );
    return result.rows.map(parseRole);
  }

  async getAssignable(organizationId: string, roleKey: string) {
    const result = await pool.query(
      `SELECT role_key, permissions FROM organization_access_roles
        WHERE organization_id = $1 AND role_key = $2`,
      [organizationId, roleKey],
    );
    return result.rows[0] as { role_key: string; permissions: OrganizationAccessRolePermissions } | undefined;
  }

  async create(organizationId: string, userId: string, input: unknown): Promise<OrganizationAccessRole> {
    await assertOrganizationManager(organizationId, userId);
    const data = validateRoleInput(input);
    const roleKey = `ROLE_${randomUUID().replace(/-/g, '').toUpperCase()}`;
    const result = await pool.query(
      `INSERT INTO organization_access_roles
         (organization_id, role_key, name, description, permissions, is_system, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, FALSE,
               COALESCE((SELECT MAX(sort_order) + 1 FROM organization_access_roles WHERE organization_id = $1), 3))
       RETURNING role_key, name, description, permissions, is_system, 0::int AS assigned_count`,
      [organizationId, roleKey, data.name, data.description, JSON.stringify(data.permissions)],
    );
    return parseRole(result.rows[0]);
  }

  async update(organizationId: string, userId: string, roleKey: string, input: unknown): Promise<OrganizationAccessRole> {
    await assertOrganizationManager(organizationId, userId);
    const data = validateRoleInput(input);
    const result = await pool.query(
      `UPDATE organization_access_roles
          SET name = $3, description = $4, permissions = $5::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $1 AND role_key = $2
        RETURNING role_key, name, description, permissions, is_system, 0::int AS assigned_count`,
      [organizationId, roleKey, data.name, data.description, JSON.stringify(data.permissions)],
    );
    if (!result.rows[0]) throw new OrganizationServiceError('ACCESS_ROLE_NOT_FOUND', 'No se encontró el rol.', 404);
    const updated = result.rows[0];
    const currentRoles = await this.list(organizationId, userId);
    return currentRoles.find((role) => role.roleKey === updated.role_key) ?? parseRole(updated);
  }

  async remove(organizationId: string, userId: string, roleKey: string) {
    await assertOrganizationManager(organizationId, userId);
    const role = await pool.query(
      `SELECT is_system FROM organization_access_roles WHERE organization_id = $1 AND role_key = $2`,
      [organizationId, roleKey],
    );
    if (!role.rows[0]) throw new OrganizationServiceError('ACCESS_ROLE_NOT_FOUND', 'No se encontró el rol.', 404);
    if (role.rows[0].is_system) throw new OrganizationServiceError('SYSTEM_ROLE_PROTECTED', 'Los roles predeterminados no se pueden eliminar.', 409);
    const assignments = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM project_members pm JOIN projects p ON p.id = pm.project_id JOIN workspaces w ON w.id = p.workspace_id WHERE w.organization_id = $1 AND pm.role = $2)
         + (SELECT COUNT(*)::int FROM team_members tm JOIN teams t ON t.id = tm.team_id JOIN workspaces w ON w.id = t.workspace_id WHERE w.organization_id = $1 AND tm.role = $2)
         + (SELECT COUNT(*)::int FROM team_invitations ti JOIN teams t ON t.id = ti.team_id JOIN workspaces w ON w.id = t.workspace_id WHERE w.organization_id = $1 AND ti.role = $2 AND ti.status = 'PENDING') AS count`,
      [organizationId, roleKey],
    );
    const assignedCount = Number(assignments.rows[0]?.count ?? 0);
    if (assignedCount > 0) {
      throw new OrganizationServiceError('ACCESS_ROLE_IN_USE', `Reasigna primero los ${assignedCount} accesos que usan este rol.`, 409);
    }
    await pool.query(`DELETE FROM organization_access_roles WHERE organization_id = $1 AND role_key = $2`, [organizationId, roleKey]);
  }
}

export const organizationAccessRoleService = new OrganizationAccessRoleService();
