import { pool } from '../../lib/db';
import { requireProjectBoundScrumRole, requireProjectScrumRole, type ProjectRequest } from '../project';

jest.mock('../../lib/db');

function response() {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('requireProjectScrumRole', () => {
  beforeEach(() => jest.clearAllMocks());

  function request(level: 'READ' | 'CONTRIBUTE' | 'MANAGE' = 'CONTRIBUTE') {
    return {
      params: { id: 'project-1' },
      user: { id: 'user-1' },
      projectContext: { projectId: 'project-1', workspaceId: 'workspace-1', level, external: false },
    } as unknown as ProjectRequest;
  }

  it('allows the responsibility assigned to the requested Scrum capability', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ role: 'PRODUCT_OWNER' }] });
    const next = jest.fn();

    await requireProjectScrumRole('PRODUCT_OWNER')(request(), response(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("p.methodology = 'SCRUM'"), [
      'project-1', 'user-1', ['PRODUCT_OWNER'],
    ]);
  });

  it('does not grant a Scrum Master-only action to a Developer', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
    const res = response();

    await requireProjectScrumRole('SCRUM_MASTER')(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'SCRUM_ROLE_REQUIRED' }),
    }));
  });

  it('lets project managers perform Scrum actions without an assignment', async () => {
    const next = jest.fn();

    await requireProjectScrumRole('PRODUCT_OWNER')(request('MANAGE'), response(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('checks Scrum responsibilities for shared card-to-sprint routes', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ project_id: 'project-1', methodology: 'SCRUM' }] })
      .mockResolvedValueOnce({ rows: [{ role: 'DEVELOPER' }] });
    const req = request() as any;
    req.params.sprintId = 'sprint-1';
    const next = jest.fn();

    await requireProjectBoundScrumRole('PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER')(req, response(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
