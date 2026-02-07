// apps/api/src/websocket/RealtimeGateway.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import type {
  Event,
  WebSocketMessage,
  JoinBoardCommand,
  LeaveBoardCommand,
  TypingStartCommand,
  TypingStopCommand,
  ActiveUser,
} from '@aether/types';
import { getPresenceService } from '../services/PresenceService';
import { redisClient } from '../lib/redis';
import { query } from '../lib/db';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
}

/**
 * RealtimeGateway
 * Maneja todas las conexiones WebSocket y eventos en tiempo real
 */
export class RealtimeGateway {
  private io: SocketIOServer;
  private presenceService = getPresenceService(redisClient);

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Middleware de autenticación
   */
  private setupMiddleware() {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
          email: string;
        };

        // Obtener info completa del usuario
        const userResult = await query('SELECT id, email, name, avatar FROM users WHERE id = $1', [
          decoded.userId,
        ]);

        if (userResult.rows.length === 0) {
          return next(new Error('Authentication error: User not found'));
        }

        const user = userResult.rows[0];

        // Adjuntar datos del usuario al socket
        (socket as AuthenticatedSocket).userId = user.id;
        (socket as AuthenticatedSocket).userEmail = user.email;
        (socket as AuthenticatedSocket).userName = user.name;
        (socket as AuthenticatedSocket).userAvatar = user.avatar;

