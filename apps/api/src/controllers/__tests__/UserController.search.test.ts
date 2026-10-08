import { Request, Response } from 'express';
import { userController } from '../UserController';
import { pool } from '../../lib/db';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));

describe('UserController.searchByEmail', () => {
  const query = pool.query as jest.Mock;
  const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }) as unknown as Response;

  beforeEach(() => query.mockReset());

  it('busca por nombre o correo entre usuarios registrados y respeta el límite', async () => {
    query.mockResolvedValue({ rows: [{ id: 'other', name: 'Jennifer Ruiz', email: 'jennifer@example.com' }] });
    const req = { user: { id: 'current' }, query: { q: 'Jennifer', limit: '50' } } as unknown as Request;
    const res = response();

    await userController.searchByEmail(req, res);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('name  ILIKE $2'), ['current', '%Jennifer%', 'Jennifer', 50]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ users: [expect.objectContaining({ id: 'other' })] }) }));
  });

  it('limita las consultas demasiado amplias', async () => {
    const res = response();
    await userController.searchByEmail({ user: { id: 'current' }, query: { q: 'je' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(query).not.toHaveBeenCalled();
  });
});
