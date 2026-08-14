import { pool } from '../../lib/db';
import { CapabilityService } from '../CapabilityService';

jest.mock('../../lib/db');

describe('CapabilityService', () => {
  const service = new CapabilityService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses only the deterministic effective subscription and its overrides', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rows: [
        { id: 'active-network', plan_code: 'NETWORK', status: 'ACTIVE', capability: 'members', limit_value: 42 },
        { id: 'active-network', plan_code: 'NETWORK', status: 'ACTIVE', capability: 'ai_credits', limit_value: 900 },
      ],
    });

    const result = await service.getOrganizationCapabilities('organization-id');

    expect(result).toEqual(expect.objectContaining({
      planCode: 'NETWORK',
      status: 'ACTIVE',
      capabilities: expect.objectContaining({ members: 42, ai_credits: 900, network_programs: true }),
    }));
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WITH effective_subscription AS'),
      ['organization-id'],
    );
    const query = (pool.query as jest.Mock).mock.calls[0][0];
    expect(query).toContain('LIMIT 1');
    expect(query).toContain('e.subscription_id = s.id');
    expect(query).toContain('s.current_period_end > CURRENT_TIMESTAMP');
  });

  it('falls back to Free when no subscription is currently effective', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await expect(service.getOrganizationCapabilities('organization-id')).resolves.toEqual({
      planCode: 'FREE',
      status: 'FREE',
      capabilities: expect.objectContaining({ workspaces: 1, members: 1 }),
    });
  });
});
