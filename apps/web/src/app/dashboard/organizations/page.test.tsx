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
    expect((await screen.findByRole('button', { name: 'Organización' })).textContent).toContain('Acme');
    fireEvent.click(await screen.findByRole('button', { name: /invitar persona/i }));
    fireEvent.change(screen.getByPlaceholderText('nombre@empresa.com'), { target: { value: 'bob@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar invitación' }));
    expect(await screen.findByRole('dialog', { name: 'Código de invitación generado' })).toBeTruthy();
    expect((screen.getByLabelText('Código de invitación') as HTMLInputElement).value).toBe(generated.code);
    expect((screen.getByLabelText('Enlace de invitación') as HTMLInputElement).value).toBe(generated.link);
    expect(screen.getByRole('button', { name: 'Copiar código' }).parentElement?.contains(screen.getByLabelText('Código de invitación'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Copiar enlace' }).parentElement?.contains(screen.getByLabelText('Enlace de invitación'))).toBe(true);
    expect(screen.getByText(/No se pudo enviar el correo/i)).toBeTruthy();
  });

  it('permite elegir otra organización con el menú personalizado', async () => {
    render(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Organización' }));
    fireEvent.click(screen.getByRole('option', { name: 'Otro equipo' }));
    expect(screen.getByRole('button', { name: 'Organización' }).textContent).toContain('Otro equipo');
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

  it('exige el nombre exacto y solo elimina una organización sin espacios', async () => {
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/organizations') return { success: true, data: { organizations: [
        { id: 'personal-1', name: 'Alice - Aether', type: 'PERSONAL', role: 'OWNER', memberCount: 1, workspaceCount: 0 },
        { id: 'org-other', name: 'Otro equipo', type: 'COMPANY', role: 'OWNER', memberCount: 1, workspaceCount: 1 },
        { id: 'org-1', name: 'Acme', type: 'COMPANY', role: 'OWNER', memberCount: 1, workspaceCount: 0 },
      ] } };
      if (url.endsWith('/members')) return { success: true, data: { members: [] } };
      if (url.endsWith('/invitations')) return { success: true, data: { invitations: [] } };
      return { success: false };
    });
    (apiService.delete as jest.Mock).mockResolvedValue({ success: true });

    render(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar organización' }));

    const dialog = screen.getByRole('dialog', { name: 'Eliminar organización' });
    const confirmButton = screen.getByRole('button', { name: 'Eliminar definitivamente' });
    const nameInput = screen.getByLabelText('Escribe el nombre exacto para confirmar');
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(nameInput, { target: { value: 'acme' } });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(nameInput, { target: { value: 'Acme' } });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(apiService.delete).toHaveBeenCalledWith(
      '/api/organizations/org-1', true, { confirmationName: 'Acme' },
    ));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Eliminar organización' })).toBeNull());
    expect(dialog).toBeTruthy();
  });

  it('explica que primero deben quitarse los espacios de trabajo', async () => {
    render(<OrganizationsPage />);
    const deleteButton = await screen.findByRole('button', { name: 'Eliminar organización' });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/mueve o elimina sus 1 espacio de trabajo/i)).toBeTruthy();
  });
});
