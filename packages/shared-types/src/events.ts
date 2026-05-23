// packages/shared-types/src/events.ts

/**
 * Core Event System Types — v2
 *
 * Schema canónico: cada evento tiene actor, subject, context y delta
 * separados del payload. Elimina duplicados y estandariza estructura.
 */

// ============================================================================
// BRANDED TYPES
// ============================================================================

export type Brand<K, T> = K & { __brand: T };

export type UserId           = Brand<string, 'UserId'>;
export type WorkspaceId      = Brand<string, 'WorkspaceId'>;
export type BoardId          = Brand<string, 'BoardId'>;
export type ListId           = Brand<string, 'ListId'>;
export type CardId           = Brand<string, 'CardId'>;
export type DocumentId       = Brand<string, 'DocumentId'>;
export type DocumentVersionId = Brand<string, 'DocumentVersionId'>;
export type DocumentCommentId = Brand<string, 'DocumentCommentId'>;
export type CommentId        = Brand<string, 'CommentId'>;
export type LabelId          = Brand<string, 'LabelId'>;
export type NotificationId   = Brand<string, 'NotificationId'>;
export type EventId          = Brand<string, 'EventId'>;
export type SocketId         = Brand<string, 'SocketId'>;

// ============================================================================
// VECTOR CLOCK
// ============================================================================

export interface VectorClock {
  [userId: string]: number;
}

// ============================================================================
// CANONICAL EVENT TYPES
// ============================================================================

export type WorkspaceEventType =
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  | 'workspace.member.invited'
  | 'workspace.member.joined'
  | 'workspace.member.removed'
  | 'workspace.member.role-changed';

export type BoardEventType =
  | 'board.created'
  | 'board.updated'
  | 'board.deleted'
  | 'board.archived'
  | 'board.restored';

export type ListEventType =
  | 'list.created'
  | 'list.updated'
  | 'list.deleted'
  | 'list.archived'
  | 'list.order-changed';

export type CardEventType =
  | 'card.created'
  | 'card.updated'
  | 'card.deleted'
  | 'card.moved'
  | 'card.status-changed'
  | 'card.archived'
  | 'card.restored'
  | 'card.due-date.set'
  | 'card.due-date.removed'
  | 'card.priority.changed'
  | 'card.member.assigned'
  | 'card.member.removed'
  | 'card.label.added'
  | 'card.label.removed'
  | 'card.dependency.added'
  | 'card.dependency.removed';

export type CommentEventType =
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'comment.mention-added';

export type ChecklistEventType =
  | 'checklist.created'
  | 'checklist.deleted'
  | 'checklist.item.created'
  | 'checklist.item.updated'
  | 'checklist.item.deleted'
  | 'checklist.item.status-changed';

export type DocumentEventType =
  | 'document.created'
  | 'document.updated'
  | 'document.deleted'
  | 'document.version.saved'
  | 'document.version.restored'
  | 'document.exported'
  | 'document.permission.changed'
  | 'document.comment.added'
  | 'document.comment.resolved';

export type ProjectEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.status.changed'
  | 'project.board.linked'
  | 'project.board.unlinked'
  | 'project.milestone.created'
  | 'project.milestone.completed';

export type TeamEventType =
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'team.member.added'
  | 'team.member.removed'
  | 'team.member.role-changed';

export type GithubEventType =
  | 'github.push.received'
  | 'github.pr.opened'
  | 'github.pr.closed'
  | 'github.pr.merged'
  | 'github.pr.review-submitted'
  | 'github.pr.review-requested';

/** Efímeros: solo WebSocket, nunca persisten en DB */
export type EphemeralEventType =
  | 'presence.user.joined'
  | 'presence.user.left'
  | 'presence.user.typing'
  | 'presence.user.typing.stopped'
  | 'presence.cursor.moved'
  | 'document.user.joined'
  | 'document.user.left'
  | 'document.cursor.moved'
  | 'document.selection.changed';

export type EventType =
  | WorkspaceEventType
  | BoardEventType
  | ListEventType
  | CardEventType
  | CommentEventType
  | ChecklistEventType
  | DocumentEventType
  | ProjectEventType
  | TeamEventType
  | GithubEventType
  | EphemeralEventType;

