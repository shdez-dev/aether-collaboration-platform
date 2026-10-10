import { render, screen } from '@testing-library/react';
import { LabelPicker } from './LabelPicker';

jest.mock('@/stores/labelStore', () => ({
  useLabelStore: () => ({
    getWorkspaceLabels: () => [{ id: 'label-1', name: 'a'.repeat(50), color: '#f06292' }],
    fetchLabels: jest.fn(), createLabel: jest.fn(), deleteLabel: jest.fn(),
  }),
}));
jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: object) => unknown) => selector({ currentWorkspace: { userRole: 'MEMBER' } }),
}));

describe('LabelPicker', () => {
  it('conserva y recorta visualmente las etiquetas antiguas de nombre largo', () => {
    const label = { id: 'label-1', name: 'a'.repeat(50), color: '#f06292', workspaceId: 'workspace-1', createdAt: '', updatedAt: '' };
    render(<LabelPicker workspaceId="workspace-1" cardId="card-1" assignedLabels={[label]}
      onLabelAssigned={jest.fn()} onLabelRemoved={jest.fn()} />);

    const names = screen.getAllByTitle(label.name);
    expect(names).toHaveLength(2);
    names.forEach((name) => {
      expect(name.style.overflow).toBe('hidden');
      expect(name.style.textOverflow).toBe('ellipsis');
      expect(name.style.whiteSpace).toBe('nowrap');
    });
  });
});
