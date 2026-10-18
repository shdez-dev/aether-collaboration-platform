import { test as base, expect, Page } from '@playwright/test';
import { generateTestEmail, registerAndLogin } from '../utils/test-helpers';

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
    await registerAndLogin(page, testUser);

    // Proveer la página autenticada
    await use(page);

    // Cleanup: logout después del test (opcional)
    // await logout(page);
  },
});

export { expect };
