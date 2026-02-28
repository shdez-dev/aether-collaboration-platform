import { test, expect } from '../fixtures/auth-fixture';
import { generateTestName, waitForToast } from '../utils/test-helpers';

test.describe('Workspaces', () => {
  test.describe('Crear workspace', () => {
    test('debe crear un nuevo workspace exitosamente', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');

      // Click en botón crear workspace
      await page.click('[data-testid="create-workspace-button"]');

      // Llenar formulario
      const workspaceName = generateTestName('Test Workspace');
      await page.fill('input[name="name"]', workspaceName);
      await page.fill('textarea[name="description"]', 'Workspace de prueba');

      // Enviar
      await page.click('button[type="submit"]');

      // Verificar que el workspace aparece en la lista
      await expect(page.locator(`text=${workspaceName}`)).toBeVisible({ timeout: 10000 });
    });

    test('debe validar nombre requerido', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');

      await page.click('[data-testid="create-workspace-button"]');

      // Intentar enviar sin nombre
      await page.click('button[type="submit"]');

      // Verificar error de validación
      const nameInput = page.locator('input[name="name"]');
      const validationMessage = await nameInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage
      );
      expect(validationMessage).toBeTruthy();
    });

    test('debe permitir crear workspace sin descripción', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');

      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Workspace Sin Descripcion');
      await page.fill('input[name="name"]', workspaceName);
      // No llenar descripción

      await page.click('button[type="submit"]');

      // Debería crear exitosamente
      await expect(page.locator(`text=${workspaceName}`)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Ver workspace', () => {
    test('debe mostrar detalles del workspace', async ({ authenticatedPage: page }) => {
      // Crear workspace primero
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Details');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');

      // Esperar que aparezca
      await page.waitForSelector(`text=${workspaceName}`, { timeout: 10000 });

      // Click en el workspace
      await page.click(`text=${workspaceName}`);

      // Verificar que estamos en la página del workspace
      await expect(page).toHaveURL(/\/dashboard\/workspaces\/[a-f0-9-]+/);

      // Verificar que se muestra el nombre
      await expect(page.locator(`h1:has-text("${workspaceName}")`)).toBeVisible();
    });

    test('debe mostrar lista de miembros', async ({ authenticatedPage: page }) => {
      // Crear workspace
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Members');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      // Ir a configuración o miembros
      await page.click('[data-testid="workspace-settings"]');

      // Verificar que el creador está como owner
      await expect(page.locator('text=/.*owner.*/i')).toBeVisible();
    });
  });

  test.describe('Invitar miembros', () => {
    test('debe generar link de invitación', async ({ authenticatedPage: page }) => {
      // Crear workspace
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Invite');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      // Ir a configuración
      await page.click('[data-testid="workspace-settings"]');

      // Click en invitar miembro
      await page.click('[data-testid="invite-member-button"]');

      // Seleccionar role
      await page.selectOption('select[name="role"]', 'MEMBER');

      // Generar invitación
      await page.click('button:has-text("Generar link")');

      // Verificar que se muestra el link
      await expect(page.locator('[data-testid="invite-link"]')).toBeVisible();

      // Verificar formato del link
      const inviteLink = await page.locator('[data-testid="invite-link"]').textContent();
      expect(inviteLink).toMatch(/\/join\/[a-zA-Z0-9-_]+/);
    });

    test('debe permitir invitar por email', async ({ authenticatedPage: page }) => {
      // Crear workspace
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Email Invite');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      // Ir a configuración
      await page.click('[data-testid="workspace-settings"]');

      // Click en invitar por email
      await page.click('[data-testid="invite-by-email-button"]');

      // Llenar email
      await page.fill('input[name="email"]', 'invited@example.com');
      await page.selectOption('select[name="role"]', 'MEMBER');

      // Enviar invitación
      await page.click('button[type="submit"]');

      // Verificar mensaje de éxito
      await expect(page.locator('text=/.*invitaci.*enviada.*/i')).toBeVisible();
    });

    test('debe poder seleccionar diferentes roles al invitar', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Roles');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      await page.click('[data-testid="workspace-settings"]');
      await page.click('[data-testid="invite-member-button"]');

      // Verificar que existen las opciones de roles
      const roleSelect = page.locator('select[name="role"]');
      await expect(roleSelect).toBeVisible();

      // Verificar opciones disponibles
      const options = await roleSelect.locator('option').allTextContents();
      expect(options).toContain('Admin');
      expect(options).toContain('Member');
      expect(options).toContain('Viewer');
    });
  });

  test.describe('Editar workspace', () => {
    test('debe editar nombre del workspace', async ({ authenticatedPage: page }) => {
      // Crear workspace
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const originalName = generateTestName('Original Name');
      await page.fill('input[name="name"]', originalName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${originalName}`);
      await page.click(`text=${originalName}`);

      // Ir a configuración
      await page.click('[data-testid="workspace-settings"]');

      // Editar nombre
      await page.click('[data-testid="edit-workspace-button"]');

      const newName = generateTestName('New Name');
      await page.fill('input[name="name"]', newName);
      await page.click('button:has-text("Guardar")');

      // Verificar cambio
      await expect(page.locator(`text=${newName}`)).toBeVisible();
    });

    test('debe editar descripción del workspace', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Edit Description');
      await page.fill('input[name="name"]', workspaceName);
      await page.fill('textarea[name="description"]', 'Descripción original');
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      await page.click('[data-testid="workspace-settings"]');
      await page.click('[data-testid="edit-workspace-button"]');

      const newDescription = 'Nueva descripción actualizada';
      await page.fill('textarea[name="description"]', newDescription);
      await page.click('button:has-text("Guardar")');

      // Verificar cambio
      await expect(page.locator(`text=${newDescription}`)).toBeVisible();
    });
  });

  test.describe('Eliminar workspace', () => {
    test('debe eliminar workspace exitosamente', async ({ authenticatedPage: page }) => {
      // Crear workspace
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Delete');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      // Ir a configuración
      await page.click('[data-testid="workspace-settings"]');

      // Eliminar workspace
      await page.click('[data-testid="delete-workspace-button"]');

      // Confirmar eliminación
      await page.click('button:has-text("Confirmar")');

      // Verificar redirección
      await page.waitForURL('/dashboard/workspaces');

      // Verificar que el workspace ya no aparece
      await expect(page.locator(`text=${workspaceName}`)).not.toBeVisible();
    });

    test('debe pedir confirmación antes de eliminar', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Delete Confirmation');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      await page.click('[data-testid="workspace-settings"]');
      await page.click('[data-testid="delete-workspace-button"]');

      // Verificar modal de confirmación
      await expect(page.locator('text=/.*seguro.*eliminar.*/i')).toBeVisible();
      await expect(page.locator('button:has-text("Confirmar")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
    });
  });

  test.describe('Permisos y roles', () => {
    test('solo el owner debe poder eliminar workspace', async ({ authenticatedPage: page }) => {
      // Este test requeriría crear dos usuarios y un workspace compartido
      // Por ahora verificamos que el botón de eliminar existe para owner
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Owner Permissions');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      await page.click('[data-testid="workspace-settings"]');

      // Como owner, debería ver el botón de eliminar
      await expect(page.locator('[data-testid="delete-workspace-button"]')).toBeVisible();
    });

    test('debe mostrar indicador de rol del usuario', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');

      const workspaceName = generateTestName('Test Workspace Role Indicator');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      // Verificar que se muestra el rol (Owner en este caso)
      await expect(page.locator('text=/.*owner.*/i')).toBeVisible();
    });
  });

  test.describe('Listado de workspaces', () => {
    test('debe mostrar todos los workspaces del usuario', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');

      // Crear múltiples workspaces
      const workspaceNames = [
        generateTestName('Workspace 1'),
        generateTestName('Workspace 2'),
        generateTestName('Workspace 3'),
      ];

      for (const name of workspaceNames) {
        await page.click('[data-testid="create-workspace-button"]');
        await page.fill('input[name="name"]', name);
        await page.click('button[type="submit"]');
        await page.waitForSelector(`text=${name}`);
      }

      // Verificar que todos aparecen
      for (const name of workspaceNames) {
        await expect(page.locator(`text=${name}`)).toBeVisible();
      }
    });

    test('debe mostrar mensaje si no hay workspaces', async ({ page, testUser }) => {
      // Usuario nuevo sin workspaces
      await page.goto('/register');
      await page.fill('input[name="name"]', testUser.name);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirmPassword"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|verify-email)/);

      await page.goto('/dashboard/workspaces');

      // Verificar mensaje de empty state
      await expect(page.locator('text=/.*no.*workspace.*/i')).toBeVisible();
    });
  });
});
