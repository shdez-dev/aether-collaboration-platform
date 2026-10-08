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
});
