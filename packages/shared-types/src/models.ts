/**
 * Domain Models
 * 
 * These are the read models (projections) built from events.
 * The database stores these, but events are the source of truth.
 */

import type {
  UserId,
  WorkspaceId,
  BoardId,
  ListId,
  CardId,
  DocumentId,
  CommentId,
  LabelId,
  NotificationId,
} from './events';

// ============================================================================
// ENUMS
// ============================================================================

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum CardPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum NotificationType {
  CARD_ASSIGNED = 'CARD_ASSIGNED',
  MENTIONED = 'MENTIONED',
  COMMENT_REPLY = 'COMMENT_REPLY',
  DUE_DATE_REMINDER = 'DUE_DATE_REMINDER',
  WORKSPACE_INVITE = 'WORKSPACE_INVITE',
}

// ============================================================================
// USER
// ============================================================================

export interface User {
  id: UserId;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  workspaces: WorkspaceMembership[];
}

// ============================================================================
// WORKSPACE
// ============================================================================

export interface Workspace {
  id: WorkspaceId;
  name: string;
  description?: string;
  ownerId: UserId;
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMembership {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: UserRole;
  joinedAt: Date;
}

export interface WorkspaceWithMembers extends Workspace {
  members: (WorkspaceMembership & { user: User })[];
}

// ============================================================================
// BOARD
// ============================================================================

export interface Board {
  id: BoardId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  position: number;
  archived: boolean;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardWithLists extends Board {
  lists: List[];
}

// ============================================================================
// LIST
// ============================================================================

export interface List {
  id: ListId;
  boardId: BoardId;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListWithCards extends List {
  cards: Card[];
}

// ============================================================================
// CARD
// ============================================================================

export interface Card {
  id: CardId;
  listId: ListId;
  title: string;
  description?: string;
  position: number;
  dueDate?: Date;
  priority?: CardPriority;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardMember {
  cardId: CardId;
  userId: UserId;
  assignedAt: Date;
}

export interface CardLabel {
  cardId: CardId;
  labelId: LabelId;
}

export interface CardWithDetails extends Card {
  assignedMembers: (CardMember & { user: User })[];
  labels: (CardLabel & { label: Label })[];
  comments: Comment[];
  attachments: Attachment[];
}

// ============================================================================
// LABEL
// ============================================================================

export interface Label {
  id: LabelId;
  workspaceId: WorkspaceId;
  name: string;
  color: string;
  createdAt: Date;
}

// ============================================================================
// COMMENT
// ============================================================================

export interface Comment {
  id: CommentId;
  userId: UserId;
  cardId?: CardId;
  documentId?: DocumentId;
  content: string;
  parentId?: CommentId; // For threading
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentWithUser extends Comment {
  user: User;
  replies?: CommentWithUser[];
}

// ============================================================================
// DOCUMENT
// ============================================================================

export interface Document {
  id: DocumentId;
  workspaceId: WorkspaceId;
  title: string;
  content: Record<string, unknown>; // JSON structure for blocks
  version: number;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// NOTIFICATION
// ============================================================================

export interface Notification {
  id: NotificationId;
  userId: UserId;
  type: NotificationType;
  content: Record<string, unknown>; // JSON content specific to type
  read: boolean;
  createdAt: Date;
}

// ============================================================================
// ATTACHMENT
// ============================================================================

export interface Attachment {
  id: string;
  cardId?: CardId;
  documentId?: DocumentId;
  userId: UserId;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

// ============================================================================
// PRESENCE
// ============================================================================

export interface UserPresence {
  userId: UserId;
  workspaceId?: WorkspaceId;
  boardId?: BoardId;
  documentId?: DocumentId;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
}

export interface CursorPosition {
  userId: UserId;
  documentId: DocumentId;
  position: {
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}
