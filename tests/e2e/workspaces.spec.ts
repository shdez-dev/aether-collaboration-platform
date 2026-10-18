import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth-fixture';
import { generateTestName } from '../utils/test-helpers';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

async function workspaceApi<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT',
  endpoint: string,
  data?: object
): Promise<T> {
  const accessToken = await page.evaluate(() => {
    const stored = localStorage.getItem('aether-auth-storage');
    return stored ? (JSON.parse(stored)?.state?.accessToken as string | undefined) : undefined;
  });
  if (!accessToken) throw new Error('La sesión E2E no contiene un access token.');

  const url = new URL(endpoint, process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').toString();
  const response = await page.request.fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    data,
  });
  const result = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || !result.success || !result.data) {
    throw new Error(result.error?.message || `Falló ${method} ${endpoint} (${response.status()}).`);
  }
  return result.data;
}

test.describe('Espacios de trabajo', () => {
  test('crea un espacio y lo devuelve en la consulta del usuario', async ({ authenticatedPage: page }) => {
    const name = generateTestName('Espacio E2E');
    const { workspace } = await workspaceApi<{ workspace: { id: string; name: string } }>(
      page,
      'POST',
      '/api/workspaces',
      { name, description: 'Espacio de trabajo creado por E2E.', workspaceTemplateId: 'personal' }
    );

    expect(workspace.name).toBe(name);
    const { workspaces } = await workspaceApi<{ workspaces: Array<{ id: string; name: string }> }>(
      page,
      'GET',
      '/api/workspaces'
    );
    expect(workspaces).toContainEqual(expect.objectContaining({ id: workspace.id, name }));
  });

  test('actualiza el nombre y conserva el espacio en el listado', async ({ authenticatedPage: page }) => {
    const { workspace } = await workspaceApi<{ workspace: { id: string; name: string } }>(
      page,
      'POST',
      '/api/workspaces',
      { name: generateTestName('Espacio original'), workspaceTemplateId: 'personal' }
    );
    const updatedName = generateTestName('Espacio actualizado');

    const { workspace: updated } = await workspaceApi<{ workspace: { id: string; name: string } }>(
      page,
      'PUT',
      `/api/workspaces/${workspace.id}`,
      { name: updatedName }
    );
    expect(updated.name).toBe(updatedName);

    const { workspace: fetched } = await workspaceApi<{ workspace: { id: string; name: string } }>(
      page,
      'GET',
      `/api/workspaces/${workspace.id}`
    );
    expect(fetched).toEqual(expect.objectContaining({ id: workspace.id, name: updatedName }));
  });
});
