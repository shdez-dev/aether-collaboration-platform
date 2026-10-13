import { z } from 'zod';
import { pool } from '../lib/db';
import { OrganizationServiceError } from './OrganizationService';

const emailDomain = z.string().trim().toLowerCase().regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/).max(253);
export const teamOrganizationSettingsSchema = z.object({
  membership: z.object({
    invitationAuthority: z.enum(['OWNER_AND_ADMIN', 'OWNER_ONLY', 'ALL_MEMBERS']),
    allowedEmailDomains: z.array(emailDomain).max(30),
    defaultWorkspaceId: z.string().uuid().nullable(),
  }).strict(),
}).strict();

export type TeamOrganizationSettings = z.infer<typeof teamOrganizationSettingsSchema>;

export const defaultTeamOrganizationSettings: TeamOrganizationSettings = {
  membership: { invitationAuthority: 'OWNER_AND_ADMIN', allowedEmailDomains: [], defaultWorkspaceId: null },
};

function withDefaults(value: unknown): TeamOrganizationSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultTeamOrganizationSettings;
  const stored = value as Record<string, any>;
  return teamOrganizationSettingsSchema.parse({
    membership: { ...defaultTeamOrganizationSettings.membership, ...(stored.membership ?? {}) },
  });
}

export async function getTeamOrganizationSettings(organizationId: string) {
  const result = await pool.query('SELECT settings FROM team_organization_settings WHERE organization_id = $1', [organizationId]);
  return withDefaults(result.rows[0]?.settings);
}

export async function loadTeamOrganizationSettingsForMember(organizationId: string, actorId: string) {
  const result = await pool.query(
    `SELECT o.type, om.role, s.settings, s.updated_at
       FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2
       LEFT JOIN team_organization_settings s ON s.organization_id = o.id
      WHERE o.id = $1`, [organizationId, actorId],
  );
  const row = result.rows[0];
  if (!row) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found or access denied', 404);
  if (row.type !== 'COMPANY') throw new OrganizationServiceError('TEAM_SETTINGS_CONTEXT_REQUIRED', 'Only team organizations have these settings', 409);
  return { settings: withDefaults(row.settings), canManage: ['OWNER', 'ADMIN'].includes(row.role), updatedAt: row.updated_at ?? null };
}

export async function saveTeamOrganizationSettings(organizationId: string, actorId: string, settings: TeamOrganizationSettings) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const membership = await client.query(
      `SELECT o.type, om.role FROM organizations o
         JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2
        WHERE o.id = $1 FOR UPDATE OF o`, [organizationId, actorId],
    );
    const row = membership.rows[0];
    if (!row) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found or access denied', 404);
    if (row.type !== 'COMPANY') throw new OrganizationServiceError('TEAM_SETTINGS_CONTEXT_REQUIRED', 'Only team organizations have these settings', 409);
    if (!['OWNER', 'ADMIN'].includes(row.role)) throw new OrganizationServiceError('FORBIDDEN', 'Organization administration required', 403);

    if (settings.membership.defaultWorkspaceId) {
      const workspace = await client.query(
        `SELECT id FROM workspaces
          WHERE id = $1 AND organization_id = $2 AND operating_mode = 'TEAM' AND archived = FALSE
          FOR SHARE`,
        [settings.membership.defaultWorkspaceId, organizationId],
      );
      if (!workspace.rows[0]) throw new OrganizationServiceError('DEFAULT_WORKSPACE_UNAVAILABLE', 'Selecciona un espacio de equipo activo de esta organización.', 400);
    }

    await client.query(
      `INSERT INTO team_organization_settings (organization_id, settings, updated_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (organization_id) DO UPDATE
         SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
      [organizationId, JSON.stringify(settings), actorId],
    );
    await client.query('COMMIT');
    return settings;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
