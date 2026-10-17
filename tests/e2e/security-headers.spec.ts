import { expect, test } from '@playwright/test';

function getScriptNonce(policy: string): string {
  const scriptDirective = policy.split(';').find((directive) => directive.trim().startsWith('script-src '));
  const nonce = scriptDirective?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce, 'CSP should contain a per-response script nonce').toBeTruthy();
  return nonce!;
}

test('serves a nonce-based CSP and nonced Next.js inline scripts', async ({ page }) => {
  const response = await page.goto('/login');
  expect(response).not.toBeNull();

  const policy = response!.headers()['content-security-policy'];
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("script-src-attr 'none'");
  expect(policy).not.toContain("'unsafe-eval'");

  const nonce = getScriptNonce(policy);
  const inlineScriptNonces = await page.locator('script:not([src])').evaluateAll((scripts) =>
    scripts.map((script) => script.getAttribute('nonce'))
  );
  expect(inlineScriptNonces.length).toBeGreaterThan(0);
  expect(inlineScriptNonces.every((scriptNonce) => scriptNonce === nonce)).toBe(true);
});

test('issues a fresh CSP nonce for every document response', async ({ page }) => {
  const firstResponse = await page.goto('/login?nonce-check=first');
  const secondResponse = await page.goto('/login?nonce-check=second');

  expect(firstResponse).not.toBeNull();
  expect(secondResponse).not.toBeNull();

  const firstNonce = getScriptNonce(firstResponse!.headers()['content-security-policy']);
  const secondNonce = getScriptNonce(secondResponse!.headers()['content-security-policy']);
  expect(secondNonce).not.toBe(firstNonce);
});
