import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

const reportSchema = z.object({
  reportedUserId: z.string().uuid(),
  reason: z.enum(['HARASSMENT', 'SPAM', 'IMPERSONATION', 'INAPPROPRIATE_CONTENT', 'OTHER']),
  description: z.string().trim().min(20).max(1000),
});

router.post('/', async (req, res, next) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Selecciona un motivo y explica lo ocurrido con entre 20 y 1000 caracteres.' } });
  }

  const reporterId = req.user!.id;
  const { reportedUserId, reason, description } = parsed.data;
  if (reporterId === reportedUserId) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TARGET', message: 'No puedes denunciar tu propia cuenta.' } });
  }

  try {
    const target = await query<{ id: string }>('SELECT id FROM users WHERE id = $1 AND deletion_requested_at IS NULL', [reportedUserId]);
    if (!target.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'No encontramos a esa persona.' } });
    }

    const recent = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM user_reports
       WHERE reporter_user_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
      [reporterId],
    );
    if ((recent.rows[0]?.total ?? 0) >= 5) {
      return res.status(429).json({ success: false, error: { code: 'REPORT_LIMIT', message: 'Has enviado varios reportes recientemente. Inténtalo más tarde si necesitas enviar otro.' } });
    }

    const created = await query<{ id: string; created_at: Date }>(
      `INSERT INTO user_reports (reporter_user_id, reported_user_id, reason, description)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [reporterId, reportedUserId, reason, description],
    );
    return res.status(201).json({ success: true, data: { id: created.rows[0].id, createdAt: created.rows[0].created_at } });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ success: false, error: { code: 'REPORT_ALREADY_OPEN', message: 'Ya tienes un reporte pendiente sobre esta persona.' } });
    }
    return next(error);
  }
});

export default router;
