import { Router, type Request } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { query } from '../lib/db';
import { getRealtimeGateway } from '../websocket/RealtimeGateway';

const router = Router();
router.use(authenticateJWT);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const viewerId = (req: Request) => (req as Request & { user: { id: string } }).user.id;
const fail = (code: string, message: string) => ({ success: false, error: { code, message } });

type Permission = {
  id: string; name: string; avatar: string | null; position: string | null;
  shared: boolean; connection_status: string | null; requested_by_id: string | null;
};

async function permission(userId: string, otherId: string): Promise<Permission | null> {
  const result = await query<Permission>(`SELECT u.id, u.name, u.avatar, u.position,
    (EXISTS (SELECT 1 FROM organization_members a JOIN organization_members b
      ON b.organization_id = a.organization_id WHERE a.user_id = $1 AND b.user_id = u.id)
     OR EXISTS (SELECT 1 FROM workspace_members a JOIN workspace_members b
      ON b.workspace_id = a.workspace_id WHERE a.user_id = $1 AND b.user_id = u.id)) AS shared,
    dc.status AS connection_status, dc.requested_by_id
    FROM users u LEFT JOIN direct_connections dc
      ON dc.user_a_id = LEAST($1::uuid, u.id) AND dc.user_b_id = GREATEST($1::uuid, u.id)
    WHERE u.id = $2 AND u.id <> $1`, [userId, otherId]);
  return result.rows[0] ?? null;
}

const canMessage = (access: Permission) => access.shared || access.connection_status === 'ACCEPTED';

function emit(userId: string, event: string, payload: object): void {
  getRealtimeGateway().getIO().to(`user:${userId}`).emit(event, payload);
}

async function conversationFor(userId: string, conversationId: string) {
  const result = await query<{ id: string; other_id: string }>(`SELECT id,
    CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS other_id
    FROM direct_conversations WHERE id = $2 AND (user_a_id = $1 OR user_b_id = $1)`, [userId, conversationId]);
  return result.rows[0] ?? null;
}

router.get('/eligibility/:userId', async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.userId)) return res.status(400).json(fail('INVALID_USER', 'Usuario inválido'));
    const access = await permission(viewerId(req), req.params.userId);
    if (!access) return res.status(404).json(fail('USER_NOT_FOUND', 'Usuario no encontrado'));
    const relationship = access.shared ? 'shared' : access.connection_status === 'ACCEPTED' ? 'connected'
      : access.connection_status === 'PENDING' ? (access.requested_by_id === viewerId(req) ? 'outgoing' : 'incoming')
      : access.connection_status === 'DECLINED' ? 'declined' : 'none';
    return res.json({ success: true, data: { canMessage: canMessage(access), relationship } });
  } catch (error) { return next(error); }
});

router.get('/contacts', async (req, res, next) => {
  try {
    const result = await query(`SELECT u.id, u.name, u.avatar, u.position
      FROM users u WHERE u.id <> $1 AND (
        EXISTS (SELECT 1 FROM direct_connections dc WHERE dc.status = 'ACCEPTED'
          AND dc.user_a_id = LEAST($1::uuid, u.id) AND dc.user_b_id = GREATEST($1::uuid, u.id))
        OR EXISTS (SELECT 1 FROM organization_members a JOIN organization_members b
          ON b.organization_id = a.organization_id WHERE a.user_id = $1 AND b.user_id = u.id)
        OR EXISTS (SELECT 1 FROM workspace_members a JOIN workspace_members b
          ON b.workspace_id = a.workspace_id WHERE a.user_id = $1 AND b.user_id = u.id)
      ) ORDER BY u.name LIMIT 200`, [viewerId(req)]);
    return res.json({ success: true, data: { contacts: result.rows } });
  } catch (error) { return next(error); }
});