// ============================================================================
// SUBJECT TYPES
// ============================================================================

export type SubjectType =
  | 'workspace'
  | 'board'
  | 'list'
  | 'card'
  | 'comment'
  | 'checklist'
  | 'checklist-item'
  | 'document'
  | 'document-comment'
  | 'project'
  | 'milestone'
  | 'team'
  | 'member'
  | 'label'
  | 'dependency'
  | 'version'
  | 'repository';

// ============================================================================
// CANONICAL BASE EVENT STRUCTURE
// ============================================================================

export interface AetherActor {
  id: string;
  name: string;
}

export interface AetherSubject {
  type: SubjectType;
  id: string;
  name: string;
}

export interface AetherContext {
  workspaceId: string;
  boardId?:    string;
  listId?:     string;
  cardId?:     string;
  documentId?: string;
}

export interface AetherDelta {
  before: Record<string, unknown>;
  after:  Record<string, unknown>;
}

export interface AetherEvent<
  TType extends EventType = EventType,
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  eventId:        string;
  type:           TType;
  timestamp:      number;
  version:        1;
  actor:          AetherActor;
  subject:        AetherSubject;
  context:        AetherContext;
  delta?:         AetherDelta;
  payload:        TPayload;
  vectorClock:    VectorClock;
  correlationId?: string;
  socketId?:      string;
}

/** Alias de compatibilidad */
export type Event = AetherEvent;

// ============================================================================
// WORKSPACE PAYLOADS
// ============================================================================

export type WorkspaceCreatedPayload    = { plan?: string };
export type WorkspaceUpdatedPayload    = Record<string, never>;
export type WorkspaceDeletedPayload    = Record<string, never>;
export type WorkspaceMemberInvitedPayload = {
  inviteeEmail: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};
export type WorkspaceMemberJoinedPayload = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};
export type WorkspaceMemberRemovedPayload = { reason?: string };
export type WorkspaceMemberRoleChangedPayload = Record<string, never>; // delta cubre before/after role

// ============================================================================
// BOARD PAYLOADS
// ============================================================================

export type BoardCreatedPayload    = { visibility?: string };
export type BoardUpdatedPayload    = Record<string, never>;
export type BoardDeletedPayload    = Record<string, never>;
export type BoardArchivedPayload   = Record<string, never>;
export type BoardRestoredPayload = Record<string, never>;

// ============================================================================
// LIST PAYLOADS
// ============================================================================

export type ListCreatedPayload   = { position: number };
export type ListUpdatedPayload   = Record<string, never>;
export type ListDeletedPayload   = Record<string, never>;
export type ListArchivedPayload  = Record<string, never>;
export type ListOrderChangedPayload = Record<string, never>; // delta: { before: {position}, after: {position} }

// ============================================================================
// CARD PAYLOADS
// ============================================================================

export type CardCreatedPayload      = { position: number };
export type CardUpdatedPayload      = Record<string, never>;
export type CardDeletedPayload      = Record<string, never>;
export type CardMovedPayload        = Record<string, never>; // delta: { before: {listId,listName,position}, after: ... }
export type CardStatusChangedPayload = Record<string, never>; // delta: { before: {completed}, after: {completed} }
export type CardArchivedPayload     = Record<string, never>;
export type CardRestoredPayload     = Record<string, never>;
export type CardDueDateSetPayload   = Record<string, never>; // delta: { before: {dueDate}, after: {dueDate} }
export type CardDueDateRemovedPayload = Record<string, never>;
export type CardPriorityChangedPayload = Record<string, never>; // delta: { before: {priority}, after: {priority} }

export type CardMemberAssignedPayload = {
  memberId:   string;
  memberName: string;
};
export type CardMemberRemovedPayload = {
  memberId:   string;
  memberName: string;
};
export type CardLabelAddedPayload = {
  labelId:   string;
  labelName: string;
  color?:    string;
};
export type CardLabelRemovedPayload = {
  labelId:   string;
  labelName: string;
};
export type CardDependencyAddedPayload = {
  dependsOnId:    string;
  dependsOnTitle: string;
};
export type CardDependencyRemovedPayload = {
  dependsOnId:    string;
  dependsOnTitle: string;
};

