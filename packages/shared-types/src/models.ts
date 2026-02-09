// packages/shared-types/src/models.ts

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

/**
 * Document Permission Levels
 */
export enum DocumentPermissionLevel {
  VIEW = 'VIEW',
  COMMENT = 'COMMENT',
  EDIT = 'EDIT',
}

export type DocumentPermission = 'VIEW' | 'COMMENT' | 'EDIT';

/**
 * Document Export Formats
 */
export type DocumentExportFormat = 'markdown' | 'pdf' | 'html';

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
  documentCount?: number;
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
  completed: boolean;
  completedAt?: string;
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

/**
 * Card with all related details
 * NO extiende Card para evitar conflictos de tipos
 */
export interface CardWithDetails {
  // Propiedades base de Card
  id: string;
  listId: string;
  title: string;
  description?: string;
  position: number;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  completed: boolean;
  completedAt?: string;
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
// COMMENT - MILESTONE 6
// ============================================================================

/**
 * Base Comment model
 */
export interface Comment {
  id: string;
  cardId: string;
  userId: string;
  content: string;
  mentions: string[]; // Array de user IDs mencionados
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Comment with user information
 */
export interface CommentWithUser extends Comment {
  user: User;
}

/**
 * Comment with user and replies (para threading futuro)
 */
export interface CommentWithReplies extends CommentWithUser {
  replies?: CommentWithUser[];
}

// ============================================================================
// DOCUMENT - MILESTONE 7
// ============================================================================

/**
 * Base Document Model
 */
export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  content: string; // Texto plano extraído para búsqueda
  yjsState?: Uint8Array; // Estado binario serializado de Yjs
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Document with Creator Info
 */
export interface DocumentWithCreator extends Document {
  creator: User;
}

/**
 * Document with full details including permissions and collaborators
 */
export interface DocumentWithDetails extends DocumentWithCreator {
  permissions: DocumentPermissionWithUser[];
  activeUsers: ActiveDocumentUser[];
  commentCount: number;
  versionCount: number;
  lastModifiedBy?: User;
  userPermission?: DocumentPermission; // Permiso del usuario actual
}

/**
 * Document Version (Snapshot)
 */
export interface DocumentVersion {
  id: string;
  documentId: string;
  yjsState: Uint8Array; // Snapshot del estado Yjs
  metadata: DocumentVersionMetadata;
  createdBy: string;
  createdAt: string;
}

/**
 * Document Version Metadata
 */
export interface DocumentVersionMetadata {
  operationCount?: number;
  description?: string;
  contentPreview?: string; // Primeras 200 chars del contenido
  changesSummary?: string; // "Added 50 words, removed 10 words"
}

/**
 * Document Version with Creator
 */
export interface DocumentVersionWithCreator extends DocumentVersion {
  creator: User;
}

/**
 * Document Comment
 */
export interface DocumentComment {
  id: string;
  documentId: string;
  content: string;
  position: DocumentCommentPosition; // Posición en el documento
  resolved: boolean;
  createdBy: string;
  parentId?: string; // Para threading
  createdAt: string;
  updatedAt: string;
}

/**
 * Position of a comment in the document
 */
export interface DocumentCommentPosition {
  from: number; // Character offset start
  to: number; // Character offset end
}

/**
 * Document Comment with User
 */
export interface DocumentCommentWithUser extends DocumentComment {
  user: User;
  replies?: DocumentCommentWithUser[]; // Para threading
}

/**
 * Document Permission
 */
export interface DocumentPermissionEntry {
  id: string;
  documentId: string;
  userId?: string;
  permission: DocumentPermission;
  createdAt: string;
}

/**
 * Document Permission with User Info
 */
export interface DocumentPermissionWithUser extends DocumentPermissionEntry {
  user: User;
}

/**
 * Document Template
 */
export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  category: DocumentTemplateCategory;
  content: any; // ProseMirror JSON structure
  preview?: string; // URL or base64 image
  icon?: string;
}

/**
 * Template Categories
 */
export type DocumentTemplateCategory =
  | 'meeting-notes'
  | 'project-brief'
  | 'technical-spec'
  | 'retrospective'
  | 'blank'
  | 'custom';

/**
 * Built-in templates
 */
export const DOCUMENT_TEMPLATES: Record<DocumentTemplateCategory, DocumentTemplate> = {
  blank: {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start with an empty document',
    category: 'blank',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
  },
  'meeting-notes': {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Template for recording meeting discussions',
    category: 'meeting-notes',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Meeting Notes' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Date:' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Attendees:' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Agenda:' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Notes:' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Action Items:' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  },
  'project-brief': {
    id: 'project-brief',
    name: 'Project Brief',
    description: 'Template for project planning and overview',
    category: 'project-brief',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Project Brief' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Overview' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Goals' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Stakeholders' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Timeline' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Success Criteria' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  },
  'technical-spec': {
    id: 'technical-spec',
    name: 'Technical Specification',
    description: 'Template for technical documentation',
    category: 'technical-spec',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Technical Specification' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Problem Statement' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Proposed Solution' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Architecture' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Implementation Details' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Testing Strategy' }],
        },
        { type: 'paragraph' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Risks & Mitigation' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  },
  retrospective: {
    id: 'retrospective',
    name: 'Retrospective',
    description: 'Template for team retrospectives',
    category: 'retrospective',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Retrospective' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'What went well? 🎉' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'What could be improved? 🤔' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Action items 🎯' }],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  },
  custom: {
    id: 'custom',
    name: 'Custom Template',
    description: 'Create your own template',
    category: 'custom',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
  },
};

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
 * Active Users in Document (Awareness)
 */
