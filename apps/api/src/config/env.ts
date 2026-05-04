// apps/api/src/config/env.ts

import { z } from 'zod';

/**
 * Si DATABASE_URL está presente, extrae los componentes individuales de la cadena
 * de conexión y los inyecta en process.env para que el pool de pg los pueda leer.
 *
 * Render.com (y otras plataformas cloud) solo inyectan DATABASE_URL; este paso
 * garantiza compatibilidad sin necesidad de configurar DB_HOST/PORT/NAME/USER/PASSWORD
 * manualmente en el dashboard.
 */
function populateDbVarsFromUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  try {
    // Soporta formatos: postgres://user:pass@host:port/dbname
    // y la variante con ?sslmode=require u otros parámetros
    const parsed = new URL(url);

    if (!process.env.DB_HOST) process.env.DB_HOST = parsed.hostname;
    if (!process.env.DB_PORT) process.env.DB_PORT = parsed.port || '5432';
    if (!process.env.DB_NAME) process.env.DB_NAME = parsed.pathname.replace(/^\//, '');
    if (!process.env.DB_USER) process.env.DB_USER = decodeURIComponent(parsed.username);
    if (!process.env.DB_PASSWORD) process.env.DB_PASSWORD = decodeURIComponent(parsed.password);
  } catch {
    // Si la URL no es válida, la validación de Zod lo reportará correctamente
  }
}

/**
 * Environment variables schema
 * Validates that all required environment variables are present and valid
 */
const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  API_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),

  // Database — opcionales individualmente cuando DATABASE_URL está presente
  // (populateDbVarsFromUrl() los rellena automáticamente antes de la validación)
  DB_HOST: z.string().min(1, 'DB_HOST is required').optional().default('localhost'),
  DB_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('5432'),
  DB_NAME: z.string().min(1, 'DB_NAME is required').optional().default('aether'),
  DB_USER: z.string().min(1, 'DB_USER is required').optional().default('postgres'),
  DB_PASSWORD: z.string().optional().default(''),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

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

  // CORS — opcionales: si no están configuradas se usan valores seguros por defecto
  CORS_ORIGIN: z.string().optional().default(''),
  ALLOWED_ORIGINS: z.string().optional().default(''),
  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL')
    .optional()
    .default('http://localhost:3001'),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_URL: z.string().url('R2_PUBLIC_URL must be a valid URL'),

  // Groq AI
  GROQ_API_KEY: z.string().optional().default(''),

  // Email - Brevo
  BREVO_API_KEY: z
    .string()
    .startsWith('xkeysib-', 'BREVO_API_KEY must start with xkeysib-')
    .min(20, 'BREVO_API_KEY appears to be invalid')
    .optional()
    .default('xkeysib-placeholder-not-configured'),
  EMAIL_FROM: z
    .string()
    .email('EMAIL_FROM must be a valid email address')
    .default('aether.notifications@gmail.com'),
  EMAIL_FROM_NAME: z.string().min(1, 'EMAIL_FROM_NAME is required').default('Aether Platform'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables on application startup
 * Exits the process if validation fails
 */
export function validateEnv(): Env {
  // Primero extraer DB_* desde DATABASE_URL si aplica
  populateDbVarsFromUrl();

  // Railway inyecta PORT; mapearlo a API_PORT si no está definido
  if (process.env.PORT && !process.env.API_PORT) {
    process.env.API_PORT = process.env.PORT;
  }

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
