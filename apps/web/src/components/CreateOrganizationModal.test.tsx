import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiService } from '@/services/apiService';
import CreateOrganizationModal from './CreateOrganizationModal';

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn(), post: jest.fn() } }));

describe('CreateOrganizationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiService.post as jest.Mock).mockResolvedValue({
      success: true,
      data: { organization: { id: 'org-new', name: 'Equipo Aurora', type: 'COMPANY' } },
    });
  });

  it('creates the selected organization and continues through the parent flow', async () => {
    const onCreated = jest.fn();
    const onClose = jest.fn();
    render(<CreateOrganizationModal isOpen onCreated={onCreated} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Nombre de la organización'), { target: { value: 'Equipo Aurora' } });
    fireEvent.click(screen.getByRole('button', { name: /Institución/ }));
    fireEvent.click(screen.getByRole('button', { name: /Crear organización/ }));

    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith(
      '/api/organizations',
      { name: 'Equipo Aurora', type: 'INSTITUTION' },
      true,
    ));
    expect(onCreated).toHaveBeenCalledWith({ id: 'org-new', name: 'Equipo Aurora', type: 'COMPANY' });
    expect(onClose).toHaveBeenCalled();
  });

  it('makes the existing personal organization available without creating a duplicate', async () => {
    const personalOrganization = { id: 'org-personal', name: 'Sebastian - Aether', type: 'PERSONAL' };
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { organizations: [personalOrganization] },
    });
    const onCreated = jest.fn();
    const onClose = jest.fn();
    render(<CreateOrganizationModal isOpen onCreated={onCreated} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Personal/ }));
    expect(screen.getByText(/Tu organización personal ya está vinculada/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Usar organización personal/ }));

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/api/organizations', true));
    expect(apiService.post).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(personalOrganization);
    expect(onClose).toHaveBeenCalled();
  });
});
