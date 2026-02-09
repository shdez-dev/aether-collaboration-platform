// packages/shared-types/src/events.ts

/**
 * Core Event System Types
 *
 * Every operation in AETHER is modeled as an immutable event.
 * Events are the single source of truth for state changes.
 */

// ============================================================================
// BRANDED TYPES - Type-safe IDs
// ============================================================================

export type Brand<K, T> = K & { __brand: T };

export type UserId = Brand<string, 'UserId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type BoardId = Brand<string, 'BoardId'>;
export type ListId = Brand<string, 'ListId'>;
export type CardId = Brand<string, 'CardId'>;
export type DocumentId = Brand<string, 'DocumentId'>;
export type DocumentVersionId = Brand<string, 'DocumentVersionId'>;
export type DocumentCommentId = Brand<string, 'DocumentCommentId'>;
export type CommentId = Brand<string, 'CommentId'>;
export type LabelId = Brand<string, 'LabelId'>;
export type NotificationId = Brand<string, 'NotificationId'>;
export type EventId = Brand<string, 'EventId'>;
export type SocketId = Brand<string, 'SocketId'>;

// ============================================================================
// VECTOR CLOCK - Causal ordering
// ============================================================================

/**
 * Vector clock for tracking causal relationships between events.
 * Ensures correct ordering of events in distributed system.
 */
export interface VectorClock {
  [userId: string]: number;
}

// ============================================================================
// BASE EVENT STRUCTURE
// ============================================================================

/**
 * Metadata attached to every event
 */
export interface EventMeta {
  eventId: EventId;
  timestamp: number; // Unix timestamp in milliseconds
  userId: UserId;
  version: number; // Event schema version
  vectorClock: VectorClock;
  correlationId?: string; // For tracking related events
  socketId?: SocketId; // Para identificar el socket que originó el evento
}

/**
 * Base event structure - all events extend this
 */
export interface BaseEvent<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload: TPayload;
  meta: EventMeta;
}

// ============================================================================
// EVENT CATEGORIES
// ============================================================================

/**
 * Authentication Events
 */
export type AuthEventType =
  | 'auth.user.registered'
  | 'auth.user.loggedIn'
  | 'auth.user.loggedOut'
  | 'auth.session.expired'
  | 'auth.password.resetRequested'
  | 'auth.password.resetCompleted';

/**
 * Workspace Events
 */
export type WorkspaceEventType =
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  | 'workspace.member.invited'
  | 'workspace.member.joined'
  | 'workspace.member.removed'
  | 'workspace.member.roleChanged';

/**
 * Board Events
 */
export type BoardEventType = 'board.created' | 'board.updated' | 'board.deleted' | 'board.archived';

/**
 * List Events
 */
export type ListEventType = 'list.created' | 'list.updated' | 'list.deleted' | 'list.reordered';

/**
 * Card Events
 */
export type CardEventType =
  | 'card.created'
  | 'card.updated'
  | 'card.deleted'
  | 'card.moved'
  | 'card.completed'
  | 'card.uncompleted'
  | 'card.member.assigned'
  | 'card.member.unassigned'
  | 'card.label.added'
  | 'card.label.removed'
  | 'card.comment.added'
  | 'card.comment.updated'
  | 'card.comment.deleted';

/**
 * Comment Events
 */
export type CommentEventType =
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'comment.mentioned';

/**
 * Document Events
 */
export type DocumentEventType =
  | 'document.created'
  | 'document.updated'
  | 'document.deleted'
  | 'document.title.changed'
  | 'document.operation.applied'
  | 'document.format.applied'
  | 'document.version.created'
  | 'document.version.restored'
  | 'document.exported'
  | 'document.permission.updated'
  | 'document.comment.added'
  | 'document.comment.updated'
  | 'document.comment.deleted'
  | 'document.comment.resolved'
  | 'document.user.joined'
  | 'document.user.left'
  | 'document.cursor.moved'
  | 'document.selection.changed';

/**
 * Notification Events
 */
export type NotificationEventType =
  | 'notification.created'
  | 'notification.read'
  | 'notification.deleted';

/**
 * Presence Events
 */
