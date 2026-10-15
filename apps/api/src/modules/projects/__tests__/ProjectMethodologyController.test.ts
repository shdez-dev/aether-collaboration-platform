import { pool } from '../../../lib/db';
import { ProjectMethodologyController } from '../ProjectMethodologyController';

jest.mock('../../../lib/db');

describe('ProjectMethodologyController', () => {
  const controller = new ProjectMethodologyController();
  let client: { query: jest.Mock; release: jest.Mock };

  function response() {
    const res: any = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    client = { query: jest.fn(), release: jest.fn() };
    (pool.connect as jest.Mock).mockResolvedValue(client);
  });

  it('updates the Product Goal only for Scrum projects', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ productGoal: 'Mejorar el onboarding' }] });
    const req: any = { params: { id: 'project-1' }, body: { productGoal: 'Mejorar el onboarding' } };
    const res = response();

    await controller.updateProductGoal(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1 AND methodology = 'SCRUM'"),
      ['project-1', 'Mejorar el onboarding'],
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { productGoal: 'Mejorar el onboarding' },
    });
  });

  it('updates an eligible participant and returns the refreshed Scrum roster', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ workspace_id: 'workspace-1', organization_id: 'org-1' }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [] }) // demote prior Product Owner
      .mockResolvedValueOnce({ rows: [] }) // upsert assignment
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    (pool.query as jest.Mock).mockResolvedValue({ rows: [
      { userId: 'user-1', name: 'Sam', email: 'sam@example.com', role: 'PRODUCT_OWNER' },
      { userId: 'user-2', name: 'Rae', email: 'rae@example.com', role: 'DEVELOPER' },
    ] });
    const req: any = {
      params: { id: 'project-1', userId: '00000000-0000-4000-8000-000000000001' },
      body: { role: 'PRODUCT_OWNER' },
    };
    const res = response();

    await controller.updateScrumAssignment(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { assignments: expect.any(Array) } });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("SET role = 'DEVELOPER'"),
      ['project-1', 'PRODUCT_OWNER', req.params.userId],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role'),
      ['project-1', req.params.userId, 'PRODUCT_OWNER'],
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects assigning someone who is not a project participant', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ workspace_id: 'workspace-1', organization_id: 'org-1' }] })
      .mockResolvedValueOnce({ rows: [] }) // participant lookup
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    const req: any = {
      params: { id: 'project-1', userId: '00000000-0000-4000-8000-000000000001' },
      body: { role: 'DEVELOPER' },
    };
    const res = response();

    await controller.updateScrumAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
