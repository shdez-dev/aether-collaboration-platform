import { Request, Response } from 'express';
import { pool } from '../../lib/db';
import { teamController } from '../TeamController';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({ notificationService: { createTeamInviteNotification: jest.fn().mockResolvedValue(undefined) } }));

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }) as unknown as Response;

describe('invitaciones a equipos', () => {
  const query = pool.query as jest.Mock;
  const connect = pool.connect as jest.Mock;

  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
  });

  it('permite invitar a un miembro de la organización aunque aún no pertenezca al espacio', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'invitee' }] }) // usuario por correo
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // acceso de organización
      .mockResolvedValueOnce({ rows: [] }) // miembro existente
      .mockResolvedValueOnce({ rows: [] }) // invitación existente
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // cupo del equipo
      .mockResolvedValueOnce({ rows: [{ id: 'invitation' }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Equipo' }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Responsable' }] });

    const req = {
      user: { id: 'manager' }, params: { id: 'team' },
      body: { email: 'PERSONA@example.com', role: 'MEMBER' },
      teamContext: { canManage: true, isCreator: true, workspaceRole: 'OWNER' },
    } as unknown as Request;
    const res = response();

    await teamController.addMember(req, res);

    expect(query.mock.calls[0][0]).toContain('LOWER(email) = LOWER($1)');
    expect(query.mock.calls[1][0]).toContain('organization_members');
    expect(query.mock.calls[1][0]).toContain('organization_access_revocations');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('muestra invitaciones pendientes a miembros de la organización sin acceso previo al espacio', async () => {
    query.mockResolvedValue({ rows: [{ id: 'invitation', role: 'MEMBER', team_id: 'team', team_name: 'Equipo' }] });
    const req = { user: { id: 'invitee' } } as unknown as Request;
    const res = response();

    await teamController.getPendingTeamInvitations(req, res);

    expect(query.mock.calls[0][0]).toContain('FROM organization_members om');
    expect(query.mock.calls[0][0]).toContain('organization_access_revocations');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ invitations: [expect.objectContaining({ id: 'invitation' })] }),
    }));
  });

  it('al aceptar incorpora al espacio y al equipo en la misma transacción', async () => {
    const transactionQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ team_id: 'team', role: 'MEMBER' }] })
      .mockResolvedValueOnce({ rows: [{ workspace_id: 'workspace', organization_id: 'org', archived: false }] })
      .mockResolvedValueOnce({ rows: [] }) // revocación
      .mockResolvedValueOnce({ rows: [{ id: 'workspace' }] }) // bloqueo
      .mockResolvedValueOnce({ rows: [] }) // aún no pertenece al espacio
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // organización
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // cupo del espacio
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // cupo del equipo
      .mockResolvedValue({ rows: [] });
    connect.mockResolvedValue({ query: transactionQuery, release: jest.fn() });
    const req = { user: { id: 'invitee' }, params: { invitationId: 'invitation' } } as unknown as Request;
    const res = response();

    await teamController.acceptTeamInvitation(req, res);

    const sql = transactionQuery.mock.calls.map(([statement]) => String(statement));
    expect(sql.findIndex((statement) => statement.includes('INSERT INTO workspace_members'))).toBeLessThan(
      sql.findIndex((statement) => statement.includes('INSERT INTO team_members'))
    );
    expect(sql).toContain('COMMIT');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { message: 'Invitación aceptada' } });
  });

  it('no concede acceso al espacio si la persona no pertenece a la organización', async () => {
    const transactionQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ team_id: 'team', role: 'MEMBER' }] })
      .mockResolvedValueOnce({ rows: [{ workspace_id: 'workspace', organization_id: 'org', archived: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'workspace' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });
    connect.mockResolvedValue({ query: transactionQuery, release: jest.fn() });
    const req = { user: { id: 'invitee' }, params: { invitationId: 'invitation' } } as unknown as Request;
    const res = response();

    await teamController.acceptTeamInvitation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(transactionQuery.mock.calls.some(([statement]) => String(statement).includes('INSERT INTO workspace_members'))).toBe(false);
    expect(transactionQuery.mock.calls.map(([statement]) => statement)).toContain('ROLLBACK');
  });
});
