// apps/api/src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import boardRoutes from './routes/board';
import cardRoutes from './routes/cards';
import labelRoutes from './routes/labels';
import userRoutes from './routes/user';
import presenceRoutes from './routes/presence';
import commentRoutes from './routes/comments';
import notificationRoutes from './routes/notifications';
import documentRoutes from './routes/documentss';

// Import WebSocket and Redis
import { initializeRedis, closeRedisConnections } from './lib/redis';
import { initializeRealtimeGateway } from './websocket/RealtimeGateway';
import { initializeYjsGateway } from './websocket/Yjsgateway';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 4000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'aether-api',
    version: '0.1.0',
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'AETHER API',
    version: '0.1.0',
    docs: '/api/docs',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/users', userRoutes);
app.use('/api', boardRoutes);
app.use('/api', cardRoutes);
app.use('/api', labelRoutes);
app.use('/api', commentRoutes);
app.use('/api', notificationRoutes);
app.use('/api', documentRoutes);
app.use('/api/presence', presenceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
});

// ============================================================================
// CREATE HTTP SERVER & INITIALIZE SERVICES
// ============================================================================

const httpServer = createServer(app);

async function startServer() {
  try {
    console.log('[Server] Initializing services...');

    // 1. Initialize Redis
    await initializeRedis();
    console.log('[Server] ✅ Redis initialized');

    // 2. Initialize WebSocket Gateway
    const realtimeGateway = initializeRealtimeGateway(httpServer);
    console.log('[Server] ✅ WebSocket Gateway initialized');

    // 3. Initialize Yjs Gateway
    const yjsGateway = initializeYjsGateway(realtimeGateway.getIO());
    console.log('[Server] ✅ Yjs Gateway initialized');

    // 4. Start HTTP server
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║                                                       ║');
      console.log('║   🚀 AETHER API Server                                ║');
      console.log('║                                                       ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`📡 HTTP Server:     http://localhost:${PORT}`);
      console.log(`🔌 WebSocket:       ws://localhost:${PORT}`);
      console.log(`📄 Yjs Sync:        ws://localhost:${PORT}`);
      console.log(`🗄️  PostgreSQL:     Connected`);
      console.log(`🔴 Redis:           Connected`);
      console.log(`📝 Health Check:    http://localhost:${PORT}/health`);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━ API ENDPOINTS ━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('AUTH:');
      console.log('  POST   /api/auth/register');
      console.log('  POST   /api/auth/login');
      console.log('  POST   /api/auth/logout');
      console.log('  GET    /api/auth/me');
      console.log('');
      console.log('WORKSPACES:');
      console.log('  POST   /api/workspaces');
      console.log('  GET    /api/workspaces');
      console.log('  GET    /api/workspaces/:id');
      console.log('  PUT    /api/workspaces/:id');
      console.log('  DELETE /api/workspaces/:id');
      console.log('  POST   /api/workspaces/:id/invite');
      console.log('  GET    /api/workspaces/:id/members');
      console.log('');
      console.log('BOARDS:');
      console.log('  POST   /api/workspaces/:wId/boards');
      console.log('  GET    /api/workspaces/:wId/boards');
      console.log('  GET    /api/boards/:id');
      console.log('  PUT    /api/boards/:id');
      console.log('  POST   /api/boards/:id/archive');
      console.log('  DELETE /api/boards/:id');
      console.log('');
      console.log('LISTS:');
      console.log('  POST   /api/boards/:bId/lists');
      console.log('  GET    /api/boards/:bId/lists');
      console.log('  PUT    /api/lists/:id');
      console.log('  PUT    /api/lists/:id/reorder');
      console.log('  DELETE /api/lists/:id');
      console.log('');
      console.log('CARDS:');
      console.log('  POST   /api/lists/:listId/cards');
      console.log('  GET    /api/cards/:id');
      console.log('  PUT    /api/cards/:id');
      console.log('  PUT    /api/cards/:id/move');
      console.log('  DELETE /api/cards/:id');
      console.log('  POST   /api/cards/:id/members');
      console.log('  DELETE /api/cards/:id/members/:userId');
      console.log('  POST   /api/cards/:id/labels');
      console.log('  DELETE /api/cards/:id/labels/:labelId');
      console.log('');
      console.log('DOCUMENTS:');
      console.log('  POST   /api/workspaces/:wId/documents');
      console.log('  GET    /api/workspaces/:wId/documents');
      console.log('  GET    /api/documents/:id');
      console.log('  PUT    /api/documents/:id');
      console.log('  DELETE /api/documents/:id');
      console.log('  POST   /api/documents/:id/versions');
      console.log('  GET    /api/documents/:id/versions');
      console.log('  POST   /api/documents/:id/versions/:vId/restore');
      console.log('  PUT    /api/documents/:id/permissions');
      console.log('');
      console.log('COMMENTS:');
      console.log('  GET    /api/cards/:cardId/comments/count');
      console.log('  GET    /api/cards/:cardId/comments');
      console.log('  POST   /api/cards/:cardId/comments');
      console.log('  GET    /api/boards/:boardId/comments/recent');
      console.log('  GET    /api/comments/:commentId');
      console.log('  PATCH  /api/comments/:commentId');
      console.log('  DELETE /api/comments/:commentId');
      console.log('');
      console.log('NOTIFICATIONS:');
      console.log('  GET    /api/notifications');
      console.log('  GET    /api/notifications/unread-count');
      console.log('  PATCH  /api/notifications/:id/read');
      console.log('  POST   /api/notifications/mark-all-read');
      console.log('  DELETE /api/notifications/:id');
      console.log('');
      console.log('LABELS:');
      console.log('  POST   /api/workspaces/:wId/labels');
      console.log('  GET    /api/workspaces/:wId/labels');
      console.log('  GET    /api/labels/:id');
      console.log('  PUT    /api/labels/:id');
      console.log('  DELETE /api/labels/:id');
      console.log('');
      console.log('PRESENCE:');
      console.log('  GET    /api/presence/boards/:boardId/active-users');
      console.log('  GET    /api/presence/cards/:cardId/typing');
      console.log('  GET    /api/presence/boards/:boardId/events');
      console.log('  GET    /api/presence/cards/:cardId/activity');
      console.log('  GET    /api/presence/boards/:boardId/stats');
      console.log('');
      console.log('USERS:');
      console.log('  GET    /api/users/search');
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (error) {
    console.error('[Server] ❌ Failed to start:', error);
    process.exit(1);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const shutdown = async (signal: string) => {
  console.log(`\n[Server] ${signal} received, closing server gracefully...`);

  httpServer.close(async () => {
    console.log('[Server] HTTP server closed');

    try {
      await closeRedisConnections();
      console.log('[Server] All connections closed');
      process.exit(0);
    } catch (error) {
      console.error('[Server] Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================================
// START
// ============================================================================

startServer();

export { httpServer };
