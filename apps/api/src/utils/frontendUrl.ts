const DEFAULT_FRONTEND_URL = 'https://aether-web.up.railway.app';

/** Build frontend links consistently, even when FRONTEND_URL has a trailing slash. */
export function buildFrontendUrl(path: string, query?: Record<string, string>): string {
  const configuredBase = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  const base = configuredBase.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  const url = new URL(normalizedPath, `${base}/`);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
