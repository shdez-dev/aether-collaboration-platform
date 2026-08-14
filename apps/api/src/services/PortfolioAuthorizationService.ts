import { pool } from '../lib/db';

export type PortfolioAction = 'READ' | 'MANAGE' | 'ADMIN';
export type PortfolioAccessLevel = 'VIEW' | 'MANAGE' | 'ADMIN';

export type PortfolioAccess = {
  portfolioId: string;
  organizationId: string;
  level: PortfolioAccessLevel;
  implicitOrganizationAdmin: boolean;
  archivedAt: Date | null;
};

/**
 * The sole authority for portfolio-scoped access.
 *
 * A portfolio role deliberately grants no workspace or project permission. An
 * organization OWNER/ADMIN is an implicit portfolio administrator; a
 * BILLING_ADMIN is not. Explicit portfolio membership additionally requires
 * that the account is still an active organization member.
 */
export class PortfolioAuthorizationService {
  async getAccess(portfolioId: string, userId: string): Promise<PortfolioAccess | null> {
    const result = await pool.query(
      `SELECT p.organization_id,
              pm.role AS portfolio_role,
              p.archived_at,
              (
                o.owner_user_id = $2
                OR EXISTS (
                  SELECT 1 FROM organization_members om
                  WHERE om.organization_id = p.organization_id
                    AND om.user_id = $2
                    AND om.role IN ('OWNER', 'ADMIN')
                    AND NOT EXISTS (SELECT 1 FROM organization_access_revocations r WHERE r.organization_id = om.organization_id AND r.user_id = om.user_id)
                )
              ) AS organization_admin
         FROM portfolios p
         JOIN organizations o ON o.id = p.organization_id
         LEFT JOIN portfolio_members pm ON pm.portfolio_id = p.id AND pm.user_id = $2
        WHERE p.id = $1
          AND NOT EXISTS (
            SELECT 1 FROM organization_access_revocations r
             WHERE r.organization_id = p.organization_id AND r.user_id = $2
          )
          AND (
            o.owner_user_id = $2
            OR EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = p.organization_id
                AND om.user_id = $2
                AND om.role IN ('OWNER', 'ADMIN')
                AND NOT EXISTS (SELECT 1 FROM organization_access_revocations r WHERE r.organization_id = om.organization_id AND r.user_id = om.user_id)
            )
            OR (
              pm.user_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.organization_id = p.organization_id AND om.user_id = $2
                  AND NOT EXISTS (SELECT 1 FROM organization_access_revocations r WHERE r.organization_id = om.organization_id AND r.user_id = om.user_id)
              )
            )
          )`,
      [portfolioId, userId],
    );

    const row = result.rows[0];
    if (!row) return null;
    const implicitOrganizationAdmin = Boolean(row.organization_admin);
    const level: PortfolioAccessLevel = implicitOrganizationAdmin || row.portfolio_role === 'ADMIN'
      ? 'ADMIN'
      : row.portfolio_role === 'MANAGER'
        ? 'MANAGE'
        : 'VIEW';
    return { portfolioId, organizationId: row.organization_id, level, implicitOrganizationAdmin, archivedAt: row.archived_at };
  }

  async can(portfolioId: string, userId: string, action: PortfolioAction): Promise<PortfolioAccess | null> {
    const access = await this.getAccess(portfolioId, userId);
    if (!access) return null;
    if (action === 'READ') return access;
    if (action === 'MANAGE' && (access.level === 'MANAGE' || access.level === 'ADMIN')) return access;
    if (action === 'ADMIN' && access.level === 'ADMIN') return access;
    return null;
  }

  async canAccessOrganization(organizationId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1
         FROM organizations o
        WHERE o.id = $1
          AND NOT EXISTS (
            SELECT 1 FROM organization_access_revocations r
             WHERE r.organization_id = o.id AND r.user_id = $2
          )
          AND (
            o.owner_user_id = $2
            OR EXISTS (
              SELECT 1 FROM organization_members om
               WHERE om.organization_id = o.id AND om.user_id = $2
            )
          )`,
      [organizationId, userId],
    );
    return Boolean(result.rows[0]);
  }

  async canAdministerOrganization(organizationId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1
         FROM organizations o
        WHERE o.id = $1
          AND NOT EXISTS (
            SELECT 1 FROM organization_access_revocations r
             WHERE r.organization_id = o.id AND r.user_id = $2
          )
          AND (
            o.owner_user_id = $2
            OR EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = o.id AND om.user_id = $2 AND om.role IN ('OWNER', 'ADMIN')
                AND NOT EXISTS (SELECT 1 FROM organization_access_revocations r WHERE r.organization_id = om.organization_id AND r.user_id = om.user_id)
            )
          )`,
      [organizationId, userId],
    );
    return Boolean(result.rows[0]);
  }
}

export const portfolioAuthorizationService = new PortfolioAuthorizationService();