// ============================================================================
// COMMENT PAYLOADS
// ============================================================================

export type CommentCreatedPayload  = { content: string; mentions: string[] };
export type CommentUpdatedPayload  = Record<string, never>; // delta: { before: {content}, after: {content} }
export type CommentDeletedPayload  = Record<string, never>;
export type CommentMentionAddedPayload = {
  mentionedUserId:   string;
  mentionedUserName: string;
  contentPreview:    string;
};

// ============================================================================
// CHECKLIST PAYLOADS
// ============================================================================

export type ChecklistCreatedPayload         = Record<string, never>;
export type ChecklistDeletedPayload         = Record<string, never>;
export type ChecklistItemCreatedPayload     = { position: number };
export type ChecklistItemUpdatedPayload     = Record<string, never>; // delta: { before: {title}, after: {title} }
export type ChecklistItemDeletedPayload     = Record<string, never>;
export type ChecklistItemStatusChangedPayload = Record<string, never>; // delta: { before: {checked}, after: {checked} } — event: checklist.item.status-changed

// ============================================================================
// DOCUMENT PAYLOADS
// ============================================================================

export type DocumentCreatedPayload           = Record<string, never>;
export type DocumentUpdatedPayload           = Record<string, never>; // delta: { before: {title}, after: {title} }
export type DocumentDeletedPayload           = Record<string, never>;
export type DocumentVersionSavedPayload      = { versionNumber: number; size?: number };
export type DocumentVersionRestoredPayload   = Record<string, never>; // delta: { before: {versionNumber}, after: {versionNumber} }
export type DocumentExportedPayload          = { format: 'pdf' | 'docx' | 'md' };
export type DocumentPermissionChangedPayload = {
  targetUserId?:   string;
  targetUserName?: string;
}; // delta: { before: {permission}, after: {permission} }
export type DocumentCommentAddedPayload    = { content: string; mentions: string[] };
export type DocumentCommentResolvedPayload = Record<string, never>;

// ============================================================================
// PROJECT PAYLOADS
// ============================================================================

export type ProjectCreatedPayload           = Record<string, never>;
export type ProjectUpdatedPayload           = Record<string, never>;
export type ProjectDeletedPayload           = Record<string, never>;
export type ProjectStatusChangedPayload     = Record<string, never>; // delta: { before: {status}, after: {status} }
export type ProjectMilestoneCreatedPayload  = { dueDate?: string };
export type ProjectMilestoneCompletedPayload = Record<string, never>;

// ============================================================================
// TEAM PAYLOADS
// ============================================================================

export type TeamCreatedPayload           = Record<string, never>;
export type TeamUpdatedPayload           = Record<string, never>;
export type TeamDeletedPayload           = Record<string, never>;
export type TeamMemberAddedPayload       = { role: string };
export type TeamMemberRemovedPayload     = Record<string, never>;
export type TeamMemberRoleChangedPayload = { memberId: string }; // delta: { before: {role}, after: {role} }

// ============================================================================
// GITHUB PAYLOADS
// ============================================================================

export type GithubPushReceivedPayload      = { branch: string; commitCount: number; ref: string };
export type GithubPrOpenedPayload          = { prId: string; title: string; branch: string };
export type GithubPrClosedPayload          = { prId: string; title: string };
export type GithubPrMergedPayload          = { prId: string; title: string; branch: string };
export type GithubPrReviewSubmittedPayload = { prId: string; reviewer: string; state: string };
export type GithubPrReviewRequestedPayload = { prId: string; reviewer: string };

// ============================================================================
// EPHEMERAL PAYLOADS (solo WebSocket)
// ============================================================================

export type PresenceUserJoinedPayload = {
  user: { id: string; name: string; email: string; avatar?: string };
};
export type PresenceUserLeftPayload    = Record<string, never>;
export type PresenceUserTypingPayload  = { cardId: string };
export type PresenceUserTypingStoppedPayload = { cardId: string };
export type PresenceCursorMovedPayload = { x: number; y: number; color: string };
export type DocumentUserJoinedPayload  = {
  user: { id: string; name: string; avatar?: string; color: string };
};
export type DocumentUserLeftPayload    = Record<string, never>;
export type DocumentCursorMovedPayload = { position: number; color: string };
export type DocumentSelectionChangedPayload = {
  selection: { from: number; to: number };
  color: string;
};

