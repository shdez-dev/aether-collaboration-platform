import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrganizationsPage from './page';
import { apiService } from '@/services/apiService';

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock('@/stores/workspaceStore', () => ({ useWorkspaceStore: () => ({
  currentWorkspace: null,
  workspaces: [{ id: 'ws-1', name: 'Operaciones', organizationId: 'org-1', userRole: 'OWNER' }],
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
      if (url === '/api/organizations/org-1') return { success: true, data: { organization: { id: 'org-1', name: 'Acme', type: 'COMPANY', role: 'OWNER', memberCount: 2, workspaceCount: 1 } } };
      if (url.endsWith('/members')) return { success: true, data: { members: [{ id: 'member-2', userId: 'bob-1', name: 'Bob', email: 'bob@example.com', role: 'MEMBER', joinedAt: '2026-10-09T12:00:00.000Z' }] } };
      if (url.endsWith('/invitations')) return { success: true, data: { invitations: [invitation] } };
      return { success: false };
    });
  });

  it('muestra código y enlace aunque falle el correo', async () => {
    (apiService.post as jest.Mock).mockResolvedValue({ success: true, data: { invitation: generated } });
    render(<OrganizationsPage />);
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeTruthy();
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

  it('usa la organización activa del sidebar sin repetir su selector', async () => {
    render(<OrganizationsPage />);
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Organización' })).toBeNull();
  });

  it('busca en todos los miembros y pagina los resultados', async () => {
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/organizations') return { success: true, data: { organizations: [
        { id: 'org-1', name: 'Acme', type: 'COMPANY', role: 'OWNER', memberCount: 12, workspaceCount: 1 },
        { id: 'org-other', name: 'Otro equipo', type: 'COMPANY', role: 'OWNER', memberCount: 1, workspaceCount: 0 },
      ] } };
      if (url === '/api/organizations/org-1/members') return { success: true, data: { members: [
        ...Array.from({ length: 11 }, (_, index) => ({ id: `member-${index}`, userId: `user-${index}`, name: `Persona ${String(index + 1).padStart(2, '0')}`, email: `persona${index + 1}@example.com`, role: 'MEMBER', joinedAt: '2026-10-09T12:00:00.000Z' })),
        { id: 'member-jose', userId: 'user-jose', name: 'José Álvarez', email: 'jose@example.com', role: 'MEMBER', joinedAt: '2026-10-09T12:00:00.000Z' },
      ] } };
      if (url === '/api/organizations/org-other/members') return { success: true, data: { members: [
        { id: 'member-ana', userId: 'user-ana', name: 'Ana', email: 'ana@example.com', role: 'MEMBER', joinedAt: '2026-10-09T12:00:00.000Z' },
      ] } };
      if (url.endsWith('/invitations')) return { success: true, data: { invitations: [] } };
      return { success: false };
    });

    render(<OrganizationsPage />);
    expect(await screen.findByText('Persona 01')).toBeTruthy();
    expect(screen.queryByText('José Álvarez')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('José Álvarez')).toBeTruthy();

    const search = screen.getByRole('searchbox', { name: 'Buscar miembros de esta organización' });
    fireEvent.change(search, { target: { value: 'jose' } });
    expect(screen.getByText('José Álvarez')).toBeTruthy();
    expect(screen.getByText('1 resultado')).toBeTruthy();

    expect((search as HTMLInputElement).value).toBe('jose');
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

  it('explica qué permisos concede el rol de facturación', async () => {
    render(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /invitar persona/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Rol en la organización' }));
    fireEvent.click(screen.getByRole('option', { name: 'Administrador de facturación' }));
    expect(screen.getByText(/actualizar el correo de facturación/i)).toBeTruthy();
    expect(screen.getByText(/En el piloto gratuito puedes dejarlo sin asignar/i)).toBeTruthy();
  });

  it('permite al propietario retirar un miembro con confirmación y actualiza la lista', async () => {
    (apiService.delete as jest.Mock).mockResolvedValue({ success: true });
    render(<OrganizationsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Bob' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Quitar de la organización' }));
    expect(screen.getByRole('dialog', { name: 'Quitar a Bob' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar de la organización' }));

    await waitFor(() => expect(apiService.delete).toHaveBeenCalledWith('/api/organizations/org-1/members/bob-1', true));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Acciones de Bob' })).toBeNull());
  });

  it('permite al administrador retirar miembros, pero no roles administrativos', async () => {
    (apiService.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/organizations') return { success: true, data: { organizations: [
        { id: 'org-1', name: 'Acme', type: 'COMPANY', role: 'ADMIN', memberCount: 3, workspaceCount: 1 },
      ] } };
      if (url.endsWith('/members')) return { success: true, data: { members: [
        { id: 'member-2', userId: 'bob-1', name: 'Bob', email: 'bob@example.com', role: 'MEMBER', joinedAt: '2026-10-09T12:00:00.000Z' },
        { id: 'member-3', userId: 'carol-1', name: 'Carol', email: 'carol@example.com', role: 'BILLING_ADMIN', joinedAt: '2026-10-09T12:00:00.000Z' },
      ] } };
      if (url.endsWith('/invitations')) return { success: true, data: { invitations: [] } };
      return { success: false };
    });
    render(<OrganizationsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Bob' }));
    expect(screen.getByRole('menuitem', { name: 'Quitar de la organización' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Acciones de Carol' }));
    expect(screen.queryByRole('menuitem', { name: 'Quitar de la organización' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Cambiar rol' })).toBeNull();
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

  it('permite asignar una persona a varios espacios con invitación', async () => {
    (apiService.post as jest.Mock).mockResolvedValue({ success: true });
    render(<OrganizationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Bob' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Asignar espacio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a 1 espacio' }));
    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/api/workspaces/ws-1/invite', { email: 'bob@example.com', role: 'MEMBER' }, true));
  });

  it('permite al propietario cambiar el rol desde la fila de la persona', async () => {
    (apiService.patch as jest.Mock).mockResolvedValue({ success: true });
    render(<OrganizationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar rol de Bob' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo rol' }));
    fireEvent.click(screen.getByRole('option', { name: 'Administrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));
    await waitFor(() => expect(apiService.patch).toHaveBeenCalledWith('/api/organizations/org-1/members/bob-1', { role: 'ADMIN' }, true));
    expect(await screen.findByText('Administrador')).toBeTruthy();
  });

  it('no muestra la eliminación de la organización mientras se define la cancelación', async () => {
    render(<OrganizationsPage />);
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eliminar organización' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Eliminar organización' })).toBeNull();
  });
});
