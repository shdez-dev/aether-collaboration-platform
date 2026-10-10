import { pool } from '../lib/db';
import crypto from 'crypto';
import type { OrganizationMemberRole, OrganizationType, OrganizationSummary } from '@aether/types';
import { emailService } from './EmailService';
import { renderOrganizationInvitationEmail } from './emailTemplates';

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
  async createForUser(
    userId: string,
    data: { name: string; type: OrganizationType; billingEmail?: string | null }
  ): Promise<OrganizationDetails> {
    if (data.type === 'PERSONAL') throw new Error('Personal organizations are created automatically');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
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

  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const result = await pool.query(
      `SELECT o.id, o.name, o.type, om.role,
              (SELECT COUNT(*)::int FROM workspaces w WHERE w.organization_id = o.id) AS workspace_count,
              (SELECT COUNT(*)::int FROM organization_members om2 WHERE om2.organization_id = o.id) AS member_count,
              (SELECT json_build_object('planCode', s.plan_code, 'status', s.status)
                 FROM subscriptions s
                WHERE s.organization_id = o.id AND s.status IN ('TRIALING', 'ACTIVE', 'PAST_DUE')
                ORDER BY s.created_at DESC LIMIT 1) AS subscription
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
              (SELECT COUNT(*)::int FROM organization_members om2 WHERE om2.organization_id = o.id) AS member_count,
              (SELECT json_build_object('planCode', s.plan_code, 'status', s.status)
                 FROM subscriptions s
                WHERE s.organization_id = o.id AND s.status IN ('TRIALING', 'ACTIVE', 'PAST_DUE')
                ORDER BY s.created_at DESC LIMIT 1) AS subscription
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
      if (row.type === 'PERSONAL') {
        throw new OrganizationServiceError('PERSONAL_ORGANIZATION_IMMUTABLE', 'Personal organizations cannot be deleted', 400);
      }
      if (row.role !== 'OWNER' || row.owner_user_id !== actorId) {
        throw new OrganizationServiceError('FORBIDDEN', 'Only the organization owner can delete it', 403);
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
      this.assertCanInvite(actor.role, data.role);

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

      const inviter = await client.query('SELECT name FROM users WHERE id = $1', [inviterId]);
      inviterName = inviter.rows[0]?.name ?? 'El equipo de Aether';
      const created = await client.query(
        `INSERT INTO organization_invitations (id, organization_id, email, role, token_hash, invited_by, expires_at, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, $2, $3::"OrganizationMemberRole", $4, $5, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING expires_at`,
        [organizationId, email, data.role, tokenHash, inviterId]
      );
      expiresAt = created.rows[0].expires_at;
      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') throw new OrganizationServiceError('INVITATION_ALREADY_PENDING', 'There is already an active invitation for this email', 409);
      throw error;
    } finally {
      client.release();
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://aether-web.up.railway.app';
    const invitationLink = `${frontendUrl}/organization-invitation?token=${token}`;
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
      const frontendUrl = process.env.FRONTEND_URL || 'https://aether-web.up.railway.app';
      return {
        code: token,
        link: `${frontendUrl}/organization-invitation?token=${token}`,
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

  async acceptInvitation(token: string, userId: string): Promise<string> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invitation = await client.query(
        `SELECT oi.*, o.type, u.email AS accepted_email
           FROM organization_invitations oi
           JOIN organizations o ON o.id = oi.organization_id
           JOIN users u ON u.id = $2
          WHERE oi.token_hash = $1
          FOR UPDATE OF oi`,
        [tokenHash, userId]
      );
      const row = invitation.rows[0];
      if (!row || row.accepted_at || row.revoked_at || new Date(row.expires_at) <= new Date()) {
        throw new OrganizationServiceError('INVITATION_NOT_FOUND', 'Invitation not found or no longer active', 404);
      }
      if (row.type === 'PERSONAL') throw new OrganizationServiceError('PERSONAL_ORGANIZATION_IMMUTABLE', 'Personal organizations cannot have additional members', 400);
      if (String(row.email).toLowerCase() !== String(row.accepted_email).toLowerCase()) {
        throw new OrganizationServiceError('INVITATION_EMAIL_MISMATCH', 'Sign in with the email that received this invitation', 403);
      }
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
      await client.query(
        `UPDATE organization_invitations
            SET accepted_by = $2, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [row.id, userId]
      );
      await client.query('COMMIT');
      return row.organization_id;
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
      subscription: row.subscription ?? null,
    };
  }
}

export const organizationService = new OrganizationService();
