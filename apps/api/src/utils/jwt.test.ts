import jwt from 'jsonwebtoken';
import type { UserId } from '@aether/types';
import {
  generateAccessToken,
  verifyAccessToken,
  verifyAccessTokenWithExpiry,
} from './jwt';

const payload = {
  userId: 'user-1' as UserId,
  email: 'user@example.com',
};

describe('access token expiry metadata', () => {
  it('returns the signed expiry for persistent WebSocket sessions', () => {
    const token = generateAccessToken(payload);

    expect(verifyAccessTokenWithExpiry(token)).toMatchObject({
      ...payload,
      exp: expect.any(Number),
    });
  });

  it('keeps the existing access-token payload shape for HTTP callers', () => {
    const token = generateAccessToken(payload);

    expect(verifyAccessToken(token)).toEqual(payload);
  });

  it('rejects a signed access token that has no expiry', () => {
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256' });

    expect(() => verifyAccessTokenWithExpiry(token)).toThrow('Invalid or expired token');
  });
});
