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
| **Workspaces** | Team-scoped environments with role-based access and live presence indicators |
| **Kanban Boards** | Drag-and-drop card management synced across all connected clients in under 100ms |
| **Cards** | Full task lifecycle: assignments, labels, due dates, checklists, dependencies, and file attachments |
| **Collaborative Documents** | Simultaneous multi-user editing with remote cursors, powered by Yjs CRDT |
| **Sprints & Milestones** | Agile planning layer on top of boards — sprint tracking with burndown visibility |
| **Notifications** | Real-time in-app notifications with @mention support across cards and documents |
| **Activity Log** | Complete immutable audit trail of every change, queryable at any point in time |
| **i18n** | Full English / Spanish internationalization with per-user language preference |

---

## Architecture

### Event Sourcing over CRUD

Traditional CRUD architectures overwrite state, discarding history. AETHER models every mutation as an **immutable event** appended to the Event Store. Current state is a projection derived by replaying those events.

```
User action  →  Event  →  Event Store (PostgreSQL)  →  Projection  →  UI
                       →  Redis PUBLISH  →  WebSocket  →  Connected clients
```

This enables:

- **Full audit trail** — who changed what and when, with zero additional instrumentation
- **Time-travel debugging** — reproduce any bug by replaying events up to a specific point in time
- **Read scalability** — projections can be rebuilt from scratch or composed independently

```typescript
interface DomainEvent {
  eventId: string;       // UUID v7 — time-ordered for efficient range queries
  type: string;          // e.g. "card.moved", "document.updated"
  payload: unknown;
  meta: {
    timestamp: number;   // Unix ms
    userId: string;
    version: number;     // Schema version for forward compatibility
    vectorClock: VectorClock;
  };
}
```

---

### CRDT vs. Operational Transformation

Collaborative text editing requires conflict resolution when two users edit simultaneously. There are two established approaches:

**Operational Transformation (OT)** — used by the original Google Docs — requires a central server to sequence all operations. This creates a single point of failure and a horizontal scaling bottleneck.

**CRDT (Conflict-free Replicated Data Type)** — implemented via [Yjs](https://yjs.dev) — guarantees mathematically that all peers converge to the same state regardless of operation order, with no central coordination required.

|  | OT | CRDT (Yjs) |
|---|---|---|
| Central arbitration required | Yes | No |
| Conflict resolution | Server-sequenced | Mathematically guaranteed convergence |
| Offline support | Fragile | Native |
| Horizontal scaling | Bottleneck at coordinator | Fully distributed |
| Production adoption | Google Docs (original) | VS Code Live Share, Notion, Linear |

Yjs is the same library powering VS Code Live Share — battle-tested at production scale.

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
- **Socket.io + Y-WebSocket** — dual WebSocket layer: Socket.io for event delivery, Y-WebSocket for Yjs document sync.

This separation means the persistence layer and the broadcast layer scale independently.

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
| API (Express) | http://localhost:3000 |
| Health check | http://localhost:3000/health |

### Environment Variables

The API requires the following variables in `apps/api/.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/aether_dev

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
```

Database schema and migrations run automatically on API startup — no manual migration step required.

---

## Repository Structure

```
aether-collaboration-platform/
├── apps/
│   ├── api/                    # Express · Socket.io · Y-WebSocket · PostgreSQL
│   │   ├── src/
│   │   │   ├── controllers/    # Request handlers
│   │   │   ├── services/       # Business logic (BoardService, CardService, …)
│   │   │   ├── migrations/     # Incremental schema migrations (run on startup)
│   │   │   ├── lib/            # DB pool, Redis client, event store
│   │   │   └── config/         # Zod-validated environment schema
│   │   └── Dockerfile
│   └── web/                    # Next.js 14 App Router
│       ├── src/
│       │   ├── app/            # Pages and layouts
│       │   ├── components/     # UI components
│       │   ├── stores/         # Zustand state management
│       │   └── lib/            # i18n, utils, API client
│       └── Dockerfile
├── packages/
│   └── shared-types/           # Shared TypeScript types (api ↔ web)
├── docs/
│   └── architecture/           # Architecture Decision Records (ADRs)
├── .github/
│   └── workflows/ci.yml        # Lint · Test · Security scan · Build
├── docker-compose.yml          # Development: PostgreSQL + Redis only
└── docker-compose.production.yml
```

---

## Tech Stack

### Frontend
| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| State management | Zustand with `persist` middleware |
| Real-time | Socket.io-client, Yjs |
| Rich text editor | Tiptap (ProseMirror) |
| UI primitives | Radix UI |
| Drag & drop | dnd-kit |

### Backend
| | |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express |
| Real-time | Socket.io, Y-WebSocket |
| Auth | JWT (access + refresh tokens) · bcrypt |
| Email | Brevo (transactional) |
| Validation | Zod |

### Infrastructure
| | |
|---|---|
| Primary database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7 |
| Containerization | Docker (multi-stage builds) |
| Monorepo tooling | Turborepo + pnpm workspaces |
| CI/CD | GitHub Actions |
| Deployment | Railway |

---

## API Overview

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| Workspaces | Full CRUD · member management · archiving |
| Boards | Full CRUD · sprint management · milestones |
| Cards | Full CRUD · move · assign · labels · checklists · dependencies · attachments |
| Documents | Collaborative CRUD · version history · permissions |
| Notifications | List · mark read · real-time delivery |
| Users | Profile · avatar upload · activity log |

All endpoints return a consistent envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

---

## Deployment

The project ships production-ready Docker images for both services. Recommended deployment target: **Railway**.

See [`apps/api/railway.toml`](./apps/api/railway.toml) and [`apps/web/railway.toml`](./apps/web/railway.toml) for service configuration. Both Dockerfiles use multi-stage builds with non-root users.

---

<div align="center">

**Sebastián Hernández** · [LinkedIn](https://www.linkedin.com/in/shdez-dev/) · [Portfolio](https://www.shernandez.dev)

</div>