export type PresenceEventType =
  | 'presence.user.joined'
  | 'presence.user.left'
  | 'presence.user.online'
  | 'presence.user.offline'
  | 'presence.user.typing'
  | 'presence.user.typing.stopped'
  | 'presence.cursor.moved';

/**
 * All possible event types
 */
export type EventType =
  | AuthEventType
  | WorkspaceEventType
  | BoardEventType
  | ListEventType
  | CardEventType
  | CommentEventType
  | DocumentEventType
  | NotificationEventType
  | PresenceEventType;

// ============================================================================
// AUTH EVENT PAYLOADS
// ============================================================================

/**
 * User Registered Event
 */
export interface UserRegisteredPayload {
  userId: UserId;
  email: string;
  name: string;
}

export type UserRegisteredEvent = BaseEvent<'auth.user.registered', UserRegisteredPayload>;

/**
 * User Logged In Event
 */
export interface UserLoggedInPayload {
  userId: UserId;
  email: string;
}

export type UserLoggedInEvent = BaseEvent<'auth.user.loggedIn', UserLoggedInPayload>;

/**
 * User Logged Out Event
 */
export interface UserLoggedOutPayload {
  userId: UserId;
}

export type UserLoggedOutEvent = BaseEvent<'auth.user.loggedOut', UserLoggedOutPayload>;

// ============================================================================
// WORKSPACE EVENT PAYLOADS
// ============================================================================

/**
 * Workspace Created Event
 */
export interface WorkspaceCreatedPayload {
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  ownerId: UserId;
  icon?: string;
  color?: string;
}

export type WorkspaceCreatedEvent = BaseEvent<'workspace.created', WorkspaceCreatedPayload>;

/**
 * Workspace Updated Event
 */
export interface WorkspaceUpdatedPayload {
  workspaceId: WorkspaceId;
  changes: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
  };
  updatedBy: UserId;
}

export type WorkspaceUpdatedEvent = BaseEvent<'workspace.updated', WorkspaceUpdatedPayload>;

/**
 * Workspace Deleted Event
 */
export interface WorkspaceDeletedPayload {
  workspaceId: WorkspaceId;
  deletedBy: UserId;
}

export type WorkspaceDeletedEvent = BaseEvent<'workspace.deleted', WorkspaceDeletedPayload>;

/**
 * Workspace Member Invited Event
 */
