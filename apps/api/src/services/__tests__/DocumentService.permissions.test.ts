import { pool } from '../../lib/db';
import { documentService } from '../DocumentService';
import { projectAuthorizationService } from '../ProjectAuthorizationService';

jest.mock('../../lib/db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../ProjectAuthorizationService', () => ({
  projectAuthorizationService: { can: jest.fn() },
}));
jest.mock('../EventStoreService', () => ({ eventStore: { emit: jest.fn() } }));

const projectId = 'project-1';
const memberId = 'member-1';

describe('permisos de documentos ligados a proyectos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no permite que un permiso EDIT supere el acceso de solo lectura del proyecto', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{
      created_by: 'creator-1',
      workspace_role: 'MEMBER',
      explicit_permission: 'EDIT',
      external_permission: null,
      project_id: projectId,
    }] });
    (projectAuthorizationService.can as jest.Mock).mockResolvedValueOnce({ level: 'READ', permissions: { 'documents.manage': false } });

    await expect(documentService.getEffectiveUserPermission('document-1', memberId)).resolves.toBe('VIEW');
  });

  it('conserva el permiso de comentar para una persona con lectura del proyecto', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{
      created_by: 'creator-1',
      workspace_role: 'MEMBER',
      explicit_permission: 'COMMENT',
      external_permission: null,
      project_id: projectId,
    }] });
    (projectAuthorizationService.can as jest.Mock).mockResolvedValueOnce({ level: 'READ', permissions: { 'documents.manage': false } });

    await expect(documentService.getEffectiveUserPermission('document-1', memberId)).resolves.toBe('COMMENT');
  });

  it('mantiene solo lectura para quien colabora si su rol no permite administrar documentos', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{
      created_by: 'creator-1',
      workspace_role: 'MEMBER',
      explicit_permission: null,
      external_permission: null,
      project_id: projectId,
    }] });
    (projectAuthorizationService.can as jest.Mock).mockResolvedValueOnce({ level: 'CONTRIBUTE', permissions: { 'documents.manage': false } });

    await expect(documentService.getEffectiveUserPermission('document-1', memberId)).resolves.toBe('VIEW');
  });

  it('rechaza asignar edición a alguien que solo puede leer el proyecto', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{
      created_by: 'creator-1',
      project_id: projectId,
      workspace_role: 'MEMBER',
    }] });
    (projectAuthorizationService.can as jest.Mock).mockResolvedValueOnce({ level: 'READ' });

    await expect(documentService.getPermissionAssignmentError('document-1', memberId, 'EDIT'))
      .resolves.toBe('Para editar este documento, la persona necesita acceso de colaboración al proyecto.');
  });

  it('permite asignar comentarios a una persona con acceso de lectura', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{
      created_by: 'creator-1',
      project_id: projectId,
      workspace_role: 'MEMBER',
    }] });
    (projectAuthorizationService.can as jest.Mock).mockResolvedValueOnce({ level: 'READ' });

    await expect(documentService.getPermissionAssignmentError('document-1', memberId, 'COMMENT'))
      .resolves.toBeNull();
  });

  it('rechaza asignar permisos a una persona que no tiene acceso al proyecto', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{
      created_by: 'creator-1',
      project_id: projectId,
      workspace_role: 'MEMBER',
    }] });
    (projectAuthorizationService.can as jest.Mock).mockResolvedValueOnce(null);

    await expect(documentService.getPermissionAssignmentError('document-1', memberId, 'COMMENT'))
      .resolves.toBe('La persona no tiene acceso a este proyecto.');
  });

  it('acepta asignar comentarios y filtra del selector a quienes no tienen acceso al proyecto', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [
      { user_id: 'reader-1', name: 'Lector', email: 'read@example.com', workspace_role: 'MEMBER', document_permission: 'EDIT', created_by: 'creator-1', project_id: projectId },
      { user_id: 'contributor-1', name: 'Colaborador', email: 'edit@example.com', workspace_role: 'MEMBER', document_permission: null, created_by: 'creator-1', project_id: projectId },
      { user_id: 'outsider-1', name: 'Sin acceso', email: 'out@example.com', workspace_role: 'MEMBER', document_permission: null, created_by: 'creator-1', project_id: projectId },
    ] });
    (projectAuthorizationService.can as jest.Mock)
      .mockResolvedValueOnce({ level: 'READ' })
      .mockResolvedValueOnce({ level: 'CONTRIBUTE' })
      .mockResolvedValueOnce(null);

    const members = await documentService.getWorkspaceMembersWithPermissions('document-1');

    expect(members.map(({ userId, effectivePermission, projectAccessLevel }) => ({ userId, effectivePermission, projectAccessLevel })))
      .toEqual([
        { userId: 'reader-1', effectivePermission: 'VIEW', projectAccessLevel: 'READ' },
        { userId: 'contributor-1', effectivePermission: 'EDIT', projectAccessLevel: 'CONTRIBUTE' },
      ]);
  });
});
