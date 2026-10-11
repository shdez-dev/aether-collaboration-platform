---
title: "Inventario de rutas"
tipo: "inventario observado"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Inventario de rutas

## Alcance y límites

Se extrajeron 273 declaraciones literales router.get, post, put, patch y delete de 22 archivos de rutas. Los prefijos se contrastaron con los montajes de apps/api/src/index.ts. La extracción incluye declaraciones multilínea y no ejecuta los controladores.

Este índice no representa un contrato OpenAPI, no enumera handlers directos de app como salud y no certifica disponibilidad, autorización ni comportamiento. Los controles pueden estar en middleware y dentro de cada controlador. Antes de invocar una operación, revisar su contrato y permisos.

Relaciones: [[Contratos de API]], [[Matriz de permisos]] y [[Fuentes y trazabilidad]].

## activity

Fuente: `apps/api/src/routes/activity.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/activity/categories` | 11 |

## ai

Fuente: `apps/api/src/routes/ai.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/ai/credits` | 14 |
| POST | `/api/ai/plan` | 15 |
| POST | `/api/ai/build` | 16 |
| GET | `/api/ai/documents` | 19 |
| POST | `/api/ai/documents` | 20 |
| GET | `/api/ai/documents/:id` | 21 |
| PUT | `/api/ai/documents/:id` | 22 |
| PATCH | `/api/ai/documents/:id/used` | 23 |
| DELETE | `/api/ai/documents/:id` | 24 |

## auth

Fuente: `apps/api/src/routes/auth.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| POST | `/api/auth/register` | 8 |
| POST | `/api/auth/login` | 9 |
| POST | `/api/auth/refresh` | 10 |
| POST | `/api/auth/verify-email` | 11 |
| POST | `/api/auth/resend-verification` | 12 |
| POST | `/api/auth/check-verification` | 13 |
| POST | `/api/auth/forgot-password` | 14 |
| POST | `/api/auth/reset-password` | 15 |
| POST | `/api/auth/logout` | 18 |
| GET | `/api/auth/me` | 19 |
| POST | `/api/auth/send-verification-email` | 20 |

## billing

Fuente: `apps/api/src/routes/billing.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/billing/catalog` | 5 |
| POST | `/api/billing/webhook` | 6 |
| GET | `/api/billing/organizations/:organizationId` | 8 |
| POST | `/api/billing/organizations/:organizationId/checkout` | 9 |

## board

Fuente: `apps/api/src/routes/board.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| POST | `/api/workspaces/:workspaceId/boards` | 24 |
| GET | `/api/workspaces/:workspaceId/boards` | 34 |
| GET | `/api/workspaces/:workspaceId/boards/orphaned` | 42 |
| GET | `/api/boards/:id` | 52 |
| GET | `/api/boards/:id/project` | 56 |
| GET | `/api/boards/:id/dependency-graph` | 66 |
| PUT | `/api/boards/:id` | 76 |
| POST | `/api/boards/:id/archive` | 84 |
| DELETE | `/api/boards/:id` | 95 |
| POST | `/api/boards/:boardId/lists` | 107 |
| GET | `/api/boards/:boardId/lists` | 117 |
| PUT | `/api/lists/:id` | 127 |
| PUT | `/api/lists/:id/reorder` | 135 |
| DELETE | `/api/lists/:id` | 146 |
| GET | `/api/boards/:boardId/sprints` | 152 |
| POST | `/api/boards/:boardId/sprints` | 155 |
| PUT | `/api/sprints/:sprintId` | 158 |
| DELETE | `/api/sprints/:sprintId` | 161 |
| POST | `/api/sprints/:sprintId/cards` | 164 |
| DELETE | `/api/sprints/:sprintId/cards/:cardId` | 167 |
| GET | `/api/boards/:boardId/milestones` | 173 |
| POST | `/api/boards/:boardId/milestones` | 176 |
| PUT | `/api/milestones/:milestoneId` | 179 |
| DELETE | `/api/milestones/:milestoneId` | 182 |

## cards

Fuente: `apps/api/src/routes/cards.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/lists/:listId/cards` | 26 |
| POST | `/api/lists/:listId/cards` | 36 |
| GET | `/api/cards/:id` | 46 |
| PUT | `/api/cards/:id` | 51 |
| PUT | `/api/cards/:id/move` | 56 |
| DELETE | `/api/cards/:id` | 61 |
| POST | `/api/cards/:id/members` | 68 |
| DELETE | `/api/cards/:id/members/:userId` | 78 |
| POST | `/api/cards/:id/labels` | 90 |
| DELETE | `/api/cards/:id/labels/:labelId` | 100 |
| GET | `/api/cards/:id/checklist` | 110 |
| POST | `/api/cards/:id/checklist` | 118 |
| PUT | `/api/cards/:id/checklist/:itemId` | 126 |
| DELETE | `/api/cards/:id/checklist/:itemId` | 134 |
| GET | `/api/cards/:id/dependencies/search` | 144 |
| GET | `/api/cards/:id/dependencies` | 152 |
| POST | `/api/cards/:id/dependencies` | 160 |
| DELETE | `/api/cards/:id/dependencies/:depId` | 168 |