export interface WorkspaceMemberInvitedPayload {
  workspaceId: WorkspaceId;
  inviterId: UserId;
  inviteeId: UserId;
  inviteeEmail: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export type WorkspaceMemberInvitedEvent = BaseEvent<
  'workspace.member.invited',
  WorkspaceMemberInvitedPayload
>;

/**
 * Workspace Member Role Changed Event
 */
export interface WorkspaceMemberRoleChangedPayload {
  workspaceId: WorkspaceId;
  userId: UserId;
  oldRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  newRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  changedBy: UserId;
}

export type WorkspaceMemberRoleChangedEvent = BaseEvent<
  'workspace.member.roleChanged',
  WorkspaceMemberRoleChangedPayload
>;

/**
 * Workspace Member Removed Event
 */
export interface WorkspaceMemberRemovedPayload {
  workspaceId: WorkspaceId;
  userId: UserId;
  removedBy: UserId;
}

export type WorkspaceMemberRemovedEvent = BaseEvent<
  'workspace.member.removed',
  WorkspaceMemberRemovedPayload
>;

// ============================================================================
// BOARD EVENT PAYLOADS
// ============================================================================

/**
 * Board Created Event
 */
export interface BoardCreatedPayload {
  boardId: BoardId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  createdBy: UserId;
  position: number;
}

export type BoardCreatedEvent = BaseEvent<'board.created', BoardCreatedPayload>;

/**
 * Board Updated Event
 */
export interface BoardUpdatedPayload {
  boardId: BoardId;
  changes: {
    name?: string;
    description?: string;
  };
  updatedBy: UserId;
  name: string;
  workspaceId: string;
}

export type BoardUpdatedEvent = BaseEvent<'board.updated', BoardUpdatedPayload>;

/**
 * Board Archived Event
 */
export interface BoardArchivedPayload {
  boardId: BoardId;
  archivedBy: UserId;
  workspaceId: string;
}

export type BoardArchivedEvent = BaseEvent<'board.archived', BoardArchivedPayload>;

/**
 * Board Deleted Event
 */
export interface BoardDeletedPayload {
  boardId: BoardId;
  deletedBy: UserId;
}

export type BoardDeletedEvent = BaseEvent<'board.deleted', BoardDeletedPayload>;

// ============================================================================
// LIST EVENT PAYLOADS
// ============================================================================

/**
 * List Created Event
 */
export interface ListCreatedPayload {
  listId: ListId;
  boardId: BoardId;
  name: string;
  position: number;
  createdBy: UserId;
  workspaceId: string | null;
}

export type ListCreatedEvent = BaseEvent<'list.created', ListCreatedPayload>;

/**
 * List Updated Event
 */
export interface ListUpdatedPayload {
  listId: ListId;
  changes: {
    name?: string;
  };
  updatedBy: UserId;
  name: string;
  boardId: string;
  workspaceId: string | null;
}

export type ListUpdatedEvent = BaseEvent<'list.updated', ListUpdatedPayload>;

/**
 * List Reordered Event
 */
export interface ListReorderedPayload {
  listId: ListId;
  boardId: BoardId;
  oldPosition: number;
  newPosition: number;
  reorderedBy: UserId;
  workspaceId: string | null;
}

export type ListReorderedEvent = BaseEvent<'list.reordered', ListReorderedPayload>;

/**
 * List Deleted Event
 */
export interface ListDeletedPayload {
  listId: ListId;
  boardId: BoardId;
  deletedBy: UserId;
  workspaceId: string | null;
}

export type ListDeletedEvent = BaseEvent<'list.deleted', ListDeletedPayload>;

// ============================================================================
// CARD EVENT PAYLOADS
// ============================================================================

/**
 * Card Created Event
 */
export interface CardCreatedPayload {
  cardId: CardId;
  listId: ListId;
  title: string;
  description?: string;
  position: number;
  createdBy: UserId;
}

export type CardCreatedEvent = BaseEvent<'card.created', CardCreatedPayload>;

/**
 * Card Updated Event
 */
export interface CardUpdatedPayload {
  cardId: CardId;
  changes: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    completed?: boolean;
    completedAt?: string | null;
  };
  updatedBy: UserId;
}

export type CardUpdatedEvent = BaseEvent<'card.updated', CardUpdatedPayload>;

/**
 * Card Moved Event
 */
export interface CardMovedPayload {
  cardId: CardId;
  fromListId: ListId;
  toListId: ListId;
  fromPosition: number;
  toPosition: number;
  movedBy: UserId;
}

export type CardMovedEvent = BaseEvent<'card.moved', CardMovedPayload>;

/**
 * Card Deleted Event
 */
export interface CardDeletedPayload {
  cardId: CardId;
  listId: ListId;
  deletedBy: UserId;
}

export type CardDeletedEvent = BaseEvent<'card.deleted', CardDeletedPayload>;

/**
 * Card Completed Event
 */
export interface CardCompletedPayload {
  cardId: CardId;
  listId: ListId;
  completedBy: UserId;
  completedAt: string;
}

export type CardCompletedEvent = BaseEvent<'card.completed', CardCompletedPayload>;

/**
 * Card Uncompleted Event
 */
export interface CardUncompletedPayload {
  cardId: CardId;
  listId: ListId;
  uncompletedBy: UserId;
}

export type CardUncompletedEvent = BaseEvent<'card.uncompleted', CardUncompletedPayload>;

/**
 * Card Member Assigned Event
 */
export interface CardMemberAssignedPayload {
  cardId: CardId;
  userId: UserId;
  assignedBy: UserId;
}

export type CardMemberAssignedEvent = BaseEvent<'card.member.assigned', CardMemberAssignedPayload>;

/**
 * Card Member Unassigned Event
 */
export interface CardMemberUnassignedPayload {
  cardId: CardId;
  userId: UserId;
  unassignedBy: UserId;
}

export type CardMemberUnassignedEvent = BaseEvent<
  'card.member.unassigned',
  CardMemberUnassignedPayload
>;

/**
 * Card Label Added Event
 */
