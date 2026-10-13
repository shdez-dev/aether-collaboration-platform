import express from 'express';
import request from 'supertest';
import adminRouter from '../admin';
import { query } from '../../lib/db';
import { getRealtimeGateway } from '../../websocket/RealtimeGateway';
import { checkRedisHealth } from '../../lib/redis';

jest.mock('../../middleware/auth', () => ({
  authenticateJWT: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = req.header('x-test-user');
    if (!id) return res.status(401).json({ success: false });
    req.user = { id, email: 'test@example.com' };
    next();
  },
}));
jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../websocket/RealtimeGateway', () => ({ getRealtimeGateway: jest.fn() }));
jest.mock('../../lib/redis', () => ({ checkRedisHealth: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

describe('rutas de administración global', () => {
  const original = process.env.PLATFORM_ADMIN_USER_ID;

  afterEach(() => {
    if (original === undefined) delete process.env.PLATFORM_ADMIN_USER_ID;
    else process.env.PLATFORM_ADMIN_USER_ID = original;
    jest.clearAllMocks();
  });

  it('rechaza peticiones sin autenticar', async () => {
    const response = await request(app).get('/api/admin/overview');
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('deniega por defecto y no consulta métricas para otros usuarios', async () => {
    delete process.env.PLATFORM_ADMIN_USER_ID;
    const response = await request(app).get('/api/admin/overview').set('x-test-user', 'ordinary-user');
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('permite al identificador configurado y cuenta usuarios conectados únicos', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ users: 3, verified_users: 2, new_users_7d: 1, new_users_30d: 2, organizations: 1, workspaces: 1, projects: 1, teams: 1, boards: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'admin-id', name: 'Admin', email: 'admin@example.com', created_at: new Date(), email_verified: true }] })
      .mockResolvedValueOnce({ rows: [{ day: '2026-10-08', count: 1 }] });
    (getRealtimeGateway as jest.Mock).mockReturnValue({ getOnlineUserIds: () => new Set(['admin-id', 'another-id']) });

    const response = await request(app).get('/api/admin/overview').set('x-test-user', 'admin-id');
    expect(response.status).toBe(200);
    expect(response.body.data.totals.online_users).toBe(2);
    expect(response.body.data.recentUsers[0].online).toBe(true);
    expect(response.body.data.onlineScope).toBe('current_instance');
  });

  it('admite exactamente una cuenta y no listas de identificadores', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    const denied = await request(app).get('/api/admin/access').set('x-test-user', 'another-id');
    const allowed = await request(app).get('/api/admin/access').set('x-test-user', 'admin-id');
    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  it('protege también las listas globales y el estado del sistema', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    for (const path of ['users', 'organizations', 'workspaces', 'projects', 'invitations', 'subscriptions', 'activity', 'system']) {
      const response = await request(app).get(`/api/admin/${path}`).set('x-test-user', 'another-id');
      expect(response.status).toBe(403);
    }
    expect(query).not.toHaveBeenCalled();
    expect(checkRedisHealth).not.toHaveBeenCalled();
  });

  it('devuelve usuarios paginados con presencia y sin datos privados de autenticación', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    (getRealtimeGateway as jest.Mock).mockReturnValue({ getOnlineUserIds: () => new Set(['admin-id']) });
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'admin-id', name: 'Admin', email: 'admin@example.com', email_verified: true, created_at: new Date(), last_activity_at: null, organizations: 1, workspaces: 2 }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });
    const response = await request(app).get('/api/admin/users?search=Admin').set('x-test-user', 'admin-id');
    expect(response.status).toBe(200);
    expect(response.body.data.users[0]).toMatchObject({ online: true, organizations: 1, workspaces: 2 });
    expect(response.body.data.users[0]).not.toHaveProperty('password');
    expect(response.body.data.total).toBe(1);
  });

  it('protege los cambios de plan y los avisos globales', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    const userId = '11111111-1111-4111-8111-111111111111';
    const requestId = '22222222-2222-4222-8222-222222222222';
    const plan = await request(app).patch(`/api/admin/users/${userId}/plan`).set('x-test-user', 'ordinary-user').send({ planCode: 'TEAMS' });
    const announcement = await request(app).post('/api/admin/announcements').set('x-test-user', 'ordinary-user').send({ requestId, title: 'Aviso', message: 'Este es un mensaje administrativo.' });
    expect(plan.status).toBe(403);
    expect(announcement.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('guarda un aviso para todas las cuentas y solo lo emite en vivo a las conectadas', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    const sendToUser = jest.fn();
    (getRealtimeGateway as jest.Mock).mockReturnValue({ getOnlineUserIds: () => new Set(['user-1']), sendToUser });
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'notice-1', user_id: 'user-1' }, { id: 'notice-2', user_id: 'user-2' }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] });
    const requestId = '22222222-2222-4222-8222-222222222222';
    const response = await request(app).post('/api/admin/announcements').set('x-test-user', 'admin-id')
      .send({ requestId, title: 'Mantenimiento', message: 'El servicio tendrá una pausa breve.' });
    expect(response.status).toBe(201);
    expect(response.body.data.recipients).toBe(2);
    expect((query as jest.Mock).mock.calls[0][0]).toContain('ON CONFLICT (user_id, dedupe_key)');
    expect((query as jest.Mock).mock.calls[0][1]).toEqual(['Mantenimiento', 'El servicio tendrá una pausa breve.', requestId, 'admin-id', `admin-announcement:${requestId}`]);
    expect(sendToUser).toHaveBeenCalledTimes(1);
    expect(sendToUser.mock.calls[0][0]).toBe('user-1');
  });

  it('aplica un plan administrativo a la organización personal', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    const userId = '11111111-1111-4111-8111-111111111111';
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'personal-org-id' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_code: 'TEAMS', provider: 'platform-admin' }] });
    const response = await request(app).patch(`/api/admin/users/${userId}/plan`).set('x-test-user', 'admin-id').send({ planCode: 'TEAMS' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ planCode: 'TEAMS', source: 'ADMIN' });
    expect((query as jest.Mock).mock.calls[1][0]).toContain('ON CONFLICT (provider_subscription_id)');
    expect((query as jest.Mock).mock.calls[1][1]).toEqual(['personal-org-id', 'TEAMS']);
  });

  it('restaura el plan del proveedor al quitar la asignación administrativa', async () => {
    process.env.PLATFORM_ADMIN_USER_ID = 'admin-id';
    const userId = '11111111-1111-4111-8111-111111111111';
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'personal-org-id' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_code: 'PORTFOLIO', provider: 'configured-provider' }] });
    const response = await request(app).patch(`/api/admin/users/${userId}/plan`).set('x-test-user', 'admin-id').send({ planCode: 'AUTO' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ planCode: 'PORTFOLIO', source: 'AUTOMATIC' });
    expect((query as jest.Mock).mock.calls[1][0]).toContain("status = 'CANCELED'");
  });
});
