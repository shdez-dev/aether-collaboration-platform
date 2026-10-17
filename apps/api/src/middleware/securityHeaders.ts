import helmet from 'helmet';

export interface SecurityHeaderOptions {
  frontendUrl: string;
  production: boolean;
}

export function createSecurityHeaders({ frontendUrl, production }: SecurityHeaderOptions) {
  return helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: [
          "'self'",
          frontendUrl,
          frontendUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:'),
        ],
        fontSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
  });
}
