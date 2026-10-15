import { apiService } from '@/services/apiService';
import { useProjectStore, type Project } from '../projectStore';

jest.mock('@/services/apiService');

const access: NonNullable<Project['access']> = {
  level: 'MANAGE', external: false, canRead: true, canContribute: true, canManage: true,
};

const project = {
  id: 'project-1', workspaceId: 'workspace-1', name: 'Proyecto', status: 'PLANNING',
  maturityStage: 'IDEA', workflowStage: 'INTAKE', ownerId: 'owner-1',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', access,
} as Project;

describe('projectStore updateProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProjectStore.setState({ projects: [project], currentProject: project });
  });

  it('keeps the current access when an older update response omits it', async () => {
    (apiService.put as jest.Mock).mockResolvedValue({
      success: true, data: { project: { ...project, name: 'Proyecto editado', icon: 'Rocket', color: '#7452A6', access: undefined } },
    });

    await useProjectStore.getState().updateProject(project.id, { name: 'Proyecto editado', icon: 'Rocket', color: '#7452A6' });

    expect(useProjectStore.getState().currentProject).toMatchObject({
      name: 'Proyecto editado', icon: 'Rocket', color: '#7452A6', access,
    });
    expect(useProjectStore.getState().projects[0].access).toEqual(access);
  });

  it('uses access returned by the server instead of retaining stale permissions', async () => {
    const readAccess: NonNullable<Project['access']> = {
      level: 'READ', external: false, canRead: true, canContribute: false, canManage: false,
    };
    (apiService.put as jest.Mock).mockResolvedValue({
      success: true, data: { project: { ...project, access: readAccess } },
    });

    await useProjectStore.getState().updateProject(project.id, { name: project.name });

    expect(useProjectStore.getState().currentProject?.access).toEqual(readAccess);
  });
});

describe('projectStore Scrum updates', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [project], currentProject: project });
  });

  it('updates Scrum assignments and Product Goal in the current project immediately', () => {
    const methodologyAssignments = [
      { userId: 'owner-1', name: 'Sebastian', email: 'sebastian@example.com', role: 'PRODUCT_OWNER' as const },
    ];

    useProjectStore.getState().setMethodologyAssignments(project.id, methodologyAssignments);
    useProjectStore.getState().setProductGoal(project.id, 'Mejorar el onboarding');

    expect(useProjectStore.getState().currentProject).toMatchObject({
      methodologyAssignments,
      productGoal: 'Mejorar el onboarding',
    });
    expect(useProjectStore.getState().projects[0]).toMatchObject({
      methodologyAssignments,
      productGoal: 'Mejorar el onboarding',
    });
  });
});
