import { test, expect } from '@playwright/test';
import {
  createPlatformInvitation,
  generateTestEmail,
  readTestRegistration,
  registerAndLogin,
  login,
} from '../utils/test-helpers';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

test.describe('Acceso al piloto', () => {
  test('bloquea el registro abierto desde la ruta y la API', async ({ page }) => {
    await page.goto('/register');

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole('link', { name: /crear cuenta/i })).toHaveCount(0);

    const response = await page.request.post(`${apiUrl}/api/auth/register`, {
      data: { name: 'E2E User', email: generateTestEmail(), password: 'TestPassword123!' },
    });
    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'REGISTRATION_CLOSED' },
    });
  });

  test('activa una invitación, guarda los dos consentimientos y consume el enlace', async ({ page }) => {
    const email = generateTestEmail();
    const token = await createPlatformInvitation(email);

    await page.goto(`/join?token=${token}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Tu invitación a AETHER' })).toBeVisible();
    await expect(page.getByText(email, { exact: false })).toBeVisible();

    await page.locator('input[autocomplete="name"]').fill('E2E Participant');
    const passwords = page.locator('input[autocomplete="new-password"]');
    await passwords.nth(0).fill('TestPassword123!');
    await passwords.nth(1).fill('TestPassword123!');

    const submit = page.getByRole('button', { name: 'Activar mi cuenta' });
    await expect(submit).toBeDisabled();
    await page.locator('#join-terms-read').check();
    await expect(submit).toBeDisabled();
    await page.locator('#join-privacy-read').check();
    await expect(submit).toBeEnabled();

    await Promise.all([
      page.waitForURL(/\/dashboard(?:\/|$|\?)/, { timeout: 25000 }),
      submit.click(),
    ]);

    const registration = await readTestRegistration(email);
    expect(registration?.terms_read_at).toBeTruthy();
    expect(registration?.privacy_read_at).toBeTruthy();
    expect(registration?.accepted_at).toBeTruthy();
    expect(registration?.accepted_by).toBeTruthy();

    const invitationPreview = await page.request.get(`${apiUrl}/api/auth/invitations/${token}`);
    expect(invitationPreview.status()).toBe(404);
  });

  test('no activa una invitación inexistente, vencida o consumida', async ({ page }) => {
    await page.goto(`/join?token=${'a'.repeat(64)}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('p[role="alert"]')).toContainText(
      'La invitación no existe, venció o fue cancelada.'
    );
    await expect(page.getByRole('button', { name: 'Activar mi cuenta' })).toHaveCount(0);
  });

  test('valida que las contraseñas coincidan antes de activar la cuenta', async ({ page }) => {
    const email = generateTestEmail();
    const token = await createPlatformInvitation(email);
    await page.goto(`/join?token=${token}`, { waitUntil: 'domcontentloaded' });

    await page.locator('input[autocomplete="name"]').fill('E2E Participant');
    const passwords = page.locator('input[autocomplete="new-password"]');
    await passwords.nth(0).fill('TestPassword123!');
    await passwords.nth(1).fill('DifferentPassword123!');
    await page.locator('#join-terms-read').check();
    await page.locator('#join-privacy-read').check();
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText('Las contraseñas no coinciden');
    await expect(page).toHaveURL(new RegExp(`/join\\?token=${token}`));
  });
});

test.describe('Inicio de sesión y recuperación', () => {
  test('inicia sesión con una cuenta activada por invitación y cierra la sesión', async ({ page }) => {
    const account = {
      email: generateTestEmail(),
      password: 'TestPassword123!',
      name: 'E2E User',
    };
    await registerAndLogin(page, account);
    await expect(page).toHaveURL(/\/dashboard(?:\/|$|\?)/);

    await page.goto('/dashboard/profile');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 10000 });

    await login(page, account.email, account.password);
    await expect(page).toHaveURL(/\/dashboard(?:\/|$|\?)/);

    await page.goto('/dashboard/profile');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 10000 });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  test('muestra un error con credenciales incorrectas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'nonexistent@example.test');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Email o contraseña incorrectos', { exact: true })).toBeVisible();
  });

  test('permite solicitar recuperación sin revelar si el correo tiene una cuenta', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('input[name="email"]', generateTestEmail());
    await page.getByRole('button', { name: 'Enviar Instrucciones' }).click();

    await expect(page.getByRole('heading', { name: 'Revisa tu email' })).toBeVisible();
    await expect(
      page.getByText('Si existe una cuenta con este email, recibirás instrucciones para restablecer tu contraseña.')
    ).toBeVisible();
  });

  test('navega desde el inicio de sesión a recuperar contraseña', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /olvidaste tu contraseña/i }).click();
    await expect(page).toHaveURL('/forgot-password');
  });
});
