// apps/api/jest.setup.ts
// Setup global mocks and test environment

import Redis from 'ioredis-mock';

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-v4'),
  v7: jest.fn(() => 'test-uuid-v7'),
}));

// Mock Redis
jest.mock('./src/lib/redis', () => {
  const redisMock = new Redis();
  return {
    redisPubClient: redisMock,
    redisSubClient: redisMock.duplicate(),
    redisClient: redisMock,
  };
});

// Mock PostgreSQL pool
jest.mock('./src/lib/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(() =>
      Promise.resolve({
        query: jest.fn(),
        release: jest.fn(),
      })
    ),
    end: jest.fn(),
  },
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }), // Mock the standalone query function
}));

// Mock WebSocket gateways
jest.mock('./src/websocket/RealtimeGateway', () => ({
  getRealtimeGateway: jest.fn(() => ({
    broadcastToBoard: jest.fn(),
    broadcastToBoardExcept: jest.fn(),
    sendToUser: jest.fn(),
    io: null,
  })),
}));

jest.mock('./src/websocket/Yjsgateway', () => ({
  YjsGateway: jest.fn(),
}));

// Mock email service
jest.mock('./src/services/EmailService', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendWorkspaceInvitation: jest.fn().mockResolvedValue(true),
  },
}));

// Suppress console errors in tests unless explicitly needed
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.FRONTEND_URL = 'http://localhost:3000';
