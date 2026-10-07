/**
 * Builds the TLS options for PostgreSQL connections.
 *
 * Local/self-hosted databases can explicitly opt out with `sslmode=disable`;
 * production-managed databases keep the existing TLS-by-default behavior.
 */
export function getDatabaseSslConfig(
  connectionString = process.env.DATABASE_URL || '',
  isProduction = process.env.NODE_ENV === 'production'
): object | undefined {
  const sslMode = /(?:[?&])sslmode=([^&]+)/i.exec(connectionString)?.[1]?.toLowerCase();
  if (sslMode === 'disable') return undefined;

  const needsSsl = isProduction || sslMode === 'require';
  if (!needsSsl) return undefined;

  // Si se provee el certificado CA del proveedor (PEM en DB_CA_CERT, o ruta en
  // DB_CA_CERT_PATH), se verifica la cadena TLS de forma estricta — esto evita
  // ataques MITM sobre la conexión a la base de datos.
  const caPem = process.env.DB_CA_CERT;
  const caPath = process.env.DB_CA_CERT_PATH;
  let ca: string | undefined = caPem;
  if (!ca && caPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ca = require('fs').readFileSync(caPath, 'utf-8');
    } catch {
      ca = undefined;
    }
  }

  if (ca) {
    return { ca, rejectUnauthorized: true };
  }

  // Permite forzar verificación estricta aun sin CA explícito (CA del sistema).
  if (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true') {
    return { rejectUnauthorized: true };
  }

  // Fallback compatible con Postgres gestionado (Render/Railway) que usa
  // certificados autofirmados. Define DB_CA_CERT para endurecer la verificación.
  return { rejectUnauthorized: false };
}
