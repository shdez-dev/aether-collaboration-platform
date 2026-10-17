import express from 'express';
import request from 'supertest';
import feedbackRouter from '../feedback';
import adminRouter from '../admin';
import { query } from '../../lib/db';

jest.mock('../../middleware/auth', () => ({
  authenticateJWT: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = req.header('x-test-user');
    if (!id) return res.status(401).json({ success: false, error: { code: 'NO_TOKEN' } });
    req.user = { id, email: 'test@example.com' };
    next();
  },
}));
jest.mock('../../lib/db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('../../websocket/RealtimeGateway', () => ({ getRealtimeGateway: jest.fn() }));
jest.mock('../../lib/redis', () => ({ checkRedisHealth: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRouter);
app.use('/api/admin', adminRouter);

describe('feedback y administración de comentarios', () => {
  const originalAdminId = process.env.PLATFORM_ADMIN_USER_ID;

  afterEach(() => {
    if (originalAdminId === undefined) delete process.env.PLATFORM_ADMIN_USER_ID;
    else process.env.PLATFORM_ADMIN_USER_ID = originalAdminId;
    jest.clearAllMocks();
  });

  it('requiere autenticación y valida el contenido antes de guardar', async () => {
    const unauthenticated = await request(app).post('/api/feedback').send({});
    const invalid = await request(app).post('/api/feedback').set('x-test-user', 'user-1').send({
      type: 'OTHER', title: 'abc', description: 'corto',
    });

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('guarda feedback autenticado con valores limpios y contexto de página', async () => {
    const createdAt = new Date('2026-10-16T12:00:00.000Z');
    (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'feedback-1', created_at: createdAt }] });

    const response = await request(app).post('/api/feedback').set('x-test-user', 'user-1').send({
      type: 'BUG', title: '  Error al guardar  ', description: '  El formulario no se guarda.  ',
      reproductionSteps: '  Abrir y guardar  ', pagePath: '/dashboard/settings',
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ id: 'feedback-1', createdAt: createdAt.toISOString() });
    expect((query as jest.Mock).mock.calls[0][0]).toContain('INSERT INTO feedback_submissions');
    expect((query as jest.Mock).mock.calls[0][1]).toEqual([
      'user-1', 'BUG', 'Error al guardar', 'El formulario no se guarda.', 'Abrir y guardar', '/dashboard/settings',
    ]);
  });

  it('permite listar comentarios paginados y aplicar filtros solo al administrador', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-1';
    const createdAt = new Date('2026-10-16T12:00:00.000Z');
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{
        id: 'feedback-1', type: 'BUG', title: 'Error', description: 'Falla al guardar',
        reproduction_steps: 'Abrir y guardar', page_path: '/dashboard', status: 'NEW',
        handled_at: null, created_at: createdAt, updated_at: createdAt,
        user_id: 'user-1', user_name: 'Persona', user_email: 'persona@example.com',
      }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const denied = await request(app).get('/api/admin/feedback').set('x-test-user', 'user-2');
    const response = await request(app).get('/api/admin/feedback?search=guardar&type=BUG&status=NEW&page=2')
      .set('x-test-user', 'admin-1');

    expect(denied.status).toBe(403);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      page: 2, pageSize: 20, total: 1,
      feedback: [{ id: 'feedback-1', userName: 'Persona', userEmail: 'persona@example.com', reproductionSteps: 'Abrir y guardar' }],
    });
    expect((query as jest.Mock).mock.calls[0][0]).toContain('f.status = $2::"FeedbackStatus"');
    expect((query as jest.Mock).mock.calls[0][0]).toContain('f.type = $3::"FeedbackType"');
    expect((query as jest.Mock).mock.calls[0][1]).toEqual(['%guardar%', 'NEW', 'BUG', 20, 20]);
  });

  it('actualiza el estado y devuelve 404 si el comentario ya no existe', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-1';
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: '11111111-1111-4111-8111-111111111111', status: 'RESOLVED', handled_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] });
    const validId = '11111111-1111-4111-8111-111111111111';

    const updated = await request(app).patch(`/api/admin/feedback/${validId}`).set('x-test-user', 'admin-1').send({ status: 'RESOLVED' });
    const missing = await request(app).patch(`/api/admin/feedback/${validId}`).set('x-test-user', 'admin-1').send({ status: 'IN_REVIEW' });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ id: validId, status: 'RESOLVED' });
    expect(missing.status).toBe(404);
  });
});