        next();
      } catch (error) {
        console.error('WebSocket auth error:', error);
        next(new Error('Authentication error'));
      }
    });
  }

  /**
   * Setup de event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      console.log(`✅ User connected: ${authSocket.userName} (${authSocket.userId})`);

      // ========================================================================
      // AUTO-JOIN PERSONAL ROOM (para recibir notificaciones globales)
      // ========================================================================
      socket.join(`user:${authSocket.userId}`);
      console.log(`📫 User ${authSocket.userName} joined personal room: user:${authSocket.userId}`);

      // ========================================================================
      // JOIN BOARD
      // ========================================================================
      socket.on('join:board', async (data: JoinBoardCommand) => {
        try {
          const { boardId } = data;

          // Verificar que el usuario tiene acceso al board
          const hasAccess = await this.checkBoardAccess(authSocket.userId, boardId);
          if (!hasAccess) {
            socket.emit('error', { message: 'No access to this board' });
            return;
          }

          // Unirse al room del board
          await socket.join(`board:${boardId}`);

          // Registrar presencia en Redis
          const activeUser: ActiveUser = {
            id: authSocket.userId,
            name: authSocket.userName,
            email: authSocket.userEmail,
            avatar: authSocket.userAvatar,
            joinedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
          };

          await this.presenceService.joinBoard(boardId, activeUser);

          // Obtener lista actualizada de usuarios activos
          const activeUsers = await this.presenceService.getActiveUsers(boardId);

          // Notificar a todos los usuarios del board
          this.io.to(`board:${boardId}`).emit('presence:users', {
            boardId,
            users: activeUsers,
          });

          // Confirmar al usuario que se unió
          socket.emit('joined:board', {
            boardId,
            users: activeUsers,
          });

          console.log(`👥 User ${authSocket.userName} joined board ${boardId}`);
        } catch (error) {
          console.error('Error joining board:', error);
          socket.emit('error', { message: 'Failed to join board' });
        }
      });

      // ========================================================================
      // LEAVE BOARD
      // ========================================================================
      socket.on('leave:board', async (data: LeaveBoardCommand) => {
        try {
          const { boardId } = data;

          // Salir del room
          await socket.leave(`board:${boardId}`);

          // Remover presencia de Redis
          await this.presenceService.leaveBoard(boardId, authSocket.userId);

          // Notificar a los demás usuarios
          const activeUsers = await this.presenceService.getActiveUsers(boardId);
          this.io.to(`board:${boardId}`).emit('presence:users', {
            boardId,
            users: activeUsers,
          });

          console.log(`👋 User ${authSocket.userName} left board ${boardId}`);
        } catch (error) {
          console.error('Error leaving board:', error);
        }
      });

      // ========================================================================
      // TYPING INDICATORS
      // ========================================================================
      socket.on('typing:start', async (data: TypingStartCommand) => {
        try {
          const { cardId } = data;

          await this.presenceService.startTyping(cardId, authSocket.userId, authSocket.userName);

          // Broadcast a todos en el mismo board (obtener boardId desde card)
          const boardId = await this.getBoardIdFromCard(cardId);
          if (boardId) {
            socket.to(`board:${boardId}`).emit('typing:started', {
              cardId,
              userId: authSocket.userId,
              userName: authSocket.userName,
            });
          }
        } catch (error) {
          console.error('Error handling typing start:', error);
        }
      });

      socket.on('typing:stop', async (data: TypingStopCommand) => {
        try {
          const { cardId } = data;

          await this.presenceService.stopTyping(cardId, authSocket.userId);

          const boardId = await this.getBoardIdFromCard(cardId);
          if (boardId) {
            socket.to(`board:${boardId}`).emit('typing:stopped', {
              cardId,
              userId: authSocket.userId,
            });
          }
        } catch (error) {
          console.error('Error handling typing stop:', error);
        }
      });

      // ========================================================================
      // DISCONNECT
      // ========================================================================
      socket.on('disconnect', async () => {
        try {
          console.log(`❌ User disconnected: ${authSocket.userName}`);

          // Limpiar presencia del usuario en todos los boards
          await this.presenceService.cleanupUser(authSocket.userId);

          // Notificar a todos los boards donde estaba activo
          const rooms = Array.from(socket.rooms);
          for (const room of rooms) {
            if (room.startsWith('board:')) {
              const boardId = room.replace('board:', '');
              const activeUsers = await this.presenceService.getActiveUsers(boardId);
              this.io.to(room).emit('presence:users', {
                boardId,
                users: activeUsers,
              });
            }
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });

      // ========================================================================
      // PING/PONG (para mantener conexión activa)
      // ========================================================================
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  // ============================================================================
  // EVENT BROADCASTING
  // ============================================================================

  /**
   * Broadcast de evento a un board específico
   */
  public broadcastToBoardExcept(boardId: string, event: Event, excludeSocketId?: string): void {
    const room = `board:${boardId}`;

    if (excludeSocketId) {
      this.io.to(room).except(excludeSocketId).emit('event', event);
    } else {
      this.io.to(room).emit('event', event);
    }
  }

  /**
   * Broadcast de evento a un board específico (todos)
   */
  public broadcastToBoard(boardId: string, event: Event): void {
    this.io.to(`board:${boardId}`).emit('event', event);
  }

  /**
   * Enviar evento a un usuario específico (usando room personal)
   */
  public sendToUser(userId: string, event: Event): void {
    const userRoom = `user:${userId}`;
    this.io.to(userRoom).emit('event', event);
    console.log(`📤 Event sent to user ${userId}: ${event.type}`);
  }

  /**
   * Broadcast de comentario a un board específico
   * Obtiene el boardId desde el cardId y hace broadcast
   */
  public async broadcastCommentEvent(
    cardId: string,
    event: Event,
    excludeSocketId?: string
  ): Promise<void> {
    try {
      const boardId = await this.getBoardIdFromCard(cardId);
      if (boardId) {
        this.broadcastToBoardExcept(boardId, event, excludeSocketId);
      }
    } catch (error) {
      console.error('Error broadcasting comment event:', error);
    }
  }

  /**
   * Notificar a usuarios mencionados en un comentario
   */
  public notifyMentionedUsers(mentionedUserIds: string[], event: Event): void {
    mentionedUserIds.forEach((userId) => {
      this.sendToUser(userId, event);
    });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Verificar si un usuario tiene acceso a un board
   */
  private async checkBoardAccess(userId: string, boardId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT 1 FROM boards b
         INNER JOIN workspaces w ON b.workspace_id = w.id
         INNER JOIN workspace_members wm ON w.id = wm.workspace_id
         WHERE b.id = $1 AND wm.user_id = $2`,
        [boardId, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking board access:', error);
      return false;
    }
  }

  /**
   * Obtener boardId desde un cardId
   */
  private async getBoardIdFromCard(cardId: string): Promise<string | null> {
    try {
      const result = await query(
        `SELECT l.board_id 
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         WHERE c.id = $1`,
        [cardId]
      );

      return result.rows[0]?.board_id || null;
    } catch (error) {
      console.error('Error getting boardId from card:', error);
      return null;
    }
  }

  /**
   * Obtener instancia del servidor Socket.io
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Export singleton
let gatewayInstance: RealtimeGateway | null = null;

export function initializeRealtimeGateway(httpServer: HTTPServer): RealtimeGateway {
  if (!gatewayInstance) {
    gatewayInstance = new RealtimeGateway(httpServer);
    console.log('✅ Realtime Gateway initialized');
  }
  return gatewayInstance;
}

export function getRealtimeGateway(): RealtimeGateway {
  if (!gatewayInstance) {
    throw new Error('Realtime Gateway not initialized. Call initializeRealtimeGateway first.');
  }
  return gatewayInstance;
}
