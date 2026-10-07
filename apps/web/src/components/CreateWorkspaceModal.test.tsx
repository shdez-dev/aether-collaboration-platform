import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiService } from '@/services/apiService';
import CreateWorkspaceModal from './CreateWorkspaceModal';

const mockCreateWorkspace = jest.fn();

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn() } }));
jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: jest.fn(() => ({
    createWorkspace: mockCreateWorkspace,
    isLoading: false,
    currentWorkspace: { organizationId: 'org-current' },
  })),
}));

const organizations = [
  { id: 'org-current', name: 'AETHER', type: 'COMPANY', role: 'OWNER' },
  { id: 'org-other', name: 'Equipo Aurora', type: 'INSTITUTION', role: 'ADMIN' },
  { id: 'org-personal', name: 'Sebastian \u00B7 Aether', type: 'PERSONAL', role: 'OWNER' },
];

describe('CreateWorkspaceModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiService.get as jest.Mock).mockResolvedValue({ success: true, data: { organizations } });
    mockCreateWorkspace.mockResolvedValue({ id: 'workspace-new', organizationId: 'org-other' });
  });

  it('allows changing the preselected organization and derives its workspace structure', async () => {
    const onCreated = jest.fn();
    render(<CreateWorkspaceModal isOpen initialOrganizationId="org-current" onClose={jest.fn()} onCreated={onCreated} />);

    const organizationSelect = await screen.findByLabelText('Organización');
    expect((organizationSelect as HTMLSelectElement).value).toBe('org-current');
    expect((organizationSelect as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole('option', { name: 'Sebastian - Aether - Personal' })).toBeTruthy();
    expect(screen.getByText('Espacio de equipo')).toBeTruthy();
    expect(screen.queryByText('Tipo de espacio de trabajo')).toBeNull();
    expect(screen.queryByText(/Marketing y contenidos|Construcción/)).toBeNull();
    expect(screen.queryByText(/^ICONO:|^COLOR:/)).toBeNull();

    fireEvent.change(organizationSelect, { target: { value: 'org-other' } });
    expect(await screen.findByText('Espacio institucional')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nombre del espacio de trabajo/), { target: { value: 'Programas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear espacio de trabajo' }));

    await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledWith({
      name: 'Programas',
      description: undefined,
      icon: 'Building2',
      color: '#f97316',
      organizationId: 'org-other',
      workspaceTemplateId: 'institutional',
    }));
    expect(onCreated).toHaveBeenCalledWith({ id: 'workspace-new', organizationId: 'org-other' });
  });

  it('uses the personal workspace structure for an organization of type personal', async () => {
    render(<CreateWorkspaceModal isOpen onClose={jest.fn()} />);

    const organizationSelect = await screen.findByLabelText('Organización');
    fireEvent.change(organizationSelect, { target: { value: 'org-personal' } });
    expect(await screen.findByText('Espacio personal')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nombre del espacio de trabajo/), { target: { value: 'Aprendizaje' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear espacio de trabajo' }));

    await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledWith({
      name: 'Aprendizaje',
      description: undefined,
      icon: 'Target',
      color: '#3b82f6',
      organizationId: 'org-personal',
      workspaceTemplateId: 'personal',
    }));
  });

  it('shows a retry action when organization data cannot be loaded', async () => {
    (apiService.get as jest.Mock).mockRejectedValueOnce(new Error('network'));
    render(<CreateWorkspaceModal isOpen onClose={jest.fn()} />);

    expect(await screen.findByText(/No se pudieron cargar tus organizaciones/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(apiService.get).toHaveBeenCalledTimes(2));
    expect((await screen.findByLabelText('Organización') as HTMLSelectElement).value).toBe('org-current');
  });
});
