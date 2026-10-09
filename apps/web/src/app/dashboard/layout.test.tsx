import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardLayout from './layout';

const router = { push: jest.fn(), replace: jest.fn() };
const fetchWorkspaces = jest.fn().mockResolvedValue(undefined);
const loadPreferences = jest.fn();
const workspaceState = {
  workspaces: [{ id: 'workspace-1', mode: 'TEAM', organization: { type: 'COMPANY' } }],
  fetchWorkspaces,
  error: null,
};
const activeWorkspaceState = {
  activeWorkspaceId: 'workspace-1',
  setActiveWorkspaceId: jest.fn(),
  fetchSidebarBoards: jest.fn(),
  fetchSidebarProjects: jest.fn(),
  sidebarBoards: [],
  sidebarProjects: [{ id: 'project-1', name: 'Proyecto Alfa', status: 'ACTIVE', color: '#7452A6' }],
  boardsLoading: false,
  projectsLoading: false,
  addSidebarProject: jest.fn(),
};

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard/projects/project-1', useRouter: () => router }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'user-1', name: 'Sebastian Hernandez' }, logout: jest.fn() }) }));
jest.mock('@/stores/workspaceStore', () => ({ useWorkspaceStore: () => workspaceState }));
jest.mock('@/stores/activeWorkspaceStore', () => ({ useActiveWorkspaceStore: () => activeWorkspaceState }));
jest.mock('@/stores/notificationStore', () => ({ useNotificationStore: (selector: (state: { unreadCount: number; popupNotifications: never[] }) => unknown) => selector({ unreadCount: 0, popupNotifications: [] }) }));
jest.mock('@/stores/preferencesStore', () => ({ usePreferencesStore: (selector?: (state: { preferences: { inAppNotifications: boolean }; loadPreferences: jest.Mock }) => unknown) => {
  const state = { preferences: { inAppNotifications: false }, loadPreferences };
  return selector ? selector(state) : state;
} }));
jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn().mockResolvedValue({ success: true, data: { platformAdmin: false } }) } }));
jest.mock('@/services/socketService', () => ({ socketService: { on: jest.fn(), off: jest.fn() } }));
jest.mock('@/components/ProtectedRoute', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/providers/SocketProvider', () => ({ SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/WorkspaceContextSwitcher', () => ({ __esModule: true, default: () => <button type="button" aria-label="Cambiar espacio de trabajo" /> }));
jest.mock('@/components/notifications/NotificationBell', () => ({ NotificationBell: () => null }));
jest.mock('@/components/notifications/NotificationListener', () => ({ NotificationListener: () => null }));
jest.mock('@/components/realtime/RealtimeNotificationProvider', () => ({ RealtimeNotificationProvider: () => null }));
jest.mock('@/components/chat/ChatDock', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
jest.mock('@/components/CommandPalette', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/CreateWorkspaceModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/CreateOrganizationModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/CreateBoardModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/CreateProjectModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/FirstWorkspaceOnboarding', () => ({ __esModule: true, default: () => null }));

describe('sidebar compacto', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('minimiza, conserva accesos por icono y recuerda la preferencia', async () => {
    const { unmount } = render(<DashboardLayout><div>Contenido</div></DashboardLayout>);
    const sidebar = document.querySelector('.dsh-sidebar-wrap');
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar barra lateral' }));

    expect(sidebar?.className).toContain('is-compact');
    expect(window.localStorage.getItem('aether:sidebar-compact')).toBe('true');
    expect(screen.getByRole('link', { name: 'Proyecto: Proyecto Alfa' }).getAttribute('href')).toBe('/dashboard/projects/project-1');
    expect(screen.getByRole('link', { name: 'Mi perfil' }).getAttribute('href')).toBe('/dashboard/profile');
    expect(screen.getByRole('link', { name: 'Ajustes' }).getAttribute('href')).toBe('/dashboard/settings');

    unmount();
    render(<DashboardLayout><div>Contenido</div></DashboardLayout>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Expandir barra lateral' })).toBeTruthy());
  });
});
