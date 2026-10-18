import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-fixture';
import { generateTestName } from '../utils/test-helpers';

type ApiResult<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

async function postAsAuthenticatedUser<T>(page: Page, endpoint: string, data: object): Promise<T> {
  const accessToken = await page.evaluate(() => {
    const stored = localStorage.getItem('aether-auth-storage');
    return stored ? (JSON.parse(stored)?.state?.accessToken as string | undefined) : undefined;
  });
  if (!accessToken) throw new Error('La sesión E2E no contiene un access token.');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const response = await page.request.post(new URL(endpoint, apiUrl).toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    data,
  });
  const result = (await response.json()) as ApiResult<T>;
  if (!response.ok() || !result.success || !result.data) {
    throw new Error(result.error?.message || `Falló ${endpoint} (${response.status()}).`);
  }
  return result.data;
}

async function createBoardFixture(page: Page) {
  const { workspace } = await postAsAuthenticatedUser<{ workspace: { id: string } }>(
    page,
    '/api/workspaces',
    { name: generateTestName('E2E Workspace'), workspaceTemplateId: 'personal' }
  );
  const { board } = await postAsAuthenticatedUser<{ board: { id: string } }>(
    page,
    `/api/workspaces/${workspace.id}/boards`,
    {
      name: generateTestName('E2E Board'),
      description: 'Tablero preparado para probar la experiencia actual.',
    }
  );
  return board;
}

test.describe('Tableros y tarjetas', () => {
  test('crea una lista y una tarjeta desde el tablero y permite comentar', async ({ authenticatedPage: page }) => {
    const board = await createBoardFixture(page);
    await page.goto(`/dashboard/boards/${board.id}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /E2E Board/ })).toBeVisible();
    await expect(page.getByText('Tablero preparado para probar la experiencia actual.')).toBeVisible();

    await page.getByRole('button', { name: /Añadir lista/ }).click();
    const listName = generateTestName('Pendiente');
    await page.getByLabel('Nueva lista').fill(listName);
    await page.getByRole('button', { name: 'Añadir Lista' }).click();
    await expect(page.getByText(listName, { exact: true })).toBeVisible();

    const list = page.getByRole('group', { name: listName, exact: true });
    await list.getByRole('button', { name: 'Añadir tarjeta', exact: true }).click();
    const cardTitle = generateTestName('Tarjeta E2E');
    await page.getByRole('textbox', { name: 'Nueva tarjeta' }).fill(cardTitle);
    await page.getByRole('button', { name: 'Crear tarjeta' }).click();
    await expect(page.getByText(cardTitle, { exact: true })).toBeVisible();
    // La creación abre el detalle para continuar con la captura de información.
    await page.locator('textarea[role="combobox"]').fill('Comentario de verificación E2E');
    await page.getByRole('button', { name: 'Comentar', exact: true }).click();
    await expect(page.getByTestId('comment-count')).toHaveText('1');

  });

  test('muestra el tablero preparado y permite completar una tarjeta', async ({ authenticatedPage: page }) => {
    const board = await createBoardFixture(page);
    const { list } = await postAsAuthenticatedUser<{ list: { id: string } }>(
      page,
      `/api/boards/${board.id}/lists`,
      { name: 'En curso' }
    );
    const cardTitle = generateTestName('Tarjeta completada');
    await postAsAuthenticatedUser<{ card: { id: string } }>(
      page,
      `/api/lists/${list.id}/cards`,
      { title: cardTitle }
    );

    await page.goto(`/dashboard/boards/${board.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /E2E Board/ })).toBeVisible();
    await expect(page.getByText('En curso', { exact: true })).toBeVisible();
    await expect(page.getByText(cardTitle, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Completar tarjeta: ${cardTitle}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Reabrir tarjeta: ${cardTitle}`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
