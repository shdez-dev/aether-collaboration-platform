import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardLayout from './layout';
import { apiService } from '@/services/apiService';

const router = { push: jest.fn(), replace: jest.fn() };
let mockPathname = '/dashboard/projects/project-1';
const fetchWorkspaces = jest.fn().mockResolvedValue(undefined);
const loadPreferences = jest.fn();
const workspaceState = {
  workspaces: [{ id: 'workspace-1', mode: 'TEAM', organization: { type: 'COMPANY' } }],
  fetchWorkspaces,
  error: null,
};
const activeWorkspaceState = {
  activeWorkspaceId: 'workspace-1' as string | null,
  setActiveWorkspaceId: jest.fn(),
  fetchSidebarBoards: jest.fn(),
  fetchSidebarProjects: jest.fn(),
  sidebarBoards: [],
  sidebarProjects: [{ id: 'project-1', name: 'Proyecto Alfa', status: 'ACTIVE', color: '#7452A6' }],
  boardsLoading: false,
  projectsLoading: false,
  addSidebarProject: jest.fn(),
};

jest.mock('next/navigation', () => ({ usePathname: () => mockPathname, useRouter: () => router }));
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
    mockPathname = '/dashboard/projects/project-1';
    workspaceState.workspaces = [{ id: 'workspace-1', mode: 'TEAM', organization: { type: 'COMPANY' } }];
    activeWorkspaceState.activeWorkspaceId = 'workspace-1';
    (apiService.get as jest.Mock).mockResolvedValue({ success: true, data: { platformAdmin: false, organizations: [] } });
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

  it('mantiene el dashboard y limita la navegación si la organización no tiene espacios', async () => {
    mockPathname = '/dashboard';
    workspaceState.workspaces = [];
    activeWorkspaceState.activeWorkspaceId = null;
    (apiService.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ success: true, data: path === '/api/organizations'
      ? { organizations: [{ id: 'organization-1', name: 'Aether', type: 'COMPANY', role: 'OWNER', workspaceCount: 0 }] }
      : { platformAdmin: false } }));

    render(<DashboardLayout><div>Inicio habitual</div></DashboardLayout>);

    await waitFor(() => expect(screen.getByText('Todavía no hay espacios de trabajo')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Crear espacio de trabajo' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Organización' }).getAttribute('href')).toContain('organizationId=organization-1');
    expect(screen.getByRole('link', { name: 'Notificaciones' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Contactos' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Documentos' })).toBeNull();
    expect(screen.queryByText('+ Nuevo proyecto')).toBeNull();
    expect(screen.queryByText('Inicio habitual')).toBeNull();
  });

  it('muestra espera sin opción de crear a un miembro de una organización vacía', async () => {
    mockPathname = '/dashboard';
    workspaceState.workspaces = [];
    activeWorkspaceState.activeWorkspaceId = null;
    (apiService.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ success: true, data: path === '/api/organizations'
      ? { organizations: [{ id: 'organization-1', name: 'Aether', type: 'COMPANY', role: 'MEMBER', workspaceCount: 0 }] }
      : { platformAdmin: false } }));

    render(<DashboardLayout><div>Inicio habitual</div></DashboardLayout>);

    await waitFor(() => expect(screen.getByText(/cuando un administrador cree un espacio/i)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Crear espacio de trabajo' })).toBeNull();
  });

  it('distingue una organización con espacios sin acceso de una organización vacía', async () => {
    mockPathname = '/dashboard';
    workspaceState.workspaces = [];
    activeWorkspaceState.activeWorkspaceId = null;
    (apiService.get as jest.Mock).mockImplementation((path: string) => Promise.resolve({ success: true, data: path === '/api/organizations'
      ? { organizations: [{ id: 'organization-1', name: 'Aether', type: 'COMPANY', role: 'MEMBER', workspaceCount: 2 }] }
      : { platformAdmin: false } }));

    render(<DashboardLayout><div>Inicio habitual</div></DashboardLayout>);

    await waitFor(() => expect(screen.getByText('Aún no tienes acceso a un espacio')).toBeTruthy());
    expect(screen.queryByText('Todavía no hay espacios de trabajo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear espacio de trabajo' })).toBeNull();
  });
});
