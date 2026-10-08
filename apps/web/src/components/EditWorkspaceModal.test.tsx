import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditWorkspaceModal from './EditWorkspaceModal';

const mockUpdateWorkspace = jest.fn();
const mockUpdateWorkspaceMode = jest.fn();

jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    updateWorkspace: mockUpdateWorkspace,
    updateWorkspaceMode: mockUpdateWorkspaceMode,
    deleteWorkspace: jest.fn(),
    isLoading: false,
  }),
}));

describe('EditWorkspaceModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateWorkspace.mockResolvedValue(undefined);
  });

  it('edita la identidad del espacio sin modificar su contexto', async () => {
    render(<EditWorkspaceModal
      workspace={{ id: 'ws-1', name: 'Portfolio', icon: 'Folder', color: '#10b981' }}
      onClose={jest.fn()}
      onDeleted={jest.fn()}
    />);

    expect(screen.queryByText('Contexto del espacio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Institucional' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ideas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(mockUpdateWorkspace).toHaveBeenCalledWith('ws-1', {
      name: 'Ideas', icon: 'Folder', color: '#10b981',
    }));
    expect(mockUpdateWorkspaceMode).not.toHaveBeenCalled();
  });
});
