import { buildContentSecurityPolicy } from './contentSecurityPolicy';

describe('buildContentSecurityPolicy', () => {
  it('requires a per-response nonce for scripts and blocks inline script attributes', () => {
    const policy = buildContentSecurityPolicy({
      nonce: 'test-nonce',
      apiUrl: 'https://api.example.test',
      websocketUrl: 'wss://realtime.example.test',
      production: true,
    });

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });

  it('allows only configured API and websocket origins for connections', () => {
    const policy = buildContentSecurityPolicy({
      nonce: 'test-nonce',
      apiUrl: 'https://api.example.test/v1',
      websocketUrl: 'wss://realtime.example.test/socket',
      production: false,
    });

    expect(policy).toContain(
      "connect-src 'self' https://api.example.test wss://api.example.test wss://realtime.example.test https://realtime.example.test"
    );
    expect(policy).not.toContain('https://unconfigured.example.test');
  });

  it('ignores malformed or unsupported connection origins', () => {
    const policy = buildContentSecurityPolicy({
      nonce: 'test-nonce',
      apiUrl: 'javascript:alert(1)',
      websocketUrl: 'not a URL',
      production: false,
    });

    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain('javascript:');
    expect(policy).not.toContain('not a URL');
  });

  it('allows eval only for the local development toolchain', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'test-nonce', production: false });

    expect(policy).toContain("'unsafe-eval'");
  });

  it('rejects insecure remote API origins in production but keeps local E2E endpoints', () => {
    const remotePolicy = buildContentSecurityPolicy({
      nonce: 'test-nonce',
      apiUrl: 'http://api.example.test',
      websocketUrl: 'ws://realtime.example.test',
      production: true,
    });
    const localPolicy = buildContentSecurityPolicy({
      nonce: 'test-nonce',
      apiUrl: 'http://localhost:3000',
      websocketUrl: 'ws://localhost:3000',
      production: true,
    });

    expect(remotePolicy).toContain("connect-src 'self'");
    expect(remotePolicy).not.toContain('http://api.example.test');
    expect(remotePolicy).not.toContain('ws://realtime.example.test');
    expect(localPolicy).toContain("connect-src 'self' http://localhost:3000 ws://localhost:3000");
  });
});
