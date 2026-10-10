import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentsPage from './page';
import { apiService } from '@/services/apiService';

const push = jest.fn();
const mockWorkspaceState = { workspaces: [{ id: 'workspace-1', name: 'Equipo' }] };
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn() } }));
jest.mock('@/stores/workspaceStore', () => ({ useWorkspaceStore: (select: (state: unknown) => unknown) => select(mockWorkspaceState) }));
jest.mock('@/stores/activeWorkspaceStore', () => ({ useActiveWorkspaceStore: (select: (state: unknown) => unknown) => select({ activeWorkspaceId: 'workspace-1' }) }));
jest.mock('@/stores/documentStore', () => ({ useDocumentStore: (select: (state: unknown) => unknown) => select({ createDocument: jest.fn() }) }));

const base = { workspaceId: 'workspace-1', content: '<p>Contenido de ejemplo</p>', createdBy: 'user-1', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z' };

describe('biblioteca de documentos', () => {
  beforeEach(() => {
    push.mockReset();
    (apiService.get as jest.Mock).mockReset().mockImplementation(async (url: string) => {
      if (url.includes('/documents')) return { success: true, data: { documents: [
        { ...base, id: 'space-doc', title: 'Guía del equipo', projectId: null },
        { ...base, id: 'project-doc', title: 'Plan del producto', projectId: 'project-1' },
      ], total: 2 } };
      return { success: true, data: { projects: [{ id: 'project-1', name: 'Nuevo producto' }] } };
    });
  });

  it('separa documentos del espacio y asociados a proyectos', async () => {
    render(<DocumentsPage />);
    expect(await screen.findByRole('heading', { name: /Documentos del espacio/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Documentos de proyectos/ })).toBeTruthy();
    expect(screen.getAllByText('Equipo').length).toBeGreaterThan(0);
    expect(screen.getByText('Nuevo producto')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir documento Plan del producto' }));
    expect(push).toHaveBeenCalledWith('/dashboard/documents/project-doc');
  });

  it('filtra por tipo y por texto sin mezclar proyectos con espacios', async () => {
    render(<DocumentsPage />);
    await screen.findByRole('button', { name: 'Abrir documento Plan del producto' });
    fireEvent.click(screen.getByRole('button', { name: /De proyectos/ }));
    expect(screen.queryByRole('button', { name: 'Abrir documento Guía del equipo' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar documentos' }), { target: { value: 'inexistente' } });
    await waitFor(() => expect(screen.getByText('Sin resultados para estos filtros')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('button', { name: 'Abrir documento Guía del equipo' })).toBeTruthy();
  });
});
