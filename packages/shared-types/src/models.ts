/**
 * Domain Models
 *
 * These are the read models (projections) built from events.
 * The database stores these, but events are the source of truth.
 */

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

/**
 * Workspace Role Type (para usar en lugar del enum cuando sea necesario)
 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

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
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  workspaces: WorkspaceMembership[];
}

// ============================================================================
// WORKSPACE
// ============================================================================

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  // Propiedades opcionales calculadas
  userRole?: WorkspaceRole;
  boardCount?: number;
  memberCount?: number;
}

/**
 * Workspace Membership
 * Relaciona un usuario con un workspace y su rol
 */
export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  // Usuario puede ser parcial (solo datos básicos) o completo
  user?: Partial<User> & { id: string; name: string; email: string };
}

export interface WorkspaceWithMembers extends Workspace {
  members: (WorkspaceMembership & { user: User })[];
}

// ============================================================================
// BOARD
// ============================================================================

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  position: number;
  archived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Propiedades opcionales calculadas/cargadas
  listCount?: number;
  cardCount?: number;
  lists?: List[]; // Para cuando se carga el board completo
}

export interface BoardWithLists extends Board {
  lists: List[];
}

// ============================================================================
// LIST
// ============================================================================

export interface List {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  // Propiedades opcionales calculadas/cargadas
  cardCount?: number;
  cards?: Card[]; // Para cuando se carga la lista completa
}

export interface ListWithCards extends List {
  cards: Card[];
}

// ============================================================================
// CARD - MILESTONE 4
// ============================================================================

export interface Card {
  id: string;
  listId: string;
  title: string;
  description?: string;
  position: number;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Relaciones opcionales (cuando se incluyen con queries)
  members?: User[];
  labels?: Label[];
  assignedUsers?: User[]; // Alias para members
}

export interface CardMember {
  cardId: string;
  userId: string;
  assignedAt: string;
}

export interface CardLabel {
  cardId: string;
  labelId: string;
}

// ✅ CardWithDetails NO extiende Card para evitar conflictos de tipos
export interface CardWithDetails {
  // Propiedades base de Card
  id: string;
  listId: string;
  title: string;
  description?: string;
  position: number;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Relaciones detalladas (con objetos completos)
  assignedMembers: (CardMember & { user: User })[];
  labels: (CardLabel & { label: Label })[];
  comments: Comment[];
  attachments: Attachment[];
}

// ============================================================================
// LABEL - MILESTONE 4
// ============================================================================

export interface Label {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// COMMENT
// ============================================================================

export interface Comment {
  id: string;
  userId: string;
  cardId?: string;
  documentId?: string;
  content: string;
  parentId?: string; // For threading
  createdAt: string;
  updatedAt: string;
}

export interface CommentWithUser extends Comment {
  user: User;
  replies?: CommentWithUser[];
}

// ============================================================================
// DOCUMENT
// ============================================================================

export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  content: Record<string, unknown>; // JSON structure for blocks
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// NOTIFICATION
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  content: Record<string, unknown>; // JSON content specific to type
  read: boolean;
  createdAt: string;
}

// ============================================================================
// ATTACHMENT
// ============================================================================

export interface Attachment {
  id: string;
  cardId?: string;
  documentId?: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

// ============================================================================
// PRESENCE - MILESTONE 5
// ============================================================================

/**
 * User Presence State
 * Representa el estado de presencia de un usuario en tiempo real
 */
export interface UserPresence {
  userId: string;
  workspaceId?: string;
  boardId?: string;
  documentId?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: string; // ISO timestamp
  socketId?: string;
}

/**
 * Active Users in Board
 * Lista de usuarios activos viendo un board específico
 */
export interface BoardPresence {
  boardId: string;
  users: ActiveUser[];
  updatedAt: string;
}

/**
 * Active User Info
 * Información básica de usuario activo
 */
export interface ActiveUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string; // ISO timestamp cuando se unió al board
  lastActivity: string; // ISO timestamp de última actividad
}

/**
 * Typing Indicator State
 * Estado de quien está escribiendo en una card
 */
export interface TypingIndicator {
  cardId: string;
  userId: string;
  userName: string;
  startedAt: number; // Unix timestamp
}

/**
 * Cursor Position (para editors colaborativos - futuro)
 */
export interface CursorPosition {
  userId: string;
  documentId: string;
  position: {
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  color: string; // Color del cursor del usuario
}

/**
 * WebSocket Connection Info
 * Información de conexión WebSocket de un usuario
 */
export interface SocketConnection {
  socketId: string;
  userId: string;
  boardId?: string;
  connectedAt: string;
  lastPing: string;
}

/**
 * Realtime Stats
 * Estadísticas de actividad en tiempo real
 */
export interface RealtimeStats {
  boardId: string;
  activeUsers: number;
  totalConnections: number;
  eventsLastMinute: number;
  lastActivity: string;
}
