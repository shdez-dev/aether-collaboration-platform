import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BandejaPage from './page';

const mockPush = jest.fn();
const mockLoad = jest.fn();
const mockRead = jest.fn();
const mockReadAll = jest.fn();
const mockArchive = jest.fn();
const mockResolve = jest.fn();
const mockSetWorkspace = jest.fn();
const mockFetchWorkspaces = jest.fn().mockResolvedValue(undefined);
let mockNotifications: any[] = [];

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    isLoading: false,
    loadNotifications: mockLoad,
    markAsRead: mockRead,
    markAllAsRead: mockReadAll,
    archiveNotification: mockArchive,
    resolveNotification: mockResolve,
  }),
}));
jest.mock('@/stores/activeWorkspaceStore', () => ({ useActiveWorkspaceStore: (select: any) => select({ setActiveWorkspaceId: mockSetWorkspace }) }));
jest.mock('@/stores/workspaceStore', () => ({ useWorkspaceStore: (select: any) => select({ fetchWorkspaces: mockFetchWorkspaces }) }));

describe('Bandeja', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications = [
      { id: 'n1', type: 'COMMENT_MENTION', title: 'Mención', message: 'Ana te mencionó en una tarjeta', data: { actorName: 'Ana', cardTitle: 'Plan', boardName: 'Diseño' }, read: false, createdAt: new Date().toISOString() },
      { id: 'n2', type: 'CARD_ASSIGNED', title: 'Asignación', message: 'Luis te asignó una tarea', data: { actorName: 'Luis', cardTitle: 'Revisión' }, read: true, createdAt: new Date().toISOString() },
    ];
  });

  it('organiza notificaciones y mantiene accesibles las acciones de cada fila', () => {
    render(<BandejaPage />);

    expect(screen.getByRole('heading', { name: 'Bandeja' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeTruthy();
    expect(screen.getByLabelText('1 notificación sin leer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída' }));
    expect(mockRead).toHaveBeenCalledWith('n1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Archivar' })[0]);
    expect(mockArchive).toHaveBeenCalledWith('n1');
  });

  it('filtra menciones y conserva la navegación al abrir una notificación', async () => {
    render(<BandejaPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Menciones' }));
    expect(screen.getByText('Plan')).toBeTruthy();
    expect(screen.queryByText('Revisión')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Abrir: Ana/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    expect(mockRead).toHaveBeenCalledWith('n1');
  });
});
