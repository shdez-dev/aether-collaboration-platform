import { z } from 'zod';
import { pool } from '../lib/db';
import { OrganizationServiceError } from './OrganizationService';

const domain = z.string().trim().toLowerCase().regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/).max(253);

export const institutionalSettingsSchema = z.object({
  profile: z.object({
    description: z.string().trim().max(2000),
    logoUrl: z.union([z.string().url().max(1000), z.literal('')]),
    timezone: z.string().trim().min(1).max(100),
    locale: z.enum(['es-CL', 'es-ES', 'en-US']),
    businessDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }).strict(),
  membership: z.object({
    invitationAuthority: z.enum(['OWNER_AND_ADMIN', 'OWNER_ONLY']),
    allowedEmailDomains: z.array(domain).max(30),
  }).strict(),
  requester: z.object({
    label: z.string().trim().min(2).max(60),
    defaultWorkspaceId: z.string().uuid().nullable(),
    canSubmit: z.boolean(),
    canEditAfterSubmission: z.boolean(),
    canAttach: z.boolean(),
    canInviteCollaborators: z.boolean(),
    canWithdraw: z.boolean(),
    maxOpenInitiatives: z.number().int().min(0).max(100),
    decisionVisibility: z.enum(['STATUS', 'REASON']),
  }).strict(),
  governance: z.object({
    mentorRequiredForValidation: z.boolean(),
    separateApproverFromRequester: z.boolean(),
    coordinatorCanApprove: z.boolean(),
    leadRequiredForConversion: z.boolean(),
  }).strict(),
  privacy: z.object({
    allowExternalInitiativeAccess: z.boolean(),
  }).strict(),
  communication: z.object({
    notifyOnSubmission: z.boolean(),
    notifyOnDecision: z.boolean(),
  }).strict(),
  operations: z.object({
    intakePaused: z.boolean(),
  }).strict(),
}).strict();

export type InstitutionalSettings = z.infer<typeof institutionalSettingsSchema>;

export const defaultInstitutionalSettings: InstitutionalSettings = {
  profile: { description: '', logoUrl: '', timezone: 'America/Santiago', locale: 'es-CL', businessDays: [1, 2, 3, 4, 5] },
  membership: { invitationAuthority: 'OWNER_AND_ADMIN', allowedEmailDomains: [] },
  requester: {
    label: 'Solicitante', defaultWorkspaceId: null, canSubmit: true, canEditAfterSubmission: true,
    canAttach: true, canInviteCollaborators: false, canWithdraw: true,
    maxOpenInitiatives: 0, decisionVisibility: 'REASON',
  },
  governance: {
    mentorRequiredForValidation: false, separateApproverFromRequester: true,
    coordinatorCanApprove: true, leadRequiredForConversion: false,
  },
  privacy: { allowExternalInitiativeAccess: false },
  communication: { notifyOnSubmission: true, notifyOnDecision: true },
  operations: { intakePaused: false },
};

function withDefaults(value: unknown): InstitutionalSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultInstitutionalSettings;
  const stored = value as Record<string, any>;
  return institutionalSettingsSchema.parse(Object.fromEntries(
    Object.entries(defaultInstitutionalSettings).map(([section, defaults]) => [section, { ...defaults, ...(stored[section] ?? {}) }]),
  ));
}

export async function getInstitutionalSettings(organizationId: string): Promise<InstitutionalSettings> {
  const result = await pool.query('SELECT settings FROM institutional_organization_settings WHERE organization_id = $1', [organizationId]);
  return withDefaults(result.rows[0]?.settings);
}

export async function getInstitutionalSettingsForWorkspace(workspaceId: string): Promise<InstitutionalSettings> {
  const result = await pool.query(
    `SELECT s.settings FROM workspaces w
       JOIN organizations o ON o.id = w.organization_id AND o.type = 'INSTITUTION'::"OrganizationType"
       LEFT JOIN institutional_organization_settings s ON s.organization_id = o.id
      WHERE w.id = $1`, [workspaceId],
  );
  if (!result.rows[0]) throw new OrganizationServiceError('INSTITUTIONAL_CONTEXT_REQUIRED', 'Institutional workspace required', 409);
  return withDefaults(result.rows[0].settings);
}

