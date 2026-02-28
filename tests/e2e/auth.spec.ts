import { test, expect } from '@playwright/test';
import { generateTestEmail, waitForToast } from '../utils/test-helpers';

test.describe('Autenticación', () => {
  test.describe('Registro de usuario', () => {
    test('debe registrar un nuevo usuario exitosamente', async ({ page }) => {
      const testEmail = generateTestEmail();
      const testPassword = 'TestPassword123!';
      const testName = 'Test User';

      // Navegar a página de registro
      await page.goto('/register');

      // Verificar que estamos en la página correcta
      await expect(page).toHaveURL('/register');

      // Llenar formulario
      await page.fill('input[name="name"]', testName);
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);

      // Enviar formulario
      await page.click('button[type="submit"]');

      // Esperar redirección al dashboard o verificación de email
      // O verificar que no hay error visible (si hay problemas de BD)
      await Promise.race([
        page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 15000 }),
        page.waitForSelector('.text-error', { state: 'visible', timeout: 15000 }).then(() => {
          throw new Error('Se mostró un error durante el registro');
        }),
      ]);

      // Verificar que el registro fue exitoso
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(dashboard|verify-email)/);
    });

    test('debe mostrar error si las contraseñas no coinciden', async ({ page }) => {
      await page.goto('/register');

      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', generateTestEmail());
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');

      await page.click('button[type="submit"]');

      // Verificar mensaje de error específico
      await expect(page.locator('.bg-error\\/10 >> p.text-error')).toContainText(
        /passwords do not match|las contraseñas no coinciden/i,
        { timeout: 5000 }
      );
    });

    test('debe mostrar error si la contraseña es muy corta', async ({ page }) => {
      await page.goto('/register');

      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', generateTestEmail());
      await page.fill('input[name="password"]', 'Short1!');
      await page.fill('input[name="confirmPassword"]', 'Short1!');

      await page.click('button[type="submit"]');

      // Verificar mensaje de error específico
      await expect(page.locator('.bg-error\\/10 >> p.text-error')).toContainText(
        /password must be at least 8|contraseña debe tener al menos 8/i,
        { timeout: 5000 }
      );
    });

    test('debe mostrar error si el email ya existe', async ({ page }) => {
      const testEmail = generateTestEmail();
      const testPassword = 'TestPassword123!';

      // Registrar usuario por primera vez
      await page.goto('/register');
      await page.fill('input[name="name"]', 'Test User 1');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      await page.click('button[type="submit"]');

      // Esperar que complete
      await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 15000 });

      // Intentar registrar de nuevo con el mismo email
      await page.goto('/register');
      await page.waitForSelector('input[name="email"]', { state: 'visible' });
      await page.fill('input[name="name"]', 'Test User 2');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      await page.click('button[type="submit"]');

      // Verificar mensaje de error (email existente, already exists, etc.)
      await expect(page.locator('text=/email.*exist|already|ya.*registrado/i')).toBeVisible({
        timeout: 5000,
      });
    });

    test('debe validar formato de email', async ({ page }) => {
      await page.goto('/register');

      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.fill('input[name="confirmPassword"]', 'TestPassword123!');

      await page.click('button[type="submit"]');

      // El navegador debería mostrar error de validación HTML5
      const emailInput = page.locator('input[name="email"]');
      const validationMessage = await emailInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage
      );
      expect(validationMessage).toBeTruthy();
    });
  });

  test.describe('Login de usuario', () => {
    test('debe hacer login exitosamente con credenciales válidas', async ({ page }) => {
      const testEmail = generateTestEmail();
      const testPassword = 'TestPassword123!';

      // Registrar usuario primero
      await page.goto('/register');
      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 10000 });

      // Hacer logout si estamos en dashboard
      if (page.url().includes('dashboard')) {
        // Esperar a que el botón de logout esté visible
        await page.waitForSelector('[data-testid="logout-button"]', {
          state: 'visible',
          timeout: 5000,
        });
        await page.click('[data-testid="logout-button"]');
        await page.waitForURL('/login', { timeout: 10000 });
      }

      // Ahora hacer login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');

      // Verificar redirección al dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await expect(page).toHaveURL('/dashboard');
    });

    test('debe mostrar error con credenciales inválidas', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'nonexistent@example.com');
      await page.fill('input[name="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]');

      // Verificar mensaje de error (el backend devuelve este mensaje)
      await expect(page.locator('.bg-error\\/10 >> p.text-error')).toContainText(
        /email o contraseña incorrectos|invalid credentials/i,
        { timeout: 10000 }
      );
    });

    test('debe mostrar error con email vacío', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="password"]', 'SomePassword123!');
      await page.click('button[type="submit"]');

      // HTML5 validation debería prevenir el submit
      const emailInput = page.locator('input[name="email"]');
      const validationMessage = await emailInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage
      );
      expect(validationMessage).toBeTruthy();
    });

    test('debe redirigir a dashboard si ya está autenticado', async ({ page }) => {
      const testEmail = generateTestEmail();
      const testPassword = 'TestPassword123!';

      // Registrar y autenticar
      await page.goto('/register');
      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 10000 });

      // Intentar ir a login estando autenticado
      await page.goto('/login');

      // Debería redirigir automáticamente
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Logout de usuario', () => {
    test('debe hacer logout exitosamente', async ({ page }) => {
      const testEmail = generateTestEmail();
      const testPassword = 'TestPassword123!';

      // Registrar usuario
      await page.goto('/register');
      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 10000 });

      // Esperar a estar en dashboard
      if (!page.url().includes('dashboard')) {
        await page.goto('/dashboard');
      }

      // Hacer logout
      await page.waitForSelector('[data-testid="logout-button"]', {
        state: 'visible',
        timeout: 5000,
      });
      await page.click('[data-testid="logout-button"]');

      // Verificar redirección a login
      await page.waitForURL('/login', { timeout: 10000 });
      await expect(page).toHaveURL('/login');
    });

    test('debe eliminar sesión después del logout', async ({ page, context }) => {
      const testEmail = generateTestEmail();
      const testPassword = 'TestPassword123!';

      // Registrar usuario
      await page.goto('/register');
      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 10000 });

      // Verificar que hay cookies/storage
      const cookiesBefore = await context.cookies();
      expect(cookiesBefore.length).toBeGreaterThan(0);

      // Hacer logout
      await page.waitForSelector('[data-testid="logout-button"]', {
        state: 'visible',
        timeout: 5000,
      });
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL('/login', { timeout: 10000 });

      // Intentar acceder a dashboard
      await page.goto('/dashboard');

      // Debería redirigir a login
      await page.waitForURL('/login', { timeout: 5000 });
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Forgot Password', () => {
    test('debe enviar email de recuperación', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.fill('input[name="email"]', 'existing@example.com');
      await page.click('button[type="submit"]');

      // Verificar que muestra la página de éxito con el mensaje
      await expect(page.locator('text=/check your email|revisa tu correo/i')).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.locator('text=/receive instructions|recibirás instrucciones/i')
      ).toBeVisible({ timeout: 10000 });
    });

    test('debe mostrar mismo mensaje incluso si el email no existe (seguridad)', async ({
      page,
    }) => {
      await page.goto('/forgot-password');

      await page.fill('input[name="email"]', 'nonexistent@example.com');
      await page.click('button[type="submit"]');

      // Por seguridad, debería mostrar el mismo mensaje
      await expect(page.locator('text=/check your email|revisa tu correo/i')).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.locator('text=/receive instructions|recibirás instrucciones/i')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navegación entre páginas de auth', () => {
    test('debe navegar de login a registro', async ({ page }) => {
      await page.goto('/login');

      await page.click('text=/.*registr.*/i');

      await expect(page).toHaveURL('/register');
    });

    test('debe navegar de registro a login', async ({ page }) => {
      await page.goto('/register');

      await page.click('text=/.*iniciar.*sesi.*/i');

      await expect(page).toHaveURL('/login');
    });

    test('debe navegar de login a forgot password', async ({ page }) => {
      await page.goto('/login');

      await page.click('text=/.*olvid.*contrase.*/i');

      await expect(page).toHaveURL('/forgot-password');
    });
  });
});
