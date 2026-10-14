import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsPage from './page';

const mockPush = jest.fn();
const mockLoad = jest.fn();
const mockRead = jest.fn();
const mockDelete = jest.fn();
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
    deleteNotification: mockDelete,
    resolveNotification: mockResolve,
  }),
}));
jest.mock('@/stores/activeWorkspaceStore', () => ({ useActiveWorkspaceStore: (select: any) => select({ setActiveWorkspaceId: mockSetWorkspace }) }));
jest.mock('@/stores/workspaceStore', () => ({ useWorkspaceStore: (select: any) => select({ fetchWorkspaces: mockFetchWorkspaces }) }));

describe('Notificaciones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications = [
      { id: 'n1', type: 'COMMENT_MENTION', title: 'Mención', message: 'Ana te mencionó en una tarjeta', data: { actorName: 'Ana', cardTitle: 'Plan', boardName: 'Diseño' }, read: false, createdAt: new Date().toISOString() },
      { id: 'n2', type: 'CARD_ASSIGNED', title: 'Asignación', message: 'Luis te asignó una tarea', data: { actorName: 'Luis', cardTitle: 'Revisión' }, read: true, createdAt: new Date().toISOString() },
    ];
  });

  it('organiza notificaciones y deja eliminar cada fila como única acción visible', () => {
    render(<NotificationsPage />);

    expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeTruthy();
    expect(screen.getByLabelText('1 notificación sin leer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Marcar como leída' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar notificación' })[0]);
    expect(mockDelete).toHaveBeenCalledWith('n1');
  });

  it('filtra menciones y conserva la navegación al abrir una notificación', async () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Menciones' }));
    expect(screen.getByText('Plan')).toBeTruthy();
    expect(screen.queryByText('Revisión')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Abrir: Ana/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    expect(mockRead).toHaveBeenCalledWith('n1');
  });
});
