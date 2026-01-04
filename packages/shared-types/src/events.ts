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
export type CommentId = Brand<string, 'CommentId'>;
export type LabelId = Brand<string, 'LabelId'>;
export type NotificationId = Brand<string, 'NotificationId'>;
export type EventId = Brand<string, 'EventId'>;

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
  | 'card.member.assigned'
  | 'card.member.unassigned'
  | 'card.label.added'
  | 'card.label.removed'
  | 'card.comment.added'
  | 'card.comment.updated'
  | 'card.comment.deleted';

/**
 * Document Events
 */
export type DocumentEventType =
  | 'document.created'
  | 'document.updated'
  | 'document.deleted'
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
  | 'presence.user.online'
  | 'presence.user.offline'
  | 'presence.user.typing';

/**
 * All possible event types
 */
export type EventType =
  | AuthEventType
  | WorkspaceEventType
  | BoardEventType
  | ListEventType
  | CardEventType
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
}

export type BoardCreatedEvent = BaseEvent<'board.created', BoardCreatedPayload>;

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
}

export type ListCreatedEvent = BaseEvent<'list.created', ListCreatedPayload>;

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
 * Card Moved Event
 */
export interface CardMovedPayload {
  cardId: CardId;
  fromListId: ListId;
  toListId: ListId;
  fromPosition: number;
  toPosition: number;
}

export type CardMovedEvent = BaseEvent<'card.moved', CardMovedPayload>;

/**
 * Card Updated Event
 */
export interface CardUpdatedPayload {
  cardId: CardId;
  changes: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export type CardUpdatedEvent = BaseEvent<'card.updated', CardUpdatedPayload>;

// ============================================================================
// PRESENCE EVENT PAYLOADS
// ============================================================================

/**
 * User Online Event
 */
export interface UserOnlinePayload {
  userId: UserId;
  workspaceId?: WorkspaceId;
  boardId?: BoardId;
}

export type UserOnlineEvent = BaseEvent<'presence.user.online', UserOnlinePayload>;

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
  | ListCreatedEvent
  | CardCreatedEvent
  | CardMovedEvent
  | CardUpdatedEvent
  | UserOnlineEvent
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
