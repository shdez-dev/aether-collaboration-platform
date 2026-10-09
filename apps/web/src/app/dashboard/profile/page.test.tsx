import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfilePage from './page';
import { useAuthStore } from '@/stores/authStore';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/i18n', () => ({ useT: () => ({}) }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));

beforeEach(() => {
  (useAuthStore as unknown as { getState: jest.Mock }).getState = jest.fn(() => ({ error: null }));
  (useAuthStore as unknown as jest.Mock).mockReturnValue({
    user: { id: 'user-1', name: 'Ana', email: 'ana@example.com', location: '' },
    isLoading: false,
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    changePassword: jest.fn(),
    logout: jest.fn(),
  });
});

describe('ubicación del perfil', () => {
  it('permite elegir un país con clic después de buscarlo', () => {
    render(<ProfilePage />);
    const search = screen.getByRole('combobox', { name: 'Ubicación' });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: 'Chile' } });
    fireEvent.click(screen.getByRole('option', { name: /Chile/ }));

    expect((search as HTMLInputElement).value).toBe('Chile');
    expect(search.getAttribute('aria-expanded')).toBe('false');
  });

  it('permite elegir un país con teclado', () => {
    render(<ProfilePage />);
    const search = screen.getByRole('combobox', { name: 'Ubicación' });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: 'Colombia' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect((search as HTMLInputElement).value).toBe('Colombia');
  });

  it('guarda la zona horaria real junto al perfil público', async () => {
    const updateProfile = jest.fn().mockResolvedValue(undefined);
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: 'user-1', name: 'Ana', email: 'ana@example.com', location: 'Chile' },
      isLoading: false,
      updateProfile,
      uploadAvatar: jest.fn(),
      changePassword: jest.fn(),
      logout: jest.fn(),
    });
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      )
    );
  });
});