export interface CardLabelAddedPayload {
  cardId: CardId;
  labelId: LabelId;
  addedBy: UserId;
}

export type CardLabelAddedEvent = BaseEvent<'card.label.added', CardLabelAddedPayload>;

/**
 * Card Label Removed Event
 */
export interface CardLabelRemovedPayload {
  cardId: CardId;
  labelId: LabelId;
  removedBy: UserId;
}

export type CardLabelRemovedEvent = BaseEvent<'card.label.removed', CardLabelRemovedPayload>;

// ============================================================================
// COMMENT EVENT PAYLOADS
// ============================================================================

/**
 * Comment Created Event
 */
export interface CommentCreatedPayload {
  commentId: CommentId;
  cardId: CardId;
  userId: UserId;
  content: string;
  mentions: UserId[];
  createdBy: UserId;
}

export type CommentCreatedEvent = BaseEvent<'comment.created', CommentCreatedPayload>;

/**
 * Comment Updated Event
 */
export interface CommentUpdatedPayload {
  commentId: CommentId;
  cardId: CardId;
  changes: {
    content?: string;
    mentions?: UserId[];
  };
  updatedBy: UserId;
}

export type CommentUpdatedEvent = BaseEvent<'comment.updated', CommentUpdatedPayload>;

/**
 * Comment Deleted Event
 */
export interface CommentDeletedPayload {
  commentId: CommentId;
  cardId: CardId;
  deletedBy: UserId;
}

export type CommentDeletedEvent = BaseEvent<'comment.deleted', CommentDeletedPayload>;

/**
 * Comment Mentioned Event
 * Se dispara cuando un usuario es mencionado en un comentario
 */
export interface CommentMentionedPayload {
  commentId: CommentId;
  cardId: CardId;
  mentionedUserId: UserId;
  mentionedByUserId: UserId;
  content: string;
}

export type CommentMentionedEvent = BaseEvent<'comment.mentioned', CommentMentionedPayload>;

// ============================================================================
// DOCUMENT EVENT PAYLOADS
// ============================================================================

/**
 * Document Created Event
 */
export interface DocumentCreatedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  title: string;
  createdBy: UserId;
  templateId?: string; // Si se creó desde una plantilla
}

export type DocumentCreatedEvent = BaseEvent<'document.created', DocumentCreatedPayload>;

/**
 * Document Updated Event
 * Para cambios generales del documento (no contenido Yjs)
 */
export interface DocumentUpdatedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  changes: {
    title?: string;
    content?: string; // Texto plano extraído
  };
  updatedBy: UserId;
}

export type DocumentUpdatedEvent = BaseEvent<'document.updated', DocumentUpdatedPayload>;

/**
 * Document Title Changed Event
 */
export interface DocumentTitleChangedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  oldTitle: string;
  newTitle: string;
  changedBy: UserId;
}

export type DocumentTitleChangedEvent = BaseEvent<
  'document.title.changed',
  DocumentTitleChangedPayload
>;

/**
 * Document Deleted Event
 */
export interface DocumentDeletedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  deletedBy: UserId;
}

export type DocumentDeletedEvent = BaseEvent<'document.deleted', DocumentDeletedPayload>;

/**
 * Document Operation Applied Event
 * Para operaciones Yjs (CRDT) - granular
 */
export interface DocumentOperationAppliedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  operation: {
    type: 'insert' | 'delete' | 'format' | 'update';
    position?: number;
    length?: number;
    content?: string;
    attributes?: Record<string, any>;
  };
  userId: UserId;
  vectorClock: VectorClock; // Para ordenamiento causal
}

export type DocumentOperationAppliedEvent = BaseEvent<
  'document.operation.applied',
  DocumentOperationAppliedPayload
>;

/**
 * Document Format Applied Event
 * Para cambios de formato (negrita, cursiva, etc.)
 */
export interface DocumentFormatAppliedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  format: {
    type: 'bold' | 'italic' | 'underline' | 'strike' | 'heading' | 'list' | 'link' | 'code';
    from: number;
    to: number;
    value?: any; // e.g., nivel de heading, URL del link, etc.
  };
  appliedBy: UserId;
}

export type DocumentFormatAppliedEvent = BaseEvent<
  'document.format.applied',
  DocumentFormatAppliedPayload
