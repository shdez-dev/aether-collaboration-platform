import { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { teamController } from '../TeamController';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));

describe('listado de equipos', () => {
  it('incluye el nombre del responsable para la tarjeta del equipo', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{
      id: 'team-1', name: 'Diseño', lead_id: 'user-1', lead_name: 'Sebastian Hernandez',
      lead_avatar: null, created_by: 'user-1', created_at: new Date(), updated_at: new Date(),
      member_count: 1, project_count: 0, active_cards: 0, sample_members: [],
    }] });
    const req = { user: { id: 'user-1' }, query: {} } as unknown as Request;
    const res = { json: jest.fn() } as unknown as Response;

    await teamController.list(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { teams: [expect.objectContaining({ leadId: 'user-1', leadName: 'Sebastian Hernandez' })] },
    }));
  });
});
