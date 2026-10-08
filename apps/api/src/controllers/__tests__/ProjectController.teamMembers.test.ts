import { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { projectController } from '../ProjectController';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));

describe('ProjectController.getTeamMembers', () => {
  const query = pool.query as jest.Mock;
  const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }) as unknown as Response;

  beforeEach(() => query.mockReset());

  it('devuelve cada persona vinculada a su equipo dentro del proyecto', async () => {
    query.mockResolvedValue({ rows: [
      { id: 'person', name: 'Ana', email: 'ana@example.com', avatar: null, role: 'MEMBER', team_id: 'team-a', team_name: 'Diseño', team_color: '#7452A6' },
      { id: 'person', name: 'Ana', email: 'ana@example.com', avatar: null, role: 'ADMIN', team_id: 'team-b', team_name: 'Producto', team_color: null },
    ] });
    const res = response();

    await projectController.getTeamMembers({ params: { id: 'project' } } as unknown as Request, res);

    expect(query.mock.calls[0][0]).toContain('FROM project_teams pt');
    expect(query.mock.calls[0][0]).toContain('JOIN workspace_members wm');
    expect(query.mock.calls[0][1]).toEqual(['project']);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { members: [
      expect.objectContaining({ id: 'person', teamId: 'team-a', teamName: 'Diseño' }),
      expect.objectContaining({ id: 'person', teamId: 'team-b', teamName: 'Producto' }),
    ] } });
  });
});
