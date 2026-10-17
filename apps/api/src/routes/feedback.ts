import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

const submissionSchema = z.object({
  type: z.enum(['FEEDBACK', 'BUG']),
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(4000),
  reproductionSteps: z.string().trim().max(4000).optional().default(''),
  pagePath: z.string().trim().startsWith('/').max(500).optional().default('/dashboard/feedback'),
});

router.post('/', async (req, res, next) => {
  const input = submissionSchema.safeParse(req.body);
  if (!input.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Revisa el tipo, el título y la descripción del reporte.' },
    });
  }

  try {
    const result = await query<{ id: string; created_at: Date }>(
      `INSERT INTO feedback_submissions
        (id, user_id, type, title, description, reproduction_steps, page_path)
       VALUES (uuid_generate_v4(), $1, $2::"FeedbackType", $3, $4, NULLIF($5, ''), $6)
       RETURNING id, created_at`,
      [req.user!.id, input.data.type, input.data.title, input.data.description,
        input.data.reproductionSteps, input.data.pagePath],
    );
    return res.status(201).json({
      success: true,
      data: { id: result.rows[0].id, createdAt: result.rows[0].created_at },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
