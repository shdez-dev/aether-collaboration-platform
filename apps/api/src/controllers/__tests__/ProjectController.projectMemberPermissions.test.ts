import { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { projectController } from '../ProjectController';
import { eventStore } from '../../services/EventStoreService';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/EventStoreService', () => ({ eventStore: { emit: jest.fn() } }));

describe('ProjectController project member permissions', () => {
  const query = pool.query as jest.Mock;
  const emit = eventStore.emit as jest.Mock;
  const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }) as unknown as Response;

  beforeEach(() => {
    query.mockReset();
    emit.mockReset();
    emit.mockResolvedValue(undefined);
  });

  it('sets a project-only role for an existing team member without sending an invite', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ workspace_id: 'workspace', member_name: 'Ana', has_team_access: true, previous_role: null }] })
      .mockResolvedValueOnce({ rows: [{ role: 'VIEWER' }] })
      .mockResolvedValueOnce({ rows: [{ project_name: 'Proyecto Aether' }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Sebastian' }] });
    const res = response();

    await projectController.updateDirectMemberRole({
      params: { id: 'project', userId: 'member' },
      body: { role: 'VIEWER' },
      user: { id: 'actor' },
    } as unknown as Request, res);

    expect(query.mock.calls[1][0]).toContain('ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role');
    expect(query.mock.calls[1][1]).toEqual(['project', 'member', 'VIEWER', 'actor']);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { role: 'VIEWER' } });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'project.member.role-changed',
      payload: expect.objectContaining({ memberId: 'member', newRole: 'VIEWER', inherited: false }),
    }));
  });

  it('restores the strongest role inherited from the assigned teams', async () => {
    query
      .mockResolvedValueOnce({ rows: [{
        workspace_id: 'workspace',
        project_name: 'Proyecto Aether',
        member_name: 'Ana',
        previous_role: 'VIEWER',
        inherited_role: 'ADMIN',
      }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: 'Sebastian' }] });
    const res = response();

    await projectController.resetDirectMemberRole({
      params: { id: 'project', userId: 'member' },
      user: { id: 'actor' },
    } as unknown as Request, res);

    expect(query.mock.calls[1][0]).toContain('DELETE FROM project_members');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { role: 'ADMIN' } });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'project.member.role-changed',
      payload: expect.objectContaining({ memberId: 'member', newRole: 'ADMIN', inherited: true }),
    }));
  });

  it('rejects roles outside project coordinator, collaborator and observer', async () => {
    const res = response();

    await projectController.updateDirectMemberRole({
      params: { id: 'project', userId: 'member' },
      body: { role: 'OWNER' },
      user: { id: 'actor' },
    } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(query).not.toHaveBeenCalled();
  });
});
