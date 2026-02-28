import { test as base, expect, Page } from '@playwright/test';
import { login, generateTestEmail } from '../utils/test-helpers';

/**
 * Fixture extendido con utilidades de autenticación
 */

type TestUser = {
  email: string;
  password: string;
  name: string;
};

type AuthFixtures = {
  authenticatedPage: Page;
  testUser: TestUser;
};

export const test = base.extend<AuthFixtures>({
  // Fixture: Usuario de prueba único por test
  testUser: async ({}, use) => {
    const user = {
      email: generateTestEmail(),
      password: 'TestPassword123!',
      name: 'Test User',
    };
    await use(user);
  },

  // Fixture: Página autenticada
  authenticatedPage: async ({ page, testUser }, use) => {
    // Registrar usuario
    await page.goto('/register', { waitUntil: 'networkidle' });

    // Esperar que el formulario esté listo
    await page.waitForSelector('input[name="name"]', { state: 'visible', timeout: 10000 });

    await page.fill('input[name="name"]', testUser.name);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="confirmPassword"]', testUser.password);

    // Click y esperar navegación
    await Promise.all([
      page.waitForNavigation({ timeout: 20000, waitUntil: 'networkidle' }).catch(() => {
        // Ignorar timeout de navegación, verificaremos la URL después
      }),
      page.click('button[type="submit"]'),
    ]);

    // Esperar un poco para que la página se estabilice
    await page.waitForTimeout(2000);

    // Verificar si estamos en dashboard o si necesitamos login manual
    const currentUrl = page.url();

    if (!currentUrl.includes('/dashboard')) {
      // Si no redirige automáticamente después del registro, hacer login manual
      console.log('No auto-redirect after register, attempting manual login...');

      await page.goto('/login', { waitUntil: 'networkidle' });
      await page.waitForSelector('input[name="email"]', { state: 'visible' });
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);

      await Promise.all([
        page.waitForNavigation({ timeout: 20000, waitUntil: 'networkidle' }),
        page.click('button[type="submit"]'),
      ]);
    }

    // Verificar que estamos autenticados
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Proveer la página autenticada
    await use(page);

    // Cleanup: logout después del test (opcional)
    // await logout(page);
  },
});

export { expect };
