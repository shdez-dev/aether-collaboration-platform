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
  const inlineScripts = await page.locator('script:not([src])').evaluateAll((scripts) =>
    scripts.map((script) => ({
      // Browsers deliberately hide CSP nonces from getAttribute(); use the
      // HTMLScriptElement.nonce property to inspect the protected value.
      nonce: script.nonce,
      type: script.getAttribute('type')?.toLowerCase() ?? '',
      preview: script.textContent?.trim().slice(0, 80) ?? '',
    }))
  );
  const executableScripts = inlineScripts.filter(({ type }) =>
    !type || type === 'module' || /^(text|application)\/(javascript|ecmascript)$/.test(type)
  );
  expect(executableScripts.length).toBeGreaterThan(0);
  const missingNonce = executableScripts.filter((script) => script.nonce !== nonce);
  expect(missingNonce, `Executable inline scripts missing the response nonce: ${JSON.stringify(missingNonce)}`).toEqual([]);
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