// ============================================================================
// TYPED EVENT ALIASES
// ============================================================================

export type WorkspaceCreatedEvent      = AetherEvent<'workspace.created',           WorkspaceCreatedPayload>;
export type WorkspaceUpdatedEvent      = AetherEvent<'workspace.updated',           WorkspaceUpdatedPayload>;
export type WorkspaceDeletedEvent      = AetherEvent<'workspace.deleted',           WorkspaceDeletedPayload>;
export type WorkspaceMemberInvitedEvent = AetherEvent<'workspace.member.invited',   WorkspaceMemberInvitedPayload>;
export type WorkspaceMemberJoinedEvent  = AetherEvent<'workspace.member.joined',    WorkspaceMemberJoinedPayload>;
export type WorkspaceMemberRemovedEvent = AetherEvent<'workspace.member.removed',   WorkspaceMemberRemovedPayload>;
export type WorkspaceMemberRoleChangedEvent = AetherEvent<'workspace.member.role-changed', WorkspaceMemberRoleChangedPayload>;

export type BoardCreatedEvent  = AetherEvent<'board.created',   BoardCreatedPayload>;
export type BoardUpdatedEvent  = AetherEvent<'board.updated',   BoardUpdatedPayload>;
export type BoardDeletedEvent  = AetherEvent<'board.deleted',   BoardDeletedPayload>;
export type BoardArchivedEvent = AetherEvent<'board.archived',  BoardArchivedPayload>;
export type BoardRestoredEvent = AetherEvent<'board.restored',  BoardRestoredPayload>;

export type ListCreatedEvent      = AetherEvent<'list.created',      ListCreatedPayload>;
export type ListUpdatedEvent      = AetherEvent<'list.updated',      ListUpdatedPayload>;
export type ListDeletedEvent      = AetherEvent<'list.deleted',      ListDeletedPayload>;
export type ListArchivedEvent     = AetherEvent<'list.archived',     ListArchivedPayload>;
export type ListOrderChangedEvent = AetherEvent<'list.order-changed',ListOrderChangedPayload>;

export type CardCreatedEvent         = AetherEvent<'card.created',          CardCreatedPayload>;
export type CardUpdatedEvent         = AetherEvent<'card.updated',          CardUpdatedPayload>;
export type CardDeletedEvent         = AetherEvent<'card.deleted',          CardDeletedPayload>;
export type CardMovedEvent           = AetherEvent<'card.moved',            CardMovedPayload>;
export type CardStatusChangedEvent   = AetherEvent<'card.status-changed',   CardStatusChangedPayload>;
export type CardArchivedEvent        = AetherEvent<'card.archived',         CardArchivedPayload>;
export type CardRestoredEvent        = AetherEvent<'card.restored',         CardRestoredPayload>;
export type CardDueDateSetEvent      = AetherEvent<'card.due-date.set',     CardDueDateSetPayload>;
export type CardDueDateRemovedEvent  = AetherEvent<'card.due-date.removed', CardDueDateRemovedPayload>;
export type CardPriorityChangedEvent = AetherEvent<'card.priority.changed', CardPriorityChangedPayload>;
export type CardMemberAssignedEvent  = AetherEvent<'card.member.assigned',  CardMemberAssignedPayload>;
export type CardMemberRemovedEvent   = AetherEvent<'card.member.removed',   CardMemberRemovedPayload>;
export type CardLabelAddedEvent      = AetherEvent<'card.label.added',      CardLabelAddedPayload>;
export type CardLabelRemovedEvent    = AetherEvent<'card.label.removed',    CardLabelRemovedPayload>;
export type CardDependencyAddedEvent   = AetherEvent<'card.dependency.added',   CardDependencyAddedPayload>;
export type CardDependencyRemovedEvent = AetherEvent<'card.dependency.removed', CardDependencyRemovedPayload>;

