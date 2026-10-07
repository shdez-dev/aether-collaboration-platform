import { getDatabaseSslConfig } from './databaseSsl';

describe('getDatabaseSslConfig', () => {
  it('honors sslmode=disable for a self-hosted production database', () => {
    expect(
      getDatabaseSslConfig('postgresql://aether:secret@postgres:5432/aether?sslmode=disable', true)
    ).toBeUndefined();
  });

  it('keeps TLS enabled by default for production-managed databases', () => {
    expect(getDatabaseSslConfig('postgresql://aether:secret@db.example.com:5432/aether', true)).toEqual({
      rejectUnauthorized: false,
    });
  });
});
