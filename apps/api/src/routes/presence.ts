// apps/api/src/routes/presence.ts

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getPresenceService } from '../services/PresenceService';
import { eventStore } from '../services/EventStoreService';
import { redisClient } from '../lib/redis';
import type { Request, Response } from 'express';

const router = Router();
const presenceService = getPresenceService(redisClient);

/**
 * ==================== RUTAS DE PRESENCIA ====================
 *
 * Todas las rutas requieren autenticación JWT
 * Proveen información en tiempo real sobre usuarios activos y actividad
 */

/**
 * ==================== USUARIOS ACTIVOS ====================
 */

/**
 * GET /api/presence/boards/:boardId/active-users
 * Obtener lista de usuarios activos en un board
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     boardId: string,
 *     users: ActiveUser[],
 *     count: number
 *   }
 * }
 */
router.get(
  '/boards/:boardId/active-users',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const { boardId } = req.params;

      const activeUsers = await presenceService.getActiveUsers(boardId);

      return res.json({
        success: true,
        data: {
          boardId,
          users: activeUsers,
          count: activeUsers.length,
        },
      });
    } catch (error: any) {
      console.error('[Presence] Error getting active users:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to get active users' },
      });
    }
  }
);

/**
 * ==================== INDICADORES DE TYPING ====================
 */

/**
 * GET /api/presence/cards/:cardId/typing
 * Obtener usuarios que están escribiendo en una card
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     cardId: string,
 *     typingUsers: TypingIndicator[]
 *   }
 * }
 */
router.get('/cards/:cardId/typing', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;

    const typingUsers = await presenceService.getTypingUsers(cardId);

    return res.json({
      success: true,
      data: {
        cardId,
        typingUsers,
      },
    });
  } catch (error: any) {
    console.error('[Presence] Error getting typing users:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get typing users' },
    });
  }
});

/**
 * ==================== HISTORIAL DE EVENTOS ====================
 */

/**
 * GET /api/presence/boards/:boardId/events
 * Obtener historial de eventos de un board
 *
 * Query params:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     boardId: string,
 *     events: Event[],
 *     count: number,
 *     limit: number,
 *     offset: number
 *   }
 * }
 */
router.get('/boards/:boardId/events', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const events = await eventStore.getBoardEvents(boardId, limit, offset);

    return res.json({
      success: true,
      data: {
        boardId,
        events,
        count: events.length,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('[Presence] Error getting board events:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get board events' },
    });
  }
});

/**
 * GET /api/presence/cards/:cardId/activity
 * Obtener historial de actividad de una card
 *
 * Query params:
 * - limit: number (default: 20, max: 50)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     cardId: string,
 *     events: Event[],
 *     count: number
 *   }
 * }
 */
router.get('/cards/:cardId/activity', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const events = await eventStore.getCardEvents(cardId, limit);

    return res.json({
      success: true,
      data: {
        cardId,
        events,
        count: events.length,
      },
    });
  } catch (error: any) {
    console.error('[Presence] Error getting card activity:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get card activity' },
    });
  }
});

/**
 * ==================== ESTADÍSTICAS ====================
 */

/**
 * GET /api/presence/boards/:boardId/stats
 * Obtener estadísticas de presencia de un board
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     boardId: string,
 *     activeUsers: number,
 *     typingCards: number
 *   }
 * }
 */
router.get('/boards/:boardId/stats', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;

    const stats = await presenceService.getStats(boardId);

    return res.json({
      success: true,
      data: {
        boardId,
        ...stats,
      },
    });
  } catch (error: any) {
    console.error('[Presence] Error getting presence stats:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get presence stats' },
    });
  }
});

export default router;
