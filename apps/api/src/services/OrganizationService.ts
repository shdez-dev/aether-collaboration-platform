import { pool } from '../lib/db';
import type { OrganizationMemberRole, OrganizationType, OrganizationSummary } from '@aether/types';

export interface OrganizationDetails extends OrganizationSummary {
  billingEmail: string | null;
  workspaces: Array<{ id: string; name: string; mode: string; archived: boolean }>;
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
    const membership = await pool.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );
    if (!membership.rows[0] || !['OWNER', 'ADMIN'].includes(membership.rows[0].role)) {
      throw new Error('Organization admin access required');
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { fields.push(`name = $${values.length + 1}`); values.push(data.name); }
    if (data.type !== undefined) { fields.push(`type = $${values.length + 1}::"OrganizationType"`); values.push(data.type); }
    if (data.billingEmail !== undefined) { fields.push(`billing_email = $${values.length + 1}`); values.push(data.billingEmail); }
    if (fields.length > 0) {
      values.push(organizationId);
      await pool.query(`UPDATE organizations SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`, values);
    }
    return this.getForUser(organizationId, userId);
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
