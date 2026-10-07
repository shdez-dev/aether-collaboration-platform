import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiService } from '@/services/apiService';
import { useRouter } from 'next/navigation';
import FirstWorkspaceOnboarding from './FirstWorkspaceOnboarding';

const mockCreateWorkspace = jest.fn();
const mockSetActiveWorkspaceId = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/services/apiService', () => ({
  apiService: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: { createWorkspace: typeof mockCreateWorkspace }) => unknown) =>
    selector({ createWorkspace: mockCreateWorkspace }),
}));

jest.mock('@/stores/activeWorkspaceStore', () => ({
  useActiveWorkspaceStore: (selector: (state: { setActiveWorkspaceId: typeof mockSetActiveWorkspaceId }) => unknown) =>
    selector({ setActiveWorkspaceId: mockSetActiveWorkspaceId }),
}));

const personalOrganization = {
  id: 'personal-org',
  name: 'Sebastián - Aether',
  type: 'PERSONAL',
  role: 'OWNER',
};

describe('FirstWorkspaceOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { organizations: [personalOrganization] },
    });
    (apiService.post as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        organization: {
          id: 'company-org',
          name: 'Equipo Aurora',
          type: 'COMPANY',
          role: 'OWNER',
        },
      },
    });
    mockCreateWorkspace.mockResolvedValue({ id: 'first-workspace' });
  });

  it('allows a new account to create an organization and its first workspace', async () => {
    const onWorkspaceCreated = jest.fn();
    render(<FirstWorkspaceOnboarding onWorkspaceCreated={onWorkspaceCreated} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear organización/i }));
    fireEvent.change(await screen.findByLabelText(/nombre de la organización/i), {
      target: { value: 'Equipo Aurora' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /continuar/i }));

    expect(await screen.findByLabelText(/nombre del primer workspace/i)).toBeTruthy();
    expect(apiService.post).toHaveBeenCalledWith(
      '/api/organizations',
      { name: 'Equipo Aurora', type: 'COMPANY' },
      true,
    );

    fireEvent.change(screen.getByLabelText(/nombre del primer workspace/i), {
      target: { value: 'Operaciones' },
    });
    fireEvent.change(screen.getByLabelText(/descripción/i), {
      target: { value: 'Trabajo del equipo' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /crear primer workspace/i }));

    await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledWith({
      name: 'Operaciones',
      description: 'Trabajo del equipo',
      icon: 'briefcase',
      color: '#F2571E',
      organizationId: 'company-org',
      workspaceTemplateId: 'team',
    }));
    expect(mockSetActiveWorkspaceId).toHaveBeenCalledWith('first-workspace');
    expect(onWorkspaceCreated).toHaveBeenCalledWith('first-workspace');
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});
