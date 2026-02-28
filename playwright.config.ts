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
  retries: process.env.CI ? 2 : 0,

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

  // Servidor de desarrollo
  webServer: [
    {
      command: 'pnpm --filter @aether/api dev',
      url: 'http://localhost:3000/health',
      timeout: 240 * 1000, // Aumentado a 4 minutos
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development', // Cambiado de 'test' a 'development'
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://aether:aether_dev_password@127.0.0.1:5432/aether_dev?schema=public&connect_timeout=10',
        JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests',
        REDIS_URL: process.env.REDIS_URL || '',
      },
      stdout: 'pipe', // Muestra logs del servidor
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @aether/web dev',
      url: 'http://localhost:3001',
      timeout: 240 * 1000, // Aumentado a 4 minutos
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development', // Cambiado de 'test' a 'development'
        NEXT_PUBLIC_API_URL: 'http://localhost:3000',
        NEXT_PUBLIC_WS_URL: 'http://localhost:3000',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  // Timeout global - aumentado para tests e2e
  timeout: 60 * 1000, // Aumentado de 30s a 60s
  expect: {
    timeout: 10000, // Aumentado de 5s a 10s
  },
});
