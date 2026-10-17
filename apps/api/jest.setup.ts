// apps/api/jest.setup.ts
// Setup global mocks and test environment

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-v4'),
  v7: jest.fn(() => 'test-uuid-v7'),
}));

// Mock Redis
jest.mock('./src/lib/redis', () => {
  const createClient = () => {
    const pipeline = {
      sadd: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      hdel: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      publish: jest.fn().mockResolvedValue(0),
      subscribe: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      pipeline: jest.fn(() => pipeline),
      keys: jest.fn().mockResolvedValue([]),
      smembers: jest.fn().mockResolvedValue([]),
      scard: jest.fn().mockResolvedValue(0),
      sismember: jest.fn().mockResolvedValue(0),
      hgetall: jest.fn().mockResolvedValue({}),
      hlen: jest.fn().mockResolvedValue(0),
      hset: jest.fn().mockResolvedValue(0),
      hdel: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(0),
      exists: jest.fn().mockResolvedValue(0),
      srem: jest.fn().mockResolvedValue(0),
    };
  };
  return {
    redisPubClient: createClient(),
    redisSubClient: createClient(),
    redisClient: createClient(),
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
  invalidateUserSockets: jest.fn().mockResolvedValue(undefined),
  revalidateUserSocketRooms: jest.fn().mockResolvedValue(undefined),
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
