import { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { teamController } from '../TeamController';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/EventStoreService', () => ({ eventStore: { emit: jest.fn().mockResolvedValue(undefined) } }));

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }) as unknown as Response;

describe('descripción breve de equipos', () => {
  beforeEach(() => (pool.query as jest.Mock).mockReset());

  it('rechaza más de 120 caracteres al crear o editar', async () => {
    const longDescription = 'x'.repeat(121);
    const createResponse = response();
    await teamController.create({ user: { id: 'user-1' }, body: {
      workspaceId: '11111111-1111-4111-8111-111111111111', name: 'Equipo', description: longDescription,
    } } as unknown as Request, createResponse);
    expect(createResponse.status).toHaveBeenCalledWith(400);

    const updateResponse = response();
    await teamController.update({ user: { id: 'user-1' }, params: { id: 'team-1' }, body: { description: longDescription } } as unknown as Request, updateResponse);
    expect(updateResponse.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('permite borrar una descripción y omitirla sin cambiar la existente', async () => {
    const row = { id: 'team-1', name: 'Equipo', created_at: new Date(), updated_at: new Date() };
    (pool.query as jest.Mock).mockResolvedValue({ rows: [row] });
    await teamController.update({ user: { id: 'user-1' }, params: { id: 'team-1' }, body: { description: null } } as unknown as Request, response());
    expect((pool.query as jest.Mock).mock.calls[0][1][7]).toBe(true);
    expect((pool.query as jest.Mock).mock.calls[0][1][1]).toBeNull();

    (pool.query as jest.Mock).mockClear();
    await teamController.update({ user: { id: 'user-1' }, params: { id: 'team-1' }, body: { name: 'Otro nombre' } } as unknown as Request, response());
    expect((pool.query as jest.Mock).mock.calls[0][1][7]).toBe(false);
  });
});
