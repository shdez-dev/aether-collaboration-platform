// apps/api/src/config/env.ts

import { z } from 'zod';

/**
 * Environment variables schema
 * Validates that all required environment variables are present and valid
 */
const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  API_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),

  // Database
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('5432'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .refine((val) => val !== 'your-secret-key', {
      message: 'JWT_SECRET must be changed from default value',
    }),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters for security')
    .refine((val) => val !== 'your-refresh-secret-key', {
      message: 'REFRESH_TOKEN_SECRET must be changed from default value',
    }),

  // CORS
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),

  // Email
  RESEND_API_KEY: z
    .string()
    .startsWith('re_', 'RESEND_API_KEY must start with re_')
    .min(10, 'RESEND_API_KEY appears to be invalid'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables on application startup
 * Exits the process if validation fails
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    process.stderr.write('env: configuration error — server cannot start\n');

    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        process.stderr.write(`  ${err.path.join('.')}: ${err.message}\n`);
      });
      process.stderr.write('\n  Hint: copy .env.example to .env and fill all required values\n');
      process.stderr.write('  Generate secrets: openssl rand -base64 32\n\n');
    } else {
      process.stderr.write(String(error) + '\n');
    }

    process.exit(1);
  }
}

/**
 * Get typed environment variables
 * Should only be called after validateEnv()
 */
export function getEnv(): Env {
  return process.env as unknown as Env;
}