export type CommentCreatedEvent      = AetherEvent<'comment.created',      CommentCreatedPayload>;
export type CommentUpdatedEvent      = AetherEvent<'comment.updated',      CommentUpdatedPayload>;
export type CommentDeletedEvent      = AetherEvent<'comment.deleted',      CommentDeletedPayload>;
export type CommentMentionAddedEvent = AetherEvent<'comment.mention-added',CommentMentionAddedPayload>;

export type ChecklistCreatedEvent             = AetherEvent<'checklist.created',            ChecklistCreatedPayload>;
export type ChecklistDeletedEvent             = AetherEvent<'checklist.deleted',            ChecklistDeletedPayload>;
export type ChecklistItemCreatedEvent         = AetherEvent<'checklist.item.created',       ChecklistItemCreatedPayload>;
export type ChecklistItemUpdatedEvent         = AetherEvent<'checklist.item.updated',       ChecklistItemUpdatedPayload>;
export type ChecklistItemDeletedEvent         = AetherEvent<'checklist.item.deleted',       ChecklistItemDeletedPayload>;
export type ChecklistItemStatusChangedEvent   = AetherEvent<'checklist.item.status-changed',ChecklistItemStatusChangedPayload>;

export type DocumentCreatedEvent            = AetherEvent<'document.created',            DocumentCreatedPayload>;
export type DocumentUpdatedEvent            = AetherEvent<'document.updated',            DocumentUpdatedPayload>;
export type DocumentDeletedEvent            = AetherEvent<'document.deleted',            DocumentDeletedPayload>;
export type DocumentVersionSavedEvent       = AetherEvent<'document.version.saved',      DocumentVersionSavedPayload>;
export type DocumentVersionRestoredEvent    = AetherEvent<'document.version.restored',   DocumentVersionRestoredPayload>;
export type DocumentExportedEvent           = AetherEvent<'document.exported',           DocumentExportedPayload>;
export type DocumentPermissionChangedEvent  = AetherEvent<'document.permission.changed', DocumentPermissionChangedPayload>;
export type DocumentCommentAddedEvent       = AetherEvent<'document.comment.added',      DocumentCommentAddedPayload>;
export type DocumentCommentResolvedEvent    = AetherEvent<'document.comment.resolved',   DocumentCommentResolvedPayload>;

export type ProjectCreatedEvent            = AetherEvent<'project.created',            ProjectCreatedPayload>;
export type ProjectUpdatedEvent            = AetherEvent<'project.updated',            ProjectUpdatedPayload>;
export type ProjectDeletedEvent            = AetherEvent<'project.deleted',            ProjectDeletedPayload>;
export type ProjectStatusChangedEvent      = AetherEvent<'project.status.changed',     ProjectStatusChangedPayload>;
export type ProjectBoardLinkedEvent        = AetherEvent<'project.board.linked',        Record<string, never>>;
export type ProjectBoardUnlinkedEvent      = AetherEvent<'project.board.unlinked',      Record<string, never>>;
export type ProjectMilestoneCreatedEvent   = AetherEvent<'project.milestone.created',  ProjectMilestoneCreatedPayload>;
export type ProjectMilestoneCompletedEvent = AetherEvent<'project.milestone.completed',ProjectMilestoneCompletedPayload>;

export type TeamCreatedEvent          = AetherEvent<'team.created',          TeamCreatedPayload>;
export type TeamUpdatedEvent          = AetherEvent<'team.updated',          TeamUpdatedPayload>;
export type TeamDeletedEvent          = AetherEvent<'team.deleted',          TeamDeletedPayload>;
export type TeamMemberAddedEvent      = AetherEvent<'team.member.added',     TeamMemberAddedPayload>;
export type TeamMemberRemovedEvent    = AetherEvent<'team.member.removed',   TeamMemberRemovedPayload>;
export type TeamMemberRoleChangedEvent = AetherEvent<'team.member.role-changed',TeamMemberRoleChangedPayload>;

