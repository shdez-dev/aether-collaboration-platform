// apps/api/src/services/UserActivityService.ts

import { pool } from '../lib/db';
import type { EventType, UserId } from '@aether/types';

export class UserActivityService {
  /**
   * Registrar actividad del usuario
   */
  async logActivity(
    userId: UserId,
    activityType: string,
    metadata?: Record<string, any>,
    boardId?: string,
    workspaceId?: string
  ): Promise<void> {
    try {
      // Para workspace.deleted limpiamos workspaceId (la workspace ya no existe).
      // Para el resto siempre guardamos workspaceId para que aparezca en el feed del equipo.
      const isWorkspaceDeletion = activityType === 'workspace.deleted';

      await pool.query(
        `INSERT INTO user_activity_log (user_id, activity_type, metadata, board_id, workspace_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          userId,
          activityType,
          metadata ? JSON.stringify(metadata) : null,
          boardId || null,
          isWorkspaceDeletion ? null : workspaceId || null,
        ]
      );
    } catch (error) {}
  }

  /**
   * Determinar si un evento debe registrarse como actividad
   */
  shouldLogActivity(eventType: string): boolean {
    const relevantEvents = [
      // Workspace
      'workspace.created',
      'workspace.updated',
      'workspace.deleted',
      'workspace.member.invited',
      'workspace.member.joined',
      'workspace.member.removed',
      'workspace.member.roleChanged',
      // Board
      'board.created',
      'board.updated',
      'board.renamed',
      'board.archived',
      'board.unarchived',
      'board.deleted',
      // List
      'list.created',
      'list.renamed',
      'list.deleted',
      // Card
      'card.created',
      'card.moved',
      'card.completed',
      'card.uncompleted',
      'card.renamed',
      'card.description.changed',
      'card.duedate.set',
      'card.duedate.changed',
      'card.duedate.removed',
      'card.priority.changed',
      'card.archived',
      'card.unarchived',
      'card.deleted',
      'card.member.assigned',
      'card.member.unassigned',
      'card.label.added',
      'card.label.removed',
      'card.dependency.added',
      'card.dependency.removed',
      // Checklist
      'checklist.item.created',
      'checklist.item.deleted',
      // Comment
      'comment.created',
      'comment.mentioned',
      // Document
      'document.created',
      'document.deleted',
      'document.version.created',
      'document.version.restored',
      'document.permission.updated',
      // GitHub
      'github.push',
      'github.pr.opened',
      'github.pr.closed',
      'github.pr.merged',
      'github.pr.review.submitted',
      'github.pr.review_requested',
      // Project
      'project.created',
      'project.updated',
      'project.status.changed',
      'project.deleted',
      'project.board.assigned',
      'project.board.removed',
      'project.milestone.created',
      'project.milestone.completed',
      // Team
      'team.created',
      'team.updated',
      'team.deleted',
      'team.member.added',
      'team.member.removed',
      'team.member.roleChanged',
    ];

    return relevantEvents.includes(eventType);
  }

  /**
   * Obtener nombres de listas para eventos de movimiento
   */
  private async getListNames(
    fromListId?: string,
    toListId?: string
  ): Promise<{ fromList?: string; toList?: string }> {
    try {
      const listIds = [fromListId, toListId].filter(Boolean);
      if (listIds.length === 0) return {};

      const result = await pool.query(`SELECT id, name FROM lists WHERE id = ANY($1)`, [listIds]);

      const listMap = new Map(result.rows.map((row) => [row.id, row.name]));

      return {
        fromList: fromListId ? listMap.get(fromListId) : undefined,
        toList: toListId ? listMap.get(toListId) : undefined,
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Procesar evento y registrar actividad si es relevante
   */
  async processEvent(eventType: string, payload: any, userId: UserId): Promise<void> {
    if (!this.shouldLogActivity(eventType)) {
      return;
    }

    const boardId = payload.boardId || null;
    const workspaceId = payload.workspaceId || null;

    const metadata = await this.extractRelevantMetadata(eventType, payload);

    await this.logActivity(userId, eventType, metadata, boardId, workspaceId);
  }

  /**
   * Obtener información adicional para los eventos
   */
  private async getCardTitle(cardId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT title FROM cards WHERE id = $1', [cardId]);
      return result.rows[0]?.title;
    } catch (error) {
      return undefined;
    }
  }

  private async getMemberName(userId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      return result.rows[0]?.name;
    } catch (error) {
      return undefined;
    }
  }

  private async getLabelInfo(labelId: string): Promise<{ name?: string; color?: string }> {
    try {
      const result = await pool.query('SELECT name, color FROM labels WHERE id = $1', [labelId]);
      return {
        name: result.rows[0]?.name,
        color: result.rows[0]?.color,
      };
    } catch (error) {
      return {};
    }
  }

  private async getBoardName(boardId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM boards WHERE id = $1', [boardId]);
      return result.rows[0]?.name;
    } catch (error) {
      return undefined;
    }
  }

  /** @deprecated usa getBoardName */
  private async getBoardTitle(boardId: string): Promise<string | undefined> {
    return this.getBoardName(boardId);
  }

  private async getListName(listId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM lists WHERE id = $1', [listId]);
      return result.rows[0]?.name;
    } catch (error) {
      return undefined;
    }
  }

  private async getDocumentTitle(documentId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT title FROM documents WHERE id = $1', [documentId]);
      return result.rows[0]?.title;
    } catch (error) {
      return undefined;
    }
  }

  private async getWorkspaceName(workspaceId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM workspaces WHERE id = $1', [workspaceId]);
      return result.rows[0]?.name;
    } catch (error) {
      return undefined;
    }
  }

  private async getProjectName(projectId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
      return result.rows[0]?.name;
    } catch {
      return undefined;
    }
  }

  private async getTeamName(teamId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM teams WHERE id = $1', [teamId]);
      return result.rows[0]?.name;
    } catch {
      return undefined;
    }
  }

  /**
   * Extraer metadata relevante del payload según el tipo de evento
   */
  private async extractRelevantMetadata(
    eventType: string,
    payload: any
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    switch (eventType) {
      case 'workspace.created':
        metadata.name = payload.name;
        metadata.description = payload.description;
        metadata.icon = payload.icon;
        metadata.color = payload.color;
        break;

      case 'workspace.updated':
        metadata.name = payload.name;
        metadata.description = payload.description;
        metadata.changes = payload.changes;
        break;

      case 'workspace.deleted':
        metadata.workspaceId = payload.workspaceId;
        metadata.name = payload.name;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'workspace.member.invited':
        metadata.workspaceId = payload.workspaceId;
        metadata.inviteeId = payload.inviteeId || payload.userId;
        if (metadata.inviteeId) {
          metadata.inviteeName = await this.getMemberName(metadata.inviteeId);
        }
        break;

      case 'workspace.member.joined':
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'board.created':
        metadata.title = payload.title || payload.name;
        metadata.name = payload.title || payload.name;
        metadata.description = payload.description;
        metadata.boardId = payload.boardId;
        break;

      case 'board.updated':
        metadata.title = payload.title || payload.name;
        metadata.name = payload.title || payload.name;
        metadata.boardId = payload.boardId;
        metadata.changes = payload.changes;
        break;

      case 'board.deleted':
        metadata.boardId = payload.boardId;
        metadata.title = payload.title;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'board.renamed':
        metadata.boardId = payload.boardId;
        metadata.name = payload.name || payload.title;
        metadata.newName = payload.newName || payload.newTitle;
        break;

      case 'board.archived':
        metadata.boardId = payload.boardId;
        metadata.name = payload.name || payload.title;
        metadata.workspaceId = payload.workspaceId;
        if (!metadata.name && payload.boardId) {
          metadata.name = await this.getBoardName(payload.boardId);
        }
        break;

      case 'board.unarchived':
        metadata.boardId = payload.boardId;
        metadata.name = payload.name || payload.title;
        metadata.workspaceId = payload.workspaceId;
        if (!metadata.name && payload.boardId) {
          metadata.name = await this.getBoardName(payload.boardId);
        }
        break;

      case 'workspace.member.removed':
        metadata.workspaceId = payload.workspaceId;
        metadata.memberId = payload.userId;
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        if (payload.workspaceId) {
          metadata.workspaceName = await this.getWorkspaceName(payload.workspaceId);
        }
        break;

      case 'workspace.member.roleChanged':
        metadata.workspaceId = payload.workspaceId;
        metadata.memberId = payload.userId;
        metadata.oldRole = payload.oldRole;
        metadata.newRole = payload.newRole;
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        if (payload.workspaceId) {
          metadata.workspaceName = await this.getWorkspaceName(payload.workspaceId);
        }
        break;

      case 'list.created':
        metadata.name = payload.name;
        metadata.listId = payload.listId;
        metadata.boardId = payload.boardId;
        // Usar título del payload si está disponible
        if (payload.boardTitle) {
          metadata.boardTitle = payload.boardTitle;
        } else if (payload.boardId) {
          // Fallback: consultar título del board
          metadata.boardTitle = await this.getBoardTitle(payload.boardId);
        }
        break;

      case 'list.renamed':
        metadata.listId = payload.listId;
        metadata.name = payload.name;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'list.updated':
        metadata.name = payload.name;
        metadata.listId = payload.listId;
        metadata.oldName = payload.oldName;
        break;

      case 'list.reordered':
        metadata.listId = payload.listId;
        metadata.name = payload.name;
        metadata.oldPosition = payload.oldPosition;
        metadata.newPosition = payload.newPosition;
        // Obtener nombre de la lista si no está en el payload
        if (!metadata.name && payload.listId) {
          metadata.name = await this.getListName(payload.listId);
        }
        break;

      case 'list.deleted':
        metadata.listId = payload.listId;
        metadata.name = payload.name;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.created':
        metadata.title = payload.title;
        metadata.cardId = payload.cardId;
        metadata.listId = payload.listId;
        // Usar nombre del payload si está disponible
        if (payload.listName) {
          metadata.listName = payload.listName;
        } else if (payload.listId) {
          // Fallback: consultar nombre de la lista
          metadata.listName = await this.getListName(payload.listId);
        }
        break;

      case 'card.updated':
        metadata.title = payload.title;
        metadata.cardId = payload.cardId;
        metadata.listId = payload.listId;
        metadata.changes = payload.changes;
        break;

      case 'card.deleted':
        metadata.cardId = payload.cardId;
        metadata.listId = payload.listId;
        metadata.title = payload.title;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.completed':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        metadata.completedAt = payload.completedAt;
        break;

      case 'card.uncompleted':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.archived':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.moved':
        metadata.title = payload.title;
        metadata.cardId = payload.cardId;
        metadata.fromListId = payload.fromListId;
        metadata.toListId = payload.toListId;
        metadata.fromPosition = payload.fromPosition;
        metadata.toPosition = payload.toPosition;

        // Usar nombres del payload si están disponibles (desde CardService)
        if (payload.oldListName) metadata.fromListName = payload.oldListName;
        if (payload.newListName) metadata.toListName = payload.newListName;
        // También copiar como newListName para compatibilidad con frontend
        if (payload.newListName) metadata.newListName = payload.newListName;

        // Fallback: consultar nombres si no venían en el payload
        if (!metadata.fromListName || !metadata.toListName) {
          const listNames = await this.getListNames(payload.fromListId, payload.toListId);
          if (!metadata.fromListName && listNames.fromList)
            metadata.fromListName = listNames.fromList;
          if (!metadata.toListName && listNames.toList) metadata.toListName = listNames.toList;
          if (!metadata.newListName && listNames.toList) metadata.newListName = listNames.toList;
        }
        break;

      case 'card.renamed':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;       // nombre anterior
        metadata.newTitle = payload.newTitle; // nombre nuevo
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.description.changed':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.duedate.set':
      case 'card.duedate.changed':
      case 'card.duedate.removed':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;
        metadata.dueDate = payload.dueDate || null;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.priority.changed':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;
        metadata.oldPriority = payload.oldPriority;
        metadata.newPriority = payload.newPriority;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.unarchived':
        metadata.cardId = payload.cardId;
        metadata.title = payload.title;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.dependency.added':
        metadata.blockingCardId = payload.blockingCardId;
        metadata.blockedCardId  = payload.blockedCardId;
        metadata.workspaceId    = payload.workspaceId || payload.dependency?.workspaceId;
        metadata.boardId        = payload.boardId     || payload.dependency?.boardId;
        // Resolver nombres de ambas tarjetas
        const [blockingTitle, blockedTitle] = await Promise.all([
          this.getCardTitle(payload.blockingCardId),
          this.getCardTitle(payload.blockedCardId),
        ]);
        metadata.blockingCardTitle = blockingTitle;
        metadata.blockedCardTitle  = blockedTitle;
        break;

      case 'card.dependency.removed':
        metadata.cardId         = payload.cardId;
        metadata.blockingCardId = payload.blockingCardId;
        metadata.workspaceId    = payload.workspaceId;
        metadata.boardId        = payload.boardId;
        const [ct1, ct2] = await Promise.all([
          this.getCardTitle(payload.cardId),
          payload.blockingCardId ? this.getCardTitle(payload.blockingCardId) : Promise.resolve(undefined),
        ]);
        metadata.cardTitle         = ct1;
        metadata.blockingCardTitle = ct2;
        break;

      case 'checklist.item.created':
        metadata.cardId    = payload.cardId;
        metadata.itemId    = payload.item?.id || payload.itemId;
        metadata.itemTitle = payload.item?.title || payload.title || '';
        metadata.workspaceId = payload.workspaceId;
        metadata.boardId   = payload.boardId;
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      case 'checklist.item.deleted':
        metadata.cardId    = payload.cardId;
        metadata.itemId    = payload.itemId;
        metadata.itemTitle = payload.title || '';
        metadata.workspaceId = payload.workspaceId;
        metadata.boardId   = payload.boardId;
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      case 'document.created':
        metadata.documentId  = payload.documentId;
        metadata.title       = payload.title;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'document.deleted':
        metadata.documentId  = payload.documentId;
        metadata.workspaceId = payload.workspaceId;
        // Intentar recuperar título antes de que se elimine (puede no estar disponible)
        if (payload.title) {
          metadata.title = payload.title;
        } else if (payload.documentId) {
          metadata.title = await this.getDocumentTitle(payload.documentId);
        }
        break;

      case 'document.version.created':
        metadata.documentId  = payload.documentId;
        metadata.versionId   = payload.versionId;
        metadata.workspaceId = payload.workspaceId;
        if (payload.documentId) {
          metadata.title = await this.getDocumentTitle(payload.documentId);
        }
        break;

      case 'document.version.restored':
        metadata.documentId  = payload.documentId;
        metadata.versionId   = payload.versionId;
        metadata.workspaceId = payload.workspaceId;
        if (payload.documentId) {
          metadata.title = await this.getDocumentTitle(payload.documentId);
        }
        break;

      case 'document.permission.updated':
        metadata.documentId  = payload.documentId;
        metadata.workspaceId = payload.workspaceId;
        metadata.targetUserId = payload.targetUserId;
        metadata.permission  = payload.permission;
        if (payload.documentId) {
          metadata.title = await this.getDocumentTitle(payload.documentId);
        }
        if (payload.targetUserId) {
          metadata.targetUserName = await this.getMemberName(payload.targetUserId);
        }
        break;

      case 'comment.mentioned':
        metadata.commentId   = payload.commentId;
        metadata.cardId      = payload.cardId;
        metadata.workspaceId = payload.workspaceId;
        metadata.boardId     = payload.boardId;
        metadata.mentionedUserId   = payload.mentionedUserId;
        metadata.mentionedByUserId = payload.mentionedByUserId;
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        if (payload.mentionedUserId) {
          metadata.mentionedUserName = await this.getMemberName(payload.mentionedUserId);
        }
        break;

      case 'comment.created':
        metadata.cardId = payload.cardId;
        metadata.commentId = payload.commentId;
        metadata.contentPreview = payload.content?.substring(0, 100);
        // Obtener título de la tarjeta
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      case 'comment.updated':
        metadata.cardId = payload.cardId;
        metadata.commentId = payload.commentId;
        metadata.contentPreview = payload.content?.substring(0, 100);
        break;

      case 'comment.deleted':
        metadata.commentId = payload.commentId;
        metadata.cardId = payload.cardId;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.member.assigned':
        metadata.cardId = payload.cardId;
        metadata.memberId = payload.userId || payload.memberId;
        // Usar título del payload si está disponible
        if (payload.title) {
          metadata.cardTitle = payload.title;
        } else if (payload.cardId) {
          // Fallback: consultar título de la tarjeta
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        // Obtener nombre del miembro
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        break;

      case 'card.member.unassigned':
        metadata.cardId = payload.cardId;
        metadata.memberId = payload.userId || payload.memberId;
        // Usar título del payload si está disponible
        if (payload.title) {
          metadata.cardTitle = payload.title;
        } else if (payload.cardId) {
          // Fallback: consultar título de la tarjeta
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        // Obtener nombre del miembro
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        break;

      case 'card.label.added':
        metadata.cardId = payload.cardId;
        metadata.labelId = payload.labelId;
        // Usar info del payload si está disponible
        if (payload.cardTitle) {
          metadata.cardTitle = payload.cardTitle;
        } else if (payload.cardId) {
          // Fallback: consultar título
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        if (payload.labelName) {
          metadata.labelName = payload.labelName;
          metadata.labelColor = payload.labelColor;
        } else if (payload.labelId) {
          // Fallback: consultar label info
          const labelInfo = await this.getLabelInfo(payload.labelId);
          metadata.labelName = labelInfo.name;
          metadata.labelColor = labelInfo.color;
        }
        break;

      case 'card.label.removed':
        metadata.cardId = payload.cardId;
        metadata.labelId = payload.labelId;
        // Usar info del payload si está disponible
        if (payload.cardTitle) {
          metadata.cardTitle = payload.cardTitle;
        } else if (payload.cardId) {
          // Fallback: consultar título
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        if (payload.labelName) {
          metadata.labelName = payload.labelName;
          metadata.labelColor = payload.labelColor;
        } else if (payload.labelId) {
          // Fallback: consultar label info
          const labelInfo = await this.getLabelInfo(payload.labelId);
          metadata.labelName = labelInfo.name;
          metadata.labelColor = labelInfo.color;
        }
        break;

      case 'github.push':
        metadata.workspaceId = payload.workspaceId;
        metadata.repo        = payload.repo;
        metadata.branch      = payload.branch;
        metadata.commits     = payload.commits;
        metadata.pusher      = payload.pusher;
        metadata.compareUrl  = payload.compareUrl;
        break;

      case 'github.pr.opened':
      case 'github.pr.closed':
      case 'github.pr.merged':
      case 'github.pr.review_requested':
        metadata.workspaceId  = payload.workspaceId;
        metadata.repo         = payload.repo;
        metadata.prNumber     = payload.prNumber;
        metadata.title        = payload.title;
        metadata.url          = payload.url;
        metadata.author       = payload.author;
        metadata.authorAvatar = payload.authorAvatar;
        metadata.draft        = payload.draft;
        metadata.mergedBy     = payload.mergedBy;
        metadata.reviewer     = payload.reviewer;
        break;

      case 'github.pr.review.submitted':
        metadata.workspaceId   = payload.workspaceId;
        metadata.repo          = payload.repo;
        metadata.prNumber      = payload.prNumber;
        metadata.title         = payload.title;
        metadata.url           = payload.url;
        metadata.prAuthor      = payload.prAuthor;
        metadata.reviewer      = payload.reviewer;
        metadata.reviewerAvatar = payload.reviewerAvatar;
        metadata.state         = payload.state;
        metadata.body          = payload.body;
        break;

      case 'project.created':
        metadata.projectId  = payload.projectId;
        metadata.name       = payload.name;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.updated':
        metadata.projectId  = payload.projectId;
        metadata.name       = payload.name || (payload.projectId ? await this.getProjectName(payload.projectId) : undefined);
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.status.changed':
        metadata.projectId  = payload.projectId;
        metadata.name       = payload.name || (payload.projectId ? await this.getProjectName(payload.projectId) : undefined);
        metadata.oldStatus  = payload.oldStatus;
        metadata.newStatus  = payload.newStatus;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.deleted':
        metadata.projectId  = payload.projectId;
        metadata.name       = payload.name;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.board.assigned':
      case 'project.board.removed':
        metadata.projectId   = payload.projectId;
        metadata.projectName = payload.projectName || (payload.projectId ? await this.getProjectName(payload.projectId) : undefined);
        metadata.boardId     = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        if (payload.boardId) {
          metadata.boardName = await this.getBoardName(payload.boardId);
        }
        break;

      case 'project.milestone.created':
        metadata.projectId    = payload.projectId;
        metadata.projectName  = payload.projectName || (payload.projectId ? await this.getProjectName(payload.projectId) : undefined);
        metadata.milestoneName = payload.milestoneName;
        metadata.milestoneDate = payload.milestoneDate;
        metadata.workspaceId  = payload.workspaceId;
        break;

      case 'project.milestone.completed':
        metadata.projectId    = payload.projectId;
        metadata.projectName  = payload.projectName || (payload.projectId ? await this.getProjectName(payload.projectId) : undefined);
        metadata.milestoneName = payload.milestoneName;
        metadata.workspaceId  = payload.workspaceId;
        break;

      case 'team.created':
        metadata.teamId  = payload.teamId;
        metadata.name    = payload.name || (payload.teamId ? await this.getTeamName(payload.teamId) : undefined);
        break;

      case 'team.updated':
        metadata.teamId  = payload.teamId;
        metadata.name    = payload.name || (payload.teamId ? await this.getTeamName(payload.teamId) : undefined);
        break;

      case 'team.deleted':
        metadata.teamId  = payload.teamId;
        metadata.name    = payload.name;
        break;

      case 'team.member.added':
        metadata.teamId   = payload.teamId;
        metadata.teamName = payload.teamName || (payload.teamId ? await this.getTeamName(payload.teamId) : undefined);
        metadata.memberId = payload.memberId;
        if (payload.memberId) {
          metadata.memberName = await this.getMemberName(payload.memberId);
        }
        break;

      case 'team.member.removed':
        metadata.teamId   = payload.teamId;
        metadata.teamName = payload.teamName || (payload.teamId ? await this.getTeamName(payload.teamId) : undefined);
        metadata.memberId = payload.memberId;
        if (payload.memberId) {
          metadata.memberName = await this.getMemberName(payload.memberId);
        }
        break;

      case 'team.member.roleChanged':
        metadata.teamId   = payload.teamId;
        metadata.teamName = payload.teamName || (payload.teamId ? await this.getTeamName(payload.teamId) : undefined);
        metadata.memberId = payload.memberId;
        metadata.newRole  = payload.newRole;
        if (payload.memberId) {
          metadata.memberName = await this.getMemberName(payload.memberId);
        }
        break;

      default:
        return payload;
    }

    return metadata;
  }

  /**
   * Obtener actividad reciente del equipo (todos los workspaces del usuario)
   */
  async getUserActivity(
    userId: UserId,
    limit = 50,
    options?: { workspaceIds?: string[]; range?: 'today' | '24h' | 'week' }
  ): Promise<any[]> {
    try {
      const params: any[] = [userId];
      const conditions: string[] = [
        `(
           (ual.workspace_id IS NOT NULL AND ual.workspace_id IN (
             SELECT workspace_id FROM workspace_members WHERE user_id = $1
           ))
           OR (ual.workspace_id IS NULL AND ual.user_id = $1)
         )`,
      ];

      // Date filter done entirely in SQL to avoid JS timezone issues
      if (options?.range === 'today') {
        conditions.push(`ual.created_at >= DATE_TRUNC('day', NOW())`);
      } else if (options?.range === 'week') {
        conditions.push(`ual.created_at >= NOW() - INTERVAL '7 days'`);
      } else {
        // '24h' is the default
        conditions.push(`ual.created_at >= NOW() - INTERVAL '24 hours'`);
      }

      if (options?.workspaceIds && options.workspaceIds.length > 0) {
        params.push(options.workspaceIds);
        conditions.push(`ual.workspace_id = ANY($${params.length})`);
      }

      params.push(limit);
      const limitParam = `$${params.length}`;

      const result = await pool.query(
        `SELECT
          ual.id,
          ual.user_id,
          ual.activity_type,
          ual.metadata,
          ual.board_id,
          ual.workspace_id,
          ual.created_at,
          u.name   AS user_name,
          u.avatar AS user_avatar,
          w.name   AS workspace_name,
          b.name   AS board_name
         FROM user_activity_log ual
         LEFT JOIN users u ON u.id = ual.user_id
         LEFT JOIN workspaces w ON w.id = ual.workspace_id
         LEFT JOIN boards b ON b.id = ual.board_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ual.created_at DESC
         LIMIT ${limitParam}`,
        params
      );

      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Obtener actividad de un board
   */
  async getBoardActivity(boardId: string, limit = 50): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
          ual.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar as user_avatar
         FROM user_activity_log ual
         JOIN users u ON u.id = ual.user_id
         WHERE ual.board_id = $1
         ORDER BY ual.created_at DESC
         LIMIT $2`,
        [boardId, limit]
      );

      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Obtener actividad de un workspace
   */
  async getWorkspaceActivity(workspaceId: string, limit = 50): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
          ual.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar as user_avatar
         FROM user_activity_log ual
         JOIN users u ON u.id = ual.user_id
         WHERE ual.workspace_id = $1
         ORDER BY ual.created_at DESC
         LIMIT $2`,
        [workspaceId, limit]
      );

      return result.rows;
    } catch (error) {
      return [];
    }
  }
}

export const userActivityService = new UserActivityService();
