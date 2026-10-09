import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrganizationsPage from './page';
import { apiService } from '@/services/apiService';

const mockInviteMember = jest.fn();
jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('@/stores/workspaceStore', () => ({ useWorkspaceStore: () => ({
  currentWorkspace: null,
  workspaces: [{ id: 'ws-1', name: 'Operaciones', organizationId: 'org-1', userRole: 'OWNER' }],
  inviteMember: mockInviteMember,
}) }));
jest.mock('@/stores/activeWorkspaceStore', () => ({ useActiveWorkspaceStore: (selector: (state: { activeWorkspaceId: string }) => unknown) => selector({ activeWorkspaceId: 'ws-1' }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'alice-1' } }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), warning: jest.fn() } }));

const invitation = {
  id: 'invite-1', email: 'bob@example.com', role: 'MEMBER',
  expiresAt: '2026-10-16T12:00:00.000Z', createdAt: '2026-10-09T12:00:00.000Z',
  invitedBy: { id: 'alice-1', name: 'Alice' },
};
const generated = {
  code: 'a'.repeat(64), link: `http://localhost:3002/organization-invitation?token=${'a'.repeat(64)}`,
  email: 'bob@example.com', expiresAt: invitation.expiresAt, emailStatus: 'failed',
};

describe('invitaciones de organización', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/organizations') return { success: true, data: { organizations: [
        { id: 'personal-1', name: 'Alice - Aether', type: 'PERSONAL', role: 'OWNER', memberCount: 1, workspaceCount: 0 },
        { id: 'org-other', name: 'Otro equipo', type: 'COMPANY', role: 'OWNER', memberCount: 1, workspaceCount: 1 },
        { id: 'org-1', name: 'Acme', type: 'COMPANY', role: 'OWNER', memberCount: 1, workspaceCount: 1 },
      ] } };
      if (url.endsWith('/members')) return { success: true, data: { members: [{ id: 'member-2', userId: 'bob-1', name: 'Bob', email: 'bob@example.com', role: 'MEMBER', joinedAt: '2026-10-09T12:00:00.000Z' }] } };
      if (url.endsWith('/invitations')) return { success: true, data: { invitations: [invitation] } };
      return { success: false };
    });
  });

  it('muestra código y enlace aunque falle el correo', async () => {
    (apiService.post as jest.Mock).mockResolvedValue({ success: true, data: { invitation: generated } });
    render(<OrganizationsPage />);
    expect((await screen.findByLabelText('Organización') as HTMLSelectElement).value).toBe('org-1');
    fireEvent.click(await screen.findByRole('button', { name: /invitar persona/i }));
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'bob@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar invitación' }));
    expect(await screen.findByRole('dialog', { name: 'Código de invitación generado' })).toBeTruthy();
    expect((screen.getByLabelText('Código de invitación') as HTMLInputElement).value).toBe(generated.code);
    expect((screen.getByLabelText('Enlace de invitación') as HTMLInputElement).value).toBe(generated.link);
    expect(screen.getByText(/No se pudo enviar el correo/i)).toBeTruthy();
  });

  it('abre el rol fuera del modal y envía el rol seleccionado', async () => {
    (apiService.post as jest.Mock).mockResolvedValue({ success: true, data: { invitation: generated } });
    render(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /invitar persona/i }));
    const roleTrigger = screen.getByRole('button', { name: 'Rol en la organización' });
    const form = roleTrigger.closest('form');
    fireEvent.click(roleTrigger);
    const menu = screen.getByRole('listbox', { name: 'Rol en la organización' });
    expect(form?.contains(menu)).toBe(false);
    fireEvent.click(screen.getByRole('option', { name: 'Administrador' }));
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'bob@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar invitación' }));
    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith(
      '/api/organizations/org-1/invitations',
      { email: 'bob@example.com', role: 'ADMIN' },
      true,
    ));
  });

  it('permite regenerar una invitación pendiente sin prometer envío de correo', async () => {
    const confirmation = jest.spyOn(window, 'confirm').mockReturnValue(true);
    (apiService.post as jest.Mock).mockResolvedValue({ success: true, data: { invitation: { ...generated, emailStatus: 'not_sent' } } });
    try {
      render(<OrganizationsPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Regenerar código para bob@example.com' }));
      await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/api/organizations/org-1/invitations/invite-1/regenerate', {}, true));
      expect(await screen.findByText(/El código anterior ya no funciona/i)).toBeTruthy();
    } finally { confirmation.mockRestore(); }
  });

  it('conserva la asignación de espacios al quitar la antigua vista de usuarios', async () => {
    mockInviteMember.mockResolvedValue(undefined);
    render(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar espacio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación al espacio' }));
    await waitFor(() => expect(mockInviteMember).toHaveBeenCalledWith('ws-1', 'bob@example.com', 'MEMBER'));
  });
});
