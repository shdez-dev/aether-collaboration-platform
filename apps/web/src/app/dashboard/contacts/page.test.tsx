import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ContactsPage from './page';
import { apiService } from '@/services/apiService';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));

const get = apiService.get as jest.Mock;

describe('Contactos', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/users/search?')) return { success: true, data: { users: [{ id: 'user-2', name: 'Jennifer Ruiz', email: 'jennifer@example.com' }] } };
      if (url === '/api/users/me/teammates') return { success: true, data: { teammates: [] } };
      if (url === '/api/users/favorites') return { success: true, data: { favorites: [] } };
      if (url === '/api/users/user-2') return { success: true, data: { user: { bio: 'Diseñadora de producto' }, sharedTeams: [], sharedProjects: [] } };
      return { success: true, data: { users: [] } };
    });
  });

  it('busca usuarios registrados fuera de los workspaces compartidos y muestra su perfil', async () => {
    render(<ContactsPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o correo'), { target: { value: 'jennifer@example.com' } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining('/api/users/search?q=jennifer%40example.com'), true));
    fireEvent.click(await screen.findByText('Jennifer Ruiz'));
    expect(await screen.findByText('Diseñadora de producto')).toBeTruthy();
  });
});
