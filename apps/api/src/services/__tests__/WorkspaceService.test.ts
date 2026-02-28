// apps/api/src/services/__tests__/WorkspaceService.test.ts

import { WorkspaceService } from '../WorkspaceService';
import { pool } from '../../lib/db';
import { eventStore } from '../EventStoreService';

jest.mock('../../lib/db');
jest.mock('../EventStoreService');
jest.mock('../EmailService');

describe('WorkspaceService', () => {
  let workspaceService: WorkspaceService;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    workspaceService = new WorkspaceService();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock) = jest.fn().mockResolvedValue(mockClient);
    (pool.query as jest.Mock) = jest.fn();
    (eventStore.emit as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  describe('createWorkspace', () => {
    it('should create workspace with owner membership', async () => {
      const userId = 'user-123';
      const workspaceData = {
        name: 'My Workspace',
        description: 'Test workspace',
        color: '#ff0000',
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // INSERT workspace
          rows: [
            {
              id: 'ws-new',
              name: workspaceData.name,
              description: workspaceData.description,
              owner_id: userId,
              color: workspaceData.color,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}) // INSERT workspace_member
        .mockResolvedValueOnce({}); // COMMIT

      const result = await workspaceService.createWorkspace(userId, workspaceData);

      expect(result.name).toBe(workspaceData.name);
      expect(result.userRole).toBe('OWNER');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workspace_members'),
        ['ws-new', userId, 'OWNER']
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'workspace.created',
        expect.objectContaining({
          workspaceId: 'ws-new',
          name: workspaceData.name,
        }),
        userId
      );
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(
        workspaceService.createWorkspace('user-1', { name: 'Workspace' })
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getUserWorkspaces', () => {
    it('should return user workspaces with role and counts', async () => {
      const userId = 'user-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'ws-1',
            name: 'Workspace 1',
            user_role: 'OWNER',
            board_count: '5',
            member_count: '3',
            archived: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'ws-2',
            name: 'Workspace 2',
            user_role: 'MEMBER',
            board_count: '2',
            member_count: '5',
            archived: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await workspaceService.getUserWorkspaces(userId);

      expect(result).toHaveLength(2);
      expect(result[0].userRole).toBe('OWNER');
      expect(result[0].boardCount).toBe(5);
      expect(result[1].userRole).toBe('MEMBER');
      expect(result[1].boardCount).toBe(2);
    });

    it('should exclude archived workspaces by default', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await workspaceService.getUserWorkspaces('user-1');

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('w.archived = false'), [
        'user-1',
        false,
      ]);
    });
  });

  describe('getMembership', () => {
    it('should return user membership', async () => {
      const workspaceId = 'ws-123';
      const userId = 'user-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            workspace_id: workspaceId,
            user_id: userId,
            role: 'ADMIN',
            joined_at: new Date(),
          },
        ],
      });

      const result = await workspaceService.getMembership(workspaceId, userId);

      expect(result).not.toBeNull();
      expect(result?.role).toBe('ADMIN');
    });

    it('should return null if not a member', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await workspaceService.getMembership('ws-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('changeMemberRole', () => {
    it('should change member role successfully', async () => {
      const workspaceId = 'ws-123';
      const memberId = 'user-member';
      const newRole = 'ADMIN';
      const updatedBy = 'user-owner';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // UPDATE
          rows: [
            {
              workspace_id: workspaceId,
              user_id: memberId,
              role: newRole,
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      await workspaceService.changeMemberRole(workspaceId, memberId, newRole, updatedBy);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'workspace.member.roleChanged',
        expect.objectContaining({
          workspaceId,
          userId: memberId,
          newRole,
        }),
        updatedBy
      );
    });

    it('should throw error if member not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE returns 0 rows

      await expect(
        workspaceService.changeMemberRole('ws-1', 'user-1', 'ADMIN', 'owner-1')
      ).rejects.toThrow('Member not found');
    });
  });

  describe('removeMember', () => {
    it('should remove member from workspace', async () => {
      const workspaceId = 'ws-123';
      const memberId = 'user-member';
      const removedBy = 'user-owner';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // DELETE
          rows: [
            {
              workspace_id: workspaceId,
              user_id: memberId,
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      await workspaceService.removeMember(workspaceId, memberId, removedBy);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM workspace_members'),
        [workspaceId, memberId]
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'workspace.member.removed',
        expect.objectContaining({
          workspaceId,
          userId: memberId,
        }),
        removedBy
      );
    });

    it('should prevent removing the last owner', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // DELETE returns 0 rows

      await expect(
        workspaceService.removeMember('ws-1', 'last-owner', 'admin-1')
      ).rejects.toThrow();
    });
  });
});
