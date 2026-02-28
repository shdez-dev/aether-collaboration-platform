import { Request, Response, NextFunction } from 'express';
import {
  checkWorkspaceMembership,
  requireRole,
  requireOwner,
  requireAdmin,
  WorkspaceRequest,
} from '../workspace';
import { workspaceService } from '../../services/WorkspaceService';
import { boardService } from '../../services/BoardService';

// Mock services
jest.mock('../../services/WorkspaceService');
jest.mock('../../services/BoardService');
jest.mock('../../services/ListService');
jest.mock('../../services/CardService');

describe('Workspace Middleware', () => {
  let mockRequest: Partial<WorkspaceRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockRequest = {
      user: { id: 'user-123', email: 'test@example.com' },
      params: {},
      baseUrl: '',
    } as any;

    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('checkWorkspaceMembership', () => {
    it('debe permitir acceso si usuario es miembro', async () => {
      mockRequest.params = { workspaceId: 'workspace-123' };

      (workspaceService.getMembership as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        role: 'MEMBER',
      });

      await checkWorkspaceMembership(
        mockRequest as WorkspaceRequest,
        mockResponse as Response,
        mockNext
      );

      expect(workspaceService.getMembership).toHaveBeenCalledWith('workspace-123', 'user-123');
      expect(mockRequest.workspace).toEqual({
        id: 'workspace-123',
        role: 'MEMBER',
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('debe rechazar si usuario no está autenticado', async () => {
      mockRequest.user = undefined;

      await checkWorkspaceMembership(
        mockRequest as WorkspaceRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe rechazar si usuario no es miembro del workspace', async () => {
      mockRequest.params = { workspaceId: 'workspace-123' };

      (workspaceService.getMembership as jest.Mock).mockResolvedValue(null);

      await checkWorkspaceMembership(
        mockRequest as WorkspaceRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_WORKSPACE_MEMBER',
          message: 'You are not a member of this workspace',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe resolver workspaceId desde boardId', async () => {
      mockRequest = {
        ...mockRequest,
        params: { boardId: 'board-123' },
        baseUrl: '/api',
        path: '/boards/board-123',
      } as any;

      (boardService.getBoardById as jest.Mock).mockResolvedValue({
        id: 'board-123',
        workspaceId: 'workspace-123',
      });

      (workspaceService.getMembership as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        role: 'MEMBER',
      });

      await checkWorkspaceMembership(
        mockRequest as WorkspaceRequest,
        mockResponse as Response,
        mockNext
      );

      expect(boardService.getBoardById).toHaveBeenCalledWith('board-123');
      expect(mockRequest.workspace?.id).toBe('workspace-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('debe manejar errores de servicio', async () => {
      mockRequest.params = { workspaceId: 'workspace-123' };

      (workspaceService.getMembership as jest.Mock).mockRejectedValue(new Error('Database error'));

      await checkWorkspaceMembership(
        mockRequest as WorkspaceRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify workspace membership',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe fallar si no puede resolver workspaceId', async () => {
      // Sin parámetros que permitan resolver workspaceId
      mockRequest.params = {};

      await checkWorkspaceMembership(
        mockRequest as WorkspaceRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_WORKSPACE_ID',
          message: 'Could not resolve workspace from request',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockRequest.workspace = {
        id: 'workspace-123',
        role: 'MEMBER',
      };
    });

    it('debe permitir acceso si usuario tiene rol suficiente', () => {
      const middleware = requireRole('MEMBER');

      middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('debe rechazar si usuario no tiene rol suficiente', () => {
      mockRequest.workspace!.role = 'VIEWER';
      const middleware = requireRole('MEMBER');

      middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'This action requires MEMBER role or higher',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe fallar si workspace no está verificado', () => {
      mockRequest.workspace = undefined;
      const middleware = requireRole('MEMBER');

      middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_VERIFIED',
          message: 'Workspace membership not verified',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    describe('jerarquía de roles', () => {
      it('OWNER debe tener acceso a operaciones de ADMIN', () => {
        mockRequest.workspace!.role = 'OWNER';
        const middleware = requireRole('ADMIN');

        middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('ADMIN debe tener acceso a operaciones de MEMBER', () => {
        mockRequest.workspace!.role = 'ADMIN';
        const middleware = requireRole('MEMBER');

        middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('MEMBER debe tener acceso a operaciones de VIEWER', () => {
        mockRequest.workspace!.role = 'MEMBER';
        const middleware = requireRole('VIEWER');

        middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('VIEWER no debe tener acceso a operaciones de MEMBER', () => {
        mockRequest.workspace!.role = 'VIEWER';
        const middleware = requireRole('MEMBER');

        middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

        expect(mockStatus).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('MEMBER no debe tener acceso a operaciones de ADMIN', () => {
        mockRequest.workspace!.role = 'MEMBER';
        const middleware = requireRole('ADMIN');

        middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

        expect(mockStatus).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('ADMIN no debe tener acceso a operaciones de OWNER', () => {
        mockRequest.workspace!.role = 'ADMIN';
        const middleware = requireRole('OWNER');

        middleware(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

        expect(mockStatus).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('requireOwner', () => {
    it('debe permitir acceso solo a OWNER', () => {
      mockRequest.workspace = {
        id: 'workspace-123',
        role: 'OWNER',
      };

      requireOwner(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('debe rechazar a ADMIN', () => {
      mockRequest.workspace = {
        id: 'workspace-123',
        role: 'ADMIN',
      };

      requireOwner(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('debe permitir acceso a ADMIN', () => {
      mockRequest.workspace = {
        id: 'workspace-123',
        role: 'ADMIN',
      };

      requireAdmin(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('debe permitir acceso a OWNER', () => {
      mockRequest.workspace = {
        id: 'workspace-123',
        role: 'OWNER',
      };

      requireAdmin(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('debe rechazar a MEMBER', () => {
      mockRequest.workspace = {
        id: 'workspace-123',
        role: 'MEMBER',
      };

      requireAdmin(mockRequest as WorkspaceRequest, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
