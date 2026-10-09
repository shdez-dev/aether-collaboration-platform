import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ContactsPage from './page';
import { apiService } from '@/services/apiService';

jest.mock('@/services/apiService', () => ({
  apiService: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/services/socketService', () => ({
  socketService: { on: jest.fn(), off: jest.fn(), onConnect: jest.fn(), offConnect: jest.fn() },
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: object) => unknown) => selector({ user: { id: 'user-1' } }),
}));

const get = apiService.get as jest.Mock;
const post = apiService.post as jest.Mock;

describe('Contactos', () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/users/search?'))
        return {
          success: true,
          data: { users: [{ id: 'user-2', name: 'Jennifer Ruiz', email: 'jennifer@example.com' }] },
        };
      if (url === '/api/users/user-2')
        return {
          success: true,
          data: {
            user: {
              id: 'user-2',
              name: 'Jennifer Ruiz',
              email: 'jennifer@example.com',
              bio: 'Diseñadora de producto',
              location: 'Chile',
              timezone: 'America/Santiago',
              language: 'es',
              createdAt: '2026-08-01T00:00:00.000Z',
              phone: '+56123456788',
            },
            sharedWorkspaces: [{ id: 'workspace-1', name: 'Diseño' }],
            sharedTeams: [],
            sharedProjects: [],
          },
        };
      if (url === '/api/chat/eligibility/user-2')
        return { success: true, data: { canMessage: false, relationship: 'none' } };
      if (url === '/api/chat/contacts') return { success: true, data: { contacts: [] } };
      if (url === '/api/chat/conversations') return { success: true, data: { conversations: [] } };
      if (url === '/api/chat/requests') return { success: true, data: { requests: [] } };
      if (url === '/api/users/favorites') return { success: true, data: { favorites: [] } };
      return { success: true, data: { messages: [] } };
    });
    post.mockResolvedValue({ success: true, data: {} });
  });

  it('busca usuarios registrados por correo y muestra su perfil tipo chat', async () => {
    render(<ContactsPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o correo'), {
      target: { value: 'jennifer@example.com' },
    });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/search?q=jennifer%40example.com'),
        true
      )
    );
    fireEvent.click(await screen.findByText('Jennifer Ruiz'));
    expect(await screen.findByText('Diseñadora de producto')).toBeTruthy();
    expect(screen.getByText('Chile')).toBeTruthy();
    expect(screen.getByText('America/Santiago')).toBeTruthy();
    expect(screen.getByText('Español')).toBeTruthy();
    expect(screen.getByText('Espacio — Diseño')).toBeTruthy();
    expect(screen.queryByText('+56123456788')).toBeNull();
    expect(screen.getByRole('button', { name: /Enviar solicitud/ })).toBeTruthy();
  });

  it('envía una solicitud antes de habilitar el chat externo', async () => {
    render(<ContactsPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o correo'), {
      target: { value: 'jennifer@example.com' },
    });
    fireEvent.click(await screen.findByText('Jennifer Ruiz'));
    fireEvent.click(await screen.findByRole('button', { name: /Enviar solicitud/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/chat/requests', { userId: 'user-2' }, true)
    );
    expect(await screen.findByText('Pendiente de respuesta')).toBeTruthy();
  });

  it('abre y cierra el perfil sin desmontarlo ni perder la conversación', async () => {
    const consoleErrors = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<ContactsPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o correo'), {
      target: { value: 'jennifer@example.com' },
    });
    fireEvent.click(await screen.findByText('Jennifer Ruiz'));
    const profile = await screen.findByRole('complementary', { name: 'Perfil de Jennifer Ruiz' });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar perfil' }));
    expect(profile.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Mostrar perfil' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar perfil' }));
    expect(profile.getAttribute('aria-hidden')).toBe('false');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(profile.getAttribute('aria-hidden')).toBe('true');
    expect(consoleErrors.mock.calls.flat().join(' ')).not.toMatch(/same key|unique "key" prop/i);
  });
});
