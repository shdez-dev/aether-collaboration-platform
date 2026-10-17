export interface ContentSecurityPolicyOptions {
  nonce: string;
  apiUrl?: string;
  websocketUrl?: string;
  production: boolean;
}

const protocolPairs: Record<string, string> = {
  'http:': 'ws:',
  'https:': 'wss:',
  'ws:': 'http:',
  'wss:': 'https:',
};

function isLoopbackHostname(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname.toLowerCase());
}

function getConnectSources(urls: Array<string | undefined>, production: boolean): string[] {
  const sources = new Set<string>();

  for (const value of urls) {
    if (!value) continue;

    try {
      const url = new URL(value);
      const pairedProtocol = protocolPairs[url.protocol];
      if (!pairedProtocol) continue;
      if (production && ['http:', 'ws:'].includes(url.protocol) && !isLoopbackHostname(url.hostname)) {
        continue;
      }

      sources.add(url.origin);
      url.protocol = pairedProtocol;
      sources.add(url.origin);
    } catch {
      // Ignore malformed or unsupported URLs instead of widening connect-src.
    }
  }

  return [...sources];
}

export function buildContentSecurityPolicy({
  nonce,
  apiUrl,
  websocketUrl,
  production,
}: ContentSecurityPolicyOptions): string {
  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['object-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['frame-src', ["'none'"]],
    ['form-action', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        ...(!production ? ["'unsafe-eval'"] : []),
      ],
    ],
    ['script-src-attr', ["'none'"]],
    // React components use style attributes; script execution remains nonce-only.
    ['style-src', ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']],
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['font-src', ["'self'", 'data:', 'https://fonts.gstatic.com']],
    ['connect-src', ["'self'", ...getConnectSources([apiUrl, websocketUrl], production)]],
    ['media-src', ["'self'", 'blob:', 'https:']],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
  ];

  return directives
    .map(([name, sources]) => (sources.length > 0 ? `${name} ${sources.join(' ')}` : name))
    .join('; ');
}
