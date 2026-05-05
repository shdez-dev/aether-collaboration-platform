// apps/api/src/controllers/AiPlannerController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { aiPlannerService, type AiWorkspacePlan } from '../services/AiPlannerService';
import { aiWorkspaceBuilderService } from '../services/AiWorkspaceBuilderService';
import { pool } from '../lib/db';

const generatePlanSchema = z.object({
  documentText: z.string().min(10).max(50000),
});

// Zod schema para validar el plan recibido del frontend
const workspacePlanSchema = z.object({
  workspace: z.object({
    name: z.string().min(1).max(255),
    description: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  projects: z.array(
    z.object({
      name: z.string().min(1).max(255),
      description: z.string(),
      status: z.enum(['PLANNING', 'ACTIVE']),
      milestones: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          dueDate: z.string().nullable(),
        })
      ),
      boards: z.array(
        z.object({
          name: z.string().min(1).max(255),
          description: z.string(),
          lists: z.array(
            z.object({
              name: z.string().min(1).max(255),
              cards: z.array(
                z.object({
                  title: z.string().min(1).max(255),
                  description: z.string().optional(),
                  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
                  dueDate: z.string().nullable().optional(),
                  checklistItems: z.array(z.string().max(500)).optional(),
                  dependsOn: z.array(z.string().max(255)).optional(),
                })
              ),
            })
          ),
        })
      ),
    })
  ).min(1),
});

async function getCredits(userId: string): Promise<number> {
  const result = await pool.query(
    'SELECT ai_planner_credits FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.ai_planner_credits ?? 0;
}

class AiPlannerController {
  async getCredits(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

      let credits = 3; // default trial value
      try {
        credits = await getCredits(userId);
      } catch {
        // Column may not exist yet (migration pending) — return trial default
      }
      return res.json({ success: true, data: { credits } });
    } catch (error) {
      console.error('[AiPlannerController] getCredits error:', error);
      // Return trial default instead of 500 so the UI doesn't break
      return res.json({ success: true, data: { credits: 3 } });
    }
  }

  async generatePlan(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

      // Verificar créditos (no se consumen aquí, solo se verifican)
      const credits = await getCredits(userId);
      if (credits <= 0) {
        return res.status(402).json({
          success: false,
          error: { code: 'NO_CREDITS', message: 'No AI builder credits remaining' },
        });
      }

      const validation = generatePlanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'documentText must be 10-50000 characters' },
        });
      }

      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({
          success: false,
          error: { code: 'AI_UNAVAILABLE', message: 'AI service not configured' },
        });
      }

      const plan = await aiPlannerService.generateWorkspacePlan(validation.data.documentText);

      return res.json({ success: true, data: { plan, creditsRemaining: credits } });
    } catch (error: any) {
      console.error('[AiPlannerController] generatePlan error:', error?.message ?? error);
      const msg = error?.message ?? 'Failed to generate plan. Please try again.';
      return res.status(503).json({
        success: false,
        error: { code: 'AI_ERROR', message: msg },
      });
    }
  }

  async buildWorkspace(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });

      // Verificar créditos
      const credits = await getCredits(userId);
      if (credits <= 0) {
        return res.status(402).json({
          success: false,
          error: { code: 'NO_CREDITS', message: 'No AI builder credits remaining' },
        });
      }

      const validation = workspacePlanSchema.safeParse(req.body.plan);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid workspace plan structure' },
        });
      }

      const plan = validation.data as AiWorkspacePlan;
      const { workspaceId } = await aiWorkspaceBuilderService.buildWorkspace(plan, userId);

      // Decrementar crédito SOLO si la creación fue exitosa
      await pool.query(
        'UPDATE users SET ai_planner_credits = ai_planner_credits - 1 WHERE id = $1',
        [userId]
      );

      return res.json({ success: true, data: { workspaceId } });
    } catch (error) {
      console.error('[AiPlannerController] buildWorkspace error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'BUILD_ERROR', message: 'Failed to create workspace. Please try again.' },
      });
    }
  }
}

export const aiPlannerController = new AiPlannerController();
