import { pool } from '../lib/db';
import crypto from 'crypto';
import type { PoolClient } from 'pg';
import type { OrganizationMemberRole, OrganizationType, OrganizationSummary } from '@aether/types';
import { capabilityService } from './CapabilityService';
import type { CapabilityQueryExecutor } from './CapabilityService';
import { emailService } from './EmailService';
import { renderOrganizationInvitationEmail } from './emailTemplates';
import { notificationService } from './NotificationService';
import { buildFrontendUrl } from '../utils/frontendUrl';

export interface OrganizationDetails extends OrganizationSummary {
  billingEmail: string | null;
  workspaces: Array<{ id: string; name: string; mode: string; archived: boolean }>;
}

export interface OrganizationMemberDetails {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: OrganizationMemberRole;
  joinedAt: Date;
}

export interface OrganizationInvitationDetails {
  id: string;
  email: string;
  role: OrganizationMemberRole;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { id: string; name: string };
}

export interface OrganizationInvitationCode {
  code: string;
  link: string;
  email: string;
  expiresAt: Date;
  emailStatus: 'sent' | 'failed' | 'not_sent';
}

export class OrganizationServiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

class OrganizationService {
  private async assertMemberCapacity(
    organizationId: string,
    client: PoolClient,
    includePendingInvitations: boolean,
  ) {
    const execute: CapabilityQueryExecutor = (text, params) => client.query(text, params);
    const entitlement = await capabilityService.getOrganizationCapabilities(organizationId, execute);
    const memberLimit = entitlement.capabilities.members;
    if (typeof memberLimit !== 'number') return;

    const count = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM organization_members WHERE organization_id = $1) AS members,
         (SELECT COUNT(*)::int FROM organization_invitations
           WHERE organization_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
             AND expires_at > CURRENT_TIMESTAMP) AS pending_invitations`,
      [organizationId],
    );
    const members = Number(count.rows[0]?.members ?? 0);
    const pendingInvitations = includePendingInvitations ? Number(count.rows[0]?.pending_invitations ?? 0) : 0;
    if (members + pendingInvitations >= memberLimit) {
      const planName = entitlement.planCode === 'TEAMS' ? 'Teams' : entitlement.planCode;
      throw new OrganizationServiceError(
        'ORGANIZATION_MEMBER_LIMIT_REACHED',
        `El plan ${planName} permite hasta ${memberLimit} miembros. Hay ${members} miembros y ${pendingInvitations} invitaciones pendientes que ocupan cupo.`,
        409,
      );
    }
  }

  async createForUser(
    userId: string,
    data: { name: string; type: OrganizationType; billingEmail?: string | null }
  ): Promise<OrganizationDetails> {
    if (data.type === 'PERSONAL') throw new Error('Personal organizations are created automatically');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (data.type !== 'COMPANY') {
        const grant = await client.query(
          `SELECT 1 FROM user_organization_creation_grants
            WHERE user_id = $1 AND organization_type = $2::"OrganizationType"
            FOR SHARE`,
          [userId, data.type],
        );
        if (!grant.rows[0]) {
          throw new OrganizationServiceError(
            'ORGANIZATION_CREATION_NOT_ALLOWED',
            'Tu cuenta no tiene autorización para crear este tipo de organización. Solicita acceso a administración.',
            403,
          );
        }
      }
      const organization = await client.query(
        `INSERT INTO organizations (id, name, type, owner_user_id, billing_email, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, $2::"OrganizationType", $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [data.name, data.type, userId, data.billingEmail ?? null]
      );
      const organizationId = organization.rows[0].id;
      await client.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role)
         VALUES (uuid_generate_v4(), $1, $2, 'OWNER'::"OrganizationMemberRole")`,
        [organizationId, userId]
      );
      const initialPlan = data.type === 'COMPANY'
        ? 'TEAMS'
        : data.type === 'INSTITUTION'
          ? 'INSTITUTIONAL'
          : null;
      if (initialPlan) {
        await client.query(
          `INSERT INTO subscriptions
            (id, organization_id, plan_code, status, provider, provider_subscription_id,
             current_period_end, cancel_at_period_end, created_at, updated_at)
           VALUES
            (uuid_generate_v4(), $1, $2, 'ACTIVE'::"SubscriptionStatus",
             'platform-admin', 'platform-admin:' || ($1::uuid)::text,
             NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [organizationId, initialPlan]
        );
      }
      await client.query('COMMIT');
      const details = await this.getForUser(organizationId, userId);
      if (!details) throw new Error('Organization could not be loaded after creation');
      return details;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCreationPermissions(userId: string): Promise<Array<Exclude<OrganizationType, 'PERSONAL'>>> {
    const result = await pool.query(
      `SELECT organization_type FROM user_organization_creation_grants
        WHERE user_id = $1 AND organization_type IN ('INSTITUTION', 'NETWORK_OPERATOR')
        ORDER BY organization_type`,
      [userId],
    );
    return [
      'COMPANY',
      ...result.rows.map((row) => row.organization_type as Exclude<OrganizationType, 'PERSONAL' | 'COMPANY'>),
    ];
  }

  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const result = await pool.query(
      `SELECT o.id, o.name, o.type, om.role,
              (SELECT COUNT(*)::int FROM workspaces w WHERE w.organization_id = o.id) AS workspace_count,
              (SELECT COUNT(*)::int FROM portfolios p WHERE p.organization_id = o.id) AS portfolio_count,
              (SELECT COUNT(DISTINCT n.id)::int FROM networks n
                LEFT JOIN network_organizations no ON no.network_id = n.id
                WHERE n.owner_organization_id = o.id OR no.organization_id = o.id) AS network_count,
              (SELECT COUNT(*)::int FROM organization_members om2 WHERE om2.organization_id = o.id) AS member_count,
              (SELECT json_build_object('planCode', s.plan_code, 'status', s.status)
                 FROM subscriptions s
                WHERE s.organization_id = o.id AND s.status IN ('TRIALING', 'ACTIVE', 'PAST_DUE')
                  AND (s.current_period_end IS NULL OR s.current_period_end > CURRENT_TIMESTAMP)
                ORDER BY CASE WHEN s.provider = 'platform-admin' THEN 0 ELSE 1 END,
                  CASE s.status WHEN 'ACTIVE' THEN 1 WHEN 'TRIALING' THEN 2 ELSE 3 END,
                  s.updated_at DESC, s.created_at DESC, s.id DESC LIMIT 1) AS subscription
         FROM organizations o
         JOIN organization_members om ON om.organization_id = o.id
        WHERE om.user_id = $1
        ORDER BY CASE WHEN o.type = 'PERSONAL' THEN 0 ELSE 1 END, o.updated_at DESC`,
      [userId]
    );
    return result.rows.map((row) => this.formatSummary(row));
  }

  async getForUser(organizationId: string, userId: string): Promise<OrganizationDetails | null> {
    const result = await pool.query(
      `SELECT o.id, o.name, o.type, o.billing_email, om.role,
              (SELECT COUNT(*)::int FROM workspaces w WHERE w.organization_id = o.id) AS workspace_count,
              (SELECT COUNT(*)::int FROM portfolios p WHERE p.organization_id = o.id) AS portfolio_count,
              (SELECT COUNT(DISTINCT n.id)::int FROM networks n
                LEFT JOIN network_organizations no ON no.network_id = n.id
                WHERE n.owner_organization_id = o.id OR no.organization_id = o.id) AS network_count,
              (SELECT COUNT(*)::int FROM organization_members om2 WHERE om2.organization_id = o.id) AS member_count,
              (SELECT json_build_object('planCode', s.plan_code, 'status', s.status)
                 FROM subscriptions s
                WHERE s.organization_id = o.id AND s.status IN ('TRIALING', 'ACTIVE', 'PAST_DUE')
                  AND (s.current_period_end IS NULL OR s.current_period_end > CURRENT_TIMESTAMP)
                ORDER BY CASE WHEN s.provider = 'platform-admin' THEN 0 ELSE 1 END,
                  CASE s.status WHEN 'ACTIVE' THEN 1 WHEN 'TRIALING' THEN 2 ELSE 3 END,
                  s.updated_at DESC, s.created_at DESC, s.id DESC LIMIT 1) AS subscription
         FROM organizations o
         JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2
        WHERE o.id = $1`,
      [organizationId, userId]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    const workspaces = await pool.query(
      `SELECT id, name, operating_mode AS mode, archived
         FROM workspaces WHERE organization_id = $1 ORDER BY archived, updated_at DESC`,
      [organizationId]
    );
    return {
      ...this.formatSummary(row),
      billingEmail: row.billing_email ?? null,
      workspaces: workspaces.rows,
    };
  }

  async update(
    organizationId: string,
    userId: string,
    data: { name?: string; type?: OrganizationType; billingEmail?: string | null }
  ): Promise<OrganizationDetails | null> {
    if (data.type !== undefined) {
      throw new OrganizationServiceError('ORGANIZATION_TYPE_IMMUTABLE', 'Organization type is chosen when the organization is created', 400);
    }
    const membership = await pool.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );
    const actorRole = membership.rows[0]?.role as OrganizationMemberRole | undefined;
    const changesOnlyBillingEmail = data.billingEmail !== undefined && data.name === undefined;
    const canUpdate = changesOnlyBillingEmail
      ? ['OWNER', 'BILLING_ADMIN'].includes(actorRole ?? '')
      : ['OWNER', 'ADMIN'].includes(actorRole ?? '');
    if (!canUpdate) {
      throw new Error('Organization admin access required');
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { fields.push(`name = $${values.length + 1}`); values.push(data.name); }
    if (data.billingEmail !== undefined) { fields.push(`billing_email = $${values.length + 1}`); values.push(data.billingEmail); }
    if (fields.length > 0) {
      values.push(organizationId);
      await pool.query(`UPDATE organizations SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`, values);
    }
    return this.getForUser(organizationId, userId);
  }

  async deleteOrganization(organizationId: string, actorId: string, confirmationName: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const organization = await client.query(
        `SELECT o.name, o.type, o.owner_user_id, om.role
           FROM organizations o
           JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2
          WHERE o.id = $1
          FOR UPDATE OF o, om`,
        [organizationId, actorId]
      );
      const row = organization.rows[0];
      if (!row) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found or access denied', 404);
      if (row.role !== 'OWNER' || row.owner_user_id !== actorId) {
        throw new OrganizationServiceError('FORBIDDEN', 'Only the organization owner can delete it', 403);
      }
      if (row.type !== 'COMPANY') {
        throw new OrganizationServiceError('ORGANIZATION_TYPE_NOT_DELETABLE', 'Only team organizations can be deleted', 400);
      }
      if (confirmationName.trim() !== row.name) {
        throw new OrganizationServiceError('ORGANIZATION_NAME_MISMATCH', 'The organization name does not match', 400);
      }

      const workspaces = await client.query(
        `SELECT COUNT(*)::int AS workspace_count FROM workspaces WHERE organization_id = $1`,
        [organizationId]
      );
      const workspaceCount = Number(workspaces.rows[0]?.workspace_count ?? 0);
      if (workspaceCount > 0) {
        throw new OrganizationServiceError('WORKSPACES_EXIST', 'Delete or move all workspaces before deleting this organization', 409);
      }

      const portfolios = await client.query(
        `SELECT COUNT(*)::int AS portfolio_count FROM portfolios WHERE organization_id = $1`,
        [organizationId]
      );
      if (Number(portfolios.rows[0]?.portfolio_count ?? 0) > 0) {
        throw new OrganizationServiceError('PORTFOLIOS_EXIST', 'Remove all portfolios before deleting this organization', 409);
      }

      const networks = await client.query(
        `SELECT COUNT(DISTINCT n.id)::int AS network_count
           FROM networks n
           LEFT JOIN network_organizations no ON no.network_id = n.id
          WHERE n.owner_organization_id = $1 OR no.organization_id = $1`,
        [organizationId]
      );
      if (Number(networks.rows[0]?.network_count ?? 0) > 0) {
        throw new OrganizationServiceError('NETWORKS_EXIST', 'Remove this organization from all collaboration networks before deleting it', 409);
      }

      await client.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMembers(organizationId: string, userId: string): Promise<OrganizationMemberDetails[]> {
    await this.requireMembership(organizationId, userId);
    const result = await pool.query(
      `SELECT om.id, om.user_id, om.role, om.joined_at, u.name, u.email, u.avatar
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
        ORDER BY CASE om.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 WHEN 'BILLING_ADMIN' THEN 2 ELSE 3 END,
                 lower(u.name), u.id`,
      [organizationId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      avatar: row.avatar ?? null,
      role: row.role as OrganizationMemberRole,
      joinedAt: row.joined_at,
    }));
  }

  async getPendingInvitations(organizationId: string, userId: string): Promise<OrganizationInvitationDetails[]> {
    await this.requireRole(organizationId, userId, ['OWNER', 'ADMIN']);
    const result = await pool.query(
      `SELECT oi.id, oi.email, oi.role, oi.expires_at, oi.created_at, u.id AS invited_by_id, u.name AS invited_by_name
         FROM organization_invitations oi
         JOIN users u ON u.id = oi.invited_by
        WHERE oi.organization_id = $1
          AND oi.accepted_at IS NULL
          AND oi.revoked_at IS NULL
          AND oi.expires_at > CURRENT_TIMESTAMP
        ORDER BY oi.created_at DESC`,
      [organizationId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as OrganizationMemberRole,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      invitedBy: { id: row.invited_by_id, name: row.invited_by_name },
    }));
  }

  async inviteMember(
    organizationId: string,
    inviterId: string,
    data: { email: string; role: Exclude<OrganizationMemberRole, 'OWNER'> }
  ): Promise<OrganizationInvitationCode> {
    const email = data.email.trim().toLowerCase();
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const client = await pool.connect();
    let organizationName = '';
    let inviterName = '';
    let invitationId = '';
    let expiresAt: Date;
    try {
      await client.query('BEGIN');
      const organization = await client.query(
        `SELECT name, type FROM organizations WHERE id = $1 FOR UPDATE`,
        [organizationId]
      );
      if (!organization.rows[0]) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
      if (organization.rows[0].type === 'PERSONAL') throw new OrganizationServiceError('PERSONAL_ORGANIZATION_IMMUTABLE', 'Personal organizations cannot have additional members', 400);
      organizationName = organization.rows[0].name;
      const actor = await this.requireMembership(organizationId, inviterId, client);
      if (organization.rows[0].type === 'INSTITUTION') {
        this.assertCanInvite(actor.role, data.role);
        const policy = await client.query('SELECT settings FROM institutional_organization_settings WHERE organization_id = $1', [organizationId]);
        const membership = policy.rows[0]?.settings?.membership;
        if (membership?.invitationAuthority === 'OWNER_ONLY' && actor.role !== 'OWNER') {
          throw new OrganizationServiceError('INVITATION_OWNER_REQUIRED', 'Only the organization owner can send invitations', 403);
        }
        const allowedDomains = Array.isArray(membership?.allowedEmailDomains) ? membership.allowedEmailDomains : [];
        if (allowedDomains.length && !allowedDomains.includes(email.split('@')[1])) {
          throw new OrganizationServiceError('EMAIL_DOMAIN_NOT_ALLOWED', 'This email domain is not allowed by the institution', 400);
        }
      } else if (organization.rows[0].type === 'COMPANY') {
        const policy = await client.query('SELECT settings FROM team_organization_settings WHERE organization_id = $1', [organizationId]);
        const membership = policy.rows[0]?.settings?.membership;
        if (membership?.invitationAuthority === 'OWNER_ONLY' && actor.role !== 'OWNER') {
          throw new OrganizationServiceError('INVITATION_OWNER_REQUIRED', 'Only the organization owner can send invitations', 403);
        }
        const allowedDomains = Array.isArray(membership?.allowedEmailDomains) ? membership.allowedEmailDomains : [];
        if (allowedDomains.length && !allowedDomains.includes(email.split('@')[1])) {
          throw new OrganizationServiceError('EMAIL_DOMAIN_NOT_ALLOWED', 'This email domain is not allowed by the organization', 400);
        }
        if (actor.role === 'MEMBER' && membership?.invitationAuthority === 'ALL_MEMBERS' && data.role === 'MEMBER') {
          // Members may invite peers when enabled, but never grant organization administration.
        } else {
          this.assertCanInvite(actor.role, data.role);
        }
      } else {
        this.assertCanInvite(actor.role, data.role);
      }

      const existingMember = await client.query(
        `SELECT 1 FROM organization_members om JOIN users u ON u.id = om.user_id
          WHERE om.organization_id = $1 AND lower(u.email) = $2`,
        [organizationId, email]
      );
      if (existingMember.rows[0]) throw new OrganizationServiceError('ALREADY_MEMBER', 'This person is already a member of the organization', 409);

      // An expired invitation must never consume the one-active-invitation
      // uniqueness slot for an address.
      await client.query(
        `UPDATE organization_invitations
            SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE organization_id = $1 AND lower(email) = $2
            AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= CURRENT_TIMESTAMP`,
        [organizationId, email]
      );

      const existingInvitation = await client.query(
        `SELECT 1 FROM organization_invitations
          WHERE organization_id = $1 AND lower(email) = $2
            AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
        [organizationId, email],
      );
      if (existingInvitation.rows[0]) {
        throw new OrganizationServiceError('INVITATION_ALREADY_PENDING', 'There is already an active invitation for this email', 409);
      }
      await this.assertMemberCapacity(organizationId, client, true);

      const inviter = await client.query('SELECT name FROM users WHERE id = $1', [inviterId]);
      inviterName = inviter.rows[0]?.name ?? 'El equipo de Aether';
      const created = await client.query(
        `INSERT INTO organization_invitations (id, organization_id, email, role, token_hash, invited_by, expires_at, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, $2, $3::"OrganizationMemberRole", $4, $5, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, expires_at`,
        [organizationId, email, data.role, tokenHash, inviterId]
      );
      invitationId = created.rows[0].id;
      expiresAt = created.rows[0].expires_at;
      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') throw new OrganizationServiceError('INVITATION_ALREADY_PENDING', 'There is already an active invitation for this email', 409);
      throw error;
    } finally {
      client.release();
    }

    const invitationLink = buildFrontendUrl('/organization-invitation', { token });
    try {
      const invitee = await pool.query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
      if (invitee.rows[0]?.id) {
        await notificationService.createOrganizationInviteNotification({
          userId: invitee.rows[0].id,
          invitationId,
          organizationId,
          organizationName,
          role: data.role,
          inviterId,
          inviterName,
        });
      }
    } catch (error) {
      console.error('[OrganizationService.inviteMember] in-app notification failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    let emailStatus: OrganizationInvitationCode['emailStatus'] = 'sent';
    try {
      await emailService.sendEmail({
        to: email,
        subject: `${inviterName} te invitó a ${organizationName} en Aether`,
        text: `Aether - Invitación a una organización\n\n${inviterName} te invitó a unirte a ${organizationName}.\nAcepta la invitación: ${invitationLink}\n\nInicia sesión con la misma dirección de correo que recibió esta invitación. Expira en 7 días.`,
        html: renderOrganizationInvitationEmail(inviterName, organizationName, invitationLink),
      });
    } catch (error) {
      emailStatus = 'failed';
      console.error('[OrganizationService.inviteMember] invitation email failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    return { code: token, link: invitationLink, email, expiresAt: expiresAt!, emailStatus };
  }

  async regenerateInvitationCode(
    organizationId: string,
    invitationId: string,
    actorId: string
  ): Promise<OrganizationInvitationCode> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const actor = await this.requireMembership(organizationId, actorId, client);
      const invitation = await client.query(
        `SELECT email, role FROM organization_invitations
          WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL
            AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
          FOR UPDATE`,
        [invitationId, organizationId]
      );
      if (!invitation.rows[0]) throw new OrganizationServiceError('INVITATION_NOT_FOUND', 'Active invitation not found', 404);
      this.assertCanManageTarget(actor.role, invitation.rows[0].role, 'revoke');
      const updated = await client.query(
        `UPDATE organization_invitations SET token_hash = $2,
            expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 RETURNING expires_at`,
        [invitationId, tokenHash]
      );
      await client.query('COMMIT');
      return {
        code: token,
        link: buildFrontendUrl('/organization-invitation', { token }),
        email: invitation.rows[0].email,
        expiresAt: updated.rows[0].expires_at,
        emailStatus: 'not_sent',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getInvitationPreview(
    identifier: string,
    userId: string,
    lookup: 'token' | 'id',
  ): Promise<{ id: string; organizationId: string; organizationName: string; email: string; role: OrganizationMemberRole; expiresAt: Date }> {
    const column = lookup === 'token' ? 'token_hash' : 'id';
    const value = lookup === 'token' ? crypto.createHash('sha256').update(identifier).digest('hex') : identifier;
    const result = await pool.query(
      `SELECT oi.id, oi.organization_id AS "organizationId", o.name AS "organizationName",
              oi.email, oi.role, oi.expires_at AS "expiresAt"
         FROM organization_invitations oi
         JOIN organizations o ON o.id = oi.organization_id
         JOIN users invitee ON invitee.id = $2 AND lower(invitee.email) = lower(oi.email)
        WHERE oi.${column} = $1 AND oi.accepted_at IS NULL AND oi.revoked_at IS NULL
          AND oi.expires_at > CURRENT_TIMESTAMP AND o.type <> 'PERSONAL'`,
      [value, userId],
    );
    const invitation = result.rows[0];
    if (!invitation) throw new OrganizationServiceError('INVITATION_NOT_FOUND', 'La invitación no está disponible para esta cuenta.', 404);
    return invitation;
  }

  async acceptInvitation(token: string, userId: string): Promise<{ organizationId: string; workspaceId: string | null }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return this.acceptInvitationByLookup(tokenHash, userId, 'token_hash');
  }

  async acceptInvitationById(invitationId: string, userId: string): Promise<{ organizationId: string; workspaceId: string | null }> {
    return this.acceptInvitationByLookup(invitationId, userId, 'id');
  }

  private async acceptInvitationByLookup(
    value: string,
    userId: string,
    lookup: 'token_hash' | 'id',
  ): Promise<{ organizationId: string; workspaceId: string | null }> {
    const column = lookup;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invitationOrganization = await client.query(
        `SELECT organization_id FROM organization_invitations WHERE ${column} = $1`,
        [value],
      );
      const organizationId = invitationOrganization.rows[0]?.organization_id as string | undefined;
      if (!organizationId) throw new OrganizationServiceError('INVITATION_NOT_FOUND', 'Invitation not found or no longer active', 404);
      const organizationLock = await client.query(
        'SELECT id FROM organizations WHERE id = $1 FOR UPDATE',
        [organizationId],
      );
      if (!organizationLock.rows[0]) throw new OrganizationServiceError('INVITATION_NOT_FOUND', 'Invitation not found or no longer active', 404);
      const invitation = await client.query(
        `SELECT oi.*, o.type, u.email AS accepted_email
           FROM organization_invitations oi
           JOIN organizations o ON o.id = oi.organization_id
           JOIN users u ON u.id = $2
          WHERE oi.${column} = $1
          FOR UPDATE OF oi`,
        [value, userId]
      );
      const row = invitation.rows[0];
      if (!row || row.accepted_at || row.revoked_at || new Date(row.expires_at) <= new Date()) {
        throw new OrganizationServiceError('INVITATION_NOT_FOUND', 'Invitation not found or no longer active', 404);
      }
      if (row.type === 'PERSONAL') throw new OrganizationServiceError('PERSONAL_ORGANIZATION_IMMUTABLE', 'Personal organizations cannot have additional members', 400);
      if (String(row.email).toLowerCase() !== String(row.accepted_email).toLowerCase()) {
        throw new OrganizationServiceError('INVITATION_EMAIL_MISMATCH', 'Sign in with the email that received this invitation', 403);
      }
      const existingMembership = await client.query(
        'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [row.organization_id, userId],
      );
      if (!existingMembership.rows[0]) await this.assertMemberCapacity(row.organization_id, client, false);
      // An explicit organization invitation is the only way to restore a
      // person who was previously revoked from this account.
      await client.query(
        `DELETE FROM organization_access_revocations WHERE organization_id = $1 AND user_id = $2`,
        [row.organization_id, userId]
      );
      await client.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role)
         VALUES (uuid_generate_v4(), $1, $2, $3::"OrganizationMemberRole")
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [row.organization_id, userId, row.role]
      );
      let assignedWorkspaceId: string | null = null;
      if (row.type === 'INSTITUTION' && row.role === 'MEMBER') {
        const policy = await client.query(
          'SELECT settings FROM institutional_organization_settings WHERE organization_id = $1',
          [row.organization_id],
        );
        const defaultWorkspaceId = policy.rows[0]?.settings?.requester?.defaultWorkspaceId;
        if (defaultWorkspaceId) {
          const workspace = await client.query(
            `SELECT id FROM workspaces
              WHERE id = $1 AND organization_id = $2 AND operating_mode = 'INSTITUTIONAL' AND archived = FALSE
              FOR SHARE`,
            [defaultWorkspaceId, row.organization_id],
          );
          if (!workspace.rows[0]) {
            throw new OrganizationServiceError('DEFAULT_WORKSPACE_UNAVAILABLE', 'El espacio predeterminado de solicitantes ya no está disponible. Contacta a la institución.', 409);
          }
          await client.query(
            `INSERT INTO workspace_members (id, workspace_id, user_id, role)
             VALUES (uuid_generate_v4(), $1, $2, 'MEMBER')
             ON CONFLICT (workspace_id, user_id) DO NOTHING`,
            [defaultWorkspaceId, userId],
          );
          assignedWorkspaceId = defaultWorkspaceId;
        }
      } else if (row.type === 'COMPANY' && row.role === 'MEMBER') {
        const policy = await client.query(
          'SELECT settings FROM team_organization_settings WHERE organization_id = $1',
          [row.organization_id],
        );
        const defaultWorkspaceId = policy.rows[0]?.settings?.membership?.defaultWorkspaceId;
        if (defaultWorkspaceId) {
          const workspace = await client.query(
            `SELECT id FROM workspaces
              WHERE id = $1 AND organization_id = $2 AND operating_mode = 'TEAM' AND archived = FALSE
              FOR SHARE`,
            [defaultWorkspaceId, row.organization_id],
          );
          if (!workspace.rows[0]) {
            throw new OrganizationServiceError('DEFAULT_WORKSPACE_UNAVAILABLE', 'El espacio de equipo predeterminado ya no está disponible. Contacta a la organización.', 409);
          }
          await client.query(
            `INSERT INTO workspace_members (id, workspace_id, user_id, role)
             VALUES (uuid_generate_v4(), $1, $2, 'MEMBER')
             ON CONFLICT (workspace_id, user_id) DO NOTHING`,
            [defaultWorkspaceId, userId],
          );
          assignedWorkspaceId = defaultWorkspaceId;
        }
      }
      await client.query(
        `UPDATE organization_invitations
            SET accepted_by = $2, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [row.id, userId]
      );
      await client.query('COMMIT');
      return { organizationId: row.organization_id, workspaceId: assignedWorkspaceId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeInvitation(organizationId: string, invitationId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const actor = await this.requireMembership(organizationId, userId, client);
      const invitation = await client.query(
        `SELECT role FROM organization_invitations
          WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL
          FOR UPDATE`,
        [invitationId, organizationId]
      );
      if (!invitation.rows[0]) throw new OrganizationServiceError('INVITATION_NOT_FOUND', 'Active invitation not found', 404);
      this.assertCanManageTarget(actor.role, invitation.rows[0].role, 'revoke');
      await client.query(
        `UPDATE organization_invitations SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [invitationId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async changeMemberRole(
    organizationId: string,
    actorId: string,
    memberUserId: string,
    role: Exclude<OrganizationMemberRole, 'OWNER'>
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.assertOrganizationNotPersonal(organizationId, client);
      const actor = await this.requireMembership(organizationId, actorId, client);
      const target = await this.requireMembership(organizationId, memberUserId, client, true);
      if (target.role === 'OWNER') throw new OrganizationServiceError('OWNER_ROLE_PROTECTED', 'Transfer ownership instead of changing the owner role', 400);
      this.assertCanManageTarget(actor.role, target.role, 'change-role');
      if (actor.role === 'ADMIN' && role !== 'MEMBER') throw new OrganizationServiceError('FORBIDDEN', 'Only an owner can assign administrative organization roles', 403);
      await client.query(
        `UPDATE organization_members SET role = $3::"OrganizationMemberRole" WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, memberUserId, role]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async removeMember(organizationId: string, actorId: string, memberUserId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.assertOrganizationNotPersonal(organizationId, client);
      const actor = await this.requireMembership(organizationId, actorId, client);
      const target = await this.requireMembership(organizationId, memberUserId, client, true);
      if (target.role === 'OWNER') throw new OrganizationServiceError('OWNER_ROLE_PROTECTED', 'Transfer ownership before removing the owner', 400);
      this.assertCanManageTarget(actor.role, target.role, 'remove');

      const ownedWorkspace = await client.query(
        `SELECT name FROM workspaces WHERE organization_id = $1 AND owner_id = $2 LIMIT 1 FOR UPDATE`,
        [organizationId, memberUserId]
      );
      if (ownedWorkspace.rows[0]) throw new OrganizationServiceError('WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED', `Transfer or archive the workspace "${ownedWorkspace.rows[0].name}" before removing this member`, 409);

      await client.query(
        `INSERT INTO organization_access_revocations (organization_id, user_id, revoked_by, revoked_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (organization_id, user_id) DO UPDATE
           SET revoked_by = EXCLUDED.revoked_by, revoked_at = EXCLUDED.revoked_at`,
        [organizationId, memberUserId, actorId]
      );
      await client.query(
        `UPDATE workspace_invitations wi SET status = 'REJECTED'
           FROM workspaces w
          WHERE wi.workspace_id = w.id AND w.organization_id = $1
            AND wi.invited_user_id = $2 AND wi.status = 'PENDING'`,
        [organizationId, memberUserId]
      );
      await client.query(
        `UPDATE team_invitations ti SET status = 'REJECTED'
           FROM teams t
          WHERE ti.team_id = t.id AND t.workspace_id IN (SELECT id FROM workspaces WHERE organization_id = $1)
            AND ti.invited_user_id = $2 AND ti.status = 'PENDING'`,
        [organizationId, memberUserId]
      );

      await client.query(
        `DELETE FROM team_members tm
          USING teams t, workspaces w
         WHERE tm.team_id = t.id AND t.workspace_id = w.id
           AND w.organization_id = $1 AND tm.user_id = $2`,
        [organizationId, memberUserId]
      );
      await client.query(
        `DELETE FROM project_role_assignments pra
          USING projects p
         WHERE pra.project_id = p.id AND p.workspace_id IN (SELECT id FROM workspaces WHERE organization_id = $1)
           AND pra.user_id = $2`,
        [organizationId, memberUserId]
      );
      await client.query(
        `DELETE FROM project_members pm
          USING projects p
         WHERE pm.project_id = p.id AND p.workspace_id IN (SELECT id FROM workspaces WHERE organization_id = $1)
           AND pm.user_id = $2`,
        [organizationId, memberUserId]
      );
      await client.query(
        `DELETE FROM document_permissions dp
          USING documents d
         WHERE dp.document_id = d.id AND d.workspace_id IN (SELECT id FROM workspaces WHERE organization_id = $1)
           AND dp.user_id = $2`,
        [organizationId, memberUserId]
      );
      // Portfolio membership is an explicit organizational grant. Remove it
      // with the organization membership so stale rows cannot be reused if the
      // account is invited back later.
      await client.query(
        `DELETE FROM portfolio_members pm
          USING portfolios p
         WHERE pm.portfolio_id = p.id
           AND p.organization_id = $1
           AND pm.user_id = $2`,
        [organizationId, memberUserId]
      );
      // Preserve past capacity planning but never let it reactivate when the
      // person is invited back to the organization. Ranges starting today are
      // removed because the database requires effective_until > effective_from.
      await client.query(
        `UPDATE organization_member_capacities
            SET effective_until = CURRENT_DATE
          WHERE organization_id = $1 AND user_id = $2
            AND effective_from < CURRENT_DATE
            AND (effective_until IS NULL OR effective_until > CURRENT_DATE)`,
        [organizationId, memberUserId]
      );
      await client.query(
        `DELETE FROM organization_member_capacities
          WHERE organization_id = $1 AND user_id = $2 AND effective_from >= CURRENT_DATE`,
        [organizationId, memberUserId]
      );
      await client.query(
        `UPDATE project_capacity_allocations
            SET effective_until = CURRENT_DATE
          WHERE organization_id = $1 AND user_id = $2
            AND effective_from < CURRENT_DATE
            AND (effective_until IS NULL OR effective_until > CURRENT_DATE)`,
        [organizationId, memberUserId]
      );
      await client.query(
        `DELETE FROM project_capacity_allocations
          WHERE organization_id = $1 AND user_id = $2 AND effective_from >= CURRENT_DATE`,
        [organizationId, memberUserId]
      );
      await client.query(
        `DELETE FROM workspace_members wm
          USING workspaces w
         WHERE wm.workspace_id = w.id AND w.organization_id = $1 AND wm.user_id = $2`,
        [organizationId, memberUserId]
      );
      await client.query(
        `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, memberUserId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async transferOwnership(organizationId: string, actorId: string, nextOwnerId: string): Promise<void> {
    if (actorId === nextOwnerId) throw new OrganizationServiceError('INVALID_OWNER_TRANSFER', 'Choose another organization member as owner', 400);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.assertOrganizationNotPersonal(organizationId, client);
      const organization = await client.query(`SELECT owner_user_id FROM organizations WHERE id = $1 FOR UPDATE`, [organizationId]);
      if (!organization.rows[0]) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
      if (organization.rows[0].owner_user_id !== actorId) throw new OrganizationServiceError('FORBIDDEN', 'Only the organization owner can transfer ownership', 403);
      const target = await this.requireMembership(organizationId, nextOwnerId, client, true);
      if (target.role === 'OWNER') throw new OrganizationServiceError('INVALID_OWNER_TRANSFER', 'This person already owns the organization', 400);
      await client.query(
        `UPDATE organization_members SET role = 'ADMIN'::"OrganizationMemberRole" WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, actorId]
      );
      await client.query(
        `UPDATE organization_members SET role = 'OWNER'::"OrganizationMemberRole" WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, nextOwnerId]
      );
      await client.query(`UPDATE organizations SET owner_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [organizationId, nextOwnerId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async requireMembership(organizationId: string, userId: string, client: any = pool, forUpdate = false): Promise<{ role: OrganizationMemberRole }> {
    const result = await client.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
      [organizationId, userId]
    );
    if (!result.rows[0]) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found or access denied', 404);
    return { role: result.rows[0].role as OrganizationMemberRole };
  }

  private async requireRole(organizationId: string, userId: string, roles: OrganizationMemberRole[]): Promise<void> {
    const membership = await this.requireMembership(organizationId, userId);
    if (!roles.includes(membership.role)) throw new OrganizationServiceError('FORBIDDEN', 'Organization administration is required', 403);
  }

  private async assertOrganizationNotPersonal(organizationId: string, client: any): Promise<void> {
    const organization = await client.query(`SELECT type FROM organizations WHERE id = $1 FOR UPDATE`, [organizationId]);
    if (!organization.rows[0]) throw new OrganizationServiceError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
    if (organization.rows[0].type === 'PERSONAL') throw new OrganizationServiceError('PERSONAL_ORGANIZATION_IMMUTABLE', 'Personal organizations cannot be modified this way', 400);
  }

  private assertCanInvite(actorRole: OrganizationMemberRole, targetRole: Exclude<OrganizationMemberRole, 'OWNER'>): void {
    if (actorRole === 'OWNER') return;
    if (actorRole === 'ADMIN' && targetRole === 'MEMBER') return;
    throw new OrganizationServiceError('FORBIDDEN', 'You do not have permission to invite this organization role', 403);
  }

  private assertCanManageTarget(actorRole: OrganizationMemberRole, targetRole: OrganizationMemberRole, _action: 'revoke' | 'change-role' | 'remove'): void {
    if (targetRole === 'OWNER') throw new OrganizationServiceError('OWNER_ROLE_PROTECTED', 'The organization owner is protected', 400);
    if (actorRole === 'OWNER') return;
    if (actorRole === 'ADMIN' && targetRole === 'MEMBER') return;
    throw new OrganizationServiceError('FORBIDDEN', 'You do not have permission to manage this organization member', 403);
  }

  private formatSummary(row: any): OrganizationSummary {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      role: row.role as OrganizationMemberRole,
      workspaceCount: Number(row.workspace_count ?? 0),
      memberCount: Number(row.member_count ?? 0),
      portfolioCount: Number(row.portfolio_count ?? 0),
      networkCount: Number(row.network_count ?? 0),
      subscription: row.subscription ?? null,
    };
  }
}

export const organizationService = new OrganizationService();
