import express from 'express';
import request from 'supertest';
import chatRouter from '../chat';
import { query } from '../../lib/db';
import { getRealtimeGateway } from '../../websocket/RealtimeGateway';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const conversation = '33333333-3333-4333-8333-333333333333';

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

const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);

const person = (shared = false, connection_status: string | null = null) => ({
  id: bob, name: 'Bob', avatar: null, position: null, shared, connection_status, requested_by_id: null,
});

describe('chat individual', () => {
  const emit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getRealtimeGateway as jest.Mock).mockReturnValue({ getIO: () => ({ to: () => ({ emit }) }) });
  });

  it('exige autenticación', async () => {
    const response = await request(app).get('/api/chat/contacts');
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('muestra la preferencia solo cuando existe una conexión activa', async () => {
    (getRealtimeGateway as jest.Mock).mockReturnValue({ getOnlineUserIds: () => new Set([alice]) });
    (query as jest.Mock).mockResolvedValueOnce({ rows: [
      { id: alice, presence_status: 'DND' }, { id: bob, presence_status: 'AWAY' },
    ] });
    const response = await request(app).get('/api/chat/presence').set('x-test-user', alice);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ statuses: { [alice]: 'DND', [bob]: 'OFFLINE' }, preference: 'DND' });
    expect((query as jest.Mock).mock.calls[0][0]).toContain('direct_connections');
  });

  it('valida los estados y solo actualiza al usuario autenticado', async () => {
    const invalid = await request(app).put('/api/chat/presence').set('x-test-user', alice).send({ status: 'BUSY' });
    expect(invalid.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const updated = await request(app).put('/api/chat/presence').set('x-test-user', alice).send({ status: 'AWAY' });
    expect(updated.status).toBe(200);
    expect((query as jest.Mock).mock.calls[0][1]).toEqual([alice, 'AWAY']);
  });

  it('no permite abrir un chat externo sin una solicitud aceptada', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [person()] });
    const response = await request(app).post('/api/chat/conversations')
      .set('x-test-user', alice).send({ userId: bob });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CONNECTION_REQUIRED');
  });

  it('permite chat cuando comparten contexto sin exigir solicitud', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [person(true)] })
      .mockResolvedValueOnce({ rows: [{ id: conversation }] });
    const response = await request(app).post('/api/chat/conversations')
      .set('x-test-user', alice).send({ userId: bob });
    expect(response.status).toBe(200);
    expect(response.body.data.conversationId).toBe(conversation);
  });

  it('envía solicitud al destinatario y no la confunde con favorito', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [person()] })
      .mockResolvedValueOnce({ rows: [{ id: conversation }] });
    const response = await request(app).post('/api/chat/requests')
      .set('x-test-user', alice).send({ userId: bob });
    expect(response.status).toBe(201);
    expect(emit).toHaveBeenCalledWith('chat:request', { requestId: conversation });
  });

  it('rechaza responder una solicitud ajena o enviada por uno mismo', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const response = await request(app).post(`/api/chat/requests/${conversation}/respond`)
      .set('x-test-user', alice).send({ action: 'accept' });
    expect(response.status).toBe(404);
    expect((query as jest.Mock).mock.calls[0][0]).toContain('requested_by_id <> $2');
  });

  it('vuelve a comprobar el permiso antes de enviar cada mensaje', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: conversation, other_id: bob }] })
      .mockResolvedValueOnce({ rows: [person()] });
    const response = await request(app).post(`/api/chat/conversations/${conversation}/messages`)
      .set('x-test-user', alice).send({ body: 'Hola' });
    expect(response.status).toBe(403);
    expect((query as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('excluye mensajes caducados al consultar el historial', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: conversation, other_id: bob }] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await request(app).get(`/api/chat/conversations/${conversation}/messages`)
      .set('x-test-user', alice);
    expect(response.status).toBe(200);
    expect(response.body.data.retentionDays).toBe(30);
    expect((query as jest.Mock).mock.calls[1][0]).toContain('expires_at > NOW()');
  });

  it('solo avisa de lectura cuando realmente había mensajes nuevos', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: conversation, other_id: bob }] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await request(app).post(`/api/chat/conversations/${conversation}/read`)
      .set('x-test-user', alice).send({});
    expect(response.status).toBe(200);
    expect(emit).not.toHaveBeenCalled();
  });
});