## comments

Fuente: `apps/api/src/routes/comments.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/cards/:cardId/comments/count` | 24 |
| GET | `/api/cards/:cardId/comments` | 27 |
| POST | `/api/cards/:cardId/comments` | 30 |
| GET | `/api/boards/:boardId/comments/recent` | 35 |
| GET | `/api/comments/:commentId` | 45 |
| PATCH | `/api/comments/:commentId` | 48 |
| DELETE | `/api/comments/:commentId` | 51 |

## documentss

Fuente: `apps/api/src/routes/documentss.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/documents/templates` | 15 |
| GET | `/api/documents/mine` | 21 |
| GET | `/api/projects/:projectId/documents` | 24 |
| POST | `/api/workspaces/:workspaceId/documents` | 27 |
| GET | `/api/workspaces/:workspaceId/documents` | 32 |
| GET | `/api/documents/:id` | 37 |
| PUT | `/api/documents/:id` | 40 |
| DELETE | `/api/documents/:id` | 43 |
| POST | `/api/documents/:id/versions` | 46 |
| GET | `/api/documents/:id/versions` | 48 |
| POST | `/api/documents/:id/versions/:versionId/restore` | 50 |
| PUT | `/api/documents/:id/permissions` | 55 |
| GET | `/api/documents/:id/members` | 59 |
| GET | `/api/documents/:id/export` | 62 |
| PUT | `/api/documents/:id/yjs-state` | 65 |
| GET | `/api/documents/:id/comments` | 118 |
| POST | `/api/documents/:id/comments` | 121 |
| PATCH | `/api/document-comments/:commentId` | 124 |
| PATCH | `/api/document-comments/:commentId/resolve` | 129 |
| DELETE | `/api/document-comments/:commentId` | 134 |

## events

Fuente: `apps/api/src/routes/events.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/events/me` | 11 |
| POST | `/api/events` | 12 |
| GET | `/api/events/:id` | 13 |
| PATCH | `/api/events/:id` | 14 |
| DELETE | `/api/events/:id` | 15 |

## github_webhook

Fuente: `apps/api/src/routes/github_webhook.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| POST | `/api/webhooks/github/:workspaceId` | 91 |

## initiatives

Fuente: `apps/api/src/routes/initiatives.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/initiatives` | 11 |
| POST | `/api/initiatives` | 12 |
| POST | `/api/initiatives/request` | 15 |
| GET | `/api/initiatives/reports` | 16 |
| GET | `/api/initiatives/settings/:workspaceId` | 17 |
| PUT | `/api/initiatives/settings/:workspaceId` | 18 |
| GET | `/api/initiatives/:id` | 19 |
| PATCH | `/api/initiatives/:id` | 20 |
| POST | `/api/initiatives/:id/participants` | 21 |
| DELETE | `/api/initiatives/:id/participants/:userId` | 22 |
| POST | `/api/initiatives/:id/transition` | 23 |
| POST | `/api/initiatives/:id/convert` | 24 |

## labels

Fuente: `apps/api/src/routes/labels.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| POST | `/api/workspaces/:workspaceId/labels` | 16 |
| GET | `/api/workspaces/:workspaceId/labels` | 19 |
| GET | `/api/labels/:id` | 22 |
| PUT | `/api/labels/:id` | 25 |
| DELETE | `/api/labels/:id` | 28 |

## networks

Fuente: `apps/api/src/routes/networks.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/networks` | 8 |
| POST | `/api/networks` | 9 |
| GET | `/api/networks/assignments` | 10 |
| POST | `/api/networks/invitations/:token/accept` | 11 |
| GET | `/api/networks/:id` | 12 |
| POST | `/api/networks/:id/organizations` | 13 |
| POST | `/api/networks/:id/members` | 14 |
| POST | `/api/networks/:id/programs` | 15 |
| POST | `/api/networks/:networkId/programs/:programId/initiatives` | 16 |
| POST | `/api/networks/:id/invitations` | 17 |
| POST | `/api/networks/:id/grants` | 18 |
| DELETE | `/api/networks/:id/grants/:grantId` | 19 |
| POST | `/api/networks/:networkId/programs/:programId/criteria` | 20 |
| PUT | `/api/networks/initiatives/:initiativeId/evaluation` | 21 |
| GET | `/api/networks/:id/reports` | 22 |