export type GithubPushReceivedEvent        = AetherEvent<'github.push.received',       GithubPushReceivedPayload>;
export type GithubPrOpenedEvent            = AetherEvent<'github.pr.opened',           GithubPrOpenedPayload>;
export type GithubPrClosedEvent            = AetherEvent<'github.pr.closed',           GithubPrClosedPayload>;
export type GithubPrMergedEvent            = AetherEvent<'github.pr.merged',           GithubPrMergedPayload>;
export type GithubPrReviewSubmittedEvent   = AetherEvent<'github.pr.review-submitted', GithubPrReviewSubmittedPayload>;
export type GithubPrReviewRequestedEvent   = AetherEvent<'github.pr.review-requested', GithubPrReviewRequestedPayload>;

// ============================================================================
// EPHEMERAL EVENTS (solo WebSocket, sin persistir)
// ============================================================================

export const EPHEMERAL_EVENTS = new Set<EventType>([
  'presence.user.joined',
  'presence.user.left',
  'presence.user.typing',
  'presence.user.typing.stopped',
  'presence.cursor.moved',
  'document.user.joined',
  'document.user.left',
  'document.cursor.moved',
  'document.selection.changed',
]);

export function isEphemeralEvent(eventType: EventType): boolean {
  return EPHEMERAL_EVENTS.has(eventType);
}

// ============================================================================
// HELPERS
// ============================================================================

export function isEventType<T extends EventType>(
  event: AetherEvent,
  type: T
): event is AetherEvent<T> {
  return event.type === type;
}

/**
 * Serializa un evento a texto legible para logs y contexto del LLM.
 *
 * Ejemplo de salida:
 *   [2026-05-21T10:03Z] card.status.changed
 *     actor: Sebastián Hernández
 *     subject: "Fix auth bug" (card)
 *     context: workspace abc, board "Backend", list "En progreso"
 *     delta: completed false → true
 */
export function toReadable(event: AetherEvent): string {
  const date = new Date(event.timestamp).toISOString().replace('.000Z', 'Z');
  const lines: string[] = [
    `[${date}] ${event.type}`,
    `  actor: ${event.actor.name}`,
    `  subject: "${event.subject.name}" (${event.subject.type})`,
  ];

  const ctx = event.context;
  const ctxParts: string[] = [`workspace ${ctx.workspaceId.slice(0, 8)}`];
  if (ctx.boardId)    ctxParts.push(`board ${ctx.boardId.slice(0, 8)}`);
  if (ctx.listId)     ctxParts.push(`list ${ctx.listId.slice(0, 8)}`);
  if (ctx.cardId)     ctxParts.push(`card ${ctx.cardId.slice(0, 8)}`);
  if (ctx.documentId) ctxParts.push(`doc ${ctx.documentId.slice(0, 8)}`);
  lines.push(`  context: ${ctxParts.join(', ')}`);

  if (event.delta) {
    const before = JSON.stringify(event.delta.before);
    const after  = JSON.stringify(event.delta.after);
    lines.push(`  delta: ${before} → ${after}`);
  }

  const payloadKeys = Object.keys(event.payload);
  if (payloadKeys.length > 0) {
    lines.push(`  payload: ${JSON.stringify(event.payload)}`);
  }

  return lines.join('\n');
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES (sin cambios)
// ============================================================================

export interface WebSocketMessage<T = unknown> {
  type: 'event' | 'command' | 'query' | 'error' | 'ack';
  payload: T;
  messageId?: string;
  timestamp?: number;
}

export type WebSocketCommand =
  | 'join.board'
  | 'leave.board'
  | 'join.document'
  | 'leave.document'
  | 'typing.start'
  | 'typing.stop'
  | 'cursor.move'
  | 'selection.change';

export interface JoinBoardCommand    { boardId: BoardId }
export interface LeaveBoardCommand   { boardId: BoardId }
export interface JoinDocumentCommand { documentId: DocumentId; workspaceId: WorkspaceId }
export interface LeaveDocumentCommand { documentId: DocumentId; workspaceId: WorkspaceId }
export interface TypingStartCommand  { cardId: CardId }
export interface TypingStopCommand   { cardId: CardId }
export interface CursorMoveCommand   { documentId: DocumentId; position: number }
export interface SelectionChangeCommand {
  documentId: DocumentId;
  selection: { from: number; to: number };
}

// NotificationType está definido en models.ts — no se duplica aquí.