>;

/**
 * Document Version Created Event
 * Snapshot automático del documento
 */
export interface DocumentVersionCreatedPayload {
  versionId: DocumentVersionId;
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  metadata: {
    operationCount?: number;
    description?: string;
  };
  createdBy: UserId;
}

export type DocumentVersionCreatedEvent = BaseEvent<
  'document.version.created',
  DocumentVersionCreatedPayload
>;

/**
 * Document Version Restored Event
 */
export interface DocumentVersionRestoredPayload {
  versionId: DocumentVersionId;
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  restoredBy: UserId;
}

export type DocumentVersionRestoredEvent = BaseEvent<
  'document.version.restored',
  DocumentVersionRestoredPayload
>;

/**
 * Document Exported Event
 */
export interface DocumentExportedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  format: 'markdown' | 'pdf' | 'html';
  exportedBy: UserId;
}

export type DocumentExportedEvent = BaseEvent<'document.exported', DocumentExportedPayload>;

/**
 * Document Permission Updated Event
 */
export interface DocumentPermissionUpdatedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  targetUserId?: UserId;
  permission: 'VIEW' | 'COMMENT' | 'EDIT';
  updatedBy: UserId;
}

export type DocumentPermissionUpdatedEvent = BaseEvent<
  'document.permission.updated',
  DocumentPermissionUpdatedPayload
>;

/**
 * Document Comment Added Event
 */
export interface DocumentCommentAddedPayload {
  commentId: DocumentCommentId;
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  content: string;
  position: {
    from: number;
    to: number;
  };
  mentions?: UserId[];
  parentId?: DocumentCommentId; // Para threading
  createdBy: UserId;
}

export type DocumentCommentAddedEvent = BaseEvent<
  'document.comment.added',
  DocumentCommentAddedPayload
>;

/**
 * Document Comment Updated Event
 */
export interface DocumentCommentUpdatedPayload {
  commentId: DocumentCommentId;
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  changes: {
    content?: string;
    mentions?: UserId[];
  };
  updatedBy: UserId;
}

export type DocumentCommentUpdatedEvent = BaseEvent<
  'document.comment.updated',
  DocumentCommentUpdatedPayload
>;

/**
 * Document Comment Deleted Event
 */
export interface DocumentCommentDeletedPayload {
  commentId: DocumentCommentId;
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  deletedBy: UserId;
}

export type DocumentCommentDeletedEvent = BaseEvent<
  'document.comment.deleted',
  DocumentCommentDeletedPayload
>;

/**
 * Document Comment Resolved Event
 */
export interface DocumentCommentResolvedPayload {
  commentId: DocumentCommentId;
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  resolved: boolean;
  resolvedBy: UserId;
}

export type DocumentCommentResolvedEvent = BaseEvent<
  'document.comment.resolved',
  DocumentCommentResolvedPayload
>;

/**
 * Document User Joined Event (Awareness/Presencia)
 */
export interface DocumentUserJoinedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  userId: UserId;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    color: string; // Color del cursor
  };
}

export type DocumentUserJoinedEvent = BaseEvent<'document.user.joined', DocumentUserJoinedPayload>;

/**
 * Document User Left Event
 */
export interface DocumentUserLeftPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  userId: UserId;
}

export type DocumentUserLeftEvent = BaseEvent<'document.user.left', DocumentUserLeftPayload>;

/**
 * Document Cursor Moved Event (Ephemeral)
 */
export interface DocumentCursorMovedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  userId: UserId;
  position: number; // Posición en el documento
  userName: string;
  userColor: string;
}

export type DocumentCursorMovedEvent = BaseEvent<
  'document.cursor.moved',
  DocumentCursorMovedPayload
>;

/**
 * Document Selection Changed Event (Ephemeral)
 */
export interface DocumentSelectionChangedPayload {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
  userId: UserId;
  selection: {
    from: number;
    to: number;
  };
  userName: string;
  userColor: string;
}

export type DocumentSelectionChangedEvent = BaseEvent<
  'document.selection.changed',
  DocumentSelectionChangedPayload
>;

// ============================================================================
// PRESENCE EVENT PAYLOADS
// ============================================================================

/**
 * User Joined Board Event (WebSocket)
 */