export async function getInstitutionalSettingsForInitiative(initiativeId: string): Promise<InstitutionalSettings> {
  const result = await pool.query(
    `SELECT s.settings FROM initiatives i JOIN workspaces w ON w.id = i.workspace_id
       JOIN organizations o ON o.id = w.organization_id AND o.type = 'INSTITUTION'::"OrganizationType"
       LEFT JOIN institutional_organization_settings s ON s.organization_id = o.id
      WHERE i.id = $1`, [initiativeId],
  );
  if (!result.rows[0]) throw new OrganizationServiceError('INSTITUTIONAL_CONTEXT_REQUIRED', 'Institutional initiative required', 409);
  return withDefaults(result.rows[0].settings);
}

export async function loadInstitutionalSettingsForMember(organizationId: string, actorId: string) {
  const result = await pool.query(
    `SELECT o.type, om.role, s.settings, s.updated_at
       FROM organizations o JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2
       LEFT JOIN institutional_organization_settings s ON s.organization_id = o.id
      WHERE o.id = $1`, [organizationId, actorId],
  );
  const row = result.rows[0];
  if (!row) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found or access denied', 404);
  if (row.type !== 'INSTITUTION') throw new OrganizationServiceError('INSTITUTIONAL_CONTEXT_REQUIRED', 'Only institutional organizations have these settings', 409);
  return { settings: withDefaults(row.settings), canManage: ['OWNER', 'ADMIN'].includes(row.role), updatedAt: row.updated_at ?? null };
}

export async function getInstitutionalSettingsHistory(organizationId: string, actorId: string) {
  const access = await loadInstitutionalSettingsForMember(organizationId, actorId);
  if (!access.canManage) throw new OrganizationServiceError('FORBIDDEN', 'Organization administration required', 403);
  const result = await pool.query(
    `SELECT h.id, h.created_at, h.previous_settings, h.new_settings, u.name AS actor_name
       FROM institutional_organization_settings_history h
       LEFT JOIN users u ON u.id = h.actor_id
      WHERE h.organization_id = $1 ORDER BY h.created_at DESC, h.id DESC LIMIT 50`, [organizationId],
  );
  return result.rows.map((row) => ({
    id: row.id, createdAt: row.created_at, actorName: row.actor_name ?? 'Persona no disponible',
    changedSections: Object.keys(defaultInstitutionalSettings).filter((section) =>
      JSON.stringify(row.previous_settings?.[section]) !== JSON.stringify(row.new_settings?.[section])),
  }));
}

export async function saveInstitutionalSettings(organizationId: string, actorId: string, settings: InstitutionalSettings) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: settings.profile.timezone }); }
  catch { throw new OrganizationServiceError('INVALID_TIMEZONE', 'La zona horaria no es válida', 400); }
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
    if (row.type !== 'INSTITUTION') throw new OrganizationServiceError('INSTITUTIONAL_CONTEXT_REQUIRED', 'Only institutional organizations have these settings', 409);
    if (!['OWNER', 'ADMIN'].includes(row.role)) throw new OrganizationServiceError('FORBIDDEN', 'Organization administration required', 403);
    if (settings.requester.defaultWorkspaceId) {
      const workspace = await client.query(
        `SELECT id FROM workspaces
          WHERE id = $1 AND organization_id = $2 AND operating_mode = 'INSTITUTIONAL' AND archived = FALSE
          FOR SHARE`,
        [settings.requester.defaultWorkspaceId, organizationId],
      );
      if (!workspace.rows[0]) throw new OrganizationServiceError('DEFAULT_WORKSPACE_UNAVAILABLE', 'Selecciona un espacio institucional activo de esta organización.', 400);
    }
    const prior = await client.query('SELECT settings FROM institutional_organization_settings WHERE organization_id = $1 FOR UPDATE', [organizationId]);
    const previous = withDefaults(prior.rows[0]?.settings);
    await client.query(
      `INSERT INTO institutional_organization_settings (organization_id, settings, updated_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (organization_id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
      [organizationId, JSON.stringify(settings), actorId],
    );
    if (JSON.stringify(previous) !== JSON.stringify(settings)) {
      await client.query(
        `INSERT INTO institutional_organization_settings_history
          (organization_id, actor_id, previous_settings, new_settings) VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
        [organizationId, actorId, JSON.stringify(previous), JSON.stringify(settings)],
      );
    }
    await client.query('COMMIT');
    return settings;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