router.get('/requests', async (req, res, next) => {
  try {
    const result = await query(`SELECT dc.id, dc.requested_by_id, dc.created_at,
      u.id AS user_id, u.name, u.avatar, u.position
      FROM direct_connections dc JOIN users u ON u.id = CASE
        WHEN dc.user_a_id = $1 THEN dc.user_b_id ELSE dc.user_a_id END
      WHERE (dc.user_a_id = $1 OR dc.user_b_id = $1) AND dc.status = 'PENDING'
      ORDER BY dc.created_at DESC`, [viewerId(req)]);
    return res.json({ success: true, data: { requests: result.rows.map((row) => ({
      ...row, direction: row.requested_by_id === viewerId(req) ? 'outgoing' : 'incoming',
    })) } });
  } catch (error) { return next(error); }
});

router.post('/requests', async (req, res, next) => {
  try {
    const otherId = String(req.body?.userId ?? '');
    if (!uuidPattern.test(otherId)) return res.status(400).json(fail('INVALID_USER', 'Usuario inválido'));
    const access = await permission(viewerId(req), otherId);
    if (!access) return res.status(404).json(fail('USER_NOT_FOUND', 'Usuario no encontrado'));
    if (canMessage(access)) return res.status(409).json(fail('ALREADY_CONNECTED', 'Ya puedes escribir a esta persona'));
    const result = await query<{ id: string }>(`INSERT INTO direct_connections (user_a_id, user_b_id, requested_by_id)
      VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid), $1)
      ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
        status = 'PENDING', requested_by_id = EXCLUDED.requested_by_id,
        created_at = NOW(), responded_at = NULL
      WHERE direct_connections.status = 'DECLINED'
        AND direct_connections.responded_at < NOW() - INTERVAL '7 days'
      RETURNING id`, [viewerId(req), otherId]);
    if (!result.rows[0]) return res.status(409).json(fail('REQUEST_EXISTS', 'Ya hay una solicitud pendiente o debes esperar para reenviarla'));
    emit(otherId, 'chat:request', { requestId: result.rows[0].id });
    return res.status(201).json({ success: true, data: { id: result.rows[0].id } });
  } catch (error) { return next(error); }
});

router.post('/requests/:id/respond', async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id) || !['accept', 'decline'].includes(req.body?.action))
      return res.status(400).json(fail('INVALID_REQUEST', 'Respuesta inválida'));
    const result = await query<{ requested_by_id: string }>(`UPDATE direct_connections SET
      status = $3, responded_at = NOW() WHERE id = $1 AND status = 'PENDING'
      AND requested_by_id <> $2 AND (user_a_id = $2 OR user_b_id = $2)
      RETURNING requested_by_id`, [req.params.id, viewerId(req), req.body.action === 'accept' ? 'ACCEPTED' : 'DECLINED']);
    if (!result.rows[0]) return res.status(404).json(fail('REQUEST_NOT_FOUND', 'Solicitud no disponible'));
    emit(result.rows[0].requested_by_id, 'chat:request-updated', { requestId: req.params.id });
    return res.json({ success: true, data: { accepted: req.body.action === 'accept' } });
  } catch (error) { return next(error); }
});

router.get('/conversations', async (req, res, next) => {
  try {
    const result = await query(`SELECT c.id, u.id AS contact_id, u.name, u.avatar, u.position,
      last_message.body AS last_body, last_message.created_at AS last_message_at,
      (SELECT COUNT(*)::int FROM direct_messages unread WHERE unread.conversation_id = c.id
        AND unread.sender_id <> $1 AND unread.read_at IS NULL AND unread.expires_at > NOW()) AS unread_count
      FROM direct_conversations c JOIN users u ON u.id = CASE
        WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
      LEFT JOIN LATERAL (SELECT body, created_at FROM direct_messages m
        WHERE m.conversation_id = c.id AND m.expires_at > NOW()
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last_message ON true
      WHERE c.user_a_id = $1 OR c.user_b_id = $1
      ORDER BY COALESCE(last_message.created_at, c.created_at) DESC LIMIT 100`, [viewerId(req)]);
    return res.json({ success: true, data: { conversations: result.rows } });
  } catch (error) { return next(error); }
});

