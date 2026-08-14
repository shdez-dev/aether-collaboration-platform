import { pool } from '../../lib/db';
import { PortfolioAuthorizationService } from '../PortfolioAuthorizationService';

jest.mock('../../lib/db');

describe('PortfolioAuthorizationService', () => {
  const service = new PortfolioAuthorizationService();

  beforeEach(() => jest.clearAllMocks());

  function accessRow(overrides: Record<string, unknown> = {}) {
    return {
      organization_id: 'organization-1',
      portfolio_role: 'VIEWER',
      organization_admin: false,
      archived_at: null,
      ...overrides,
    };
  }

  it('does not grant a BILLING_ADMIN an implicit portfolio role', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await expect(service.can('portfolio-1', 'billing-admin', 'READ')).resolves.toBeNull();
    await expect(service.can('portfolio-1', 'billing-admin', 'MANAGE')).resolves.toBeNull();
  });

  it('allows a portfolio manager to manage portfolio metadata but not administer it', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [accessRow({ portfolio_role: 'MANAGER' })] });

    await expect(service.can('portfolio-1', 'manager', 'MANAGE')).resolves.toMatchObject({ level: 'MANAGE' });
    await expect(service.can('portfolio-1', 'manager', 'ADMIN')).resolves.toBeNull();
  });

  it('treats organization owners and administrators as implicit portfolio administrators', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [accessRow({ organization_admin: true, portfolio_role: null })] });

    await expect(service.can('portfolio-1', 'organization-admin', 'ADMIN')).resolves.toMatchObject({ level: 'ADMIN', implicitOrganizationAdmin: true });
  });
});
