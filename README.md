<div align="center">
  <img src="./docs/assets/banner.svg" alt="AETHER — Event-driven collaboration platform" width="100%"/>
</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)

</div>

<br/>

**AETHER** is a real-time collaboration platform for distributed teams, built on an event-sourced architecture with CRDT-based document editing and WebSocket synchronization. Every action is recorded as an immutable event — state is a projection, not a mutation.

---

## Features

| Module | Description |
|---|---|
| **Workspaces** | Team-scoped environments with role-based access (Owner / Admin / Member), archiving, invite links, and GitHub integration |
| **Projects & Milestones** | Group boards under a project, track milestones, and assign teams to initiatives |
| **Kanban Boards** | Drag-and-drop card management with Kanban, Calendar, Timeline, and Table views — synced across all clients |
| **Sprints** | Agile sprint lifecycle (Planned → Active → Completed) with card association and board milestones |
| **Cards** | Full task lifecycle: assignments, labels, due dates, start dates, checklists, file attachments, and dependency tracking |
| **Dependency Graph** | Visual graph of card dependencies using a DAG renderer — detects cycles before committing |
| **Collaborative Documents** | Simultaneous multi-user editing with remote cursors, powered by Yjs CRDT. Supports templates, version history, inline comments, and PDF export |
| **Teams** | Create cross-workspace teams, assign them to projects, and manage membership with invitation flows |
| **Daily Standup** | Per-workspace standup form (yesterday / today / blockers) with publishing and team visibility |
| **Search** | Global full-text search across cards, boards, documents, and workspaces |
| **Notifications** | Real-time in-app notifications with @mention support across cards and documents |
| **Activity Log** | Immutable audit trail of every change, queryable per workspace |
| **PWA** | Installable as a Progressive Web App — works on desktop and mobile |
| **i18n** | Full English / Spanish internationalization with per-user language preference |

---

## Architecture

### Event Sourcing

Traditional CRUD architectures overwrite state, discarding history. AETHER models every mutation as an **immutable event** appended to the Event Store. Current state is derived from those events.

```
User action  →  Event  →  Event Store (PostgreSQL)  →  Projection  →  UI
                       →  Redis PUBLISH  →  WebSocket  →  Connected clients
```

This enables:

- **Full audit trail** — who changed what and when, with zero additional instrumentation
- **Time-travel debugging** — reproduce any bug by replaying events up to a specific point in time
- **Read scalability** — projections can be rebuilt from scratch or composed independently

The event schema (v2) uses structured context fields for efficient filtering without JSONB queries:

```typescript
interface AetherEvent {
  id:           string;    // UUID
  type:         string;    // e.g. "card.moved", "document.updated"
  timestamp:    number;    // Unix ms
  version:      number;    // Schema version

  actor: {
    id:   string;          // User ID who triggered the event
    name: string;
  };

  subject: {
    type: string;          // "card" | "board" | "document" | ...
    id:   string;
    name: string;
  };

  // Denormalized context IDs for fast lookups
  workspaceId?: string;
  boardId?:     string;
  listId?:      string;
  cardId?:      string;
  documentId?:  string;

  delta?:       unknown;   // Structured diff (what changed)
  payload:      unknown;   // Supplemental data
  vectorClock:  VectorClock;
  correlationId?: string;
}
```

---

### CRDT vs. Operational Transformation

Collaborative text editing requires conflict resolution when two users edit simultaneously.

**Operational Transformation (OT)** — used by the original Google Docs — requires a central server to sequence all operations. This creates a single point of failure and a horizontal scaling bottleneck.

