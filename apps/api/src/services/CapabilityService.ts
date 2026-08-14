import { pool } from '../lib/db';

export type Capability = 'workspaces' | 'members' | 'portfolio' | 'institutional_context' | 'intake' | 'advanced_roles' | 'network_programs' | 'analytics' | 'storage_mb' | 'ai_credits';
export const PLAN_CATALOG: Record<string, { name: string; capabilities: Partial<Record<Capability, number | boolean>> }> = {
  FREE: { name: 'Free / Personal', capabilities: { workspaces: 1, members: 1, storage_mb: 250, ai_credits: 3 } },
  TEAMS: { name: 'Teams', capabilities: { workspaces: 5, members: 15, advanced_roles: true, storage_mb: 10_000, ai_credits: 100 } },
  PORTFOLIO: { name: 'Portfolio', capabilities: { workspaces: 20, members: 50, portfolio: true, advanced_roles: true, analytics: true, storage_mb: 50_000, ai_credits: 500 } },
  INSTITUTIONAL: { name: 'Institutional', capabilities: { workspaces: 100, members: 500, portfolio: true, institutional_context: true, intake: true, advanced_roles: true, analytics: true, storage_mb: 250_000, ai_credits: 2_000 } },
  NETWORK: { name: 'Network', capabilities: { workspaces: 250, members: 2_000, portfolio: true, institutional_context: true, intake: true, advanced_roles: true, network_programs: true, analytics: true, storage_mb: 1_000_000, ai_credits: 10_000 } },
};

export class CapabilityService {
  async getOrganizationCapabilities(organizationId: string) {
    // An organization can retain historical provider rows while a plan changes.
    // Select the one effective subscription first, then read only its overrides:
    // joining before selecting would otherwise merge entitlements from several plans.
    const result = await pool.query(`
      WITH effective_subscription AS (
        SELECT s.id, s.plan_code, s.status
          FROM subscriptions s
         WHERE s.organization_id = $1
           AND s.status IN ('TRIALING', 'ACTIVE', 'PAST_DUE')
           AND (s.current_period_end IS NULL OR s.current_period_end > CURRENT_TIMESTAMP)
         ORDER BY
           CASE s.status
             WHEN 'ACTIVE' THEN 1
             WHEN 'TRIALING' THEN 2
             WHEN 'PAST_DUE' THEN 3
           END,
           s.updated_at DESC,
           s.created_at DESC,
           s.id DESC
         LIMIT 1
      )
      SELECT s.id, s.plan_code, s.status, e.capability, e.limit_value
        FROM effective_subscription s
        LEFT JOIN subscription_entitlements e ON e.subscription_id = s.id
       ORDER BY e.capability ASC NULLS LAST
    `, [organizationId]);
    const subscription = result.rows[0]; const planCode = subscription?.plan_code ?? 'FREE'; const base = PLAN_CATALOG[planCode]?.capabilities ?? PLAN_CATALOG.FREE.capabilities; const capabilities = { ...base } as Record<string, number | boolean>;
    for (const row of result.rows) if (row.capability) capabilities[row.capability] = row.limit_value ?? true;
    return { planCode, status: subscription?.status ?? 'FREE', capabilities };
  }
  async check(organizationId: string, capability: Capability, usage = 0) {
    const entitlement = await this.getOrganizationCapabilities(organizationId); const value = entitlement.capabilities[capability];
    const allowed = typeof value === 'number' ? usage < value : value === true;
    return { allowed, capability, limit: typeof value === 'number' ? value : null, usage, planCode: entitlement.planCode, status: entitlement.status };
  }
  async require(organizationId: string, capability: Capability, usage = 0) {
    const check = await this.check(organizationId, capability, usage);
    if (!check.allowed) { const err: any = new Error(`La capacidad ${capability} no está disponible en el plan actual.`); err.code = 'CAPABILITY_REQUIRED'; err.details = check; throw err; }
    return check;
  }
}
export const capabilityService = new CapabilityService();