router.post('/conversations', async (req, res, next) => {
  try {
    const otherId = String(req.body?.userId ?? '');
    if (!uuidPattern.test(otherId)) return res.status(400).json(fail('INVALID_USER', 'Usuario inválido'));
    const access = await permission(viewerId(req), otherId);
    if (!access) return res.status(404).json(fail('USER_NOT_FOUND', 'Usuario no encontrado'));
    if (!canMessage(access)) return res.status(403).json(fail('CONNECTION_REQUIRED', 'Primero deben estar conectados para conversar'));
    const created = await query<{ id: string }>(`INSERT INTO direct_conversations (user_a_id, user_b_id)
      VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid))
      ON CONFLICT (user_a_id, user_b_id) DO NOTHING RETURNING id`, [viewerId(req), otherId]);
    const existing = created.rows[0] ?? (await query<{ id: string }>(`SELECT id FROM direct_conversations
      WHERE user_a_id = LEAST($1::uuid, $2::uuid) AND user_b_id = GREATEST($1::uuid, $2::uuid)`, [viewerId(req), otherId])).rows[0];
    return res.json({ success: true, data: { conversationId: existing.id } });
  } catch (error) { return next(error); }
});

router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json(fail('INVALID_CONVERSATION', 'Conversación inválida'));
    const conversation = await conversationFor(viewerId(req), req.params.id);
    if (!conversation) return res.status(404).json(fail('CONVERSATION_NOT_FOUND', 'Conversación no encontrada'));
    const before = req.query.before ? new Date(String(req.query.before)) : null;
    if (before && Number.isNaN(before.getTime())) return res.status(400).json(fail('INVALID_CURSOR', 'Fecha inválida'));
    const result = await query(`SELECT id, sender_id, body, created_at, expires_at, read_at
      FROM direct_messages WHERE conversation_id = $1 AND expires_at > NOW()
        AND ($2::timestamptz IS NULL OR created_at < $2)
      ORDER BY created_at DESC, id DESC LIMIT 50`, [conversation.id, before?.toISOString() ?? null]);
    return res.json({ success: true, data: { messages: result.rows.reverse(), retentionDays: 30 } });
  } catch (error) { return next(error); }
});

router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json(fail('INVALID_CONVERSATION', 'Conversación inválida'));
    const body = String(req.body?.body ?? '').trim();
    if (!body || body.length > 4000) return res.status(400).json(fail('INVALID_MESSAGE', 'Escribe un mensaje de hasta 4000 caracteres'));
    const conversation = await conversationFor(viewerId(req), req.params.id);
    if (!conversation) return res.status(404).json(fail('CONVERSATION_NOT_FOUND', 'Conversación no encontrada'));
    const access = await permission(viewerId(req), conversation.other_id);
    if (!access || !canMessage(access)) return res.status(403).json(fail('CONNECTION_REQUIRED', 'Ya no tienes permiso para enviar mensajes a esta persona'));
    const result = await query(`INSERT INTO direct_messages (conversation_id, sender_id, body)
      VALUES ($1, $2, $3) RETURNING id, sender_id, body, created_at, expires_at, read_at`,
      [conversation.id, viewerId(req), body]);
    await query('UPDATE direct_conversations SET last_message_at = $2 WHERE id = $1', [conversation.id, result.rows[0].created_at]);
    const payload = { conversationId: conversation.id, message: result.rows[0] };
    emit(conversation.other_id, 'chat:message', payload);
    emit(viewerId(req), 'chat:message', payload);
    return res.status(201).json({ success: true, data: payload });
  } catch (error) { return next(error); }
});

router.post('/conversations/:id/read', async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json(fail('INVALID_CONVERSATION', 'Conversación inválida'));
    const conversation = await conversationFor(viewerId(req), req.params.id);
    if (!conversation) return res.status(404).json(fail('CONVERSATION_NOT_FOUND', 'Conversación no encontrada'));
    const updated = await query(`UPDATE direct_messages SET read_at = NOW() WHERE conversation_id = $1
      AND sender_id <> $2 AND read_at IS NULL AND expires_at > NOW() RETURNING id`, [conversation.id, viewerId(req)]);
    if (updated.rows.length > 0) emit(conversation.other_id, 'chat:read', { conversationId: conversation.id });
    return res.json({ success: true, data: { read: true } });
  } catch (error) { return next(error); }
});

export default router;