**CRDT (Conflict-free Replicated Data Type)** — implemented via [Yjs](https://yjs.dev) — guarantees mathematically that all peers converge to the same state regardless of operation order, with no central coordination required.

|  | OT | CRDT (Yjs) |
|---|---|---|
| Central arbitration required | Yes | No |
| Conflict resolution | Server-sequenced | Mathematically guaranteed convergence |
| Offline support | Fragile | Native |
| Horizontal scaling | Bottleneck at coordinator | Fully distributed |
| Production adoption | Google Docs (original) | VS Code Live Share, Notion, Linear |

---

### Layered Real-time Infrastructure

PostgreSQL and Redis serve distinct, complementary roles:

```
Client A  →  API Instance 1  →  PostgreSQL  (durable event store)
                             →  Redis PUBLISH
                                    ↓
                          API Instance 1  →  Client A's socket
                          API Instance 2  →  Client B's socket
```

- **PostgreSQL** — source of truth. Events are persisted before any broadcast occurs.
- **Redis Pub/Sub** — ephemeral broadcast layer. Sub-millisecond fan-out across API instances with no disk I/O.
- **Socket.io** — event delivery (board updates, presence, notifications).
- **Y-WebSocket** — Yjs document state synchronization (separate from Socket.io).

### Data Access Layer

The API uses two complementary data access strategies:

- **Prisma ORM** — all domain entities (users, workspaces, boards, cards, documents, teams, projects, etc.) are accessed through a fully typed Prisma Client, backed by a declarative schema in `apps/api/prisma/schema.prisma`.
- **Raw `pg` pool** — the event store itself and schema bootstrapping use raw SQL via a `pg` pool. All migrations run automatically on API startup through `src/migrations/run-migrations.ts` — no manual migration step is required.

---

## Getting Started

**Prerequisites:** Docker, Node.js 20+, pnpm 8+

```bash
# 1. Clone the repository
git clone https://github.com/Loksz/aether-collaboration-platform.git
cd aether-collaboration-platform

# 2. Start PostgreSQL and Redis
docker-compose up -d

# 3. Install dependencies
pnpm install

# 4. Configure environment variables
#    Copy and fill in the required values in apps/api/.env
#    (See Environment Variables section below)

# 5. Start in development mode
pnpm dev
```

| Service | URL |
|---|---|
| Web (Next.js) | http://localhost:3002 |
| API (Express) | http://localhost:4000 |
| Health check | http://localhost:4000/health |

> The database schema bootstraps automatically when the API starts. No manual migration step is needed.

---

### Environment Variables

Create `apps/api/.env` with the following variables:

```env
# Database — matches docker-compose.yml defaults
DATABASE_URL=postgresql://aether:aether_dev_password@localhost:5432/aether_dev

# Redis
REDIS_URL=redis://localhost:6379

# Auth — generate with: openssl rand -base64 32
JWT_SECRET=
REFRESH_TOKEN_SECRET=

# CORS
FRONTEND_URL=http://localhost:3002
CORS_ORIGIN=http://localhost:3002

# Email (Brevo)
BREVO_API_KEY=
EMAIL_FROM=
EMAIL_FROM_NAME=Aether Platform

# File storage (Cloudflare R2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

---

## Repository Structure

```
aether-collaboration-platform/
├── apps/
│   ├── api/                      # Express · Socket.io · Y-WebSocket
│   │   ├── src/
│   │   │   ├── controllers/      # Request handlers (one per resource)
│   │   │   ├── services/         # Business logic
│   │   │   ├── repositories/     # Data access (Prisma + raw pg)
│   │   │   ├── routes/           # Express route definitions
│   │   │   ├── websocket/        # RealtimeGateway (Socket.io) + YjsGateway
│   │   │   ├── jobs/             # Background jobs (due-date notifications)
│   │   │   ├── migrations/       # run-migrations.ts — auto-runs on startup
│   │   │   ├── middleware/       # Auth, error handling, rate limiting
│   │   │   ├── lib/              # DB pool, Redis client, event store
│   │   │   └── config/           # Zod-validated environment schema
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Full Prisma schema (all 30+ models)
│   │   └── Dockerfile
│   └── web/                      # Next.js 14 App Router
│       ├── src/
│       │   ├── app/              # Pages and layouts (App Router)
│       │   │   └── dashboard/    # All authenticated routes
│       │   ├── components/       # UI components (board, editor, modals, …)
│       │   ├── stores/           # Zustand stores (one per domain)
│       │   └── lib/              # i18n, API client, color tokens, utils
│       └── Dockerfile
├── packages/
│   └── shared-types/             # @aether/types — shared TS types (api ↔ web)
├── docs/
│   └── architecture/             # Architecture Decision Records (ADRs)
├── tests/                        # Playwright E2E tests
├── scripts/                      # Standalone SQL migration scripts
├── .github/
│   └── workflows/ci.yml          # Lint · Typecheck · Test · Security scan · Build
├── docker-compose.yml            # Development: PostgreSQL 15 + Redis 7
└── docker-compose.production.yml # Production: PostgreSQL 16 + Redis 7
```

---

## Tech Stack

### Frontend

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + inline design tokens (`lib/colors.ts`) |
| State management | Zustand 4 with `persist` middleware |
| Real-time | Socket.io-client · Yjs · y-websocket |
| Rich text editor | Tiptap 2 (ProseMirror) with custom extensions |
| UI primitives | Radix UI |
| Drag & drop | dnd-kit |
| Graph visualization | @xyflow/react (dependency graph) |
| Animations | GSAP · Framer Motion · Lenis |
| PWA | next-pwa |
| i18n | Custom `useT()` hook — English and Spanish |

### Backend

| | |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| ORM | Prisma 5 (domain entities) |
| Real-time | Socket.io · Y-WebSocket |
| Auth | JWT (access + refresh tokens) · bcrypt |
| Email | Brevo (transactional) |
| File storage | Cloudflare R2 (via AWS S3-compatible SDK) |
| Document export | Puppeteer (PDF) |
| Validation | Zod |

### Infrastructure

| | |
|---|---|
| Primary database | PostgreSQL 15 (dev) · PostgreSQL 16 (production) |
| Cache / Pub-Sub | Redis 7 |
| Containerization | Docker (multi-stage builds, non-root users) |
| Monorepo tooling | Turborepo 2 · pnpm 8 workspaces |
| CI/CD | GitHub Actions (lint, typecheck, tests, Trivy security scan, build) |
| Deployment | Railway |

---

## API Overview

All endpoints are mounted under `/api` and return a consistent response envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | Register · Login · Refresh token · Forgot/reset password · Email verification |
| Users | `/api/users` | Profile · Preferences · Activity · Standup · Teammates |
| Workspaces | `/api/workspaces` | CRUD · Members · Roles · Invite tokens · Archive · GitHub integration |
| Boards | `/api/boards` | CRUD · Sprints · Milestones |
| Cards | `/api/cards` | CRUD · Move · Assignments · Labels · Checklists · Dependencies · Attachments |
| Comments | `/api/comments` | Card comment threads |
| Documents | `/api/documents` | Collaborative CRUD · Versions · Permissions · Templates · PDF export |
| Projects | `/api/projects` | CRUD · Milestones · Board and team assignments |
| Teams | `/api/teams` | CRUD · Members · Invitations |
| Labels | `/api/labels` | Workspace-scoped label management |
| Notifications | `/api/notifications` | List · Mark read · Mark all read |
| Search | `/api/search` | Global full-text search |
| Presence | `/api/presence` | Online status (also via WebSocket) |
| Activity | `/api/activity` | Workspace-level activity feed |
| GitHub webhooks | `/api/webhooks/github` | Push · PR · Issue events → board automation |

### WebSocket

Two parallel WebSocket servers run on the same port:

- **Socket.io** — board events (card moves, list updates), presence, typing indicators, notifications, real-time toast delivery.
- **Y-WebSocket** — Yjs CRDT document state synchronization for the collaborative editor.

---

## Deployment

The project ships production-ready Docker images for both services. Recommended deployment target: **Railway**.

See [`apps/api/railway.toml`](./apps/api/railway.toml) and [`apps/web/railway.toml`](./apps/web/railway.toml) for service configuration. Both Dockerfiles use multi-stage builds and run as non-root users.

---

<div align="center">

**Sebastián Hernández** · [LinkedIn](https://www.linkedin.com/in/shdez-dev/) · [Portfolio](https://www.shernandez.dev)

</div>
