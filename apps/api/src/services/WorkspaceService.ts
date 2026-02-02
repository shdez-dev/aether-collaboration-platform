// apps/api/src/services/WorkspaceService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import type {
  Workspace,
  WorkspaceMembership,
  WorkspaceRole,
  WorkspaceCreatedPayload,
  WorkspaceUpdatedPayload,
  WorkspaceMemberInvitedPayload,
  WorkspaceMemberRoleChangedPayload,
  WorkspaceMemberRemovedPayload,
} from '@aether/types';

export class WorkspaceService {
  /**
   * Crear un nuevo workspace
   */
  async createWorkspace(
    userId: string,
    data: {
      name: string;
      description?: string;
      icon?: string;
      color?: string;
    }
  ): Promise<Workspace & { userRole: WorkspaceRole }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Crear el workspace
      const workspaceResult = await client.query(
        `INSERT INTO workspaces (name, description, owner_id, icon, color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.name, data.description || null, userId, data.icon || null, data.color || null]
      );

      const workspace = workspaceResult.rows[0];

      // 2. Agregar al creador como miembro con rol OWNER
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [workspace.id, userId, 'OWNER']
      );

      await client.query('COMMIT');

      const payload: WorkspaceCreatedPayload = {
        workspaceId: workspace.id as any,
        name: workspace.name,
        description: workspace.description,
        ownerId: userId as any,
        icon: workspace.icon,
        color: workspace.color,
      };

      await eventStore.emit('workspace.created', payload, userId as any);

      return {
        ...this.formatWorkspace(workspace),
        userRole: 'OWNER',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener todos los workspaces donde el usuario es miembro
   */
  async getUserWorkspaces(
    userId: string
  ): Promise<
    (Workspace & { userRole: WorkspaceRole; boardCount?: number; memberCount?: number })[]
  > {
    const result = await pool.query(
      `SELECT 
        w.*,
        wm.role as user_role,
        COUNT(DISTINCT b.id) as board_count,
        COUNT(DISTINCT wm2.user_id) as member_count
       FROM workspaces w
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       LEFT JOIN boards b ON w.id = b.workspace_id AND b.archived = false
       LEFT JOIN workspace_members wm2 ON w.id = wm2.workspace_id
       WHERE wm.user_id = $1
       GROUP BY w.id, wm.role
       ORDER BY w.updated_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      ...this.formatWorkspace(row),
      userRole: row.user_role as WorkspaceRole,
      boardCount: parseInt(row.board_count),
      memberCount: parseInt(row.member_count),
    }));
  }

  /**
   * Obtener un workspace específico con detalles
   */
  async getWorkspaceById(
    workspaceId: string,
    userId: string
  ): Promise<
    (Workspace & { userRole?: WorkspaceRole; boardCount?: number; memberCount?: number }) | null
  > {
    const result = await pool.query(
      `SELECT 
        w.*,
        wm.role as user_role,
        COUNT(DISTINCT b.id) as board_count,
        COUNT(DISTINCT wm2.user_id) as member_count
       FROM workspaces w
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       LEFT JOIN boards b ON w.id = b.workspace_id AND b.archived = false
       LEFT JOIN workspace_members wm2 ON w.id = wm2.workspace_id
       WHERE w.id = $1 AND wm.user_id = $2
       GROUP BY w.id, wm.role`,
      [workspaceId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...this.formatWorkspace(row),
      userRole: row.user_role as WorkspaceRole,
      boardCount: parseInt(row.board_count),
      memberCount: parseInt(row.member_count),
    };
  }

  /**
   * Actualizar un workspace
   */
  async updateWorkspace(
    workspaceId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
    }
  ): Promise<Workspace & { userRole: WorkspaceRole }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.icon !== undefined) {
        updates.push(`icon = $${paramIndex++}`);
        values.push(data.icon);
      }
      if (data.color !== undefined) {
        updates.push(`color = $${paramIndex++}`);
        values.push(data.color);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(workspaceId);

      const result = await client.query(
        `UPDATE workspaces 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
        values
      );

      const workspace = result.rows[0];

      const membershipResult = await client.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId]
      );

      const userRole = membershipResult.rows[0]?.role as WorkspaceRole;

      await client.query('COMMIT');

      const payload: WorkspaceUpdatedPayload = {
        workspaceId: workspace.id as any,
        changes: data,
        updatedBy: userId as any,
      };

      await eventStore.emit('workspace.updated', payload, userId as any);

      return {
        ...this.formatWorkspace(workspace),
        userRole,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar un workspace (solo Owner)
   */
  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const memberResult = await client.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId]
      );

      if (memberResult.rows.length === 0 || memberResult.rows[0].role !== 'OWNER') {
        throw new Error('Only workspace owner can delete workspace');
      }

      await client.query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);

      await client.query('COMMIT');

      await eventStore.emit(
        'workspace.deleted',
        { workspaceId: workspaceId as any, deletedBy: userId as any },
        userId as any
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Invitar un usuario al workspace
   */
  async inviteMember(
    workspaceId: string,
    inviterId: string,
    inviteeEmail: string,
    role: WorkspaceRole
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(`SELECT id FROM users WHERE email = $1`, [
        inviteeEmail,
      ]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const inviteeId = userResult.rows[0].id;

      const existingMember = await client.query(
        `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, inviteeId]
      );

      if (existingMember.rows.length > 0) {
        throw new Error('User is already a member');
      }

      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [workspaceId, inviteeId, role]
      );

      await client.query('COMMIT');

      const payload: WorkspaceMemberInvitedPayload = {
        workspaceId: workspaceId as any,
        inviterId: inviterId as any,
        inviteeId: inviteeId as any,
        inviteeEmail,
        role,
      };

      await eventStore.emit('workspace.member.invited', payload, inviterId as any);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener miembros de un workspace
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    const result = await pool.query(
      `SELECT 
        wm.id,
        wm.workspace_id,
        wm.user_id,
        wm.role,
        wm.joined_at,
        u.name as user_name,
        u.email as user_email,
        u.avatar as user_avatar
       FROM workspace_members wm
       INNER JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = $1
       ORDER BY 
         CASE wm.role
           WHEN 'OWNER' THEN 1
           WHEN 'ADMIN' THEN 2
           WHEN 'MEMBER' THEN 3
           WHEN 'VIEWER' THEN 4
         END,
         wm.joined_at ASC`,
      [workspaceId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role as WorkspaceRole,
      joinedAt: row.joined_at,
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatar: row.user_avatar,
      },
    }));
  }

  /**
   * Cambiar rol de un miembro
   */
  async changeMemberRole(
    workspaceId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
    changerId: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE workspace_members 
         SET role = $1
         WHERE workspace_id = $2 AND user_id = $3`,
        [newRole, workspaceId, targetUserId]
      );

      await client.query('COMMIT'); //

      const payload: WorkspaceMemberRoleChangedPayload = {
        workspaceId: workspaceId as any,
        userId: targetUserId as any,
        oldRole: 'MEMBER',
        newRole,
        changedBy: changerId as any,
      };

      await eventStore.emit('workspace.member.roleChanged', payload, changerId as any);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remover un miembro del workspace
   */
  async removeMember(workspaceId: string, targetUserId: string, removerId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM workspace_members 
         WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, targetUserId]
      );

      await client.query('COMMIT');

      const payload: WorkspaceMemberRemovedPayload = {
        workspaceId: workspaceId as any,
        userId: targetUserId as any,
        removedBy: removerId as any,
      };

      await eventStore.emit('workspace.member.removed', payload, removerId as any);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verificar si un usuario es miembro de un workspace
   */
  async getMembership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: WorkspaceRole } | null> {
    const result = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return { role: result.rows[0].role as WorkspaceRole };
  }

  /**
   * Formatear workspace desde resultado de DB
   */
  private formatWorkspace(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ownerId: row.owner_id,
      icon: row.icon,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const workspaceService = new WorkspaceService();
