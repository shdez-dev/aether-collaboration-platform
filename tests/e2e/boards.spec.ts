import { test, expect } from '../fixtures/auth-fixture';
import { generateTestName, dragAndDrop } from '../utils/test-helpers';

test.describe('Boards y Cards', () => {
  // Helper: Crear workspace y board de prueba
  async function setupWorkspaceAndBoard(page: any) {
    // Crear workspace
    await page.goto('/dashboard/workspaces');
    await page.click('[data-testid="create-workspace-button"]');
    const workspaceName = generateTestName('Test Workspace');
    await page.fill('input[name="name"]', workspaceName);
    await page.click('button[type="submit"]');
    await page.waitForSelector(`text=${workspaceName}`);
    await page.click(`text=${workspaceName}`);

    // Crear board
    await page.click('[data-testid="create-board-button"]');
    const boardTitle = generateTestName('Test Board');
    await page.fill('input[name="title"]', boardTitle);
    await page.click('button[type="submit"]');
    await page.waitForSelector(`text=${boardTitle}`);
    await page.click(`text=${boardTitle}`);

    return { workspaceName, boardTitle };
  }

  test.describe('Crear board', () => {
    test('debe crear un nuevo board exitosamente', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');
      const workspaceName = generateTestName('Test Workspace');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      // Crear board
      await page.click('[data-testid="create-board-button"]');
      const boardTitle = generateTestName('New Board');
      await page.fill('input[name="title"]', boardTitle);
      await page.fill('textarea[name="description"]', 'Board de prueba');
      await page.click('button[type="submit"]');

      // Verificar que aparece
      await expect(page.locator(`text=${boardTitle}`)).toBeVisible();
    });

    test('debe validar título requerido', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');
      const workspaceName = generateTestName('Test Workspace');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      await page.click('[data-testid="create-board-button"]');
      await page.click('button[type="submit"]');

      // Verificar validación
      const titleInput = page.locator('input[name="title"]');
      const validationMessage = await titleInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage
      );
      expect(validationMessage).toBeTruthy();
    });

    test('debe poder crear board desde plantilla', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard/workspaces');
      await page.click('[data-testid="create-workspace-button"]');
      const workspaceName = generateTestName('Test Workspace');
      await page.fill('input[name="name"]', workspaceName);
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${workspaceName}`);
      await page.click(`text=${workspaceName}`);

      await page.click('[data-testid="create-board-button"]');

      // Seleccionar plantilla
      await page.click('[data-testid="template-selector"]');
      await page.click('[data-testid="template-kanban"]');

      const boardTitle = generateTestName('Board From Template');
      await page.fill('input[name="title"]', boardTitle);
      await page.click('button[type="submit"]');

      await page.waitForSelector(`text=${boardTitle}`);
      await page.click(`text=${boardTitle}`);

      // Verificar que tiene listas por defecto
      await expect(page.locator('text=/To Do|In Progress|Done/')).toBeVisible();
    });
  });

  test.describe('Ver board', () => {
    test('debe mostrar board vacío correctamente', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Verificar empty state
      await expect(page.locator('text=/.*agregar.*lista.*/i')).toBeVisible();
    });

    test('debe mostrar título y descripción del board', async ({ authenticatedPage: page }) => {
      const { boardTitle } = await setupWorkspaceAndBoard(page);

      await expect(page.locator(`h1:has-text("${boardTitle}")`)).toBeVisible();
    });
  });

  test.describe('Crear listas', () => {
    test('debe crear una nueva lista', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Crear lista
      await page.click('[data-testid="create-list-button"]');
      const listTitle = 'To Do';
      await page.fill('input[name="title"]', listTitle);
      await page.press('input[name="title"]', 'Enter');

      // Verificar que aparece
      await expect(page.locator(`[data-testid="list-${listTitle}"]`)).toBeVisible();
    });

    test('debe crear múltiples listas', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      const lists = ['To Do', 'In Progress', 'Done'];

      for (const listTitle of lists) {
        await page.click('[data-testid="create-list-button"]');
        await page.fill('input[name="title"]', listTitle);
        await page.press('input[name="title"]', 'Enter');
        await page.waitForSelector(`text=${listTitle}`);
      }

      // Verificar todas las listas
      for (const listTitle of lists) {
        await expect(page.locator(`text=${listTitle}`)).toBeVisible();
      }
    });

    test('debe cancelar creación de lista al presionar Escape', async ({
      authenticatedPage: page,
    }) => {
      await setupWorkspaceAndBoard(page);

      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'New List');
      await page.press('input[name="title"]', 'Escape');

      // Verificar que no se creó
      await expect(page.locator('text=New List')).not.toBeVisible();
    });
  });

  test.describe('Crear cards', () => {
    test('debe crear una nueva card', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Crear lista primero
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      // Crear card
      await page.click('[data-testid="add-card-button"]');
      const cardTitle = 'Test Card';
      await page.fill('input[name="cardTitle"]', cardTitle);
      await page.press('input[name="cardTitle"]', 'Enter');

      // Verificar que aparece
      await expect(page.locator(`text=${cardTitle}`)).toBeVisible();
    });

    test('debe abrir modal de card al hacer click', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Crear lista y card
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      const cardTitle = 'Test Card Details';
      await page.fill('input[name="cardTitle"]', cardTitle);
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector(`text=${cardTitle}`);

      // Click en card
      await page.click(`text=${cardTitle}`);

      // Verificar modal
      await expect(page.locator('[data-testid="card-modal"]')).toBeVisible();
      await expect(page.locator(`h2:has-text("${cardTitle}")`)).toBeVisible();
    });

    test('debe editar descripción de card', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Setup
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Card with Description');
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector('text=Card with Description');

      // Abrir card
      await page.click('text=Card with Description');

      // Editar descripción
      await page.click('[data-testid="edit-description-button"]');
      const description = 'Esta es una descripción de prueba';
      await page.fill('textarea[name="description"]', description);
      await page.click('button:has-text("Guardar")');

      // Verificar
      await expect(page.locator(`text=${description}`)).toBeVisible();
    });

    test('debe añadir etiquetas a card', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Setup
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Card with Labels');
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector('text=Card with Labels');

      // Abrir card
      await page.click('text=Card with Labels');

      // Añadir etiqueta
      await page.click('[data-testid="add-label-button"]');
      await page.click('[data-testid="label-bug"]');

      // Verificar
      await expect(page.locator('[data-testid="label-bug"]')).toHaveClass(/selected/);
    });

    test('debe asignar miembro a card', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Setup
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Assigned Card');
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector('text=Assigned Card');

      // Abrir card
      await page.click('text=Assigned Card');

      // Asignar a sí mismo
      await page.click('[data-testid="assign-member-button"]');
      await page.click('[data-testid="assign-self"]');

      // Verificar avatar aparece
      await expect(page.locator('[data-testid="assigned-member-avatar"]')).toBeVisible();
    });

    test('debe añadir fecha de vencimiento', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Setup
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Card with Due Date');
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector('text=Card with Due Date');

      // Abrir card
      await page.click('text=Card with Due Date');

      // Añadir fecha
      await page.click('[data-testid="add-due-date-button"]');

      // Seleccionar fecha (próxima semana)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const dateString = nextWeek.toISOString().split('T')[0];

      await page.fill('input[type="date"]', dateString);
      await page.click('button:has-text("Guardar")');

      // Verificar
      await expect(page.locator('[data-testid="due-date-display"]')).toBeVisible();
    });
  });

  test.describe('Drag and Drop', () => {
    test('debe mover card entre listas', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Crear dos listas
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'In Progress');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=In Progress');

      // Crear card en "To Do"
      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Draggable Card');
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector('text=Draggable Card');

      // Drag card de "To Do" a "In Progress"
      const card = page.locator('[data-card-title="Draggable Card"]');
      const targetList = page.locator('[data-list-title="In Progress"]');

      await card.dragTo(targetList);

      // Verificar que la card está en "In Progress"
      const inProgressList = page.locator('[data-list-title="In Progress"]');
      await expect(inProgressList.locator('text=Draggable Card')).toBeVisible();
    });

    test('debe reordenar cards dentro de una lista', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Crear lista
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      // Crear múltiples cards
      const cards = ['Card 1', 'Card 2', 'Card 3'];
      for (const cardTitle of cards) {
        await page.click('[data-testid="add-card-button"]');
        await page.fill('input[name="cardTitle"]', cardTitle);
        await page.press('input[name="cardTitle"]', 'Enter');
        await page.waitForSelector(`text=${cardTitle}`);
      }

      // Drag Card 1 debajo de Card 3
      const card1 = page.locator('[data-card-title="Card 1"]');
      const card3 = page.locator('[data-card-title="Card 3"]');

      await card1.dragTo(card3);

      // Verificar orden
      const cardElements = await page.locator('[data-testid^="card-"]').allTextContents();
      expect(cardElements[0]).toContain('Card 2');
      expect(cardElements[1]).toContain('Card 3');
      expect(cardElements[2]).toContain('Card 1');
    });

    test('debe reordenar listas', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Crear múltiples listas
      const lists = ['List 1', 'List 2', 'List 3'];
      for (const listTitle of lists) {
        await page.click('[data-testid="create-list-button"]');
        await page.fill('input[name="title"]', listTitle);
        await page.press('input[name="title"]', 'Enter');
        await page.waitForSelector(`text=${listTitle}`);
      }

      // Drag List 1 después de List 3
      const list1 = page.locator('[data-list-title="List 1"]');
      const list3 = page.locator('[data-list-title="List 3"]');

      await list1.dragTo(list3);

      // Verificar orden
      const listElements = await page.locator('[data-testid^="list-"]').allTextContents();
      expect(listElements[0]).toContain('List 2');
      expect(listElements[1]).toContain('List 3');
      expect(listElements[2]).toContain('List 1');
    });
  });

  test.describe('Eliminar elementos', () => {
    test('debe eliminar una card', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Setup
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      const cardTitle = 'Card to Delete';
      await page.fill('input[name="cardTitle"]', cardTitle);
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector(`text=${cardTitle}`);

      // Abrir card
      await page.click(`text=${cardTitle}`);

      // Eliminar
      await page.click('[data-testid="delete-card-button"]');
      await page.click('button:has-text("Confirmar")');

      // Verificar
      await expect(page.locator(`text=${cardTitle}`)).not.toBeVisible();
    });

    test('debe eliminar una lista completa', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Crear lista con cards
      await page.click('[data-testid="create-list-button"]');
      const listTitle = 'List to Delete';
      await page.fill('input[name="title"]', listTitle);
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector(`text=${listTitle}`);

      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Card in List');
      await page.press('input[name="cardTitle"]', 'Enter');

      // Eliminar lista
      await page.click('[data-testid="list-menu"]');
      await page.click('[data-testid="delete-list-button"]');
      await page.click('button:has-text("Confirmar")');

      // Verificar
      await expect(page.locator(`text=${listTitle}`)).not.toBeVisible();
      await expect(page.locator('text=Card in List')).not.toBeVisible();
    });
  });

  test.describe('Comentarios', () => {
    test('debe añadir comentario a una card', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Setup
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Card with Comments');
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector('text=Card with Comments');

      // Abrir card
      await page.click('text=Card with Comments');

      // Añadir comentario
      await page.fill('textarea[name="comment"]', 'Este es un comentario de prueba');
      await page.click('button:has-text("Comentar")');

      // Verificar
      await expect(page.locator('text=Este es un comentario de prueba')).toBeVisible();
    });

    test('debe mostrar contador de comentarios en card', async ({ authenticatedPage: page }) => {
      await setupWorkspaceAndBoard(page);

      // Setup y añadir comentario
      await page.click('[data-testid="create-list-button"]');
      await page.fill('input[name="title"]', 'To Do');
      await page.press('input[name="title"]', 'Enter');
      await page.waitForSelector('text=To Do');

      await page.click('[data-testid="add-card-button"]');
      await page.fill('input[name="cardTitle"]', 'Card Comments Counter');
      await page.press('input[name="cardTitle"]', 'Enter');
      await page.waitForSelector('text=Card Comments Counter');

      await page.click('text=Card Comments Counter');
      await page.fill('textarea[name="comment"]', 'Comentario 1');
      await page.click('button:has-text("Comentar")');

      // Cerrar modal
      await page.press('body', 'Escape');

      // Verificar contador
      await expect(page.locator('[data-testid="comment-count"]')).toHaveText('1');
    });
  });
});