## notifications

Fuente: `apps/api/src/routes/notifications.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/notifications` | 17 |
| GET | `/api/notifications/unread-count` | 20 |
| PATCH | `/api/notifications/:notificationId/read` | 23 |
| POST | `/api/notifications/mark-all-read` | 30 |
| PATCH | `/api/notifications/:notificationId/archive` | 32 |
| PATCH | `/api/notifications/:notificationId/restore` | 33 |
| PATCH | `/api/notifications/:notificationId/resolve` | 34 |
| PATCH | `/api/notifications/:notificationId/reopen` | 35 |
| DELETE | `/api/notifications/:notificationId` | 38 |

## organizations

Fuente: `apps/api/src/routes/organizations.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| POST | `/api/organizations/invitations/:token/accept` | 7 |
| POST | `/api/organizations` | 8 |
| GET | `/api/organizations` | 9 |
| GET | `/api/organizations/:id/members` | 10 |
| PATCH | `/api/organizations/:id/members/:userId` | 11 |
| DELETE | `/api/organizations/:id/members/:userId` | 12 |
| POST | `/api/organizations/:id/invitations` | 13 |
| GET | `/api/organizations/:id/invitations` | 14 |
| DELETE | `/api/organizations/:id/invitations/:invitationId` | 15 |
| POST | `/api/organizations/:id/transfer-ownership` | 16 |
| GET | `/api/organizations/:id` | 17 |
| PUT | `/api/organizations/:id` | 18 |

## portfolios

Fuente: `apps/api/src/routes/portfolios.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/portfolios` | 10 |
| POST | `/api/portfolios` | 11 |
| GET | `/api/portfolios/:id/overview` | 14 |
| GET | `/api/portfolios/:id/alerts` | 15 |
| GET | `/api/portfolios/:id/capacity` | 16 |
| GET | `/api/portfolios/:id/export.csv` | 17 |
| GET | `/api/portfolios/:id/projects/candidates` | 18 |
| POST | `/api/portfolios/:id/capacity/availability` | 19 |
| PUT | `/api/portfolios/:id/capacity/availability/:capacityId` | 20 |
| DELETE | `/api/portfolios/:id/capacity/availability/:capacityId` | 21 |
| POST | `/api/portfolios/:id/capacity/allocations` | 22 |
| PATCH | `/api/portfolios/:id/capacity/allocations/:allocationId` | 23 |
| DELETE | `/api/portfolios/:id/capacity/allocations/:allocationId` | 24 |
| PATCH | `/api/portfolios/:id/alerts/:alertId` | 25 |
| GET | `/api/portfolios/:id` | 26 |
| PATCH | `/api/portfolios/:id` | 27 |
| POST | `/api/portfolios/:id/archive` | 28 |
| POST | `/api/portfolios/:id/members` | 29 |
| DELETE | `/api/portfolios/:id/members/:userId` | 30 |
| POST | `/api/portfolios/:id/projects` | 31 |
| DELETE | `/api/portfolios/:id/projects/:projectId` | 32 |

## presence

Fuente: `apps/api/src/routes/presence.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/presence/boards/:boardId/active-users` | 39 |
| GET | `/api/presence/cards/:cardId/typing` | 83 |
| GET | `/api/presence/boards/:boardId/events` | 128 |
| GET | `/api/presence/cards/:cardId/activity` | 171 |
| GET | `/api/presence/boards/:boardId/stats` | 212 |

## projects

Fuente: `apps/api/src/routes/projects.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/projects` | 16 |
| GET | `/api/projects/:id` | 23 |
| PUT | `/api/projects/:id` | 24 |
| DELETE | `/api/projects/:id` | 25 |
| POST | `/api/projects/:id/adopt-current-standard` | 26 |
| POST | `/api/projects/:id/workflow` | 27 |
| GET | `/api/projects/:id/stats` | 30 |
| GET | `/api/projects/:id/timeline-cards` | 31 |
| GET | `/api/projects/:id/backlog` | 32 |
| POST | `/api/projects/:id/boards` | 35 |
| DELETE | `/api/projects/:id/boards/:boardId` | 36 |
| POST | `/api/projects/:id/milestones` | 39 |
| PUT | `/api/projects/:id/milestones/:milestoneId` | 40 |
| DELETE | `/api/projects/:id/milestones/:milestoneId` | 41 |
| GET | `/api/projects/:id/teams` | 44 |
| POST | `/api/projects/:id/teams` | 45 |
| DELETE | `/api/projects/:id/teams/:teamId` | 46 |
| GET | `/api/projects/:id/members` | 49 |
| POST | `/api/projects/:id/members` | 50 |
| PATCH | `/api/projects/:id/members/:userId` | 51 |
| DELETE | `/api/projects/:id/members/:userId` | 52 |
| GET | `/api/projects/:id/activity` | 55 |

## search

Fuente: `apps/api/src/routes/search.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/search` | 15 |

## teams

Fuente: `apps/api/src/routes/teams.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/teams` | 13 |
| POST | `/api/teams` | 14 |
| GET | `/api/teams/invitations` | 17 |
| POST | `/api/teams/invitations/:invitationId/accept` | 18 |
| POST | `/api/teams/invitations/:invitationId/reject` | 19 |
| GET | `/api/teams/:id` | 22 |
| PUT | `/api/teams/:id` | 23 |
| DELETE | `/api/teams/:id` | 24 |
| GET | `/api/teams/:id/workspaces` | 27 |
| GET | `/api/teams/:id/activity` | 30 |
| GET | `/api/teams/:id/members` | 33 |
| POST | `/api/teams/:id/members` | 34 |
| PUT | `/api/teams/:id/members/:userId` | 35 |
| DELETE | `/api/teams/:id/members/:userId` | 36 |

## user

Fuente: `apps/api/src/routes/user.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| GET | `/api/users` | 19 |
| GET | `/api/users/search` | 26 |
| GET | `/api/users/me/stats` | 33 |
| GET | `/api/users/me/activity` | 40 |
| GET | `/api/users/me/cards` | 47 |
| GET | `/api/users/me/preferences` | 54 |
| PUT | `/api/users/me` | 61 |
| PUT | `/api/users/me/password` | 68 |
| POST | `/api/users/me/avatar` | 75 |
| PUT | `/api/users/me/preferences` | 82 |
| GET | `/api/users/favorites` | 89 |
| POST | `/api/users/favorites/:userId` | 96 |
| DELETE | `/api/users/favorites/:userId` | 103 |
| GET | `/api/users/me/agenda` | 109 |
| GET | `/api/users/me/github/prs` | 115 |
| GET | `/api/users/me/teammates` | 116 |
| GET | `/api/users/me/team-standups` | 117 |
| GET | `/api/users/me/standup` | 123 |
| PUT | `/api/users/me/standup` | 129 |
| POST | `/api/users/me/standup/publish` | 135 |
| GET | `/api/users/:id` | 142 |

