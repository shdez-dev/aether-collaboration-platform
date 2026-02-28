import { test, expect, Browser, BrowserContext } from '@playwright/test';
import { generateTestEmail, generateTestName } from '../utils/test-helpers';

test.describe('Colaboración en Tiempo Real', () => {
  let browser1: Browser;
  let browser2: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    // Crear dos contextos de browser separados para simular dos usuarios
    context1 = await browser.newContext();
    context2 = await browser.newContext();
  });

  test.afterEach(async () => {
    await context1?.close();
    await context2?.close();
  });

  test.describe('Indicadores de presencia', () => {
    test('debe mostrar usuarios activos en workspace', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Usuario 1: Registrar y crear workspace
      const user1Email = generateTestEmail();
      const user1Password = 'TestPassword123!';

      await page1.goto('/register');
      await page1.fill('input[name="name"]', 'User 1');
      await page1.fill('input[name="email"]', user1Email);
      await page1.fill('input[name="password"]', user1Password);
      await page1.fill('input[name="confirmPassword"]', user1Password);
      await page1.click('button[type="submit"]');
      await page1.waitForURL(/\/(dashboard|verify-email)/);

      // Crear workspace
      await page1.goto('/dashboard/workspaces');
      await page1.click('[data-testid="create-workspace-button"]');
      const workspaceName = generateTestName('Collaborative Workspace');
      await page1.fill('input[name="name"]', workspaceName);
      await page1.click('button[type="submit"]');
      await page1.waitForSelector(`text=${workspaceName}`);
      await page1.click(`text=${workspaceName}`);

      // Generar link de invitación
      await page1.click('[data-testid="workspace-settings"]');
      await page1.click('[data-testid="invite-member-button"]');
      await page1.selectOption('select[name="role"]', 'MEMBER');
      await page1.click('button:has-text("Generar link")');

      const inviteLink = await page1.locator('[data-testid="invite-link"]').textContent();
      const inviteToken = inviteLink?.match(/\/join\/([a-zA-Z0-9-_]+)/)?.[1];

      // Usuario 2: Registrar y unirse al workspace
      const user2Email = generateTestEmail();
      const user2Password = 'TestPassword123!';

      await page2.goto('/register');
      await page2.fill('input[name="name"]', 'User 2');
      await page2.fill('input[name="email"]', user2Email);
      await page2.fill('input[name="password"]', user2Password);
      await page2.fill('input[name="confirmPassword"]', user2Password);
      await page2.click('button[type="submit"]');
      await page2.waitForURL(/\/(dashboard|verify-email)/);

      // Unirse mediante link
      await page2.goto(`/join/${inviteToken}`);
      await page2.click('button:has-text("Unirse")');

      // Ambos usuarios en el workspace
      await page1.goto(`/dashboard/workspaces`);
      await page1.click(`text=${workspaceName}`);

      await page2.goto(`/dashboard/workspaces`);
      await page2.click(`text=${workspaceName}`);

      // Verificar indicadores de presencia
      await expect(page1.locator('[data-testid="online-users"]')).toContainText('2');
      await expect(page2.locator('[data-testid="online-users"]')).toContainText('2');

      // Verificar avatares de usuarios activos
      await expect(page1.locator('[data-testid="user-avatar-User 2"]')).toBeVisible();
      await expect(page2.locator('[data-testid="user-avatar-User 1"]')).toBeVisible();
    });

    test('debe actualizar presencia cuando usuario se desconecta', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Setup similar al test anterior (simplificado)
      const user1Email = generateTestEmail();
      await page1.goto('/register');
      await page1.fill('input[name="name"]', 'User 1');
      await page1.fill('input[name="email"]', user1Email);
      await page1.fill('input[name="password"]', 'Test123!');
      await page1.fill('input[name="confirmPassword"]', 'Test123!');
      await page1.click('button[type="submit"]');
      await page1.waitForURL(/\/(dashboard|verify-email)/);

      // Usuario 2 se desconecta
      await page2.close();

      // Verificar que el contador actualiza
      await expect(page1.locator('[data-testid="online-users"]')).toContainText('1', {
        timeout: 10000,
      });
    });
  });

  test.describe('Sincronización de boards', () => {
    test('debe sincronizar creación de card entre usuarios', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Crear workspace compartido (código reutilizable del test anterior)
      const user1Email = generateTestEmail();
      await page1.goto('/register');
      await page1.fill('input[name="name"]', 'User 1');
      await page1.fill('input[name="email"]', user1Email);
      await page1.fill('input[name="password"]', 'Test123!');
      await page1.fill('input[name="confirmPassword"]', 'Test123!');
      await page1.click('button[type="submit"]');
      await page1.waitForURL(/\/(dashboard|verify-email)/);

      await page1.goto('/dashboard/workspaces');
      await page1.click('[data-testid="create-workspace-button"]');
      const workspaceName = generateTestName('Sync Workspace');
      await page1.fill('input[name="name"]', workspaceName);
      await page1.click('button[type="submit"]');
      await page1.waitForSelector(`text=${workspaceName}`);
      await page1.click(`text=${workspaceName}`);

      // Crear board
      await page1.click('[data-testid="create-board-button"]');
      const boardTitle = generateTestName('Sync Board');
      await page1.fill('input[name="title"]', boardTitle);
      await page1.click('button[type="submit"]');
      await page1.waitForSelector(`text=${boardTitle}`);
      await page1.click(`text=${boardTitle}`);

      // Crear lista
      await page1.click('[data-testid="create-list-button"]');
      await page1.fill('input[name="title"]', 'To Do');
      await page1.press('input[name="title"]', 'Enter');
      await page1.waitForSelector('text=To Do');

      // Usuario 2 accede al mismo board (requiere invitación y navegación)
      // Para simplificar, asumimos que el board es visible

      // Usuario 1 crea una card
      const cardTitle = 'Synced Card';
      await page1.click('[data-testid="add-card-button"]');
      await page1.fill('input[name="cardTitle"]', cardTitle);
      await page1.press('input[name="cardTitle"]', 'Enter');

      // Usuario 2 debería ver la card aparecer en tiempo real
      await expect(page2.locator(`text=${cardTitle}`)).toBeVisible({ timeout: 5000 });
    });

    test('debe sincronizar movimiento de card drag and drop', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Setup: workspace, board, listas y card (simplificado)
      // ...

      // Usuario 1 mueve una card
      const card = page1.locator('[data-card-title="Card to Move"]');
      const targetList = page1.locator('[data-list-title="In Progress"]');
      await card.dragTo(targetList);

      // Usuario 2 ve el movimiento en tiempo real
      await expect(
        page2.locator('[data-list-title="In Progress"]').locator('text=Card to Move')
      ).toBeVisible({ timeout: 5000 });
    });

    test('debe sincronizar eliminación de card', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Setup con card creada
      // ...

      // Usuario 1 elimina card
      const cardTitle = 'Card to Delete';
      await page1.click(`text=${cardTitle}`);
      await page1.click('[data-testid="delete-card-button"]');
      await page1.click('button:has-text("Confirmar")');

      // Usuario 2 ve que desaparece
      await expect(page2.locator(`text=${cardTitle}`)).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Edición colaborativa de documentos', () => {
    test('debe mostrar cursores de otros usuarios', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Setup: crear documento compartido
      // ...

      // Usuario 2 escribe en el documento
      await page2.click('[data-testid="editor"]');
      await page2.type('[data-testid="editor"]', 'Texto de User 2');

      // Usuario 1 debería ver el cursor de User 2
      await expect(page1.locator('[data-testid="remote-cursor-User 2"]')).toBeVisible();
    });

    test('debe sincronizar texto en tiempo real', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Setup: documento compartido con Yjs
      // ...

      // Usuario 1 escribe
      const text = 'Texto colaborativo en tiempo real';
      await page1.click('[data-testid="editor"]');
      await page1.type('[data-testid="editor"]', text);

      // Usuario 2 ve el texto aparecer
      await expect(page2.locator('[data-testid="editor"]')).toContainText(text, { timeout: 3000 });
    });

    test('debe resolver conflictos de edición simultánea', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Ambos usuarios editan al mismo tiempo
      await page1.click('[data-testid="editor"]');
      await page2.click('[data-testid="editor"]');

      await page1.type('[data-testid="editor"]', 'Texto de User 1');
      await page2.type('[data-testid="editor"]', 'Texto de User 2');

      // Ambos deberían ver ambos textos (Yjs maneja CRDT)
      await expect(page1.locator('[data-testid="editor"]')).toContainText('Texto de User 1');
      await expect(page1.locator('[data-testid="editor"]')).toContainText('Texto de User 2');

      await expect(page2.locator('[data-testid="editor"]')).toContainText('Texto de User 1');
      await expect(page2.locator('[data-testid="editor"]')).toContainText('Texto de User 2');
    });
  });

  test.describe('Notificaciones en tiempo real', () => {
    test('debe recibir notificación cuando es mencionado', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Setup: workspace compartido
      // ...

      // Usuario 1 menciona a Usuario 2 en un comentario
      await page1.click('[data-testid="comment-input"]');
      await page1.type('[data-testid="comment-input"]', '@User2 necesito tu ayuda');
      await page1.click('button:has-text("Comentar")');

      // Usuario 2 recibe notificación
      await expect(page2.locator('[data-testid="notification-badge"]')).toBeVisible({
        timeout: 5000,
      });
      await expect(page2.locator('[data-testid="notification-badge"]')).toHaveText('1');
    });

    test('debe recibir notificación de nueva asignación', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Usuario 1 asigna card a Usuario 2
      await page1.click('[data-testid="card"]');
      await page1.click('[data-testid="assign-member-button"]');
      await page1.click('[data-testid="member-User 2"]');

      // Usuario 2 recibe notificación
      await expect(page2.locator('[data-testid="notification-badge"]')).toBeVisible({
        timeout: 5000,
      });
    });

    test('debe actualizar notificaciones al leerlas', async () => {
      const page1 = await context1.newPage();

      // Crear notificación
      // ...

      // Verificar badge
      await expect(page1.locator('[data-testid="notification-badge"]')).toHaveText('1');

      // Abrir panel de notificaciones
      await page1.click('[data-testid="notifications-button"]');

      // Badge debería desaparecer o cambiar
      await expect(page1.locator('[data-testid="notification-badge"]')).not.toBeVisible();
    });
  });

  test.describe('Reconexión después de desconexión', () => {
    test('debe reconectar WebSocket automáticamente', async () => {
      const page1 = await context1.newPage();

      // Setup
      // ...

      // Simular desconexión de red
      await context1.setOffline(true);

      // Verificar indicador de desconexión
      await expect(page1.locator('[data-testid="connection-status"]')).toHaveText(/desconectado/i);

      // Reconectar
      await context1.setOffline(false);

      // Verificar reconexión
      await expect(page1.locator('[data-testid="connection-status"]')).toHaveText(/conectado/i, {
        timeout: 10000,
      });
    });

    test('debe sincronizar cambios perdidos después de reconexión', async () => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Usuario 1 offline
      await context1.setOffline(true);

      // Usuario 2 hace cambios
      await page2.click('[data-testid="add-card-button"]');
      await page2.fill('input[name="cardTitle"]', 'Card creada offline');
      await page2.press('input[name="cardTitle"]', 'Enter');

      // Usuario 1 reconecta
      await context1.setOffline(false);

      // Debería recibir los cambios
      await expect(page1.locator('text=Card creada offline')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Performance con múltiples usuarios', () => {
    test('debe manejar múltiples usuarios simultáneos sin lag', async ({ browser }) => {
      // Crear 5 contextos simulando 5 usuarios
      const context3 = await browser.newContext();
      const context4 = await browser.newContext();
      const context5 = await browser.newContext();

      const pages = await Promise.all([
        context1.newPage(),
        context2.newPage(),
        context3.newPage(),
        context4.newPage(),
        context5.newPage(),
      ]);

      // Todos en el mismo board
      // ...

      // Todos crean cards simultáneamente
      const cardPromises = pages.map((page: any, i: number) => {
        return page
          .click('[data-testid="add-card-button"]')
          .then(() => page.fill('input[name="cardTitle"]', `Card ${i}`))
          .then(() => page.press('input[name="cardTitle"]', 'Enter'));
      });

      await Promise.all(cardPromises);

      // Verificar que todas las cards aparecen en todos los usuarios
      for (const page of pages) {
        for (let i = 0; i < 5; i++) {
          await expect(page.locator(`text=Card ${i}`)).toBeVisible({ timeout: 10000 });
        }
      }

      // Cleanup
      await context3.close();
      await context4.close();
      await context5.close();
    });
  });
});
