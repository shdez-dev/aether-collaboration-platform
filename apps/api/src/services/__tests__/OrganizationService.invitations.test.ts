import crypto from 'crypto';
import { pool } from '../../lib/db';
import { emailService } from '../EmailService';
import { organizationService } from '../OrganizationService';

jest.mock('../../lib/db', () => ({ pool: { connect: jest.fn(), query: jest.fn() } }));
jest.mock('../EmailService', () => ({ emailService: { sendEmail: jest.fn() } }));

const expiresAt = new Date('2026-10-16T12:00:00.000Z');
const client = { query: jest.fn(), release: jest.fn() };

describe('códigos de invitación a organización', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (pool.connect as jest.Mock).mockResolvedValue(client);
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT name, type FROM organizations')) return { rows: [{ name: 'Acme', type: 'COMPANY' }] };
      if (sql.includes('SELECT role FROM organization_members')) return { rows: [{ role: 'OWNER' }] };
      if (sql.includes('SELECT 1 FROM organization_members')) return { rows: [] };
      if (sql.includes('SELECT name FROM users')) return { rows: [{ name: 'Alice' }] };
      if (sql.includes('INSERT INTO organization_invitations')) return { rows: [{ expires_at: expiresAt }] };
      if (sql.includes('SELECT email, role FROM organization_invitations')) return { rows: [{ email: 'bob@example.com', role: 'MEMBER' }] };
      if (sql.includes('UPDATE organization_invitations SET token_hash')) return { rows: [{ expires_at: expiresAt }] };
      return { rows: [] };
    });
  });

  it('genera un código de un solo uso y comunica un fallo de correo sin perderlo', async () => {
    (emailService.sendEmail as jest.Mock).mockRejectedValue(new Error('SMTP unavailable'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await organizationService.inviteMember('org-1', 'alice-1', { email: ' BOB@example.com ', role: 'MEMBER' });
      expect(result.code).toMatch(/^[0-9a-f]{64}$/);
      expect(result.email).toBe('bob@example.com');
      expect(result.emailStatus).toBe('failed');
      expect(result.link).toContain(result.code);
      const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO organization_invitations'));
      expect(insert[1][3]).toBe(crypto.createHash('sha256').update(result.code).digest('hex'));
      expect(insert[1]).not.toContain(result.code);
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    } finally { log.mockRestore(); }
  });

  it('regenera el código sin enviar correo y guarda solo su hash', async () => {
    const result = await organizationService.regenerateInvitationCode('org-1', 'inv-1', 'alice-1');
    expect(result.code).toMatch(/^[0-9a-f]{64}$/);
    expect(result.emailStatus).toBe('not_sent');
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    const update = client.query.mock.calls.find(([sql]) => sql.includes('UPDATE organization_invitations SET token_hash'));
    expect(update[1][1]).toBe(crypto.createHash('sha256').update(result.code).digest('hex'));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('impide que un miembro sin permiso regenere el código', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM organization_members')) return { rows: [{ role: 'MEMBER' }] };
      if (sql.includes('SELECT email, role FROM organization_invitations')) return { rows: [{ email: 'bob@example.com', role: 'MEMBER' }] };
      return { rows: [] };
    });
    await expect(organizationService.regenerateInvitationCode('org-1', 'inv-1', 'member-1'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => sql.includes('UPDATE organization_invitations SET token_hash'))).toBe(false);
  });
});

describe('eliminación de organización', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (pool.connect as jest.Mock).mockResolvedValue(client);
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organizations o')) return { rows: [{ name: 'Acme', type: 'COMPANY', owner_user_id: 'owner-1', role: 'OWNER' }] };
      if (sql.includes('SELECT COUNT(*)::int AS workspace_count')) return { rows: [{ workspace_count: 0 }] };
      return { rows: [] };
    });
  });

  it('elimina con transacción solo cuando el propietario confirma el nombre y no hay espacios', async () => {
    await organizationService.deleteOrganization('org-1', 'owner-1', 'Acme');

    expect(client.query).toHaveBeenCalledWith('DELETE FROM organizations WHERE id = $1', ['org-1']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('rechaza el nombre incorrecto antes de consultar o borrar espacios', async () => {
    await expect(organizationService.deleteOrganization('org-1', 'owner-1', 'acme'))
      .rejects.toMatchObject({ code: 'ORGANIZATION_NAME_MISMATCH', status: 400 });

    expect(client.query.mock.calls.some(([sql]) => sql.includes('workspace_count'))).toBe(false);
    expect(client.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM organizations'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('impide eliminar si todavía existe algún espacio de trabajo', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organizations o')) return { rows: [{ name: 'Acme', type: 'COMPANY', owner_user_id: 'owner-1', role: 'OWNER' }] };
      if (sql.includes('SELECT COUNT(*)::int AS workspace_count')) return { rows: [{ workspace_count: 2 }] };
      return { rows: [] };
    });

    await expect(organizationService.deleteOrganization('org-1', 'owner-1', 'Acme'))
      .rejects.toMatchObject({ code: 'WORKSPACES_EXIST', status: 409 });

    expect(client.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM organizations'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('reserva el borrado para el propietario', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organizations o')) return { rows: [{ name: 'Acme', type: 'COMPANY', owner_user_id: 'owner-1', role: 'ADMIN' }] };
      return { rows: [] };
    });

    await expect(organizationService.deleteOrganization('org-1', 'admin-1', 'Acme'))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(client.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM organizations'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
