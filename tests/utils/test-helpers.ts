import { Page, expect } from '@playwright/test';

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
  await page.goto('/login', { waitUntil: 'networkidle' });

  // Esperar que los campos estén visibles
  await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 10000 });

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Click en submit y esperar navegación
  await Promise.all([
    page.waitForNavigation({ timeout: 20000, waitUntil: 'networkidle' }),
    page.click('button[type="submit"]'),
  ]);

  // Verificar que el login fue exitoso
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });
  await expect(page).toHaveURL(/.*dashboard.*/);
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
