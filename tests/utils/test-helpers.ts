import { Page, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
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

type DatabaseRow = Record<string, unknown>;
type TestPool = {
  query: <T extends DatabaseRow = DatabaseRow>(sql: string, values?: unknown[]) => Promise<{
    rows: T[];
    rowCount: number | null;
  }>;
  end: () => Promise<void>;
};

function createTestPool(): TestPool {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Configura TEST_DATABASE_URL para los tests E2E.');
  }

  const databaseUrl = new URL(connectionString);
  const databaseHost = databaseUrl.hostname.replace(/^\[|\]$/g, '');
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost) || !/(?:_e2e|_test)$/i.test(databaseName)) {
    throw new Error('Los tests E2E solo pueden modificar una base local cuyo nombre termine en _e2e o _test.');
  }

  const apiRequire = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
  const { Pool } = apiRequire('pg') as {
    Pool: new (config: { connectionString: string }) => TestPool;
  };
  return new Pool({ connectionString });
}

/** Prepara una invitación de piloto descartable sin depender de un proveedor de correo. */
export async function createPlatformInvitation(email: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const pool = createTestPool();

  try {
    const inviter = await pool.query<{ id: string }>(
      `INSERT INTO users (id, email, password, name, email_verified, created_at, updated_at)
       VALUES (uuid_generate_v4(), 'e2e-inviter@aether.test', 'not-used-by-tests', 'E2E invitation sender', TRUE, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id`
    );
    await pool.query(
      `INSERT INTO platform_invitations (id, email, token_hash, invited_by, expires_at, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, NOW() + INTERVAL '7 days', NOW(), NOW())`,
      [email.toLowerCase(), tokenHash, inviter.rows[0].id]
    );
    return token;
  } finally {
    await pool.end();
  }
}

/** Crea una cuenta siguiendo el acceso real por invitación del piloto. */
export async function registerTestUser(page: Page, account: TestAccount) {
  const invitationToken = await createPlatformInvitation(account.email);
  await page.goto(`/join?token=${invitationToken}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Tu invitación a AETHER' })).toBeVisible();
  await expect(page.getByText(account.email, { exact: false })).toBeVisible();

  await page.locator('input[autocomplete="name"]').fill(account.name);
  const passwordFields = page.locator('input[autocomplete="new-password"]');
  await passwordFields.nth(0).fill(account.password);
  await passwordFields.nth(1).fill(account.password);
  await page.locator('#join-terms-read').check();
  await page.locator('#join-privacy-read').check();

  await Promise.all([
    page.waitForURL(/\/dashboard(?:\/|$|\?)/, { timeout: 25000 }),
    page.getByRole('button', { name: 'Activar mi cuenta' }).click(),
  ]);
  return invitationToken;
}

/** Activa por invitación y obtiene la sesión que el flujo real inicia al finalizar. */
export async function registerAndLogin(page: Page, account: TestAccount) {
  return registerTestUser(page, account);
}

/** Lee la evidencia de aceptación legal persistida para la cuenta E2E. */
export async function readTestRegistration(email: string) {
  const pool = createTestPool();
  try {
    const result = await pool.query<{
      terms_read_at: Date | null;
      privacy_read_at: Date | null;
      accepted_at: Date | null;
      accepted_by: string | null;
    }>(
      `SELECT u.terms_read_at, u.privacy_read_at, i.accepted_at, i.accepted_by
       FROM users u
       LEFT JOIN platform_invitations i ON i.accepted_by = u.id
       WHERE lower(u.email) = lower($1)
       ORDER BY i.accepted_at DESC NULLS LAST
       LIMIT 1`,
      [email]
    );
    return result.rows[0] ?? null;
  } finally {
    await pool.end();
  }
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
