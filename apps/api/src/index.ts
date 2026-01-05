// apps/api/src/index.ts

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import userRoutes from './routes/user';
import boardRoutes from './routes/board';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
});

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== API ROUTES ====================
app.get('/api', (req, res) => {
  res.json({
    message: 'AETHER API',
    version: '0.1.0',
    docs: '/api/docs',
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Workspace routes
app.use('/api/workspaces', workspaceRoutes);

// User routes
app.use('/api/users', userRoutes);

// Board & List routes ← NUEVO
app.use('/api', boardRoutes);

// ==================== WEBSOCKET ====================
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// ==================== SERVER START ====================
const PORT = process.env.API_PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   AETHER API Server                                   ║
║                                                       ║
║   HTTP:      http://localhost:${PORT}                    ║
║   WebSocket: ws://localhost:${PORT}                      ║
║   Health:    http://localhost:${PORT}/health            ║
║                                                       ║
║   Endpoints:                                          ║
║                                                       ║
║   AUTH:                                               ║
║   - POST   /api/auth/register                         ║
║   - POST   /api/auth/login                            ║
║   - POST   /api/auth/logout                           ║
║   - GET    /api/auth/me                               ║
║                                                       ║
║   WORKSPACES:                                         ║
║   - POST   /api/workspaces                            ║
║   - GET    /api/workspaces                            ║
║   - GET    /api/workspaces/:id                        ║
║   - PUT    /api/workspaces/:id                        ║
║   - DELETE /api/workspaces/:id                        ║
║   - POST   /api/workspaces/:id/invite                 ║
║   - GET    /api/workspaces/:id/members                ║
║                                                       ║
║   BOARDS:                                             ║
║   - POST   /api/workspaces/:wId/boards                ║
║   - GET    /api/workspaces/:wId/boards                ║
║   - GET    /api/boards/:id                            ║
║   - PUT    /api/boards/:id                            ║
║   - POST   /api/boards/:id/archive                    ║
║   - DELETE /api/boards/:id                            ║
║                                                       ║
║   LISTS:                                              ║
║   - POST   /api/boards/:bId/lists                     ║
║   - GET    /api/boards/:bId/lists                     ║
║   - PUT    /api/lists/:id                             ║
║   - PUT    /api/lists/:id/reorder                     ║
║   - DELETE /api/lists/:id                             ║
║                                                       ║
║   USERS:                                              ║
║   - GET    /api/users/search                          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export { app, io, httpServer };
