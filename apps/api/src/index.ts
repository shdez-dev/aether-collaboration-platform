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
import cardRoutes from './routes/cards';
import labelRoutes from './routes/labels';

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

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de workspaces
app.use('/api/workspaces', workspaceRoutes);

// Rutas de usuarios
app.use('/api/users', userRoutes);

// Rutas de boards y listas
app.use('/api', boardRoutes);

// Rutas de cards
app.use('/api', cardRoutes);

// Rutas de labels
app.use('/api', labelRoutes);

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
║   CARDS:                                              ║
║   - POST   /api/lists/:listId/cards                   ║
║   - GET    /api/cards/:id                             ║
║   - PUT    /api/cards/:id                             ║
║   - PUT    /api/cards/:id/move                        ║
║   - DELETE /api/cards/:id                             ║
║   - POST   /api/cards/:id/members                     ║
║   - DELETE /api/cards/:id/members/:userId             ║
║   - POST   /api/cards/:id/labels                      ║
║   - DELETE /api/cards/:id/labels/:labelId             ║
║                                                       ║
║   LABELS:                                             ║
║   - POST   /api/workspaces/:wId/labels                ║
║   - GET    /api/workspaces/:wId/labels                ║
║   - GET    /api/labels/:id                            ║
║   - PUT    /api/labels/:id                            ║
║   - DELETE /api/labels/:id                            ║
║                                                       ║
║   USERS:                                              ║
║   - GET    /api/users/search                          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export { app, io, httpServer };
