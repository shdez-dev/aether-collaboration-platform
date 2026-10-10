import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import WorkspaceContextSwitcher from './WorkspaceContextSwitcher';
import { apiService } from '@/services/apiService';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn() } }));
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange: (open: boolean) => void }) => {
    useEffect(() => { onOpenChange(true); }, []);
    return <div>{children}</div>;
  },
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

it('permite entrar a una organización vacía sin abrir la creación de espacio', async () => {
  (apiService.get as jest.Mock).mockResolvedValue({ success: true, data: { organizations: [
    { id: 'organization-1', name: 'Con espacios', type: 'COMPANY', role: 'OWNER', workspaceCount: 1 },
    { id: 'organization-2', name: 'Aether vacía', type: 'COMPANY', role: 'MEMBER', workspaceCount: 0 },
  ] } });
  const onSelectOrganization = jest.fn();
  const onCreateNew = jest.fn();

  render(<WorkspaceContextSwitcher
    workspaces={[{ id: 'workspace-1', organizationId: 'organization-1', mode: 'TEAM', name: 'Espacio', ownerId: 'user-1', createdAt: '', updatedAt: '' }]}
    activeWorkspaceId="workspace-1"
    activeOrganizationId="organization-1"
    activeOrganization={{ id: 'organization-1', name: 'Con espacios', type: 'COMPANY', role: 'OWNER', workspaceCount: 1 }}
    onSelect={jest.fn()}
    onSelectOrganization={onSelectOrganization}
    onCreateNew={onCreateNew}
    onNewOrganization={jest.fn()}
    onEdit={jest.fn()}
    onRefresh={jest.fn().mockResolvedValue(undefined)}
  />);

  fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Aether vacía/i })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Aether vacía/i }));

  expect(onSelectOrganization).toHaveBeenCalledWith('organization-2');
  expect(onCreateNew).not.toHaveBeenCalled();
});
