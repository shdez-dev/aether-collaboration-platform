// apps/api/src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import path from 'path';
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
import activityRoutes from './routes/activity';
import githubWebhookRoutes from './routes/github_webhook';
import projectRoutes from './routes/projects';
import teamRoutes from './routes/teams';
import searchRoutes from './routes/search';
import aiRoutes from './routes/ai';
import { documentCommentController } from './controllers/DocumentCommentController';

// Import middleware
import {
  apiLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
} from './middleware/rateLimiter';

// Import config
import { validateEnv } from './config/env';

// Import WebSocket and Redis
import { initializeRedis, closeRedisConnections } from './lib/redis';
import { initializeRealtimeGateway } from './websocket/RealtimeGateway';
import { initializeYjsGateway } from './websocket/Yjsgateway';
import { runMigrations } from './migrations/run-migrations';
import { startDueDateJob, stopDueDateJob } from './jobs/dueDateJob';

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

// Load environment variables from .env file
// When running with tsx, the --env-file flag handles this
// But we keep this for backwards compatibility
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// Validate environment variables (exits if invalid)
const env = validateEnv();

const app = express();
const PORT = env.API_PORT || 4000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Trust proxy - Required for Render and other cloud platforms
// This allows Express to correctly identify the client's IP address
// when behind a reverse proxy/load balancer
app.set('trust proxy', 1);

// ============================================================================
// SECURITY HEADERS (Helmet)
// ============================================================================

app.use(
  helmet({
    // Allow cross-origin image loads (e.g. frontend loading avatars from API)
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'], // Allow images from any HTTPS source
        connectSrc: [
          "'self'",
          env.FRONTEND_URL,
          env.FRONTEND_URL.replace('https://', 'wss://').replace('http://', 'ws://'),
        ],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null, // Only in production
      },
    },

    // Additional security headers
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
  })
);
const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
  ...(process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
  'http://localhost:3001',
  'http://localhost:3002',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// GitHub webhooks need raw body for HMAC verification — must come BEFORE express.json()
app.use('/api/webhooks/github', express.raw({ type: 'application/json' }), githubWebhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (avatars, uploads)
// __dirname = apps/api/src/ in tsx dev, so ../public/uploads = apps/api/public/uploads
// In production (dist/index.js), __dirname = apps/api/dist, same one level up resolves correctly
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../public/uploads'), {
    setHeaders: (res, path) => {
      // Set CORS headers for uploaded files (avatars, etc.)
      res.setHeader(
        'Access-Control-Allow-Origin',
        process.env.CORS_ORIGIN || 'http://localhost:3001'
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

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

// ============================================================================
// RATE LIMITING
// ============================================================================

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Apply stricter rate limiting to auth endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);

// ============================================================================
// API ROUTES
// ============================================================================

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
app.use('/api/activity', activityRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);

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
    // 0. Run database migrations
    await runMigrations();

    // 1. Initialize Redis
    await initializeRedis();

    // 2. Initialize WebSocket Gateway
    const realtimeGateway = initializeRealtimeGateway(httpServer);

    // 3. Initialize Yjs Gateway
    const yjsGateway = initializeYjsGateway(realtimeGateway.getIO());

    // Make yjsGateway globally accessible for DocumentService
    (global as any).yjsGateway = yjsGateway;

    // 4. Inject Socket.IO into DocumentCommentController for realtime events
    documentCommentController.setIo(realtimeGateway.getIO());

    // 5. Start due date notification cron job
    startDueDateJob();

    // 6. Start HTTP server
    httpServer.listen(PORT, () => {
      const line = '─'.repeat(52);
      process.stdout.write(`\n${line}\n`);
      process.stdout.write(` Aether API  v0.1.0  [${env.NODE_ENV}]\n`);
      process.stdout.write(`${line}\n`);
      process.stdout.write(` HTTP       http://localhost:${PORT}\n`);
      process.stdout.write(` WebSocket  ws://localhost:${PORT}\n`);
      process.stdout.write(` Health     http://localhost:${PORT}/health\n`);
      process.stdout.write(` Database   ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}\n`);
      process.stdout.write(` Redis      ${env.REDIS_URL.split('@')[1] || 'connected'}\n`);
      process.stdout.write(`${line}\n\n`);
    });
  } catch (error) {
    process.stderr.write(`server: fatal error during startup — ${error}\n`);
    process.exit(1);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const shutdown = async (signal: string) => {
  process.stdout.write(`\nserver: ${signal} — shutting down gracefully\n`);

  httpServer.close(async () => {
    try {
      stopDueDateJob();
      await closeRedisConnections();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    process.stderr.write('server: forced shutdown after timeout\n');
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
