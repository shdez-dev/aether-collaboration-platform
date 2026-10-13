import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiService } from '@/services/apiService';
import CreateOrganizationModal from './CreateOrganizationModal';

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn(), post: jest.fn() } }));

describe('CreateOrganizationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => url === '/api/organizations/creation-permissions'
      ? { success: true, data: { types: [] } }
      : { success: true, data: { organizations: [] } });
    (apiService.post as jest.Mock).mockResolvedValue({
      success: true,
      data: { organization: { id: 'org-new', name: 'Equipo Aurora', type: 'COMPANY' } },
    });
  });

  it('keeps special organization types unavailable without explicit permission', () => {
    render(<CreateOrganizationModal isOpen onCreated={jest.fn()} onClose={jest.fn()} />);

    expect((screen.getByRole('button', { name: /Equipo o empresa/ }) as HTMLButtonElement).disabled).toBe(false);
    for (const label of [/Institución/, /Red de colaboración/]) {
      expect((screen.getByRole('button', { name: label }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole('button', { name: /Crear organización/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('makes the existing personal organization available without creating a duplicate', async () => {
    const personalOrganization = { id: 'org-personal', name: 'Sebastian - Aether', type: 'PERSONAL' };
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => url === '/api/organizations/creation-permissions'
      ? { success: true, data: { types: [] } }
      : { success: true, data: { organizations: [personalOrganization] } });
    const onCreated = jest.fn();
    const onClose = jest.fn();
    render(<CreateOrganizationModal isOpen onCreated={onCreated} onClose={onClose} />);

    expect(screen.getByText(/Tu espacio personal ya existe/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Usar espacio personal/ }));

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/api/organizations', true));
    expect(apiService.post).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(personalOrganization);
    expect(onClose).toHaveBeenCalled();
  });
});
