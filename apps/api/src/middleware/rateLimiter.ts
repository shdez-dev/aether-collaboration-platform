// apps/api/src/middleware/rateLimiter.ts

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Applies to all API routes to prevent abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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
  max: 5, // Limit each IP to 5 login requests per windowMs
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
  max: 3, // Limit each IP to 3 account creations per hour
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
  max: 3, // Limit each IP to 3 password reset requests per hour
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
