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
  console.log('[ENV] Validating environment variables...');

  try {
    const env = envSchema.parse(process.env);
    console.log('[ENV] ✅ Environment variables validated successfully');
    console.log('[ENV] 📝 Configuration:');
    console.log(`[ENV]   - Environment: ${env.NODE_ENV}`);
    console.log(`[ENV]   - Port: ${env.API_PORT}`);
    console.log(`[ENV]   - Database: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
    console.log(`[ENV]   - Redis: ${env.REDIS_URL.split('@')[1] || 'configured'}`);
    console.log(`[ENV]   - CORS Origin: ${env.CORS_ORIGIN}`);
    console.log(`[ENV]   - Frontend URL: ${env.FRONTEND_URL}`);

    return env;
  } catch (error) {
    console.error('[ENV] ❌ Environment validation failed:');

    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`[ENV]   - ${err.path.join('.')}: ${err.message}`);
      });

      console.error('\n[ENV] 💡 Tips:');
      console.error('[ENV]   1. Copy .env.example to .env');
      console.error('[ENV]   2. Fill in all required values');
      console.error('[ENV]   3. Generate secrets with: openssl rand -base64 32');
      console.error('[ENV]   4. Never commit .env to git\n');
    } else {
      console.error(error);
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
