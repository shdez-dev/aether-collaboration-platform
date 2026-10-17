import express, { Request, Response } from 'express';
import request from 'supertest';
import { redisClient } from '../../lib/redis';
import { loginRateLimit } from '../authRateLimit';

const mockedRedis = redisClient as unknown as {
  eval: jest.Mock;
  zrem: jest.Mock;
};

function createApp(handler: jest.Mock) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/login', loginRateLimit, handler);
  return app;
}

describe('auth rate limits', () => {
  beforeEach(() => {
    mockedRedis.eval = jest.fn().mockResolvedValue([0, 0]);
    mockedRedis.zrem = jest.fn().mockResolvedValue(1);
  });

  it('keeps account limits separate for users behind the same IP', async () => {
    const handler = jest.fn((_req: Request, res: Response) =>
      res.status(200).json({ success: true })
    );
    const app = createApp(handler);

    await request(app)
      .post('/login')
      .send({ email: 'ana@example.com', password: 'secret' })
      .expect(200);
    await request(app)
      .post('/login')
      .send({ email: 'luis@example.com', password: 'secret' })
      .expect(200);

    expect(mockedRedis.eval).toHaveBeenCalledTimes(2);
    const firstCall = mockedRedis.eval.mock.calls[0];
    const secondCall = mockedRedis.eval.mock.calls[1];

    expect(firstCall[1]).toBe(2);
    expect(firstCall[2]).toBe(secondCall[2]);
    expect(firstCall[3]).not.toBe(secondCall[3]);
    expect(firstCall[3]).not.toContain('ana@example.com');
    expect(secondCall[3]).not.toContain('luis@example.com');
  });

  it('counts only failed credentials against the account limit', async () => {
    const handler = jest.fn((req: Request, res: Response) =>
      res.status(req.body.password === 'wrong' ? 401 : 200).json({ success: false })
    );
    const app = createApp(handler);

    await request(app)
      .post('/login')
      .send({ email: 'ana@example.com', password: 'wrong' })
      .expect(401);
    expect(mockedRedis.zrem).not.toHaveBeenCalled();

    await request(app)
      .post('/login')
      .send({ email: 'ana@example.com', password: 'correct' })
      .expect(200);

    const successfulCall = mockedRedis.eval.mock.calls[1];
    const accountKey = successfulCall[3];
    const requestId = successfulCall[4];
    expect(mockedRedis.zrem).toHaveBeenCalledWith(accountKey, requestId);
  });

  it('returns 429 with Retry-After without reaching the controller when capped', async () => {
    mockedRedis.eval.mockResolvedValue([1, 2_500]);
    const handler = jest.fn((_req: Request, res: Response) => res.sendStatus(200));
    const app = createApp(handler);

    const response = await request(app)
      .post('/login')
      .send({ email: 'ana@example.com', password: 'secret' })
      .expect(429);

    expect(response.headers['retry-after']).toBe('3');
    expect(response.body.error.code).toBe('AUTH_RATE_LIMITED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when Redis cannot check the limit', async () => {
    mockedRedis.eval.mockRejectedValue(new Error('Redis unavailable'));
    const handler = jest.fn((_req: Request, res: Response) => res.sendStatus(200));
    const app = createApp(handler);

    const response = await request(app)
      .post('/login')
      .send({ email: 'ana@example.com', password: 'secret' })
      .expect(503);

    expect(response.body.error.code).toBe('AUTH_RATE_LIMIT_UNAVAILABLE');
    expect(handler).not.toHaveBeenCalled();
  });
});