export interface DocumentPresence {
  documentId: string;
  users: ActiveDocumentUser[];
  updatedAt: string;
}

/**
 * Active User in Document
 */
export interface ActiveDocumentUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string; // Color del cursor/selección
  cursor?: number; // Posición actual del cursor
  selection?: {
    from: number;
    to: number;
  };
  joinedAt: string;
  lastActivity: string;
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
 * Cursor Position (para editores colaborativos)
 */
export interface CursorPosition {
  userId: string;
  documentId: string;
  position: number; // Character offset in document
  selection?: {
    from: number;
    to: number;
  };
  color: string; // Color del cursor del usuario
  userName: string;
}

/**
 * WebSocket Connection Info
 * Información de conexión WebSocket de un usuario
 */
export interface SocketConnection {
  socketId: string;
  userId: string;
  boardId?: string;
  documentId?: string;
  connectedAt: string;
  lastPing: string;
}

/**
 * Realtime Stats
 * Estadísticas de actividad en tiempo real
 */
export interface RealtimeStats {
  boardId?: string;
  documentId?: string;
  activeUsers: number;
  totalConnections: number;
  eventsLastMinute: number;
  lastActivity: string;
}

// ==================== NOTIFICATION TYPES ====================

/**
 * Tipos de notificaciones
 */
export type NotificationType =
  | 'COMMENT_MENTION'
  | 'CARD_ASSIGNED'
  | 'CARD_DUE_SOON'
  | 'BOARD_INVITE'
  | 'WORKSPACE_INVITE'
  | 'DOCUMENT_MENTION'
  | 'DOCUMENT_SHARED'
  | 'DOCUMENT_COMMENT';

/**
 * Notification
 * Notificación del sistema para un usuario
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  read: boolean;
  createdAt: string;
}

/**
 * Datos adicionales de la notificación (flexibles según el tipo)
 */
export interface NotificationData {
  // Para COMMENT_MENTION
  cardId?: string;
  cardTitle?: string;
  commentId?: string;
  commentPreview?: string;
  authorId?: string;
  authorName?: string;

  // Para CARD_ASSIGNED
  assignedBy?: string;
  assignedByName?: string;

  // Para CARD_DUE_SOON
  dueDate?: string;
  hoursUntilDue?: number;

  // Para BOARD_INVITE / WORKSPACE_INVITE
  boardId?: string;
  boardName?: string;
  workspaceId?: string;
  workspaceName?: string;
  invitedBy?: string;
  invitedByName?: string;

  // Para DOCUMENT_MENTION / DOCUMENT_COMMENT / DOCUMENT_SHARED
  documentId?: string;
  documentTitle?: string;
  documentCommentId?: string;
  documentCommentPreview?: string;
  sharedBy?: string;
  sharedByName?: string;
  permission?: DocumentPermission;

  // Otros datos genéricos
  [key: string]: any;
}

/**
 * NotificationWithUser
 * Notificación con información del usuario destinatario
 */
export interface NotificationWithUser extends Notification {
  user: User;
}

/**
 * DTOs para crear notificaciones
 */
export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
}

/**
 * Respuesta del contador de notificaciones
 */
export interface NotificationCountResponse {
  count: number;
  hasUnread: boolean;
}

/**
 * Filtros para query de notificaciones
 */
export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}
