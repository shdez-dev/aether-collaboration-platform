import { pool } from '../../lib/db';
import { ProjectAuthorizationService } from '../ProjectAuthorizationService';

jest.mock('../../lib/db');

describe('ProjectAuthorizationService', () => {
  const service = new ProjectAuthorizationService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function accessRow(overrides: Record<string, unknown> = {}) {
    return {
      workspace_id: 'workspace-1',
      organization_type: 'ORGANIZATION',
      is_project_owner: false,
      is_workspace_admin: false,
      direct_project_role: null,
      is_team_member: false,
      is_team_contributor: false,
      has_operational_role: false,
      is_project_lead: false,
      is_operational_contributor: false,
      external_permission: '',
      ...overrides,
    };
  }

  it('denies a workspace member with no explicit project relationship', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [accessRow()] });

    await expect(service.can('project-1', 'user-1', 'READ')).resolves.toBeNull();
  });

  it('allows a direct VIEWER to read but not contribute', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [accessRow({ direct_project_role: 'VIEWER' })] });

    await expect(service.can('project-1', 'user-1', 'READ')).resolves.toMatchObject({ level: 'READ' });
    await expect(service.can('project-1', 'user-1', 'CONTRIBUTE')).resolves.toBeNull();
  });

  it('allows direct project administrators to manage without a workspace admin role', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rows: [accessRow({ direct_project_role: 'ADMIN' })],
    });

    await expect(service.can('project-1', 'user-1', 'MANAGE')).resolves.toMatchObject({ level: 'MANAGE' });
  });

  it('lets an explicit project observer role override contributor access inherited from a team', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rows: [accessRow({ direct_project_role: 'VIEWER', is_team_member: true, is_team_contributor: true })],
    });

    await expect(service.can('project-1', 'user-1', 'READ')).resolves.toMatchObject({ level: 'READ' });
    await expect(service.can('project-1', 'user-1', 'CONTRIBUTE')).resolves.toBeNull();
  });

  it('uses the explicit project collaborator role instead of the inherited observer role', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rows: [accessRow({ direct_project_role: 'MEMBER', is_team_member: true })],
    });

    await expect(service.can('project-1', 'user-1', 'CONTRIBUTE')).resolves.toMatchObject({ level: 'CONTRIBUTE' });
  });

  it('limits an external PROJECT VIEW grant to read access', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [accessRow({ external_permission: 'VIEW' })] });

    await expect(service.can('project-1', 'external-user', 'READ')).resolves.toMatchObject({ external: true, level: 'READ' });
    await expect(service.can('project-1', 'external-user', 'CONTRIBUTE')).resolves.toBeNull();
  });
});
