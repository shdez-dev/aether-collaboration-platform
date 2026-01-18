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
