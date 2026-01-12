// apps/api/src/controllers/PresenceController.ts

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getPresenceService } from '../services/PresenceService';
import { eventStore } from '../services/EventStoreService';
import { redisClient } from '../lib/redis';

const router = Router();
const presenceService = getPresenceService(redisClient);

// ============================================================================
// GET ACTIVE USERS IN BOARD
// ============================================================================
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
    } catch (error) {
      console.error('[Presence] Error getting active users:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to get active users' },
      });
    }
  }
);

// ============================================================================
// GET TYPING INDICATORS FOR CARD
// ============================================================================
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
  } catch (error) {
    console.error('[Presence] Error getting typing users:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get typing users' },
    });
  }
});

// ============================================================================
// GET BOARD EVENT HISTORY
// ============================================================================
router.get('/boards/:boardId/events', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
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
  } catch (error) {
    console.error('[Presence] Error getting board events:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get board events' },
    });
  }
});

// ============================================================================
// GET CARD ACTIVITY LOG
// ============================================================================
router.get('/cards/:cardId/activity', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const events = await eventStore.getCardEvents(cardId, limit);

    return res.json({
      success: true,
      data: {
        cardId,
        events,
        count: events.length,
      },
    });
  } catch (error) {
    console.error('[Presence] Error getting card activity:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get card activity' },
    });
  }
});

// ============================================================================
// GET PRESENCE STATS
// ============================================================================
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
  } catch (error) {
    console.error('[Presence] Error getting presence stats:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to get presence stats' },
    });
  }
});

export default router;