export interface UserJoinedBoardPayload {
  userId: UserId;
  boardId: BoardId;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export type UserJoinedBoardEvent = BaseEvent<'presence.user.joined', UserJoinedBoardPayload>;

/**
 * User Left Board Event (WebSocket)
 */
export interface UserLeftBoardPayload {
  userId: UserId;
  boardId: BoardId;
}

export type UserLeftBoardEvent = BaseEvent<'presence.user.left', UserLeftBoardPayload>;

/**
 * User Online Event
 */
export interface UserOnlinePayload {
  userId: UserId;
  workspaceId?: WorkspaceId;
  boardId?: BoardId;
}

export type UserOnlineEvent = BaseEvent<'presence.user.online', UserOnlinePayload>;

/**
 * User Offline Event
 */
export interface UserOfflinePayload {
  userId: UserId;
  lastSeen: number;
}

export type UserOfflineEvent = BaseEvent<'presence.user.offline', UserOfflinePayload>;

/**
 * User Typing Event (Ephemeral - No persiste en DB)
 */
export interface UserTypingPayload {
  userId: UserId;
  cardId: CardId;
  user: {
    id: string;
    name: string;
  };
}

export type UserTypingEvent = BaseEvent<'presence.user.typing', UserTypingPayload>;

/**
 * User Stopped Typing Event (Ephemeral)
 */
export interface UserTypingStoppedPayload {
  userId: UserId;
  cardId: CardId;
}

export type UserTypingStoppedEvent = BaseEvent<
  'presence.user.typing.stopped',
  UserTypingStoppedPayload
>;

/**
 * Cursor Moved Event (Ephemeral)
 */
export interface CursorMovedPayload {
  userId: UserId;
  documentId?: DocumentId;
  position: {
    x: number;
    y: number;
  };
  color: string;
}

export type CursorMovedEvent = BaseEvent<'presence.cursor.moved', CursorMovedPayload>;

// ============================================================================
// NOTIFICATION EVENT PAYLOADS
// ============================================================================

/**
 * Notification Created Event
 */
export interface NotificationCreatedPayload {
  notificationId: NotificationId;
  userId: UserId;
  type:
    | 'COMMENT_MENTION'
    | 'CARD_ASSIGNED'
    | 'CARD_DUE_SOON'
    | 'DOCUMENT_MENTION'
    | 'DOCUMENT_SHARED'
    | 'DOCUMENT_COMMENT';
  title: string;
  message: string;
  data: {
    cardId?: CardId;
    cardTitle?: string;
    documentId?: DocumentId;
    documentTitle?: string;
    commentId?: CommentId | DocumentCommentId;
    commentPreview?: string;
    authorId?: UserId;
    authorName?: string;
    [key: string]: any;
  };
}

export type NotificationCreatedEvent = BaseEvent<
  'notification.created',
  NotificationCreatedPayload
>;

/**
 * Notification Read Event
 */
export interface NotificationReadPayload {
  notificationId: NotificationId;
  userId: UserId;
  unreadCount: number;
}

export type NotificationReadEvent = BaseEvent<'notification.read', NotificationReadPayload>;

/**
 * Notification Read All Event
 */
export interface NotificationReadAllPayload {
  userId: UserId;
  unreadCount: number;
}

export type NotificationReadAllEvent = BaseEvent<
  'notification.read_all',
  NotificationReadAllPayload
>;

/**
 * Notification Deleted Event
 */
export interface NotificationDeletedPayload {
  notificationId: NotificationId;
  userId: UserId;
  unreadCount: number;
}

export type NotificationDeletedEvent = BaseEvent<
  'notification.deleted',
  NotificationDeletedPayload
>;

// ============================================================================
// EVENT UNION TYPES
// ============================================================================

/**
 * All possible events in the system
 */
export type Event =
  | UserRegisteredEvent
  | UserLoggedInEvent
  | UserLoggedOutEvent
  | WorkspaceCreatedEvent
  | WorkspaceUpdatedEvent
  | WorkspaceDeletedEvent
  | WorkspaceMemberInvitedEvent
  | WorkspaceMemberRoleChangedEvent
  | WorkspaceMemberRemovedEvent
  | BoardCreatedEvent
  | BoardUpdatedEvent
  | BoardArchivedEvent
  | BoardDeletedEvent
  | ListCreatedEvent
  | ListUpdatedEvent
  | ListReorderedEvent
  | ListDeletedEvent
  | CardCreatedEvent
  | CardUpdatedEvent
  | CardMovedEvent
  | CardDeletedEvent
  | CardCompletedEvent
  | CardUncompletedEvent
  | CardMemberAssignedEvent
  | CardMemberUnassignedEvent
  | CardLabelAddedEvent
  | CardLabelRemovedEvent
  | CommentCreatedEvent
  | CommentUpdatedEvent
  | CommentDeletedEvent
  | CommentMentionedEvent
  | DocumentCreatedEvent
  | DocumentUpdatedEvent
  | DocumentTitleChangedEvent
  | DocumentDeletedEvent
  | DocumentOperationAppliedEvent
  | DocumentFormatAppliedEvent
  | DocumentVersionCreatedEvent
  | DocumentVersionRestoredEvent
  | DocumentExportedEvent
  | DocumentPermissionUpdatedEvent
  | DocumentCommentAddedEvent
  | DocumentCommentUpdatedEvent
  | DocumentCommentDeletedEvent
  | DocumentCommentResolvedEvent
  | DocumentUserJoinedEvent
  | DocumentUserLeftEvent
  | DocumentCursorMovedEvent
  | DocumentSelectionChangedEvent
  | NotificationCreatedEvent
  | NotificationReadEvent
  | NotificationReadAllEvent
  | NotificationDeletedEvent
  | UserJoinedBoardEvent
  | UserLeftBoardEvent
  | UserOnlineEvent
  | UserOfflineEvent
  | UserTypingEvent
  | UserTypingStoppedEvent
  | CursorMovedEvent
  | BaseEvent<EventType, unknown>;

// ============================================================================
// EVENT HELPERS
// ============================================================================

/**
 * Type guard to check event type
 */
export function isEventType<T extends EventType>(
  event: Event,
  type: T
): event is Extract<Event, { type: T }> {
  return event.type === type;
}

/**
 * Extract payload type from event type
 */
export type PayloadOf<T extends EventType> = Extract<Event, { type: T }>['payload'];

/**
 * Helper para identificar eventos efímeros (no se persisten en DB)
 */
export const EPHEMERAL_EVENTS = new Set<EventType>([
  'presence.user.typing',
  'presence.user.typing.stopped',
  'presence.cursor.moved',
  'document.cursor.moved',
  'document.selection.changed',
]);

export function isEphemeralEvent(eventType: EventType): boolean {
  return EPHEMERAL_EVENTS.has(eventType);
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

/**
 * WebSocket message structure for client-server communication
 */
export interface WebSocketMessage<T = unknown> {
  type: 'event' | 'command' | 'query' | 'error' | 'ack';
  payload: T;
  messageId?: string;
  timestamp?: number;
}

/**
 * Command types for WebSocket operations
 */
export type WebSocketCommand =
  | 'join.board'
  | 'leave.board'
  | 'join.document'
  | 'leave.document'
  | 'typing.start'
  | 'typing.stop'
  | 'cursor.move'
  | 'selection.change';

/**
 * Join Board Command
 */
export interface JoinBoardCommand {
  boardId: BoardId;
}

/**
 * Leave Board Command
 */
export interface LeaveBoardCommand {
  boardId: BoardId;
}

/**
 * Join Document Command
 */
export interface JoinDocumentCommand {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
}

/**
 * Leave Document Command
 */
export interface LeaveDocumentCommand {
  documentId: DocumentId;
  workspaceId: WorkspaceId;
}

/**
 * Typing Start Command
 */
export interface TypingStartCommand {
  cardId: CardId;
}

/**
 * Typing Stop Command
 */
export interface TypingStopCommand {
  cardId: CardId;
}

/**
 * Cursor Move Command
 */
export interface CursorMoveCommand {
  documentId: DocumentId;
  position: number;
}

/**
 * Selection Change Command
 */
export interface SelectionChangeCommand {
  documentId: DocumentId;
  selection: {
    from: number;
    to: number;
  };
}
