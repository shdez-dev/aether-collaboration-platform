import { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { teamController } from '../TeamController';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));

describe('proyectos de un equipo', () => {
  beforeEach(() => (pool.query as jest.Mock).mockReset());

  it('devuelve las asignaciones persistidas para el detalle y el modal', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{
      id: 'project-1', name: 'Portal', color: '#7452A6', description: 'Sitio',
      status: 'ACTIVE', workspace_name: 'Producto', assigned_at: new Date('2026-10-09T12:00:00Z'),
    }] });
    const req = { params: { id: 'team-1' } } as unknown as Request;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

    await teamController.getProjects(req, res);

    expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('FROM project_teams pt');
    expect((pool.query as jest.Mock).mock.calls[0][1]).toEqual(['team-1']);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { projects: [expect.objectContaining({
      id: 'project-1', name: 'Portal', workspaceName: 'Producto', assignedAt: '2026-10-09T12:00:00.000Z',
    })] } });
  });
});
