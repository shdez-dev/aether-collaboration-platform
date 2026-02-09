// packages/shared-types/src/api.ts

/**
 * API Response Types
 * Estructuras de respuesta estandarizadas para la API REST
 */

// ============================================================================
// BASE API RESPONSE
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// AUTH API TYPES
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  accessToken: string;
  refreshToken?: string;
}

// ============================================================================
// WORKSPACE API TYPES
// ============================================================================

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

// ============================================================================
// BOARD API TYPES
// ============================================================================

export interface CreateBoardRequest {
  name: string;
  description?: string;
}

export interface UpdateBoardRequest {
  name?: string;
  description?: string;
}

// ============================================================================
// LIST API TYPES
// ============================================================================

export interface CreateListRequest {
  name: string;
}

export interface UpdateListRequest {
  name?: string;
}

export interface ReorderListRequest {
  position: number;
}

// ============================================================================
// CARD API TYPES
// ============================================================================

export interface CreateCardRequest {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface UpdateCardRequest {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  completed?: boolean;
  completedAt?: string | null;
}

export interface MoveCardRequest {
  toListId: string;
  position: number;
}

export interface AssignMemberRequest {
  userId: string;
}

export interface AddLabelRequest {
  labelId: string;
}

// ============================================================================
// COMMENT API TYPES
// ============================================================================

export interface CreateCommentRequest {
  content: string;
  mentions?: string[];
}

export interface UpdateCommentRequest {
  content: string;
  mentions?: string[];
}

// ============================================================================
// LABEL API TYPES
// ============================================================================

export interface CreateLabelRequest {
  name: string;
  color: string;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: string;
}

// ============================================================================
// DOCUMENT API TYPES - MILESTONE 7
// ============================================================================

/**
 * Create Document Request
 */
export interface CreateDocumentRequest {
  title: string;
  templateId?: string; // ID de la plantilla a usar (opcional)
  content?: any; // Contenido inicial (ProseMirror JSON), opcional si usa template
}

/**
 * Update Document Request
 */
export interface UpdateDocumentRequest {
  title?: string;
  content?: string; // Texto plano extraído (para búsqueda)
}

/**
 * Update Document Title Request
 */
export interface UpdateDocumentTitleRequest {
  title: string;
}

/**
 * Export Document Request (query params)
 */
export interface ExportDocumentRequest {
  format: 'markdown' | 'pdf' | 'html';
}

/**
 * Export Document Response
 */
export interface ExportDocumentResponse {
  format: 'markdown' | 'pdf' | 'html';
  content?: string; // Para markdown y html
  downloadUrl?: string; // Para PDF
  fileName: string;
}

/**
 * Create Document Version Request
 */
export interface CreateDocumentVersionRequest {
  description?: string; // Descripción opcional del snapshot
}

/**
 * Restore Document Version Request
 */
export interface RestoreDocumentVersionRequest {
  versionId: string;
}

/**
 * Document Comment Request
 */
export interface CreateDocumentCommentRequest {
  content: string;
  position: {
    from: number;
    to: number;
  };
  mentions?: string[]; // Array de user IDs
  parentId?: string; // Para threading
}

/**
 * Update Document Comment Request
 */
export interface UpdateDocumentCommentRequest {
  content: string;
  mentions?: string[];
}

/**
 * Resolve/Unresolve Document Comment Request
 */
export interface ResolveDocumentCommentRequest {
  resolved: boolean;
}

/**
 * Update Document Permission Request
 */
export interface UpdateDocumentPermissionRequest {
  userId: string;
  permission: 'VIEW' | 'COMMENT' | 'EDIT';
}

/**
 * Remove Document Permission Request
 */
export interface RemoveDocumentPermissionRequest {
  userId: string;
}

/**
 * Batch Update Document Permissions Request
 */
export interface BatchUpdateDocumentPermissionsRequest {
  permissions: Array<{
    userId: string;
    permission: 'VIEW' | 'COMMENT' | 'EDIT';
  }>;
}

/**
 * Document List Response
 */
export interface DocumentListResponse {
  documents: Array<{
    id: string;
    workspaceId: string;
    title: string;
    content: string; // Preview
    createdBy: string;
    creator?: {
      id: string;
      name: string;
      avatar?: string;
    };
    createdAt: string;
    updatedAt: string;
    activeUsers?: number;
    commentCount?: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

/**
 * Document Search Request
 */
export interface SearchDocumentsRequest {
  query: string;
  workspaceId?: string;
  createdBy?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Document Filter Options
 */
export interface DocumentFilterOptions {
  createdBy?: string;
  hasComments?: boolean;
  hasActiveUsers?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

/**
 * Get Documents Request (query params)
 */
export interface GetDocumentsRequest {
  workspaceId: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: DocumentFilterOptions;
  page?: number;
  limit?: number;
}

/**
 * Document Version List Response
 */
export interface DocumentVersionListResponse {
  versions: Array<{
    id: string;
    documentId: string;
    metadata: {
      operationCount?: number;
      description?: string;
      contentPreview?: string;
    };
    createdBy: string;
    creator?: {
      id: string;
      name: string;
      avatar?: string;
    };
    createdAt: string;
  }>;
  total: number;
}

/**
 * Document Comment List Response
 */
export interface DocumentCommentListResponse {
  comments: Array<{
    id: string;
    documentId: string;
    content: string;
    position: {
      from: number;
      to: number;
    };
    resolved: boolean;
    createdBy: string;
    creator?: {
      id: string;
      name: string;
      avatar?: string;
    };
    parentId?: string;
    replies?: any[];
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
}

/**
 * Document Active Users Response
 */
export interface DocumentActiveUsersResponse {
  users: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
    color: string;
    cursor?: number;
    selection?: {
      from: number;
      to: number;
    };
    joinedAt: string;
    lastActivity: string;
  }>;
  count: number;
}

/**
 * Yjs Update Message (WebSocket)
 * Para sincronización en tiempo real
 */
export interface YjsUpdateMessage {
  documentId: string;
  update: Uint8Array | number[]; // Yjs update binary data
  origin?: string; // Para evitar loops
}

/**
 * Yjs Sync Step 1 Message
 */
export interface YjsSyncStep1Message {
  documentId: string;
  stateVector: Uint8Array | number[];
}

/**
 * Yjs Sync Step 2 Message
 */
export interface YjsSyncStep2Message {
  documentId: string;
  update: Uint8Array | number[];
}

/**
 * Awareness Update Message (WebSocket)
 * Para cursores y selecciones en tiempo real
 */
export interface AwarenessUpdateMessage {
  documentId: string;
  update: {
    userId: string;
    cursor?: number;
    selection?: {
      from: number;
      to: number;
    };
    userName: string;
    userColor: string;
  };
}

// ============================================================================
// NOTIFICATION API TYPES
// ============================================================================

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

// ============================================================================
// SEARCH & FILTER TYPES
// ============================================================================

export interface SearchRequest {
  query: string;
  filters?: {
    workspaceId?: string;
    boardId?: string;
    documentId?: string;
    type?: string[];
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface FilterOptions {
  assignees?: string[];
  labels?: string[];
  priority?: ('LOW' | 'MEDIUM' | 'HIGH')[];
  completed?: boolean;
  dueDate?: {
    from?: string;
    to?: string;
  };
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES FOR DOCUMENTS
// ============================================================================

/**
 * WebSocket Message Types for Document Collaboration
 */
export type DocumentWebSocketMessageType =
  | 'document.join'
  | 'document.leave'
  | 'document.yjs.update'
  | 'document.yjs.sync1'
  | 'document.yjs.sync2'
  | 'document.awareness.update'
  | 'document.cursor.move'
  | 'document.selection.change'
  | 'document.comment.add'
  | 'document.comment.update'
  | 'document.comment.delete'
  | 'document.comment.resolve';

/**
 * Document WebSocket Message
 */
export interface DocumentWebSocketMessage<T = unknown> {
  type: DocumentWebSocketMessageType;
  payload: T;
  messageId?: string;
  timestamp?: number;
}

/**
 * Join Document Message
 */
export interface JoinDocumentMessage {
  documentId: string;
  workspaceId: string;
}

/**
 * Leave Document Message
 */
export interface LeaveDocumentMessage {
  documentId: string;
  workspaceId: string;
}

/**
 * Document Stats Response
 */
export interface DocumentStatsResponse {
  totalDocuments: number;
  totalViews: number;
  totalEdits: number;
  totalComments: number;
  totalVersions: number;
  activeCollaborators: number;
  recentActivity: Array<{
    type: string;
    userId: string;
    userName: string;
    timestamp: string;
  }>;
}
