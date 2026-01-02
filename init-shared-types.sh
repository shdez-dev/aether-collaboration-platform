#!/bin/bash

# Script to initialize @aether/types package

set -e

echo "Initializing @aether/types package..."

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Navigate to packages directory
print_step "Creating package structure..."

mkdir -p packages/shared-types/src

# Create package.json
print_step "Creating package.json..."

cat > packages/shared-types/package.json << 'EOF'
{
  "name": "@aether/types",
  "version": "0.1.0",
  "private": true,
  "description": "Shared TypeScript type definitions for AETHER event-driven system",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  },
  "dependencies": {}
}
EOF

print_success "package.json created"

# Create tsconfig.json
print_step "Creating tsconfig.json..."

cat > packages/shared-types/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

print_success "tsconfig.json created"

# Create src/index.ts
print_step "Creating src/index.ts..."

cat > packages/shared-types/src/index.ts << 'EOF'
/**
 * @aether/types
 * 
 * Shared type definitions for the AETHER event-driven collaboration platform.
 * This package is the single source of truth for all types used across
 * frontend and backend.
 */

// Export all event types
export * from './events';

// Export all model types
export * from './models';

// Export API types
export * from './api';
EOF

print_success "src/index.ts created"

# Create src/events.ts
print_step "Creating src/events.ts..."

cat > packages/shared-types/src/events.ts << 'EOF'
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
export type BoardEventType =
  | 'board.created'
  | 'board.updated'
  | 'board.deleted'
  | 'board.archived';

/**
 * List Events
 */
export type ListEventType =
  | 'list.created'
  | 'list.updated'
  | 'list.deleted'
  | 'list.reordered';

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
// SPECIFIC EVENT PAYLOADS
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

/**
 * Workspace Created Event
 */
export interface WorkspaceCreatedPayload {
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  ownerId: UserId;
}

export type WorkspaceCreatedEvent = BaseEvent<'workspace.created', WorkspaceCreatedPayload>;

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
  | CardCreatedEvent
  | CardMovedEvent
  | CardUpdatedEvent
  | WorkspaceCreatedEvent
  | BoardCreatedEvent
  | ListCreatedEvent
  | UserOnlineEvent
  // Add more as we build them
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
EOF

print_success "src/events.ts created"

# Create src/models.ts
print_step "Creating src/models.ts..."

cat > packages/shared-types/src/models.ts << 'EOF'
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
EOF

print_success "src/models.ts created"

# Create src/api.ts
print_step "Creating src/api.ts..."

cat > packages/shared-types/src/api.ts << 'EOF'
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
EOF

print_success "src/api.ts created"

# Create .gitignore
print_step "Creating .gitignore..."

cat > packages/shared-types/.gitignore << 'EOF'
node_modules
dist
*.tsbuildinfo
EOF

print_success ".gitignore created"

# Create README
print_step "Creating README.md..."

cat > packages/shared-types/README.md << 'EOF'
# @aether/types

Shared TypeScript type definitions for the AETHER event-driven collaboration platform.

## Overview

This package contains all type definitions used across the AETHER monorepo:

- **Event Types**: Core event system with branded types for type-safe IDs
- **Domain Models**: Read models (projections) from the event store
- **API Types**: Request/Response types for REST API

## Usage

```typescript
import { CardCreatedEvent, Card, CreateCardRequest } from '@aether/types';
```

## Philosophy

This package embodies AETHER's event-driven architecture:

- Events are immutable and the single source of truth
- Models are projections built from events
- Branded types prevent ID confusion (e.g., CardId vs ListId)
- Vector clocks enable causal ordering in distributed system

## Development

```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Type checking
pnpm typecheck
```
EOF

print_success "README.md created"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  @aether/types Package Created Successfully"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "  1. Install dependencies:"
echo "     $ pnpm install"
echo ""
echo "  2. Build the package:"
echo "     $ cd packages/shared-types && pnpm build"
echo ""
echo "  3. Verify build:"
echo "     $ ls -la packages/shared-types/dist"
echo ""
echo "═══════════════════════════════════════════════════════════════"