import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-fixture';
import { generateTestName } from '../utils/test-helpers';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

async function createResource<T>(page: Page, endpoint: string, data: object): Promise<T> {
  const accessToken = await page.evaluate(() => {
    const stored = localStorage.getItem('aether-auth-storage');
    return stored ? (JSON.parse(stored)?.state?.accessToken as string | undefined) : undefined;
  });
  if (!accessToken) throw new Error('La sesión E2E no contiene un access token.');

  const response = await page.request.post(
    new URL(endpoint, process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').toString(),
    { headers: { Authorization: `Bearer ${accessToken}` }, data }
  );
  const result = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || !result.success || !result.data) {
    throw new Error(result.error?.message || `Falló ${endpoint} (${response.status()}).`);
  }
  return result.data;
}

test('sincroniza en otra pestaña una tarjeta creada desde el tablero', async ({ authenticatedPage: page }) => {
  const { workspace } = await createResource<{ workspace: { id: string } }>(page, '/api/workspaces', {
    name: generateTestName('E2E Realtime'),
    workspaceTemplateId: 'personal',
  });
  const { board } = await createResource<{ board: { id: string } }>(
    page,
    `/api/workspaces/${workspace.id}/boards`,
    { name: generateTestName('Tablero realtime') }
  );
  const listName = generateTestName('Cola realtime');
  await createResource(page, `/api/boards/${board.id}/lists`, { name: listName });

  const boardUrl = `/dashboard/boards/${board.id}`;
  await page.goto(boardUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(listName, { exact: true })).toBeVisible();

  const secondPage = await page.context().newPage();
  try {
    await secondPage.goto(boardUrl, { waitUntil: 'domcontentloaded' });
    await expect(secondPage.getByText(listName, { exact: true })).toBeVisible();

    await page
      .getByRole('group', { name: listName, exact: true })
      .getByRole('button', { name: 'Añadir tarjeta', exact: true })
      .click();
    const cardTitle = generateTestName('Tarjeta sincronizada');
    await page.getByRole('textbox', { name: 'Nueva tarjeta' }).fill(cardTitle);
    await page.getByRole('button', { name: 'Crear tarjeta' }).click();

    await expect(page.getByText(cardTitle, { exact: true })).toBeVisible();
    await expect(secondPage.getByRole('heading', { name: cardTitle, level: 4 })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Cerrar tarjeta' }).click();
    await page.getByRole('button', { name: `Completar tarjeta: ${cardTitle}`, exact: true }).click();
    await expect(secondPage.getByRole('button', { name: `Reabrir tarjeta: ${cardTitle}`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 15_000 }
    );
  } finally {
    await secondPage.close();
  }
});
