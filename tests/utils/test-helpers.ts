import { Page, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

/**
 * Helpers para tests E2E
 */

/**
 * Espera que un elemento sea visible y clickeable
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Login helper - realiza login y retorna cookies/tokens
 */
export async function login(page: Page, email: string, password: string) {
  // La app mantiene conexiones WebSocket; networkidle puede tardar mucho o no
  // ocurrir aunque la página de acceso ya esté lista.
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Esperar que los campos estén visibles
  await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 10000 });

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Esperar el cambio de ruta de Next.js, que puede ser una navegación SPA.
  await Promise.all([
    page.waitForURL(/.*dashboard.*/, { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);

  // Verificar que el login fue exitoso
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });
  await expect(page).toHaveURL(/.*dashboard.*/);
}

export type TestAccount = {
  email: string;
  password: string;
  name: string;
};

/**
 * Registra una cuenta a través de la interfaz para conservar cobertura del flujo real.
 */
export async function registerTestUser(page: Page, account: TestAccount) {
  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name="name"]', { state: 'visible', timeout: 10000 });

  await page.fill('input[name="name"]', account.name);
  await page.fill('input[name="email"]', account.email);
  await page.fill('input[name="password"]', account.password);
  await page.fill('input[name="confirmPassword"]', account.password);

  await Promise.all([
    page.waitForURL(/.*(?:dashboard|login|verify-email).*/, { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

/**
 * Verifica la cuenta recién creada directamente en la base E2E.
 * El entorno de GitHub no debe depender de credenciales ni de un proveedor de correo real.
 */
export async function verifyTestEmail(email: string) {
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://aether:aether_dev_password@127.0.0.1:5432/aether_dev?schema=public&connect_timeout=10';
  const databaseHost = new URL(connectionString).hostname.replace(/^\[|\]$/g, '');

  if (!process.env.TEST_DATABASE_URL && !['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
    throw new Error(
      'La verificación de correo E2E solo puede modificar una base local. Configura TEST_DATABASE_URL para usar una base de pruebas.'
    );
  }

  const apiRequire = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
  const { Pool } = apiRequire('pg') as {
    Pool: new (config: { connectionString: string }) => {
      query: (sql: string, values: string[]) => Promise<{ rowCount: number | null }>;
      end: () => Promise<void>;
    };
  };
  const pool = new Pool({ connectionString });

  try {
    const result = await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           updated_at = NOW()
       WHERE email = $1`,
      [email]
    );

    if (result.rowCount !== 1) {
      throw new Error(`No se encontró la cuenta E2E para verificar: ${email}`);
    }
  } finally {
    await pool.end();
  }
}

/** Registra, verifica y autentica una cuenta E2E para los tests que requieren sesión. */
export async function registerAndLogin(page: Page, account: TestAccount) {
  await registerTestUser(page, account);
  await verifyTestEmail(account.email);

  // El registro puede crear una sesión si el entorno tiene correo configurado.
  // Cerrar esa sesión hace que cada test ejercite el login de forma determinista.
  if (page.url().includes('/dashboard')) {
    await page.goto('/dashboard/profile');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.waitForURL(/.*login.*/, { timeout: 10000 });
  }

  // login() navega al formulario; evitar una segunda carga redundante aquí.
  await login(page, account.email, account.password);
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  // Buscar el botón de logout (puede variar según tu UI)
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');

  // Verificar redirección a login
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Crea un workspace de prueba
 */
export async function createWorkspace(page: Page, name: string) {
  await page.click('[data-testid="create-workspace-button"]');
  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');

  // Esperar que se cree el workspace
  await page.waitForSelector(`text=${name}`, { timeout: 5000 });
}

/**
 * Crea un board de prueba
 */
export async function createBoard(page: Page, title: string) {
  await page.click('[data-testid="create-board-button"]');
  await page.fill('input[name="title"]', title);
  await page.click('button[type="submit"]');

  // Esperar que se cree el board
  await page.waitForSelector(`text=${title}`, { timeout: 5000 });
}

/**
 * Genera un email único para tests
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Genera un nombre único para tests
 */
export function generateTestName(prefix: string): string {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}`;
}

/**
 * Espera por notificación toast
 */
export async function waitForToast(page: Page, message: string) {
  await page.waitForSelector(`text=${message}`, { timeout: 5000 });
}

/**
 * Espera a que desaparezca el loading spinner
 */
export async function waitForLoadingComplete(page: Page) {
  await page.waitForSelector('[data-testid="loading-spinner"]', {
    state: 'hidden',
    timeout: 10000,
  });
}

/**
 * Toma screenshot con nombre descriptivo
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}

/**
 * Simula drag and drop
 */
export async function dragAndDrop(page: Page, sourceSelector: string, targetSelector: string) {
  const source = await page.locator(sourceSelector);
  const target = await page.locator(targetSelector);

  await source.dragTo(target);
}

/**
 * Espera por WebSocket connection
 */
export async function waitForWebSocketConnection(page: Page) {
  await page.waitForFunction(
    () => {
      return (window as any).__ws_connected === true;
    },
    { timeout: 10000 }
  );
}

/**
 * Limpia la base de datos (para tests de integración)
 */
export async function cleanDatabase() {
  // Implementar según tu estrategia de limpieza
  // Puede ser una llamada a un endpoint de test o directamente a la DB
}
