import { LabelService } from '../LabelService';
import { pool } from '../../lib/db';

jest.mock('../../lib/db');

describe('LabelService workspace authorization', () => {
  let mockClient: { query: jest.Mock; release: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };
    (pool.query as jest.Mock) = jest.fn().mockResolvedValue({ rows: [] });
    (pool.connect as jest.Mock) = jest.fn().mockResolvedValue(mockClient);
  });

  it('does not create a label when the caller is not a workspace member', async () => {
    const result = await LabelService.createLabel('workspace-a', 'user-b', {
      name: 'Private',
      color: '#123456',
    });

    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM workspace_members wm'),
      ['workspace-a', 'user-b', 'Private', '#123456']
    );
  });

  it('scopes label reads to the caller membership', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 'label-a', workspace_id: 'workspace-a', name: 'Private', color: '#123456' }],
    });

    const label = await LabelService.getLabelById('label-a', 'user-b');

    expect(label).toMatchObject({ id: 'label-a', workspaceId: 'workspace-a', name: 'Private' });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('workspace_members wm'),
      ['label-a', 'user-b']
    );
  });

  it('scopes label updates to the caller membership', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 'label-a', workspace_id: 'workspace-a', name: 'Updated', color: '#123456' }],
    });

    const label = await LabelService.updateLabel('label-a', 'user-b', { name: 'Updated' });

    expect(label?.name).toBe('Updated');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('wm.workspace_id = labels.workspace_id'),
      ['Updated', 'label-a', 'user-b']
    );
  });

  it('blocks deleting a label with a cross-workspace card association', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return {};
      if (sql.includes('FROM labels l')) return { rows: [{ workspace_id: 'workspace-a' }] };
      if (sql.includes('FROM card_labels cl')) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    });

    const result = await LabelService.deleteLabel('label-a', 'user-a');

    expect(result).toBe('cross_workspace_association');
    expect(mockClient.query).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM labels'),
      expect.anything()
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
