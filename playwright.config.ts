import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para tests E2E
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Ejecutar tests en paralelo
  fullyParallel: true,

  // Fallar el build en CI si se dejan tests con .only
  forbidOnly: !!process.env.CI,

  // Reintentos en CI
  retries: process.env.CI ? 1 : 0,

  // Workers: parallelismo
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // Configuración compartida para todos los tests
  use: {
    // URL base para navigar con page.goto('/')
    baseURL: 'http://localhost:3001',

    // Trace on first retry of failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport por defecto
    viewport: { width: 1280, height: 720 },
    // Evita que selectores o navegación rotos consuman el timeout completo del test.
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  // Configurar proyectos para diferentes browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Descomentar para probar en otros browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // API de prueba y build de producción web
  webServer: [
    {
      // En E2E no cargar apps/api/.env: sus valores locales podrían sobreescribir
      // DATABASE_URL y mezclar datos de prueba con la base de desarrollo.
      command: 'pnpm --filter @aether/api exec tsx watch src/index.ts',
      url: 'http://localhost:3000/health',
      timeout: 240 * 1000, // Aumentado a 4 minutos
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development', // Cambiado de 'test' a 'development'
        API_PORT: process.env.API_PORT || '3000',
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://aether:aether_dev_password@127.0.0.1:5432/aether_dev?schema=public&connect_timeout=10',
        JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests-32-characters-minimum',
        REFRESH_TOKEN_SECRET:
          process.env.REFRESH_TOKEN_SECRET || 'test-refresh-token-secret-for-e2e-tests-32c',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3001',
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
        STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
        LOCAL_STORAGE_DIR: process.env.LOCAL_STORAGE_DIR || 'apps/api/public/uploads',
        ...(process.env.STORAGE_DRIVER === 'r2'
          ? {
              R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
              R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
              R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
              R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
              R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
            }
          : {}),
        // E2E uses database verification instead of a real email provider.
        AETHER_E2E_DISABLE_EMAIL: 'true',
        BREVO_API_KEY: 'xkeysib-placeholder-not-configured',
        BREVO_SMTP_LOGIN: '',
        BREVO_SMTP_KEY: '',
      },
      stdout: 'pipe', // Muestra logs del servidor
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @aether/web exec next start -p 3001 -H localhost',
      url: 'http://localhost:3001',
      timeout: 240 * 1000, // Aumentado a 4 minutos
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  // Un timeout finito acelera el diagnóstico de una interacción que no existe.
  timeout: 45 * 1000,
  expect: {
    timeout: 8000,
  },
});
