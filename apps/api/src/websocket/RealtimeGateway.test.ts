jest.unmock('./RealtimeGateway');
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => {
    const server: any = {
      middleware: undefined,
      connectionHandler: undefined,
      use: jest.fn((middleware) => { server.middleware = middleware; }),
      on: jest.fn((event, handler) => {
        if (event === 'connection') server.connectionHandler = handler;
      }),
      sockets: { sockets: new Map(), adapter: { rooms: new Map() } },
      to: jest.fn(() => ({ emit: jest.fn() })),
    };
    return server;
  }),
}));
jest.mock('../services/PresenceService', () => ({
  getPresenceService: jest.fn(() => ({})),
}));
jest.mock('../lib/redis', () => ({
  onSocketInvalidation: jest.fn(),
  publishSocketInvalidation: jest.fn().mockResolvedValue(undefined),
  redisClient: {},
}));
jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('../services/ProjectAuthorizationService', () => ({
  projectAuthorizationService: { can: jest.fn() },
}));

const { RealtimeGateway } = require('./RealtimeGateway') as typeof import('./RealtimeGateway');
const { query } = require('../lib/db') as typeof import('../lib/db');
const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');

describe('RealtimeGateway access-token expiry', () => {
  afterEach(() => jest.useRealTimers());

  it('disconnects a live socket when its signed access token expires', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-17T00:00:00.000Z'));
    (query as jest.Mock).mockResolvedValue({
      rows: [{ id: 'user-1', email: 'user@example.com', name: 'Test User', avatar: null }],
    });

    new RealtimeGateway({} as any);
    const server = (require('socket.io').Server as jest.Mock).mock.results.at(-1)?.value;
    const token = jwt.sign(
      { userId: 'user-1', email: 'user@example.com' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '2s' },
    );
    const socket: any = {
      handshake: { auth: { token }, headers: {} },
      emit: jest.fn(),
      disconnect: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
    };
    let middlewareError: Error | undefined;
    await server.middleware(socket, (error?: Error) => { middlewareError = error; });
    expect(middlewareError).toBeUndefined();

    server.connectionHandler(socket);
    jest.advanceTimersByTime(1999);
    expect(socket.emit).not.toHaveBeenCalledWith('auth:expired');
    jest.advanceTimersByTime(1);

    expect(socket.emit).toHaveBeenCalledWith('auth:expired');
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});
