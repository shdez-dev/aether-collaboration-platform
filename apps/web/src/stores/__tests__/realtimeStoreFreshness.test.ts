import { apiService } from '@/services/apiService';
import { useActiveWorkspaceStore } from '../activeWorkspaceStore';
import { useTeamStore } from '../teamStore';
import { useWorkspaceStore } from '../workspaceStore';

jest.mock('@/services/apiService');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('freshness of realtime list refreshes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActiveWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-old',
      sidebarBoards: [],
      sidebarProjects: [],
      boardsLoading: false,
      projectsLoading: false,
    });
    useWorkspaceStore.getState().reset();
    useTeamStore.getState().reset();
  });

  it('keeps the newest workspace list when an earlier refresh resolves later', async () => {
    const stale = deferred<any>();
    (apiService.get as jest.Mock)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({ success: true, data: { workspaces: [{ id: 'workspace-new' }] } });

    const oldRefresh = useWorkspaceStore.getState().fetchWorkspaces();
    await useWorkspaceStore.getState().fetchWorkspaces();
    stale.resolve({ success: true, data: { workspaces: [{ id: 'workspace-old' }] } });
    await oldRefresh;

    expect(useWorkspaceStore.getState().workspaces).toEqual([{ id: 'workspace-new' }]);
  });

  it('keeps sidebar boards for the newly selected workspace after a slow previous response', async () => {
    const stale = deferred<any>();
    (apiService.get as jest.Mock)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({ success: true, data: { boards: [{ id: 'board-new', archived: false }] } });

    const oldRefresh = useActiveWorkspaceStore.getState().fetchSidebarBoards('workspace-old');
    useActiveWorkspaceStore.getState().setActiveWorkspaceId('workspace-new');
    await useActiveWorkspaceStore.getState().fetchSidebarBoards('workspace-new');
    stale.resolve({ success: true, data: { boards: [{ id: 'board-old', archived: false }] } });
    await oldRefresh;

    expect(useActiveWorkspaceStore.getState().sidebarBoards.map((board) => board.id)).toEqual(['board-new']);
    expect(useActiveWorkspaceStore.getState().boardsLoading).toBe(false);
  });

  it('keeps the newest team list when a prior membership refresh resolves later', async () => {
    const stale = deferred<any>();
    (apiService.get as jest.Mock)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({ success: true, data: { teams: [{ id: 'team-new' }] } });

    const oldRefresh = useTeamStore.getState().fetchTeams('workspace-old');
    await useTeamStore.getState().fetchTeams('workspace-new');
    stale.resolve({ success: true, data: { teams: [{ id: 'team-old' }] } });
    await oldRefresh;

    expect(useTeamStore.getState().teams).toEqual([{ id: 'team-new' }]);
  });
});