## workspace

Fuente: `apps/api/src/routes/workspace.ts`.

| Método | Ruta con prefijo | Línea de declaración |
| :--- | :--- | ---: |
| POST | `/api/workspaces` | 21 |
| GET | `/api/workspaces` | 28 |
| POST | `/api/workspaces/from-template` | 35 |
| POST | `/api/workspaces/join/:token` | 42 |
| GET | `/api/workspaces/invitations` | 49 |
| POST | `/api/workspaces/invitations/:invitationId/accept` | 55 |
| POST | `/api/workspaces/invitations/:invitationId/reject` | 61 |
| GET | `/api/workspaces/:id` | 68 |
| PUT | `/api/workspaces/:id` | 75 |
| PUT | `/api/workspaces/:id/mode` | 84 |
| DELETE | `/api/workspaces/:id` | 93 |
| POST | `/api/workspaces/:id/invite` | 102 |
| POST | `/api/workspaces/:id/invite-multiple` | 111 |
| GET | `/api/workspaces/:id/members` | 120 |
| GET | `/api/workspaces/:id/pending-invitations` | 128 |
| PUT | `/api/workspaces/:id/members/:userId` | 137 |
| DELETE | `/api/workspaces/:id/members/:userId` | 146 |
| GET | `/api/workspaces/:id/stats` | 154 |
| GET | `/api/workspaces/:id/project-standard` | 162 |
| GET | `/api/workspaces/:id/project-standard/history` | 170 |
| PUT | `/api/workspaces/:id/project-standard` | 178 |
| GET | `/api/workspaces/:id/teams` | 186 |
| POST | `/api/workspaces/:id/archive` | 194 |
| POST | `/api/workspaces/:id/restore` | 202 |
| POST | `/api/workspaces/:id/duplicate` | 210 |
| PUT | `/api/workspaces/:id/visibility` | 218 |
| POST | `/api/workspaces/:id/invite-token` | 226 |
| DELETE | `/api/workspaces/:id/invite-token` | 234 |
| GET | `/api/workspaces/:id/github` | 242 |
| GET | `/api/workspaces/:id/github/repos` | 250 |
| POST | `/api/workspaces/:id/github` | 258 |
| DELETE | `/api/workspaces/:id/github` | 266 |
| GET | `/api/workspaces/:id/projects` | 274 |
| POST | `/api/workspaces/:id/projects` | 283 |
| GET | `/api/workspaces/:id/activity` | 292 |
| GET | `/api/workspaces/:id/activity/stats` | 300 |
