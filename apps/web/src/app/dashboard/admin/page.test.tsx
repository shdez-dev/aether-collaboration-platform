import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from './page';
import { apiService } from '@/services/apiService';

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

const user = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Ana Ruiz', email: 'ana@example.com',
  emailVerified: true, createdAt: '2026-10-01T12:00:00.000Z', lastActivityAt: null,
  organizations: 1, workspaces: 1, online: false,
  personalOrganizationId: '22222222-2222-4222-8222-222222222222',
  personalPlan: 'FREE', personalPlanSource: 'AUTOMATIC',
};

describe('acciones de administración', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/admin/overview') return { success: true, data: { totals: { users: 2 }, registrations: [], recentUsers: [], generatedAt: '2026-10-11T12:00:00.000Z', onlineScope: 'current_instance' } };
      if (url === '/api/admin/system') return { success: true, data: { api: true, database: true, redis: true, users: 2, uptimeSeconds: 3600, memoryMb: 100, environment: 'test', checkedAt: '2026-10-11T12:00:00.000Z' } };
      if (url.startsWith('/api/admin/users?')) return { success: true, data: { users: [user], page: 1, pageSize: 20, total: 1 } };
      return { success: false };
    });
  });

  it('muestra una revisión antes de enviar un aviso a todas las cuentas', async () => {
    (apiService.post as jest.Mock).mockResolvedValue({ success: true, data: { recipients: 2 } });
    Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: () => '33333333-3333-4333-8333-333333333333' });
    render(<AdminPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Título' }), { target: { value: 'Mantenimiento' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensaje' }), { target: { value: 'El servicio tendrá una pausa breve.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar aviso' }));
    expect(screen.getByText('Se enviará a', { exact: false })).toBeTruthy();
    expect(apiService.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar aviso a todos' }));
    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/api/admin/announcements', {
      requestId: '33333333-3333-4333-8333-333333333333', title: 'Mantenimiento', message: 'El servicio tendrá una pausa breve.',
    }, true));
    expect(await screen.findByText('Aviso enviado a 2 cuentas.')).toBeTruthy();
  });

  it('cambia el plan de la organización personal desde Usuarios', async () => {
    (apiService.patch as jest.Mock).mockResolvedValue({ success: true, data: { planCode: 'TEAMS', source: 'ADMIN' } });
    render(<AdminPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Usuarios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar plan' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de plan' }), { target: { value: 'TEAMS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));
    await waitFor(() => expect(apiService.patch).toHaveBeenCalledWith(`/api/admin/users/${user.id}/plan`, { planCode: 'TEAMS' }, true));
    expect(await screen.findByText('Teams')).toBeTruthy();
    expect(screen.getByText('Administrado')).toBeTruthy();
  });
});
