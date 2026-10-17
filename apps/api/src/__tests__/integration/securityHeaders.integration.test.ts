import express from 'express';
import request from 'supertest';
import { createSecurityHeaders } from '../../middleware/securityHeaders';

describe('API security headers integration', () => {
  it('serves a restrictive CSP and production transport headers', async () => {
    const app = express();
    app.use(
      createSecurityHeaders({
        frontendUrl: 'https://app.example.test',
        production: true,
      })
    );
    app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

    const response = await request(app).get('/health').expect(200);
    const policy = response.headers['content-security-policy'] as string;

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('upgrade-insecure-requests');
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not request HTTPS upgrades in development', async () => {
    const app = express();
    app.use(
      createSecurityHeaders({
        frontendUrl: 'http://localhost:3001',
        production: false,
      })
    );
    app.get('/health', (_req, res) => res.sendStatus(200));

    const response = await request(app).get('/health').expect(200);

    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
});
