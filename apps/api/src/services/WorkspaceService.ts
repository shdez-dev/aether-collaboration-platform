// apps/api/src/services/WorkspaceService.ts

import { randomBytes } from 'crypto';
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
    userId: string,
    includeArchived = false
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
       WHERE wm.user_id = $1 AND ($2 OR w.archived = false)
       GROUP BY w.id, wm.role
       ORDER BY w.updated_at DESC`,
      [userId, includeArchived]
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

      // Crear notificación de invitación
      try {
        const workspaceResult = await client.query('SELECT name FROM workspaces WHERE id = $1', [
          workspaceId,
        ]);
        const workspaceName = workspaceResult.rows[0]?.name || 'Unknown workspace';

        const inviterResult = await client.query('SELECT name FROM users WHERE id = $1', [
          inviterId,
        ]);
        const inviterName = inviterResult.rows[0]?.name || 'Someone';

        const { notificationService } = await import('./NotificationService');
        await notificationService.createWorkspaceInviteNotification({
          userId: inviteeId,
          workspaceId,
          workspaceName,
          inviterId,
          inviterName,
        });
      } catch (notifError) {
        console.error('[WorkspaceService] Error creating invite notification:', notifError);
      }
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
   * Archivar un workspace (solo OWNER)
   */
  async archiveWorkspace(workspaceId: string, userId: string): Promise<Workspace> {
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (memberResult.rows.length === 0 || memberResult.rows[0].role !== 'OWNER') {
      throw new Error('Only workspace owner can archive workspace');
    }

    const result = await pool.query(
      `UPDATE workspaces
       SET archived = true, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [workspaceId]
    );

    await eventStore.emit(
      'workspace.updated',
      { workspaceId: workspaceId as any, changes: { archived: true }, updatedBy: userId as any },
      userId as any
    );

    return this.formatWorkspace(result.rows[0]);
  }

  /**
   * Restaurar un workspace archivado (solo OWNER)
   */
  async restoreWorkspace(workspaceId: string, userId: string): Promise<Workspace> {
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (memberResult.rows.length === 0 || memberResult.rows[0].role !== 'OWNER') {
      throw new Error('Only workspace owner can restore workspace');
    }

    const result = await pool.query(
      `UPDATE workspaces
       SET archived = false, archived_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [workspaceId]
    );

    await eventStore.emit(
      'workspace.updated',
      { workspaceId: workspaceId as any, changes: { archived: false }, updatedBy: userId as any },
      userId as any
    );

    return this.formatWorkspace(result.rows[0]);
  }

  /**
   * Duplicar un workspace (OWNER o ADMIN)
   * Copia nombre, descripción, icon, color y opcionalmente los boards vacíos
   */
  async duplicateWorkspace(
    workspaceId: string,
    userId: string,
    options: { includeBoards?: boolean } = {}
  ): Promise<Workspace & { userRole: WorkspaceRole }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Obtener workspace original
      const sourceResult = await client.query(`SELECT * FROM workspaces WHERE id = $1`, [
        workspaceId,
      ]);
      if (sourceResult.rows.length === 0) {
        throw new Error('Workspace not found');
      }
      const source = sourceResult.rows[0];

      // Crear copia
      const newWorkspaceResult = await client.query(
        `INSERT INTO workspaces (name, description, owner_id, icon, color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [`${source.name} (copia)`, source.description, userId, source.icon, source.color]
      );
      const newWorkspace = newWorkspaceResult.rows[0];

      // Añadir al creador como OWNER
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
        [newWorkspace.id, userId]
      );

      // Opcionalmente copiar boards (sin listas ni cards)
      if (options.includeBoards) {
        const boardsResult = await client.query(
          `SELECT * FROM boards WHERE workspace_id = $1 AND archived = false ORDER BY position ASC`,
          [workspaceId]
        );
        for (let i = 0; i < boardsResult.rows.length; i++) {
          const board = boardsResult.rows[i];
          await client.query(
            `INSERT INTO boards (workspace_id, name, description, position, created_by) VALUES ($1, $2, $3, $4, $5)`,
            [newWorkspace.id, board.name, board.description, i, userId]
          );
        }
      }

      await client.query('COMMIT');

      await eventStore.emit(
        'workspace.created',
        {
          workspaceId: newWorkspace.id as any,
          name: newWorkspace.name,
          ownerId: userId as any,
        },
        userId as any
      );

      return {
        ...this.formatWorkspace(newWorkspace),
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
   * Obtener estadísticas de avance del workspace
   */
  async getWorkspaceStats(workspaceId: string): Promise<{
    // Progreso global
    totalCards: number;
    completedCards: number;
    overdueCards: number;
    unassignedCards: number;
    // Velocidad (últimos 7 días vs 7 días anteriores)
    completedThisWeek: number;
    completedLastWeek: number;
    // Progreso por board
    boardProgress: { boardId: string; name: string; total: number; completed: number }[];
    // Distribución por prioridad
    priorityBreakdown: { priority: string; count: number }[];
  }> {
    const [
      cardsResult,
      overdueResult,
      unassignedResult,
      thisWeekResult,
      lastWeekResult,
      boardProgressResult,
      priorityResult,
    ] = await Promise.all([
      // Total y completadas
      pool.query(
        `SELECT
          COUNT(c.id) as total,
          COUNT(c.id) FILTER (WHERE c.completed = true) as completed
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         INNER JOIN boards b ON l.board_id = b.id
         WHERE b.workspace_id = $1 AND b.archived = false`,
        [workspaceId]
      ),
      // Vencidas (due_date pasada y no completadas)
      pool.query(
        `SELECT COUNT(c.id) as total
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         INNER JOIN boards b ON l.board_id = b.id
         WHERE b.workspace_id = $1
           AND b.archived = false
           AND c.completed = false
           AND c.due_date IS NOT NULL
           AND c.due_date < NOW()`,
        [workspaceId]
      ),
      // Sin asignar
      pool.query(
        `SELECT COUNT(c.id) as total
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         INNER JOIN boards b ON l.board_id = b.id
         WHERE b.workspace_id = $1
           AND b.archived = false
           AND c.completed = false
           AND NOT EXISTS (
             SELECT 1 FROM card_members cm WHERE cm.card_id = c.id
           )`,
        [workspaceId]
      ),
      // Completadas esta semana (últimos 7 días)
      pool.query(
        `SELECT COUNT(c.id) as total
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         INNER JOIN boards b ON l.board_id = b.id
         WHERE b.workspace_id = $1
           AND c.completed = true
           AND c.completed_at >= NOW() - INTERVAL '7 days'`,
        [workspaceId]
      ),
      // Completadas semana anterior (7-14 días atrás)
      pool.query(
        `SELECT COUNT(c.id) as total
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         INNER JOIN boards b ON l.board_id = b.id
         WHERE b.workspace_id = $1
           AND c.completed = true
           AND c.completed_at >= NOW() - INTERVAL '14 days'
           AND c.completed_at < NOW() - INTERVAL '7 days'`,
        [workspaceId]
      ),
      // Progreso por board
      pool.query(
        `SELECT
          b.id as board_id,
          b.name,
          COUNT(c.id) as total,
          COUNT(c.id) FILTER (WHERE c.completed = true) as completed
         FROM boards b
         LEFT JOIN lists l ON l.board_id = b.id
         LEFT JOIN cards c ON c.list_id = l.id
         WHERE b.workspace_id = $1 AND b.archived = false
         GROUP BY b.id, b.name
         ORDER BY b.name ASC`,
        [workspaceId]
      ),
      // Distribución por prioridad (solo cards activas)
      pool.query(
        `SELECT
          COALESCE(c.priority, 'none') as priority,
          COUNT(c.id) as count
         FROM cards c
         INNER JOIN lists l ON c.list_id = l.id
         INNER JOIN boards b ON l.board_id = b.id
         WHERE b.workspace_id = $1
           AND b.archived = false
           AND c.completed = false
         GROUP BY c.priority`,
        [workspaceId]
      ),
    ]);

    return {
      totalCards: parseInt(cardsResult.rows[0].total),
      completedCards: parseInt(cardsResult.rows[0].completed),
      overdueCards: parseInt(overdueResult.rows[0].total),
      unassignedCards: parseInt(unassignedResult.rows[0].total),
      completedThisWeek: parseInt(thisWeekResult.rows[0].total),
      completedLastWeek: parseInt(lastWeekResult.rows[0].total),
      boardProgress: boardProgressResult.rows.map((r) => ({
        boardId: r.board_id,
        name: r.name,
        total: parseInt(r.total),
        completed: parseInt(r.completed),
      })),
      priorityBreakdown: priorityResult.rows.map((r) => ({
        priority: r.priority,
        count: parseInt(r.count),
      })),
    };
  }

  /**
   * Cambiar visibilidad del workspace (OWNER o ADMIN)
   */
  async updateVisibility(
    workspaceId: string,
    userId: string,
    visibility: 'private' | 'public'
  ): Promise<Workspace> {
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (memberResult.rows.length === 0 || !['OWNER', 'ADMIN'].includes(memberResult.rows[0].role)) {
      throw new Error('Only workspace owner or admin can change visibility');
    }

    const result = await pool.query(
      `UPDATE workspaces
       SET visibility = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [visibility, workspaceId]
    );

    await eventStore.emit(
      'workspace.updated',
      { workspaceId: workspaceId as any, changes: { visibility }, updatedBy: userId as any },
      userId as any
    );

    return this.formatWorkspace(result.rows[0]);
  }

  /**
   * Generar o renovar token de invitación público
   */
  async regenerateInviteToken(workspaceId: string, userId: string): Promise<string> {
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (memberResult.rows.length === 0 || !['OWNER', 'ADMIN'].includes(memberResult.rows[0].role)) {
      throw new Error('Only workspace owner or admin can manage invite tokens');
    }

    const token = randomBytes(24).toString('hex');

    await pool.query(
      `UPDATE workspaces SET invite_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [token, workspaceId]
    );

    return token;
  }

  /**
   * Revocar token de invitación público
   */
  async revokeInviteToken(workspaceId: string, userId: string): Promise<void> {
    const memberResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    if (memberResult.rows.length === 0 || !['OWNER', 'ADMIN'].includes(memberResult.rows[0].role)) {
      throw new Error('Only workspace owner or admin can manage invite tokens');
    }

    await pool.query(
      `UPDATE workspaces SET invite_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [workspaceId]
    );
  }

  /**
   * Unirse a un workspace vía invite token
   */
  async joinByInviteToken(token: string, userId: string): Promise<Workspace> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const workspaceResult = await client.query(
        `SELECT * FROM workspaces WHERE invite_token = $1 AND archived = false`,
        [token]
      );
      if (workspaceResult.rows.length === 0) {
        throw new Error('Invalid or expired invite token');
      }

      const workspace = workspaceResult.rows[0];

      const existing = await client.query(
        `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspace.id, userId]
      );
      if (existing.rows.length > 0) {
        throw new Error('Already a member');
      }

      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'MEMBER')`,
        [workspace.id, userId]
      );

      await client.query('COMMIT');

      return this.formatWorkspace(workspace);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Crear workspace desde template predefinido
   */
  async createFromTemplate(
    userId: string,
    templateId: string,
    name: string
  ): Promise<Workspace & { userRole: WorkspaceRole }> {
    const templates: Record<
      string,
      {
        description: string;
        icon: string;
        color: string;
        boards: { name: string; lists: string[] }[];
      }
    > = {
      development: {
        description: 'Workspace para proyectos de desarrollo de software',
        icon: 'Code2',
        color: '#3b82f6',
        boards: [
          { name: 'Backlog', lists: ['Por hacer', 'En progreso', 'En revisión', 'Completado'] },
          { name: 'Bugs', lists: ['Reportado', 'En análisis', 'En fix', 'Resuelto'] },
          { name: 'Releases', lists: ['Planificado', 'En desarrollo', 'Testing', 'Publicado'] },
        ],
      },
      marketing: {
        description: 'Workspace para campañas y estrategias de marketing',
        icon: 'Megaphone',
        color: '#f59e0b',
        boards: [
          {
            name: 'Campañas',
            lists: ['Ideas', 'Planificando', 'En ejecución', 'Publicado', 'Analizando'],
          },
          { name: 'Contenido', lists: ['Por crear', 'En redacción', 'En revisión', 'Publicado'] },
        ],
      },
      design: {
        description: 'Workspace para proyectos de diseño y creatividad',
        icon: 'PenTool',
        color: '#8b5cf6',
        boards: [
          { name: 'Proyectos', lists: ['Brief', 'Concepto', 'Diseño', 'Revisión', 'Aprobado'] },
          { name: 'Assets', lists: ['Por crear', 'En proceso', 'Revisión', 'Entregado'] },
        ],
      },
      hr: {
        description: 'Workspace para recursos humanos y gestión de talento',
        icon: 'Users',
        color: '#10b981',
        boards: [
          { name: 'Reclutamiento', lists: ['Aplicando', 'Entrevista', 'Oferta', 'Contratado'] },
          { name: 'Onboarding', lists: ['Pendiente', 'En proceso', 'Completado'] },
        ],
      },
      general: {
        description: 'Workspace de propósito general para tu equipo',
        icon: 'Folder',
        color: '#06b6d4',
        boards: [{ name: 'Tareas', lists: ['Por hacer', 'En progreso', 'Completado'] }],
      },
    };

    const template = templates[templateId];
    if (!template) {
      throw new Error('Template not found');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Crear workspace
      const wsResult = await client.query(
        `INSERT INTO workspaces (name, description, owner_id, icon, color)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, template.description, userId, template.icon, template.color]
      );
      const workspace = wsResult.rows[0];

      // Añadir como OWNER
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
        [workspace.id, userId]
      );

      // Crear boards y listas del template
      for (let boardIndex = 0; boardIndex < template.boards.length; boardIndex++) {
        const boardTemplate = template.boards[boardIndex];
        const boardResult = await client.query(
          `INSERT INTO boards (workspace_id, name, position, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
          [workspace.id, boardTemplate.name, boardIndex, userId]
        );
        const boardId = boardResult.rows[0].id;

        for (let i = 0; i < boardTemplate.lists.length; i++) {
          await client.query(`INSERT INTO lists (board_id, name, position) VALUES ($1, $2, $3)`, [
            boardId,
            boardTemplate.lists[i],
            i,
          ]);
        }
      }

      await client.query('COMMIT');

      await eventStore.emit(
        'workspace.created',
        {
          workspaceId: workspace.id as any,
          name: workspace.name,
          ownerId: userId as any,
        },
        userId as any
      );

      return { ...this.formatWorkspace(workspace), userRole: 'OWNER' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
      archived: row.archived ?? false,
      archivedAt: row.archived_at ?? null,
      visibility: row.visibility ?? 'private',
      inviteToken: row.invite_token ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const workspaceService = new WorkspaceService();
