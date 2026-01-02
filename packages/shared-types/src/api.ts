/**
 * API Request/Response Types
 * 
 * Standard types for REST API communication
 */

// ============================================================================
// STANDARD API RESPONSES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  timestamp: number;
  requestId: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ============================================================================
// WORKSPACE
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
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

// ============================================================================
// BOARD
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
// LIST
// ============================================================================

export interface CreateListRequest {
  name: string;
  position: number;
}

export interface UpdateListRequest {
  name?: string;
}

export interface ReorderListRequest {
  position: number;
}

// ============================================================================
// CARD
// ============================================================================

export interface CreateCardRequest {
  title: string;
  description?: string;
  position: number;
}

export interface UpdateCardRequest {
  title?: string;
  description?: string;
  dueDate?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MoveCardRequest {
  toListId: string;
  position: number;
}

// ============================================================================
// WEBSOCKET MESSAGES
// ============================================================================

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

export interface WebSocketAck {
  messageId: string;
  status: 'success' | 'error';
  error?: string;
}

// ============================================================================
// SEARCH & FILTERS
// ============================================================================

export interface SearchQuery {
  q: string;
  type?: 'cards' | 'documents' | 'comments' | 'all';
  filters?: SearchFilters;
  pagination?: {
    page: number;
    pageSize: number;
  };
}

export interface SearchFilters {
  assignedTo?: string[];
  labels?: string[];
  dueDateFrom?: string;
  dueDateTo?: string;
  priority?: ('LOW' | 'MEDIUM' | 'HIGH')[];
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
