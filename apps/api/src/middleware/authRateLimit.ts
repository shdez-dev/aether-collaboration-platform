import { createHmac, randomUUID } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { redisClient } from '../lib/redis';

type AuthRateLimitScopeType = 'ip' | 'email';

interface AuthRateLimitScope {
  type: AuthRateLimitScopeType;
  limit: number;
  windowMs: number;
  /** Keep login account counters for invalid credentials only, not successful sign-ins. */
  failuresOnly?: boolean;
}

interface AuthRateLimitOptions {
  policy: string;
  scopes: AuthRateLimitScope[];
}

interface ResolvedAuthRateLimitScope extends AuthRateLimitScope {
  key: string;
}

const AUTH_RATE_LIMIT_SCRIPT = `
local redisTime = redis.call('TIME')
local now = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
local member = ARGV[1]
local scopeCount = #KEYS
local blocked = 0
local retryAfterMs = 0

for i, key in ipairs(KEYS) do
  local limit = tonumber(ARGV[1 + i])
  local windowMs = tonumber(ARGV[1 + scopeCount + i])
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)

  local count = tonumber(redis.call('ZCARD', key))
  if count >= limit then
    blocked = 1
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if #oldest >= 2 then
      local waitMs = tonumber(oldest[2]) + windowMs - now
      if waitMs > retryAfterMs then
        retryAfterMs = waitMs
      end
    end
  end
end

if blocked == 0 then
  for i, key in ipairs(KEYS) do
    local windowMs = tonumber(ARGV[1 + scopeCount + i])
    redis.call('ZADD', key, 'NX', now, member)
    redis.call('PEXPIRE', key, windowMs)
  end
end

return {blocked, retryAfterMs}
`;

const REDIS_TIMEOUT_MS = 1_000;
// The hash tag keeps the middleware's multi-key Lua operation in one slot if
// Redis Cluster is used in a deployment.
const RATE_LIMIT_PREFIX = 'auth:rate-limit:v1:{auth}';
let lastStoreErrorLogAt = 0;

function logStoreFailure(): void {
  const now = Date.now();
  if (now - lastStoreErrorLogAt < 30_000) return;
  lastStoreErrorLogAt = now;
  console.error('[auth-rate-limit] Redis operation failed');
}

function getScopeValue(req: Request, type: AuthRateLimitScopeType): string | undefined {
  if (type === 'ip') {
    return req.ip || req.socket.remoteAddress || undefined;
  }

  const value = req.body?.email;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  const maxLength = 320;
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
}

function getRateLimitKey(policy: string, scope: AuthRateLimitScopeType, value: string): string {
  const hmacSecret = process.env.JWT_SECRET;
  if (!hmacSecret) {
    throw new Error('JWT_SECRET is required to protect authentication rate-limit keys');
  }

  const digest = createHmac('sha256', hmacSecret).update(value).digest('hex');
  return `${RATE_LIMIT_PREFIX}:${policy}:${scope}:${digest}`;
}

function rateLimitUnavailable(res: Response): void {
  logStoreFailure();
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_UNAVAILABLE',
      message: 'El servicio de autenticación no está disponible temporalmente',
    },
  });
}

export function createAuthRateLimit(options: AuthRateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const checkAndContinue = async (): Promise<void> => {
      const resolvedScopes: ResolvedAuthRateLimitScope[] = [];

      try {
        for (const scope of options.scopes) {
          const value = getScopeValue(req, scope.type);
          if (value === undefined) continue;

          resolvedScopes.push({
            ...scope,
            key: getRateLimitKey(options.policy, scope.type, value),
          });
        }

        if (!resolvedScopes.some((scope) => scope.type === 'ip')) {
          throw new Error('Could not determine client IP for authentication rate limiting');
        }

        const requestId = randomUUID();
        const keys = resolvedScopes.map((scope) => scope.key);
        const args = [
          requestId,
          ...resolvedScopes.map((scope) => String(scope.limit)),
          ...resolvedScopes.map((scope) => String(scope.windowMs)),
        ];

        let timeout: NodeJS.Timeout | undefined;
        const result = await Promise.race([
          redisClient.eval(AUTH_RATE_LIMIT_SCRIPT, keys.length, ...keys, ...args) as Promise<
            [number | string, number | string]
          >,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Redis rate-limit check timed out')),
              REDIS_TIMEOUT_MS
            );
          }),
        ]).finally(() => {
          if (timeout) clearTimeout(timeout);
        });

        const [blocked, retryAfterMs] = result;
        if (Number(blocked) !== 0) {
          const retryAfterSeconds = Math.max(1, Math.ceil(Number(retryAfterMs) / 1_000));
          res.setHeader('Retry-After', String(retryAfterSeconds));
          res.setHeader('Cache-Control', 'no-store');
          res.status(429).json({
            success: false,
            error: {
              code: 'AUTH_RATE_LIMITED',
              message: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
            },
            retryAfterSeconds,
          });
          return;
        }

        const failureOnlyScope = resolvedScopes.find((scope) => scope.failuresOnly);
        if (failureOnlyScope) {
          res.once('finish', () => {
            // Successful logins, validation errors and server errors do not count
            // against the account-specific failed-credential limit. The IP quota
            // still counts every request to contain malformed-request floods.
            if (res.statusCode !== 401) {
              void redisClient.zrem(failureOnlyScope.key, requestId).catch(logStoreFailure);
            }
          });
        }

        next();
      } catch {
        rateLimitUnavailable(res);
      }
    };

    void checkAndContinue();
  };
}

const minute = 60 * 1_000;
const hour = 60 * minute;

// IP quotas intentionally leave room for multiple people behind a shared
// office or household connection. Email quotas isolate targeted auth attempts.
export const registerRateLimit = createAuthRateLimit({
  policy: 'register',
  scopes: [
    { type: 'ip', limit: 300, windowMs: hour },
    { type: 'email', limit: 3, windowMs: hour },
  ],
});

export const loginRateLimit = createAuthRateLimit({
  policy: 'login',
  scopes: [
    { type: 'ip', limit: 300, windowMs: 15 * minute },
    { type: 'email', limit: 12, windowMs: 15 * minute, failuresOnly: true },
  ],
});

export const refreshRateLimit = createAuthRateLimit({
  policy: 'refresh',
  scopes: [{ type: 'ip', limit: 600, windowMs: 15 * minute }],
});

export const verifyEmailRateLimit = createAuthRateLimit({
  policy: 'verify-email',
  scopes: [{ type: 'ip', limit: 300, windowMs: hour }],
});

export const resendVerificationRateLimit = createAuthRateLimit({
  policy: 'resend-verification',
  scopes: [
    { type: 'ip', limit: 300, windowMs: hour },
    { type: 'email', limit: 3, windowMs: hour },
  ],
});

export const forgotPasswordRateLimit = createAuthRateLimit({
  policy: 'forgot-password',
  scopes: [
    { type: 'ip', limit: 300, windowMs: hour },
    { type: 'email', limit: 3, windowMs: hour },
  ],
});

export const resetPasswordRateLimit = createAuthRateLimit({
  policy: 'reset-password',
  scopes: [{ type: 'ip', limit: 300, windowMs: hour }],
});
