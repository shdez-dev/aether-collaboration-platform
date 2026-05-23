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
      'workspace.member.role-changed',
      // Board
      'board.created',
      'board.updated',
      'board.archived',
      'board.restored',
      'board.deleted',
      // List
      'list.created',
      'list.updated',
      'list.order-changed',
      'list.deleted',
      // Card
      'card.created',
      'card.moved',
      'card.status-changed',
      'card.updated',
      'card.due-date.set',
      'card.due-date.removed',
      'card.priority.changed',
      'card.archived',
      'card.restored',
      'card.deleted',
      'card.member.assigned',
      'card.member.removed',
      'card.label.added',
      'card.label.removed',
      'card.dependency.added',
      'card.dependency.removed',
      // Checklist
      'checklist.item.created',
      'checklist.item.deleted',
      // Comment
      'comment.created',
      'comment.updated',
      'comment.deleted',
      'comment.mention-added',
      // Document
      'document.created',
      'document.deleted',
      'document.version.saved',
      'document.version.restored',
      'document.permission.changed',
      // GitHub
      'github.push.received',
      'github.pr.opened',
      'github.pr.closed',
      'github.pr.merged',
      'github.pr.review-submitted',
      'github.pr.review-requested',
      // Project
      'project.created',
      'project.updated',
      'project.status.changed',
      'project.deleted',
      'project.board.linked',
      'project.board.unlinked',
      'project.milestone.created',
      'project.milestone.completed',
      // Team
      'team.created',
      'team.updated',
      'team.deleted',
      'team.member.added',
      'team.member.removed',
      'team.member.role-changed',
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
        metadata.name = payload.name || payload.subjectName;
        metadata.description = payload.description;
        metadata.icon = payload.icon;
        metadata.color = payload.color;
        break;

      case 'workspace.updated':
        metadata.name = payload.name || payload.subjectName;
        metadata.description = payload.description;
        metadata.changes = payload.changes;
        break;

      case 'workspace.deleted':
        metadata.workspaceId = payload.workspaceId;
        metadata.name = payload.name || payload.subjectName;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'workspace.member.invited':
        metadata.workspaceId = payload.workspaceId;
        metadata.inviteeId = payload.inviteeId || payload.userId || payload.subjectId;
        metadata.inviteeEmail = payload.inviteeEmail;
        if (metadata.inviteeId) {
          metadata.inviteeName = await this.getMemberName(metadata.inviteeId);
        }
        if (!metadata.inviteeName && payload.inviteeEmail) {
          metadata.inviteeName = payload.inviteeEmail;
        }
        break;

      case 'workspace.member.joined':
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'board.created':
        metadata.boardId   = payload.boardId || payload.subjectId;
        metadata.boardName = payload.title || payload.name || payload.subjectName;
        metadata.name      = metadata.boardName;
        metadata.description = payload.description;
        break;

      case 'board.updated':
        metadata.boardId   = payload.boardId || payload.subjectId;
        metadata.boardName = payload.title || payload.name || payload.subjectName;
        metadata.name      = metadata.boardName;
        if (!metadata.boardName && metadata.boardId) {
          metadata.boardName = await this.getBoardName(metadata.boardId);
          metadata.name      = metadata.boardName;
        }
        metadata.changes = payload.changes;
        break;

      case 'board.deleted':
        metadata.boardId   = payload.boardId || payload.subjectId;
        metadata.boardName = payload.title || payload.name || payload.subjectName;
        metadata.name      = metadata.boardName;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'board.archived':
        metadata.boardId     = payload.boardId || payload.subjectId;
        metadata.boardName   = payload.name || payload.title || payload.subjectName;
        metadata.name        = metadata.boardName;
        metadata.workspaceId = payload.workspaceId;
        if (!metadata.boardName && metadata.boardId) {
          metadata.boardName = await this.getBoardName(metadata.boardId);
          metadata.name      = metadata.boardName;
        }
        break;

      case 'board.restored':
        metadata.boardId     = payload.boardId || payload.subjectId;
        metadata.boardName   = payload.name || payload.title || payload.subjectName;
        metadata.name        = metadata.boardName;
        metadata.workspaceId = payload.workspaceId;
        if (!metadata.boardName && metadata.boardId) {
          metadata.boardName = await this.getBoardName(metadata.boardId);
          metadata.name      = metadata.boardName;
        }
        break;

      case 'workspace.member.removed':
        metadata.workspaceId = payload.workspaceId;
        metadata.memberId = payload.userId || payload.subjectId;
        metadata.memberName = payload.memberName || payload.subjectName;
        if (!metadata.memberName && metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        if (payload.workspaceId) {
          metadata.workspaceName = await this.getWorkspaceName(payload.workspaceId);
        }
        break;

      case 'workspace.member.role-changed':
        metadata.workspaceId = payload.workspaceId;
        metadata.memberId = payload.userId || payload.subjectId;
        metadata.memberName = payload.memberName || payload.subjectName;
        metadata.oldRole = payload.oldRole;
        metadata.newRole = payload.newRole;
        if (!metadata.memberName && metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        if (payload.workspaceId) {
          metadata.workspaceName = await this.getWorkspaceName(payload.workspaceId);
        }
        break;

      case 'list.created':
        metadata.listId     = payload.listId || payload.subjectId;
        metadata.listName   = payload.listName || payload.name || payload.subjectName;
        metadata.name       = metadata.listName;
        metadata.boardId    = payload.boardId;
        metadata.boardName  = payload.boardName || payload.boardTitle
          || (metadata.boardId ? await this.getBoardName(metadata.boardId) : undefined);
        metadata.projectName = payload.projectName || undefined;
        break;

      case 'list.updated':
        metadata.listId   = payload.listId || payload.subjectId;
        metadata.listName = payload.name || payload.subjectName;
        metadata.name     = metadata.listName;
        metadata.oldName  = payload.oldName;
        metadata.boardId  = payload.boardId;
        metadata.boardName = payload.boardName
          || (metadata.boardId ? await this.getBoardName(metadata.boardId) : undefined);
        break;

      case 'list.order-changed':
        metadata.listId      = payload.listId;
        metadata.listName    = payload.name;
        metadata.name        = metadata.listName;
        metadata.oldPosition = payload.oldPosition;
        metadata.newPosition = payload.newPosition;
        metadata.boardId     = payload.boardId;
        metadata.boardName   = payload.boardName
          || (metadata.boardId ? await this.getBoardName(metadata.boardId) : undefined);
        if (!metadata.listName && payload.listId) {
          metadata.listName = await this.getListName(payload.listId);
          metadata.name     = metadata.listName;
        }
        break;

      case 'list.deleted':
        metadata.listId   = payload.listId;
        metadata.listName = payload.name;
        metadata.name     = metadata.listName;
        metadata.boardId  = payload.boardId;
        metadata.boardName = payload.boardName
          || (metadata.boardId ? await this.getBoardName(metadata.boardId) : undefined);
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.created':
        metadata.title = payload.title || payload.subjectName;
        metadata.cardId = payload.cardId || payload.subjectId;
        metadata.listId = payload.listId;
        if (payload.listName) {
          metadata.listName = payload.listName;
        } else if (payload.listId) {
          metadata.listName = await this.getListName(payload.listId);
        }
        break;

      case 'card.updated':
        metadata.title = payload.title || payload.subjectName;
        metadata.cardId = payload.cardId || payload.subjectId;
        metadata.listId = payload.listId;
        metadata.changes = payload.changes;
        break;

      case 'card.deleted':
        metadata.cardId = payload.cardId || payload.subjectId;
        metadata.listId = payload.listId;
        metadata.title = payload.title || payload.subjectName;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.archived':
        metadata.cardId = payload.cardId || payload.subjectId;
        metadata.title = payload.title || payload.subjectName;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.moved':
        metadata.cardId    = payload.cardId || payload.subjectId;
        metadata.cardTitle = payload.title || payload.cardTitle || payload.subjectName;
        metadata.title     = metadata.cardTitle;
        if (!metadata.cardTitle && metadata.cardId) {
          metadata.cardTitle = await this.getCardTitle(metadata.cardId);
          metadata.title     = metadata.cardTitle;
        }
        metadata.fromListId   = payload.fromListId;
        metadata.toListId     = payload.toListId;
        metadata.fromPosition = payload.fromPosition;
        metadata.toPosition   = payload.toPosition;

        if (payload.oldListName) metadata.fromListName = payload.oldListName;
        if (payload.newListName) { metadata.toListName = payload.newListName; metadata.newListName = payload.newListName; }

        if (!metadata.fromListName || !metadata.toListName) {
          const listNames = await this.getListNames(payload.fromListId, payload.toListId);
          if (!metadata.fromListName && listNames.fromList) metadata.fromListName = listNames.fromList;
          if (!metadata.toListName  && listNames.toList)   { metadata.toListName = listNames.toList; metadata.newListName = listNames.toList; }
        }
        break;

      case 'card.due-date.set':
      case 'card.due-date.removed':
        metadata.cardId = payload.cardId || payload.subjectId;
        metadata.title = payload.title || payload.subjectName;
        metadata.dueDate = payload.dueDate || null;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.priority.changed':
        metadata.cardId = payload.cardId || payload.subjectId;
        metadata.title = payload.title || payload.subjectName;
        metadata.oldPriority = payload.oldPriority;
        metadata.newPriority = payload.newPriority;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.restored':
        metadata.cardId = payload.cardId || payload.subjectId;
        metadata.title = payload.title || payload.subjectName;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.dependency.added': {
        metadata.blockingCardId = payload.blockingCardId;
        metadata.blockedCardId  = payload.blockedCardId;
        metadata.workspaceId    = payload.workspaceId || payload.dependency?.workspaceId;
        metadata.boardId        = payload.boardId     || payload.dependency?.boardId;
        const [blockingTitle, blockedTitle] = await Promise.all([
          this.getCardTitle(payload.blockingCardId),
          this.getCardTitle(payload.blockedCardId),
        ]);
        metadata.blockingCardTitle = blockingTitle;
        metadata.blockedCardTitle  = blockedTitle;
        break;
      }

      case 'card.dependency.removed': {
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
      }

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
        metadata.documentId  = payload.documentId || payload.subjectId;
        metadata.title       = payload.title || payload.subjectName;
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

      case 'document.version.saved':
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

      case 'document.permission.changed':
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

      case 'comment.mention-added':
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
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        metadata.cardTitle = payload.cardTitle || (payload.cardId ? await this.getCardTitle(payload.cardId) : undefined);
        metadata.authorName = payload.authorName;
        break;

      case 'comment.updated':
        metadata.cardId = payload.cardId;
        metadata.commentId = payload.commentId;
        metadata.contentPreview = payload.changes?.content?.substring(0, 100) || payload.content?.substring(0, 100);
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        metadata.cardTitle = payload.cardTitle || (payload.cardId ? await this.getCardTitle(payload.cardId) : undefined);
        metadata.authorName = payload.authorName;
        break;

      case 'comment.deleted':
        metadata.commentId = payload.commentId;
        metadata.cardId = payload.cardId;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        metadata.cardTitle = payload.cardTitle || (payload.cardId ? await this.getCardTitle(payload.cardId) : undefined);
        metadata.deletedByName = payload.deletedByName;
        break;

      case 'card.member.assigned':
        metadata.cardId = payload.cardId;
        metadata.memberId = payload.userId || payload.memberId;
        metadata.cardTitle = payload.cardTitle || payload.title || (payload.cardId ? await this.getCardTitle(payload.cardId) : undefined);
        metadata.memberName = payload.memberName || payload.assignedUserName || (metadata.memberId ? await this.getMemberName(metadata.memberId) : undefined);
        metadata.assignedUserName = metadata.memberName;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'card.member.removed':
        metadata.cardId = payload.cardId;
        metadata.memberId = payload.userId || payload.memberId;
        metadata.cardTitle = payload.cardTitle || payload.title || (payload.cardId ? await this.getCardTitle(payload.cardId) : undefined);
        metadata.memberName = payload.memberName || payload.unassignedUserName || (metadata.memberId ? await this.getMemberName(metadata.memberId) : undefined);
        metadata.unassignedUserName = metadata.memberName;
        metadata.boardId = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
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

      case 'github.push.received':
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
      case 'github.pr.review-requested':
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

      case 'github.pr.review-submitted':
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
        metadata.projectId   = payload.projectId || payload.subjectId;
        metadata.name        = payload.name || payload.subjectName;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.updated':
        metadata.projectId   = payload.projectId || payload.subjectId;
        metadata.name        = payload.name || payload.subjectName || (metadata.projectId ? await this.getProjectName(metadata.projectId) : undefined);
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.status.changed':
        metadata.projectId   = payload.projectId || payload.subjectId;
        metadata.name        = payload.name || payload.subjectName || (metadata.projectId ? await this.getProjectName(metadata.projectId) : undefined);
        metadata.oldStatus   = payload.oldStatus;
        metadata.newStatus   = payload.newStatus;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.deleted':
        metadata.projectId   = payload.projectId || payload.subjectId;
        metadata.name        = payload.name || payload.subjectName;
        metadata.workspaceId = payload.workspaceId;
        break;

      case 'project.board.linked':
      case 'project.board.unlinked':
        metadata.projectId   = payload.projectId || payload.subjectId;
        metadata.projectName = payload.projectName || payload.subjectName || (metadata.projectId ? await this.getProjectName(metadata.projectId) : undefined);
        metadata.boardId     = payload.boardId;
        metadata.workspaceId = payload.workspaceId;
        if (metadata.boardId) {
          metadata.boardName = await this.getBoardName(metadata.boardId);
        }
        break;

      case 'project.milestone.created':
        metadata.projectId    = payload.projectId || payload.subjectId;
        metadata.projectName  = payload.projectName || (metadata.projectId ? await this.getProjectName(metadata.projectId) : undefined);
        metadata.milestoneName = payload.milestoneName || payload.subjectName;
        metadata.milestoneDate = payload.milestoneDate;
        metadata.workspaceId  = payload.workspaceId;
        break;

      case 'project.milestone.completed':
        metadata.projectId    = payload.projectId || payload.subjectId;
        metadata.projectName  = payload.projectName || (metadata.projectId ? await this.getProjectName(metadata.projectId) : undefined);
        metadata.milestoneName = payload.milestoneName || payload.subjectName;
        metadata.workspaceId  = payload.workspaceId;
        break;

      case 'team.created':
        metadata.teamId  = payload.teamId || payload.subjectId;
        metadata.name    = payload.name || payload.subjectName || (metadata.teamId ? await this.getTeamName(metadata.teamId) : undefined);
        break;

      case 'team.updated':
        metadata.teamId  = payload.teamId || payload.subjectId;
        metadata.name    = payload.name || payload.subjectName || (metadata.teamId ? await this.getTeamName(metadata.teamId) : undefined);
        break;

      case 'team.deleted':
        metadata.teamId  = payload.teamId || payload.subjectId;
        metadata.name    = payload.name || payload.subjectName;
        break;

      case 'team.member.added':
        metadata.teamId   = payload.teamId || payload.subjectId;
        metadata.teamName = payload.teamName || (metadata.teamId ? await this.getTeamName(metadata.teamId) : undefined);
        metadata.memberId = payload.memberId;
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        break;

      case 'team.member.removed':
        metadata.teamId   = payload.teamId || payload.subjectId;
        metadata.teamName = payload.teamName || (metadata.teamId ? await this.getTeamName(metadata.teamId) : undefined);
        metadata.memberId = payload.memberId;
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        break;

      case 'team.member.role-changed':
        metadata.teamId   = payload.teamId || payload.subjectId;
        metadata.teamName = payload.teamName || (metadata.teamId ? await this.getTeamName(metadata.teamId) : undefined);
        metadata.memberId = payload.memberId;
        metadata.newRole  = payload.newRole;
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        break;

      default:
        // For unknown event types, return the enriched payload itself so
        // subjectName/workspaceId etc. are still available to the frontend.
        return {
          name: payload.subjectName,
          workspaceId: payload.workspaceId,
          ...payload,
        };
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
        `ual.user_id = $1`,
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
