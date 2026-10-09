import { Request, Response } from 'express';
import { userController } from '../UserController';
import { pool } from '../../lib/db';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));

describe('UserController.getUserProfile', () => {
  const query = pool.query as jest.Mock;
  const response = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }) as unknown as Response;

  beforeEach(() => query.mockReset());

  it('incluye los datos públicos y nunca expone el teléfono', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'contact-1',
            name: 'Ana',
            email: 'ana@example.com',
            avatar: null,
            bio: 'Diseñadora',
            position: 'Product Designer',
            location: 'Chile',
            timezone: 'America/Santiago',
            language: 'es',
            phone: '+56123456788',
            created_at: '2026-08-01',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'workspace-1', name: 'Diseño' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const req = { user: { id: 'viewer-1' }, params: { id: 'contact-1' } } as unknown as Request;
    const res = response();

    await userController.getUserProfile(req, res);

    expect(query.mock.calls[0][0]).toContain('location, timezone, language');
    expect(query.mock.calls[0][0]).not.toContain('phone');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            location: 'Chile',
            timezone: 'America/Santiago',
            language: 'es',
          }),
        }),
      })
    );
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.data.user).not.toHaveProperty('phone');
  });
});
