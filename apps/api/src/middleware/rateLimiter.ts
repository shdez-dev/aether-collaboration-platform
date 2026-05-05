// apps/api/src/middleware/rateLimiter.ts

import rateLimit from 'express-rate-limit';

// Get configuration from environment variables with defaults
const isDevelopment = process.env.NODE_ENV === 'development';
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_MAX_REQUESTS || (isDevelopment ? '5000' : '500'),
  10
);

/**
 * General API rate limiter
 * Applies to all API routes to prevent abuse
 * In development: 1000 requests per 15 minutes (configurable)
 * In production: 100 requests per 15 minutes (configurable)
 */
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests
  skipSuccessfulRequests: false,
  // Skip failed requests
  skipFailedRequests: false,
});

/**
 * Auth endpoints rate limiter (stricter)
 * Prevents brute force attacks on login
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 5,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Too many login attempts from this IP, please try again after 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only count failed login attempts
  skipSuccessfulRequests: true,
});

/**
 * Registration rate limiter (very strict)
 * Prevents spam account creation
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 1000 : 3,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REGISTRATIONS',
      message: 'Too many accounts created from this IP, please try again after 1 hour.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password reset rate limiter
 * Prevents spam of password reset emails
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 1000 : 3,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_RESET_REQUESTS',
      message: 'Too many password reset requests, please try again after 1 hour.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI generation rate limiter (strict, per user)
 * Applies to /api/ai/plan and /api/ai/build.
 * Uses userId as key (not IP) so shared networks (campus, office) no se ven afectadas.
 * Must run AFTER authenticateJWT so req.user está disponible.
 */
export const aiGenerateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: isDevelopment ? 1000 : 8,
  keyGenerator: (req: any) => req.user?.id ?? (req.ip ?? 'anonymous'),
  validate: { xForwardedForHeader: false },
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT',
      message: 'Has alcanzado el límite de generaciones por hora. Intenta de nuevo más tarde.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
