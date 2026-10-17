import type { NextFunction, Response } from 'express';
import { pool } from '../../lib/db';
import { checkLabelWorkspaceMembership, type WorkspaceRequest } from '../workspace';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/WorkspaceService', () => ({
  workspaceService: { getMembership: jest.fn() },
}));
jest.mock('../../services/BoardService', () => ({
  boardService: { getBoardById: jest.fn() },
}));
jest.mock('../../services/ListService', () => ({
  listService: { getListById: jest.fn() },
}));
jest.mock('../../services/CardService', () => ({
  CardService: { getCardById: jest.fn() },
}));

describe('checkLabelWorkspaceMembership', () => {
  let req: Partial<WorkspaceRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let status: jest.Mock;
  let json: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    status = jest.fn().mockReturnThis();
    json = jest.fn();
    req = {
      user: { id: 'user-a', email: 'a@example.test' },
      params: { labelId: 'label-a' },
    } as any;
    res = { status, json };
    next = jest.fn();
  });

  it('attaches the workspace for a member of the label workspace', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ workspace_id: 'workspace-a', role: 'MEMBER' }],
    });

    await checkLabelWorkspaceMembership(req as WorkspaceRequest, res as Response, next);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('workspace_members wm'),
      ['label-a', 'user-a']
    );
    expect(req.workspace).toEqual({ id: 'workspace-a', role: 'MEMBER' });
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('returns the same not-found response for unknown labels and labels in other workspaces', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await checkLabelWorkspaceMembership(req as WorkspaceRequest, res as Response, next);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Label not found' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers before querying labels', async () => {
    req.user = undefined;

    await checkLabelWorkspaceMembership(req as WorkspaceRequest, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(pool.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
