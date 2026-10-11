---
title: "Inventario de datos"
tipo: "inventario observado"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Inventario de datos

## Alcance

Inventario extraído de apps/api/prisma/schema.prisma el 7 de septiembre de 2026. Contiene 70 modelos y 16 enumeraciones. Refleja el esquema declarado; no acredita que una base desplegada tenga aplicadas todas sus migraciones.

Las marcas ? y [] indican opcionalidad y colección en Prisma. Las anotaciones documentan relaciones, mapeos, índices y restricciones declaradas. Las migraciones SQL pueden contener triggers y controles adicionales que no aparecen aquí. El significado funcional y las invariantes objetivo están en [[Modelo de dominio]].

## OrganizationType

Tipo: enum. Fuente: schema.prisma, línea 11.

Valores declarados: `PERSONAL`, `COMPANY`, `INSTITUTION`, `NETWORK_OPERATOR`.

## OrganizationMemberRole

Tipo: enum. Fuente: schema.prisma, línea 18.

Valores declarados: `OWNER`, `BILLING_ADMIN`, `ADMIN`, `MEMBER`.

## PortfolioMemberRole

Tipo: enum. Fuente: schema.prisma, línea 27.

Valores declarados: `ADMIN`, `MANAGER`, `VIEWER`.

## SubscriptionStatus

Tipo: enum. Fuente: schema.prisma, línea 33.

Valores declarados: `TRIALING`, `ACTIVE`, `PAST_DUE`, `PAUSED`, `CANCELED`, `EXPIRED`.

## WorkspaceMode

Tipo: enum. Fuente: schema.prisma, línea 44.

Valores declarados: `PERSONAL`, `TEAM`, `INSTITUTIONAL`.

## ProjectOperationalRole

Tipo: enum. Fuente: schema.prisma, línea 50.

Valores declarados: `TRIAGE_COORDINATOR`, `MENTOR`, `PROJECT_LEAD`, `COLLABORATOR`, `REQUESTER`, `EVALUATOR`.

## InitiativeStage

Tipo: enum. Fuente: schema.prisma, línea 59.

Valores declarados: `SUBMITTED`, `TRIAGE`, `DIAGNOSIS`, `VALIDATION`, `APPROVED`, `DECLINED`, `PAUSED`, `ARCHIVED`.

## InitiativeParticipantRole

Tipo: enum. Fuente: schema.prisma, línea 70.

Valores declarados: `REQUESTER`, `TRIAGE_COORDINATOR`, `MENTOR`, `EVALUATOR`, `PROJECT_LEAD`, `COLLABORATOR`, `SPONSOR`.

## NetworkOrganizationRole

Tipo: enum. Fuente: schema.prisma, línea 80.

Valores declarados: `HOST`, `PARTNER`, `SPONSOR`.

## NetworkMemberRole

Tipo: enum. Fuente: schema.prisma, línea 86.

Valores declarados: `ADMIN`, `MEMBER`, `MENTOR`, `EVALUATOR`.

## NetworkProgramStatus

Tipo: enum. Fuente: schema.prisma, línea 93.

Valores declarados: `DRAFT`, `OPEN`, `REVIEWING`, `CLOSED`, `ARCHIVED`.

## NetworkProgramType

Tipo: enum. Fuente: schema.prisma, línea 101.

Valores declarados: `CALL`, `INCUBATOR`, `CHALLENGE`, `FUND`, `MENTORSHIP`.

## NetworkExternalRole

Tipo: enum. Fuente: schema.prisma, línea 109.

Valores declarados: `MENTOR`, `EVALUATOR`, `SPONSOR`, `PARTNER`, `REQUESTER`.

## NetworkResourceType

Tipo: enum. Fuente: schema.prisma, línea 117.

Valores declarados: `INITIATIVE`, `DOCUMENT`, `PROJECT`.

## Event

Tipo: model. Fuente: schema.prisma, línea 129.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `type` | `String   @db.VarChar(100)` |
| `timestamp` | `BigInt` |
| `version` | `Int      @default(1) @db.SmallInt` |
| `actorId` | `String   @map("actor_id")` |
| `actorName` | `String   @map("actor_name")` |
| `subjectType` | `String   @map("subject_type") @db.VarChar(50)` |
| `subjectId` | `String   @map("subject_id") @db.Uuid` |
| `subjectName` | `String   @map("subject_name")` |
| `workspaceId` | `String?  @map("workspace_id") @db.Uuid` |
| `boardId` | `String?  @map("board_id") @db.Uuid` |
| `listId` | `String?  @map("list_id") @db.Uuid` |
| `cardId` | `String?  @map("card_id") @db.Uuid` |
| `documentId` | `String?  @map("document_id") @db.Uuid` |
| `delta` | `Json?` |
| `payload` | `Json     @default("{}")` |
| `vectorClock` | `Json     @map("vector_clock")` |
| `correlationId` | `String?  @map("correlation_id") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `@@index([type])` | `Restricción del modelo` |
| `@@index([timestamp])` | `Restricción del modelo` |
| `@@index([actorId])` | `Restricción del modelo` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@index([boardId])` | `Restricción del modelo` |
| `@@index([cardId])` | `Restricción del modelo` |
| `@@index([documentId])` | `Restricción del modelo` |
| `@@map("events")` | `Restricción del modelo` |

## User

Tipo: model. Fuente: schema.prisma, línea 162.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `email` | `String    @unique` |
| `password` | `String` |
| `name` | `String` |
| `avatar` | `String?` |
| `bio` | `String?` |
| `position` | `String?   @db.VarChar(255)` |
| `timezone` | `String?   @default("UTC") @db.VarChar(100)` |
| `language` | `String?   @default("es") @db.VarChar(10)` |
| `phone` | `String?   @db.VarChar(50)` |
| `location` | `String?   @db.VarChar(255)` |
| `emailVerified` | `Boolean   @default(false) @map("email_verified")` |
| `emailVerificationToken` | `String?   @unique @map("email_verification_token") @db.VarChar(255)` |
| `emailVerificationExpires` | `DateTime? @map("email_verification_expires")` |
| `passwordResetToken` | `String?   @unique @map("password_reset_token") @db.VarChar(255)` |
| `passwordResetExpires` | `DateTime? @map("password_reset_expires")` |
| `aiPlannerCredits` | `Int       @default(3) @map("ai_planner_credits")` |
| `createdAt` | `DateTime  @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime  @updatedAt @map("updated_at")` |
| `preferences` | `UserPreferences?` |
| `workspaces` | `WorkspaceMember[]` |
| `sessions` | `UserSession[]` |
| `createdBoards` | `Board[]` |
| `createdLists` | `List[]` |
| `createdCards` | `Card[]` |
| `cardMemberships` | `CardMember[]` |
| `comments` | `Comment[]` |
| `notifications` | `Notification[]` |
| `activityLogs` | `UserActivityLog[]` |
| `standups` | `Standup[]` |
| `aiBuilderDocuments` | `AiBuilderDocument[]` |
| `favoriteContacts` | `UserFavoriteContact[] @relation("UserFavorites")` |
| `favoritedBy` | `UserFavoriteContact[] @relation("FavoritedUser")` |
| `teamMemberships` | `TeamMember[]` |
| `createdTeams` | `Team[]                @relation("TeamCreator")` |
| `ledTeams` | `Team[]                @relation("TeamLead")` |
| `workspaceInvitationsReceived` | `WorkspaceInvitation[] @relation("WsInvitedUser")` |
| `workspaceInvitationsSent` | `WorkspaceInvitation[] @relation("WsInvitedBy")` |
| `teamInvitationsReceived` | `TeamInvitation[]      @relation("TeamInvitedUser")` |
| `teamInvitationsSent` | `TeamInvitation[]      @relation("TeamInvitedBy")` |
| `projectMemberships` | `ProjectMember[]       @relation("ProjectMemberUser")` |
| `projectMembershipsAdded` | `ProjectMember[]       @relation("ProjectMemberAdder")` |
| `calendarEventsCreated` | `CalendarEvent[]       @relation("CalendarEventCreator")` |
| `calendarEventAttendances` | `CalendarEventAttendee[] @relation("CalendarEventAttendeeUser")` |
| `ownedOrganizations` | `Organization[]        @relation("OrganizationOwner")` |
| `organizationMemberships` | `OrganizationMember[]` |
| `organizationInvitationsSent` | `OrganizationInvitation[] @relation("OrganizationInvitationInviter")` |
| `organizationInvitationsAccepted` | `OrganizationInvitation[] @relation("OrganizationInvitationAccepter")` |
| `organizationAccessRevocations` | `OrganizationAccessRevocation[] @relation("OrganizationAccessRevokedUser")` |
| `organizationAccessRevocationsIssued` | `OrganizationAccessRevocation[] @relation("OrganizationAccessRevokedBy")` |
| `submittedInitiatives` | `Initiative[]          @relation("InitiativeSubmitter")` |
| `triageOwnedInitiatives` | `Initiative[]          @relation("InitiativeTriageOwner")` |
| `mentoredInitiatives` | `Initiative[]          @relation("InitiativeMentor")` |
| `initiativeParticipation` | `InitiativeParticipant[]` |
| `initiativeAssignmentsReceived` | `InitiativeAssignmentHistory[] @relation("InitiativeAssignmentSubject")` |
| `initiativeAssignmentsRecorded` | `InitiativeAssignmentHistory[] @relation("InitiativeAssignmentActor")` |
| `projectRoleAssignments` | `ProjectRoleAssignment[] @relation("ProjectRoleAssignee")` |
| `networkMemberships` | `NetworkMember[]` |
| `networkAccessGrants` | `NetworkAccessGrant[] @relation("NetworkGrantUser")` |
| `networkInvitationsAccepted` | `NetworkExternalInvitation[] @relation("NetworkInvitationAcceptor")` |
| `networkInvitationsSent` | `NetworkExternalInvitation[] @relation("NetworkInvitationSender")` |
| `networkEvaluations` | `InitiativeEvaluation[]` |
| `networkAccessAudits` | `NetworkAccessAudit[] @relation("NetworkAccessActor")` |
| `portfolioMemberships` | `PortfolioMember[] @relation("PortfolioMemberUser")` |
| `portfolioMembershipsAdded` | `PortfolioMember[] @relation("PortfolioMemberAdder")` |
| `organizationCapacities` | `OrganizationMemberCapacity[]` |
| `projectCapacityAllocations` | `ProjectCapacityAllocation[] @relation("ProjectCapacityAllocationAssignee")` |
| `projectCapacityAllocationsAssigned` | `ProjectCapacityAllocation[] @relation("ProjectCapacityAllocationAssigner")` |
| `portfolioAlertsAcknowledged` | `PortfolioAlert[] @relation("PortfolioAlertAcknowledgedBy")` |
| `portfolioAlertsResolved` | `PortfolioAlert[] @relation("PortfolioAlertResolvedBy")` |
| `portfolioExports` | `PortfolioExportAudit[] @relation("PortfolioExportActor")` |
| `@@map("users")` | `Restricción del modelo` |

## UserPreferences

Tipo: model. Fuente: schema.prisma, línea 241.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `userId` | `String   @unique @map("user_id") @db.Uuid` |
| `theme` | `String   @default("dark") @db.VarChar(20)` |
| `emailNotifications` | `Boolean  @default(true) @map("email_notifications")` |
| `pushNotifications` | `Boolean  @default(true) @map("push_notifications")` |
| `inAppNotifications` | `Boolean  @default(true) @map("in_app_notifications")` |
| `notificationFrequency` | `String   @default("realtime") @map("notification_frequency") @db.VarChar(20)` |
| `compactMode` | `Boolean  @default(false) @map("compact_mode")` |
| `showArchived` | `Boolean  @default(false) @map("show_archived")` |
| `defaultBoardView` | `String   @default("kanban") @map("default_board_view") @db.VarChar(20)` |
| `githubToken` | `String?  @map("github_token")` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `user` | `User @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@map("user_preferences")` | `Restricción del modelo` |

## UserSession

Tipo: model. Fuente: schema.prisma, línea 263.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `userId` | `String    @map("user_id") @db.Uuid` |
| `socketId` | `String    @unique @map("socket_id") @db.VarChar(255)` |
| `boardId` | `String?   @map("board_id") @db.Uuid` |
| `workspaceId` | `String?   @map("workspace_id") @db.Uuid` |
| `connectedAt` | `DateTime  @default(now()) @map("connected_at")` |
| `lastPing` | `DateTime  @default(now()) @map("last_ping")` |
| `disconnectedAt` | `DateTime? @map("disconnected_at")` |
| `user` | `User       @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `board` | `Board?     @relation(fields: [boardId], references: [id], onDelete: SetNull)` |
| `workspace` | `Workspace? @relation(fields: [workspaceId], references: [id], onDelete: SetNull)` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@index([boardId])` | `Restricción del modelo` |
| `@@index([socketId])` | `Restricción del modelo` |
| `@@map("user_sessions")` | `Restricción del modelo` |

## UserFavoriteContact

Tipo: model. Fuente: schema.prisma, línea 285.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `favoriteUserId` | `String   @map("favorite_user_id") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `user` | `User @relation("UserFavorites", fields: [userId], references: [id], onDelete: Cascade)` |
| `favoriteUser` | `User @relation("FavoritedUser", fields: [favoriteUserId], references: [id], onDelete: Cascade)` |
| `@@unique([userId,` | `favoriteUserId])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("user_favorite_contacts")` | `Restricción del modelo` |

## UserActivityLog

Tipo: model. Fuente: schema.prisma, línea 301.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `activityType` | `String   @map("activity_type") @db.VarChar(100)` |
| `metadata` | `Json     @default("{}")` |
| `boardId` | `String?  @map("board_id") @db.Uuid` |
| `workspaceId` | `String?  @map("workspace_id") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `user` | `User @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@map("user_activity_log")` | `Restricción del modelo` |

## Workspace

Tipo: model. Fuente: schema.prisma, línea 319.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `organizationId` | `String  @map("organization_id") @db.Uuid` |
| `mode` | `WorkspaceMode @default(TEAM) @map("operating_mode")` |
| `name` | `String` |
| `description` | `String?` |
| `ownerId` | `String    @map("owner_id") @db.Uuid` |
| `icon` | `String?` |
| `color` | `String?` |
| `archived` | `Boolean   @default(false)` |
| `archivedAt` | `DateTime? @map("archived_at")` |
| `visibility` | `String    @default("private") @db.VarChar(20)` |
| `inviteToken` | `String?   @unique @map("invite_token") @db.VarChar(100)` |
| `initiativeTeamId` | `String? @map("initiative_team_id") @db.Uuid` |
| `createdAt` | `DateTime  @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime  @updatedAt @map("updated_at")` |
| `members` | `WorkspaceMember[]` |
| `boards` | `Board[]` |
| `labels` | `Label[]` |
| `projects` | `Project[]` |
| `projectStandards` | `WorkspaceProjectStandard[]` |
| `documents` | `Document[]` |
| `sessions` | `UserSession[]` |
| `standups` | `Standup[]` |
| `githubConnection` | `WorkspaceGithubConnection?` |
| `invitations` | `WorkspaceInvitation[]` |
| `calendarEvents` | `CalendarEvent[]` |
| `teams` | `Team[]` |
| `organization` | `Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)` |
| `institutionalSettings` | `WorkspaceInstitutionalSettings?` |
| `initiatives` | `Initiative[]` |
| `hostedNetworkPrograms` | `NetworkProgram[] @relation("NetworkProgramHostWorkspace")` |
| `@@map("workspaces")` | `Restricción del modelo` |

## WorkspaceProjectStandard

Tipo: model. Fuente: schema.prisma, línea 356.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String   @map("workspace_id") @db.Uuid` |
| `name` | `String   @db.VarChar(255)` |
| `version` | `Int      @default(1)` |
| `isActive` | `Boolean  @default(true) @map("is_active")` |
| `definitionJson` | `Json   @map("definition_json")` |
| `createdBy` | `String?  @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `workspace` | `Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `activeForInstitutionalSettings` | `WorkspaceInstitutionalSettings[] @relation("InstitutionalActiveStandard")` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@index([workspaceId,` | `isActive])` |
| `@@map("workspace_project_standards")` | `Restricción del modelo` |

## WorkspaceMember

Tipo: model. Fuente: schema.prisma, línea 377.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String   @map("workspace_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `role` | `String   @db.VarChar(20)` |
| `joinedAt` | `DateTime @default(now()) @map("joined_at")` |
| `workspace` | `Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `user` | `User      @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@unique([workspaceId,` | `userId])` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("workspace_members")` | `Restricción del modelo` |

## WorkspaceInvitation

Tipo: model. Fuente: schema.prisma, línea 395.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String   @map("workspace_id") @db.Uuid` |
| `invitedUserId` | `String   @map("invited_user_id") @db.Uuid` |
| `invitedBy` | `String   @map("invited_by") @db.Uuid` |
| `role` | `String   @default("MEMBER") @db.VarChar(20)` |
| `status` | `String   @default("PENDING") @db.VarChar(20)` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `workspace` | `Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `invitedUser` | `User      @relation("WsInvitedUser", fields: [invitedUserId], references: [id], onDelete: Cascade)` |
| `inviter` | `User      @relation("WsInvitedBy", fields: [invitedBy], references: [id], onDelete: Cascade)` |
| `@@unique([workspaceId,` | `invitedUserId])` |
| `@@index([invitedUserId])` | `Restricción del modelo` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@index([status])` | `Restricción del modelo` |
| `@@map("workspace_invitations")` | `Restricción del modelo` |

## WorkspaceGithubConnection

Tipo: model. Fuente: schema.prisma, línea 417.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String   @unique @map("workspace_id") @db.Uuid` |
| `githubToken` | `String   @map("github_token")` |
| `repos` | `String[]` |
| `webhookSecret` | `String   @map("webhook_secret")` |
| `githubLogin` | `String?  @map("github_login")` |
| `connectedBy` | `String?  @map("connected_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `workspace` | `Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@map("workspace_github_connections")` | `Restricción del modelo` |

## Board

Tipo: model. Fuente: schema.prisma, línea 436.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String   @map("workspace_id") @db.Uuid` |
| `name` | `String` |
| `description` | `String?` |
| `position` | `Int` |
| `archived` | `Boolean  @default(false)` |
| `color` | `String?  @default("#3b82f6") @db.VarChar(50)` |
| `createdBy` | `String   @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `workspace` | `Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `creator` | `User             @relation(fields: [createdBy], references: [id])` |
| `lists` | `List[]` |
| `sprints` | `BoardSprint[]` |
| `milestones` | `BoardMilestone[]` |
| `sessions` | `UserSession[]` |
| `projects` | `ProjectBoard[]` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@map("boards")` | `Restricción del modelo` |

## List

Tipo: model. Fuente: schema.prisma, línea 462.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `boardId` | `String   @map("board_id") @db.Uuid` |
| `name` | `String` |
| `position` | `Int` |
| `createdBy` | `String?  @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `board` | `Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)` |
| `creator` | `User?  @relation(fields: [createdBy], references: [id])` |
| `cards` | `Card[]` |
| `@@index([boardId])` | `Restricción del modelo` |
| `@@index([createdBy])` | `Restricción del modelo` |
| `@@map("lists")` | `Restricción del modelo` |

## Card

Tipo: model. Fuente: schema.prisma, línea 482.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `listId` | `String    @map("list_id") @db.Uuid` |
| `title` | `String` |
| `description` | `String?` |
| `position` | `Int` |
| `startDate` | `DateTime? @map("start_date")` |
| `dueDate` | `DateTime? @map("due_date")` |
| `priority` | `String?   @db.VarChar(20)` |
| `estimatedMinutes` | `Int? @map("estimated_minutes")` |
| `completed` | `Boolean   @default(false)` |
| `completedAt` | `DateTime? @map("completed_at")` |
| `createdBy` | `String    @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime  @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime  @updatedAt @map("updated_at")` |
| `list` | `List               @relation(fields: [listId], references: [id], onDelete: Cascade)` |
| `creator` | `User               @relation(fields: [createdBy], references: [id])` |
| `members` | `CardMember[]` |
| `labels` | `CardLabel[]` |
| `comments` | `Comment[]` |
| `checklistItems` | `CardChecklistItem[]` |
| `blocking` | `CardDependency[]   @relation("BlockingCard")` |
| `blocked` | `CardDependency[]   @relation("BlockedCard")` |
| `sprintCards` | `SprintCard[]` |
| `@@index([listId])` | `Restricción del modelo` |
| `@@index([completed])` | `Restricción del modelo` |
| `@@map("cards")` | `Restricción del modelo` |

## CardMember

Tipo: model. Fuente: schema.prisma, línea 515.

| Campo o restricción | Declaración |
| :--- | :--- |
| `cardId` | `String   @map("card_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `assignedAt` | `DateTime @default(now()) @map("assigned_at")` |
| `card` | `Card @relation(fields: [cardId], references: [id], onDelete: Cascade)` |
| `user` | `User @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@id([cardId,` | `userId])` |
| `@@map("card_members")` | `Restricción del modelo` |

## CardLabel

Tipo: model. Fuente: schema.prisma, línea 529.

| Campo o restricción | Declaración |
| :--- | :--- |
| `cardId` | `String @map("card_id") @db.Uuid` |
| `labelId` | `String @map("label_id") @db.Uuid` |
| `card` | `Card  @relation(fields: [cardId], references: [id], onDelete: Cascade)` |
| `label` | `Label @relation(fields: [labelId], references: [id], onDelete: Cascade)` |
| `@@id([cardId,` | `labelId])` |
| `@@map("card_labels")` | `Restricción del modelo` |

## CardChecklistItem

Tipo: model. Fuente: schema.prisma, línea 542.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `cardId` | `String   @map("card_id") @db.Uuid` |
| `title` | `String   @db.VarChar(500)` |
| `completed` | `Boolean  @default(false)` |
| `position` | `Int      @default(0)` |
| `createdBy` | `String?  @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `card` | `Card @relation(fields: [cardId], references: [id], onDelete: Cascade)` |
| `@@index([cardId])` | `Restricción del modelo` |
| `@@index([cardId,` | `position])` |
| `@@map("card_checklist_items")` | `Restricción del modelo` |

## CardDependency

Tipo: model. Fuente: schema.prisma, línea 561.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `blockingCardId` | `String   @map("blocking_card_id") @db.Uuid` |
| `blockedCardId` | `String   @map("blocked_card_id") @db.Uuid` |
| `createdBy` | `String   @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `blockingCard` | `Card @relation("BlockingCard", fields: [blockingCardId], references: [id], onDelete: Cascade)` |
| `blockedCard` | `Card @relation("BlockedCard", fields: [blockedCardId], references: [id], onDelete: Cascade)` |
| `@@unique([blockingCardId,` | `blockedCardId])` |
| `@@index([blockingCardId])` | `Restricción del modelo` |
| `@@index([blockedCardId])` | `Restricción del modelo` |
| `@@map("card_dependencies")` | `Restricción del modelo` |

## Comment

Tipo: model. Fuente: schema.prisma, línea 579.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `cardId` | `String   @map("card_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `content` | `String` |
| `mentions` | `String[] @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `card` | `Card @relation(fields: [cardId], references: [id], onDelete: Cascade)` |
| `user` | `User @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@index([cardId])` | `Restricción del modelo` |
| `@@map("comments")` | `Restricción del modelo` |

## Label

Tipo: model. Fuente: schema.prisma, línea 597.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String   @map("workspace_id") @db.Uuid` |
| `name` | `String` |
| `color` | `String` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `workspace` | `Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `cards` | `CardLabel[]` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@map("labels")` | `Restricción del modelo` |

## Notification

Tipo: model. Fuente: schema.prisma, línea 613.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `type` | `String   @db.VarChar(100)` |
| `title` | `String   @db.VarChar(500)` |
| `message` | `String` |
| `data` | `Json     @default("{}")` |
| `dedupeKey` | `String?  @map("dedupe_key") @db.VarChar(255)` |
| `read` | `Boolean  @default(false)` |
| `readAt` | `DateTime? @map("read_at")` |
| `archivedAt` | `DateTime? @map("archived_at")` |
| `resolvedAt` | `DateTime? @map("resolved_at")` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `user` | `User @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@index([userId,` | `read])` |
| `@@index([userId,` | `dedupeKey])` |
| `@@map("notifications")` | `Restricción del modelo` |

## Document

Tipo: model. Fuente: schema.prisma, línea 637.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String   @map("workspace_id") @db.Uuid` |
| `projectId` | `String?  @map("project_id") @db.Uuid` |
| `title` | `String   @db.VarChar(500)` |
| `content` | `String   @default("")` |
| `yjsState` | `Bytes?   @map("yjs_state")` |
| `createdBy` | `String   @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `workspace` | `Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `project` | `Project?             @relation(fields: [projectId], references: [id], onDelete: SetNull)` |
| `permissions` | `DocumentPermission[]` |
| `comments` | `DocumentComment[]` |
| `versions` | `DocumentVersion[]` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@index([projectId])` | `Restricción del modelo` |
| `@@map("documents")` | `Restricción del modelo` |

## DocumentPermission

Tipo: model. Fuente: schema.prisma, línea 661.

| Campo o restricción | Declaración |
| :--- | :--- |
| `documentId` | `String @map("document_id") @db.Uuid` |
| `userId` | `String @map("user_id") @db.Uuid` |
| `permission` | `String @default("VIEW") @db.VarChar(20)` |
| `document` | `Document @relation(fields: [documentId], references: [id], onDelete: Cascade)` |
| `@@id([documentId,` | `userId])` |
| `@@map("document_permissions")` | `Restricción del modelo` |

## DocumentComment

Tipo: model. Fuente: schema.prisma, línea 674.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `documentId` | `String   @map("document_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `content` | `String` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `document` | `Document @relation(fields: [documentId], references: [id], onDelete: Cascade)` |
| `@@index([documentId])` | `Restricción del modelo` |
| `@@map("document_comments")` | `Restricción del modelo` |

## DocumentVersion

Tipo: model. Fuente: schema.prisma, línea 690.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `documentId` | `String   @map("document_id") @db.Uuid` |
| `yjsState` | `Bytes?   @map("yjs_state")` |
| `metadata` | `Json     @default("{}")` |
| `createdBy` | `String   @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `document` | `Document @relation(fields: [documentId], references: [id], onDelete: Cascade)` |
| `@@index([documentId])` | `Restricción del modelo` |
| `@@map("document_versions")` | `Restricción del modelo` |

## BoardSprint

Tipo: model. Fuente: schema.prisma, línea 706.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `boardId` | `String   @map("board_id") @db.Uuid` |
| `name` | `String   @db.VarChar(255)` |
| `goal` | `String?` |
| `startDate` | `DateTime @map("start_date") @db.Date` |
| `endDate` | `DateTime @map("end_date") @db.Date` |
| `status` | `String   @default("PLANNED") @db.VarChar(20)` |
| `position` | `Int      @default(0)` |
| `createdBy` | `String   @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `board` | `Board            @relation(fields: [boardId], references: [id], onDelete: Cascade)` |
| `cards` | `SprintCard[]` |
| `milestones` | `BoardMilestone[]` |
| `@@index([boardId])` | `Restricción del modelo` |
| `@@map("board_sprints")` | `Restricción del modelo` |

## SprintCard

Tipo: model. Fuente: schema.prisma, línea 729.

| Campo o restricción | Declaración |
| :--- | :--- |
| `sprintId` | `String   @map("sprint_id") @db.Uuid` |
| `cardId` | `String   @map("card_id") @db.Uuid` |
| `addedBy` | `String   @map("added_by") @db.Uuid` |
| `addedAt` | `DateTime @default(now()) @map("added_at")` |
| `sprint` | `BoardSprint @relation(fields: [sprintId], references: [id], onDelete: Cascade)` |
| `card` | `Card        @relation(fields: [cardId], references: [id], onDelete: Cascade)` |
| `@@id([sprintId,` | `cardId])` |
| `@@index([sprintId])` | `Restricción del modelo` |
| `@@index([cardId])` | `Restricción del modelo` |
| `@@map("sprint_cards")` | `Restricción del modelo` |

## BoardMilestone

Tipo: model. Fuente: schema.prisma, línea 746.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `boardId` | `String   @map("board_id") @db.Uuid` |
| `sprintId` | `String?  @map("sprint_id") @db.Uuid` |
| `name` | `String   @db.VarChar(255)` |
| `description` | `String?` |
| `date` | `DateTime @db.Date` |
| `color` | `String?  @default("#f59e0b") @db.VarChar(7)` |
| `createdBy` | `String   @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `board` | `Board        @relation(fields: [boardId], references: [id], onDelete: Cascade)` |
| `sprint` | `BoardSprint? @relation(fields: [sprintId], references: [id], onDelete: SetNull)` |
| `@@index([boardId])` | `Restricción del modelo` |
| `@@map("board_milestones")` | `Restricción del modelo` |

## Standup

Tipo: model. Fuente: schema.prisma, línea 766.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `userId` | `String    @map("user_id") @db.Uuid` |
| `workspaceId` | `String    @map("workspace_id") @db.Uuid` |
| `date` | `DateTime  @db.Date` |
| `yesterdayItems` | `Json      @default("[]") @map("yesterday_items")` |
| `todayItems` | `Json      @default("[]") @map("today_items")` |
| `blockers` | `Json      @default("[]")` |
| `publishedAt` | `DateTime? @map("published_at")` |
| `createdAt` | `DateTime  @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime  @updatedAt @map("updated_at")` |
| `user` | `User      @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `workspace` | `Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `@@unique([userId,` | `workspaceId, date])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@index([workspaceId,` | `date])` |
| `@@map("standups")` | `Restricción del modelo` |

## Team

Tipo: model. Fuente: schema.prisma, línea 789.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String?  @map("workspace_id") @db.Uuid` |
| `name` | `String   @db.VarChar(255)` |
| `description` | `String?` |
| `color` | `String?  @default("#3b82f6") @db.VarChar(50)` |
| `icon` | `String?` |
| `leadId` | `String?  @map("lead_id") @db.Uuid` |
| `createdBy` | `String   @map("created_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `lead` | `User?            @relation("TeamLead", fields: [leadId], references: [id], onDelete: SetNull)` |
| `creator` | `User             @relation("TeamCreator", fields: [createdBy], references: [id], onDelete: Cascade)` |
| `workspace` | `Workspace?       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `members` | `TeamMember[]` |
| `projects` | `ProjectTeam[]` |
| `invitations` | `TeamInvitation[]` |
| `calendarEvents` | `CalendarEvent[]` |
| `initiativeForInstitutionalSettings` | `WorkspaceInstitutionalSettings[] @relation("InstitutionalInitiativeTeam")` |
| `@@index([createdBy])` | `Restricción del modelo` |
| `@@index([leadId])` | `Restricción del modelo` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@map("teams")` | `Restricción del modelo` |

## TeamMember

Tipo: model. Fuente: schema.prisma, línea 818.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `teamId` | `String   @map("team_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `role` | `String   @default("MEMBER") @db.VarChar(50)` |
| `joinedAt` | `DateTime @default(now()) @map("joined_at")` |
| `team` | `Team @relation(fields: [teamId], references: [id], onDelete: Cascade)` |
| `user` | `User @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@unique([teamId,` | `userId])` |
| `@@index([teamId])` | `Restricción del modelo` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("team_members")` | `Restricción del modelo` |

## TeamInvitation

Tipo: model. Fuente: schema.prisma, línea 836.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `teamId` | `String   @map("team_id") @db.Uuid` |
| `invitedUserId` | `String   @map("invited_user_id") @db.Uuid` |
| `invitedBy` | `String   @map("invited_by") @db.Uuid` |
| `role` | `String   @default("MEMBER") @db.VarChar(20)` |
| `status` | `String   @default("PENDING") @db.VarChar(20)` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `team` | `Team @relation(fields: [teamId], references: [id], onDelete: Cascade)` |
| `invitedUser` | `User @relation("TeamInvitedUser", fields: [invitedUserId], references: [id], onDelete: Cascade)` |
| `inviter` | `User @relation("TeamInvitedBy", fields: [invitedBy], references: [id], onDelete: Cascade)` |
| `@@unique([teamId,` | `invitedUserId])` |
| `@@index([invitedUserId])` | `Restricción del modelo` |
| `@@index([teamId])` | `Restricción del modelo` |
| `@@index([status])` | `Restricción del modelo` |
| `@@map("team_invitations")` | `Restricción del modelo` |

## Project

Tipo: model. Fuente: schema.prisma, línea 858.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String    @map("workspace_id") @db.Uuid` |
| `sourceInitiativeId` | `String? @unique @map("source_initiative_id") @db.Uuid` |
| `name` | `String` |
| `description` | `String?` |
| `icon` | `String?` |
| `color` | `String?` |
| `status` | `String    @default("PLANNING") @db.VarChar(20)` |
| `maturityStage` | `String  @default("IDEA") @map("maturity_stage") @db.VarChar(20)` |
| `problemStatement` | `String? @map("problem_statement")` |
| `nextStep` | `String?   @map("next_step")` |
| `startDate` | `DateTime? @map("start_date")` |
| `endDate` | `DateTime? @map("end_date")` |
| `formalizedAt` | `DateTime? @map("formalized_at")` |
| `appliedStandardId` | `String? @map("applied_standard_id") @db.Uuid` |
| `appliedStandardVersion` | `Int? @map("applied_standard_version")` |
| `standardAppliedAt` | `DateTime? @map("standard_applied_at")` |
| `workflowStage` | `String    @default("INTAKE") @map("workflow_stage") @db.VarChar(30)` |
| `intakeReceivedAt` | `DateTime? @map("intake_received_at")` |
| `nextReviewAt` | `DateTime? @map("next_review_at")` |
| `triageOwnerId` | `String?  @map("triage_owner_id") @db.Uuid` |
| `mentorId` | `String?   @map("mentor_id") @db.Uuid` |
| `workflowDecision` | `String? @map("workflow_decision") @db.VarChar(30)` |
| `workflowDecisionReason` | `String? @map("workflow_decision_reason")` |
| `pausedReason` | `String? @map("paused_reason")` |
| `ownerId` | `String    @map("owner_id") @db.Uuid` |
| `createdAt` | `DateTime  @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime  @updatedAt @map("updated_at")` |
| `workspace` | `Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `boards` | `ProjectBoard[]` |
| `milestones` | `ProjectMilestone[]` |
| `teams` | `ProjectTeam[]` |
| `directMembers` | `ProjectMember[]` |
| `documents` | `Document[]` |
| `workflowHistory` | `ProjectWorkflowHistory[]` |
| `sourceInitiative` | `Initiative? @relation("InitiativeFormalizedProject", fields: [sourceInitiativeId], references: [id], onDelete: SetNull)` |
| `roleAssignments` | `ProjectRoleAssignment[]` |
| `portfolioLinks` | `PortfolioProject[]` |
| `capacityAllocations` | `ProjectCapacityAllocation[]` |
| `portfolioAlerts` | `PortfolioAlert[]` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@index([ownerId])` | `Restricción del modelo` |
| `@@map("projects")` | `Restricción del modelo` |

## ProjectWorkflowHistory

Tipo: model. Fuente: schema.prisma, línea 906.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `projectId` | `String   @map("project_id") @db.Uuid` |
| `fromStage` | `String?  @map("from_stage") @db.VarChar(30)` |
| `toStage` | `String   @map("to_stage") @db.VarChar(30)` |
| `decision` | `String?  @db.VarChar(30)` |
| `reason` | `String?` |
| `actorId` | `String?  @map("actor_id") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `project` | `Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `@@index([projectId,` | `createdAt])` |
| `@@map("project_workflow_history")` | `Restricción del modelo` |

## ProjectBoard

Tipo: model. Fuente: schema.prisma, línea 924.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `projectId` | `String   @map("project_id") @db.Uuid` |
| `boardId` | `String   @map("board_id") @db.Uuid` |
| `addedAt` | `DateTime @default(now()) @map("added_at")` |
| `project` | `Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `board` | `Board   @relation(fields: [boardId], references: [id], onDelete: Cascade)` |
| `@@unique([projectId,` | `boardId])` |
| `@@index([projectId])` | `Restricción del modelo` |
| `@@index([boardId])` | `Restricción del modelo` |
| `@@map("project_boards")` | `Restricción del modelo` |

## ProjectMilestone

Tipo: model. Fuente: schema.prisma, línea 941.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `projectId` | `String    @map("project_id") @db.Uuid` |
| `name` | `String` |
| `description` | `String?` |
| `date` | `DateTime?` |
| `status` | `String    @default("PENDING") @db.VarChar(20)` |
| `color` | `String?` |
| `createdAt` | `DateTime  @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime  @updatedAt @map("updated_at")` |
| `project` | `Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `@@index([projectId])` | `Restricción del modelo` |
| `@@map("project_milestones")` | `Restricción del modelo` |

## ProjectTeam

Tipo: model. Fuente: schema.prisma, línea 960.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `projectId` | `String   @map("project_id") @db.Uuid` |
| `teamId` | `String   @map("team_id") @db.Uuid` |
| `assignedAt` | `DateTime @default(now()) @map("assigned_at")` |
| `assignedBy` | `String?  @map("assigned_by") @db.Uuid` |
| `project` | `Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `team` | `Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)` |
| `@@unique([projectId,` | `teamId])` |
| `@@index([projectId])` | `Restricción del modelo` |
| `@@index([teamId])` | `Restricción del modelo` |
| `@@map("project_teams")` | `Restricción del modelo` |

## ProjectMember

Tipo: model. Fuente: schema.prisma, línea 978.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `projectId` | `String   @map("project_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `role` | `String   @default("MEMBER") @db.VarChar(20)` |
| `addedBy` | `String?  @map("added_by") @db.Uuid` |
| `addedAt` | `DateTime @default(now()) @map("added_at")` |
| `project` | `Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `user` | `User    @relation("ProjectMemberUser", fields: [userId], references: [id], onDelete: Cascade)` |
| `adder` | `User?   @relation("ProjectMemberAdder", fields: [addedBy], references: [id])` |
| `@@unique([projectId,` | `userId])` |
| `@@index([projectId])` | `Restricción del modelo` |
| `@@map("project_members")` | `Restricción del modelo` |

## CalendarEvent

Tipo: model. Fuente: schema.prisma, línea 997.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `title` | `String   @db.VarChar(500)` |
| `description` | `String?` |
| `startTime` | `DateTime @map("start_time") @db.Timestamptz()` |
| `endTime` | `DateTime @map("end_time")   @db.Timestamptz()` |
| `allDay` | `Boolean  @default(false)    @map("all_day")` |
| `color` | `String   @default("#5ec5ff") @db.VarChar(50)` |
| `type` | `String   @default("personal") @db.VarChar(20)` |
| `workspaceId` | `String?  @map("workspace_id") @db.Uuid` |
| `teamId` | `String?  @map("team_id")      @db.Uuid` |
| `createdBy` | `String   @map("created_by")   @db.Uuid` |
| `createdAt` | `DateTime @default(now())      @map("created_at") @db.Timestamptz()` |
| `updatedAt` | `DateTime @default(now())      @map("updated_at") @db.Timestamptz()` |
| `creator` | `User                        @relation("CalendarEventCreator",    fields: [createdBy], references: [id], onDelete: Cascade)` |
| `workspace` | `Workspace?                  @relation(fields: [workspaceId], references: [id], onDelete: SetNull)` |
| `team` | `Team?                       @relation(fields: [teamId],      references: [id], onDelete: SetNull)` |
| `attendees` | `CalendarEventAttendee[]` |
| `@@index([createdBy])` | `Restricción del modelo` |
| `@@index([startTime])` | `Restricción del modelo` |
| `@@index([workspaceId])` | `Restricción del modelo` |
| `@@index([teamId])` | `Restricción del modelo` |
| `@@map("calendar_events")` | `Restricción del modelo` |

## CalendarEventAttendee

Tipo: model. Fuente: schema.prisma, línea 1024.

| Campo o restricción | Declaración |
| :--- | :--- |
| `eventId` | `String @map("event_id") @db.Uuid` |
| `userId` | `String @map("user_id")  @db.Uuid` |
| `event` | `CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)` |
| `user` | `User          @relation("CalendarEventAttendeeUser", fields: [userId], references: [id], onDelete: Cascade)` |
| `@@id([eventId,` | `userId])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("calendar_event_attendees")` | `Restricción del modelo` |

## AiBuilderDocument

Tipo: model. Fuente: schema.prisma, línea 1038.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String    @id @default(uuid()) @db.Uuid` |
| `userId` | `String    @map("user_id") @db.Uuid` |
| `title` | `String    @default("Untitled Plan") @db.VarChar(255)` |
| `content` | `String    @default("")` |
| `usedAt` | `DateTime? @map("used_at")` |
| `createdAt` | `DateTime  @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime  @updatedAt @map("updated_at")` |
| `user` | `User @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("ai_builder_documents")` | `Restricción del modelo` |

## Organization

Tipo: model. Fuente: schema.prisma, línea 1055.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String           @id @default(uuid()) @db.Uuid` |
| `name` | `String           @db.VarChar(255)` |
| `type` | `OrganizationType @default(PERSONAL)` |
| `ownerUserId` | `String?          @map("owner_user_id") @db.Uuid` |
| `billingEmail` | `String?         @map("billing_email") @db.VarChar(255)` |
| `createdAt` | `DateTime         @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime         @updatedAt @map("updated_at")` |
| `owner` | `User?                @relation("OrganizationOwner", fields: [ownerUserId], references: [id], onDelete: SetNull)` |
| `members` | `OrganizationMember[]` |
| `subscriptions` | `Subscription[]` |
| `workspaces` | `Workspace[]` |
| `portfolios` | `Portfolio[]` |
| `ownedNetworks` | `Network[]            @relation("NetworkOwnerOrganization")` |
| `networkMemberships` | `NetworkOrganization[]` |
| `invitations` | `OrganizationInvitation[]` |
| `accessRevocations` | `OrganizationAccessRevocation[]` |
| `memberCapacities` | `OrganizationMemberCapacity[]` |
| `projectCapacityAllocations` | `ProjectCapacityAllocation[]` |
| `portfolioExportAudits` | `PortfolioExportAudit[]` |
| `@@index([ownerUserId])` | `Restricción del modelo` |
| `@@map("organizations")` | `Restricción del modelo` |

## OrganizationMember

Tipo: model. Fuente: schema.prisma, línea 1081.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String                 @id @default(uuid()) @db.Uuid` |
| `organizationId` | `String                 @map("organization_id") @db.Uuid` |
| `userId` | `String                 @map("user_id") @db.Uuid` |
| `role` | `OrganizationMemberRole @default(MEMBER)` |
| `joinedAt` | `DateTime               @default(now()) @map("joined_at")` |
| `organization` | `Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `user` | `User         @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@unique([organizationId,` | `userId])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("organization_members")` | `Restricción del modelo` |

## OrganizationInvitation

Tipo: model. Fuente: schema.prisma, línea 1096.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String                 @id @default(uuid()) @db.Uuid` |
| `organizationId` | `String                 @map("organization_id") @db.Uuid` |
| `email` | `String                 @db.VarChar(255)` |
| `role` | `OrganizationMemberRole @default(MEMBER)` |
| `tokenHash` | `String                 @unique @map("token_hash") @db.Char(64)` |
| `invitedById` | `String                 @map("invited_by") @db.Uuid` |
| `expiresAt` | `DateTime               @map("expires_at")` |
| `acceptedById` | `String?                @map("accepted_by") @db.Uuid` |
| `acceptedAt` | `DateTime?              @map("accepted_at")` |
| `revokedAt` | `DateTime?              @map("revoked_at")` |
| `createdAt` | `DateTime               @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime               @updatedAt @map("updated_at")` |
| `organization` | `Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `invitedBy` | `User         @relation("OrganizationInvitationInviter", fields: [invitedById], references: [id], onDelete: Restrict)` |
| `acceptedBy` | `User?        @relation("OrganizationInvitationAccepter", fields: [acceptedById], references: [id], onDelete: SetNull)` |
| `@@index([organizationId,` | `createdAt(sort: Desc)])` |
| `@@index([email,` | `createdAt(sort: Desc)])` |
| `@@map("organization_invitations")` | `Restricción del modelo` |

## OrganizationAccessRevocation

Tipo: model. Fuente: schema.prisma, línea 1119.

| Campo o restricción | Declaración |
| :--- | :--- |
| `organizationId` | `String   @map("organization_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `revokedById` | `String   @map("revoked_by") @db.Uuid` |
| `revokedAt` | `DateTime @default(now()) @map("revoked_at")` |
| `organization` | `Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `user` | `User         @relation("OrganizationAccessRevokedUser", fields: [userId], references: [id], onDelete: Cascade)` |
| `revokedBy` | `User         @relation("OrganizationAccessRevokedBy", fields: [revokedById], references: [id], onDelete: Restrict)` |
| `@@id([organizationId,` | `userId])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("organization_access_revocations")` | `Restricción del modelo` |

## Subscription

Tipo: model. Fuente: schema.prisma, línea 1134.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String             @id @default(uuid()) @db.Uuid` |
| `organizationId` | `String             @map("organization_id") @db.Uuid` |
| `planCode` | `String             @map("plan_code") @db.VarChar(100)` |
| `status` | `SubscriptionStatus @default(TRIALING)` |
| `provider` | `String?            @db.VarChar(50)` |
| `providerCustomerId` | `String?            @map("provider_customer_id") @db.VarChar(255)` |
| `providerSubscriptionId` | `String?            @unique @map("provider_subscription_id") @db.VarChar(255)` |
| `currentPeriodStart` | `DateTime?          @map("current_period_start")` |
| `currentPeriodEnd` | `DateTime?          @map("current_period_end")` |
| `cancelAtPeriodEnd` | `Boolean            @default(false) @map("cancel_at_period_end")` |
| `createdAt` | `DateTime           @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime           @updatedAt @map("updated_at")` |
| `organization` | `Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `entitlements` | `SubscriptionEntitlement[]` |
| `@@index([organizationId,` | `status])` |
| `@@map("subscriptions")` | `Restricción del modelo` |

## SubscriptionEntitlement

Tipo: model. Fuente: schema.prisma, línea 1155.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `subscriptionId` | `String   @map("subscription_id") @db.Uuid` |
| `capability` | `String   @db.VarChar(100)` |
| `limitValue` | `Int?     @map("limit_value")` |
| `metadata` | `Json     @default("{}")` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `subscription` | `Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)` |
| `@@unique([subscriptionId,` | `capability])` |
| `@@map("subscription_entitlements")` | `Restricción del modelo` |

## Portfolio

Tipo: model. Fuente: schema.prisma, línea 1170.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `organizationId` | `String   @map("organization_id") @db.Uuid` |
| `name` | `String   @db.VarChar(255)` |
| `description` | `String?` |
| `createdBy` | `String?  @map("created_by") @db.Uuid` |
| `archivedAt` | `DateTime? @map("archived_at")` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `organization` | `Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `projects` | `PortfolioProject[]` |
| `members` | `PortfolioMember[]` |
| `alerts` | `PortfolioAlert[]` |
| `exportAudits` | `PortfolioExportAudit[]` |
| `@@index([organizationId])` | `Restricción del modelo` |
| `@@index([organizationId,` | `archivedAt])` |
| `@@map("portfolios")` | `Restricción del modelo` |

## PortfolioMember

Tipo: model. Fuente: schema.prisma, línea 1194.

| Campo o restricción | Declaración |
| :--- | :--- |
| `portfolioId` | `String              @map("portfolio_id") @db.Uuid` |
| `userId` | `String              @map("user_id") @db.Uuid` |
| `role` | `PortfolioMemberRole @default(VIEWER)` |
| `addedById` | `String?             @map("added_by") @db.Uuid` |
| `addedAt` | `DateTime            @default(now()) @map("added_at")` |
| `updatedAt` | `DateTime            @updatedAt @map("updated_at")` |
| `portfolio` | `Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)` |
| `user` | `User      @relation("PortfolioMemberUser", fields: [userId], references: [id], onDelete: Cascade)` |
| `addedBy` | `User?     @relation("PortfolioMemberAdder", fields: [addedById], references: [id], onDelete: SetNull)` |
| `@@id([portfolioId,` | `userId])` |
| `@@index([userId,` | `role])` |
| `@@map("portfolio_members")` | `Restricción del modelo` |

## PortfolioProject

Tipo: model. Fuente: schema.prisma, línea 1211.

| Campo o restricción | Declaración |
| :--- | :--- |
| `portfolioId` | `String   @map("portfolio_id") @db.Uuid` |
| `projectId` | `String   @map("project_id") @db.Uuid` |
| `addedBy` | `String?  @map("added_by") @db.Uuid` |
| `addedAt` | `DateTime @default(now()) @map("added_at")` |
| `portfolio` | `Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)` |
| `project` | `Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `@@id([portfolioId,` | `projectId])` |
| `@@index([projectId])` | `Restricción del modelo` |
| `@@map("portfolio_projects")` | `Restricción del modelo` |

## OrganizationMemberCapacity

Tipo: model. Fuente: schema.prisma, línea 1228.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `organizationId` | `String   @map("organization_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `weeklyAvailableMinutes` | `Int      @map("weekly_available_minutes")` |
| `effectiveFrom` | `DateTime @map("effective_from") @db.Date` |
| `effectiveUntil` | `DateTime? @map("effective_until") @db.Date` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `organization` | `Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `user` | `User         @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@index([organizationId,` | `userId, effectiveFrom])` |
| `@@index([organizationId,` | `effectiveUntil])` |
| `@@map("organization_member_capacities")` | `Restricción del modelo` |

## ProjectCapacityAllocation

Tipo: model. Fuente: schema.prisma, línea 1249.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `organizationId` | `String  @map("organization_id") @db.Uuid` |
| `projectId` | `String   @map("project_id") @db.Uuid` |
| `userId` | `String   @map("user_id") @db.Uuid` |
| `weeklyMinutes` | `Int      @map("weekly_minutes")` |
| `effectiveFrom` | `DateTime @map("effective_from") @db.Date` |
| `effectiveUntil` | `DateTime? @map("effective_until") @db.Date` |
| `assignedById` | `String?  @map("assigned_by") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `organization` | `Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `project` | `Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `user` | `User         @relation("ProjectCapacityAllocationAssignee", fields: [userId], references: [id], onDelete: Cascade)` |
| `assignedBy` | `User?        @relation("ProjectCapacityAllocationAssigner", fields: [assignedById], references: [id], onDelete: SetNull)` |
| `@@index([organizationId,` | `userId, effectiveFrom])` |
| `@@index([projectId,` | `effectiveFrom])` |
| `@@map("project_capacity_allocations")` | `Restricción del modelo` |

## PortfolioAlertSeverity

Tipo: enum. Fuente: schema.prisma, línea 1271.

Valores declarados: `INFO`, `WARNING`, `CRITICAL`.

## PortfolioAlertStatus

Tipo: enum. Fuente: schema.prisma, línea 1277.

Valores declarados: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`.

## PortfolioAlert

Tipo: model. Fuente: schema.prisma, línea 1285.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String                @id @default(uuid()) @db.Uuid` |
| `portfolioId` | `String                @map("portfolio_id") @db.Uuid` |
| `projectId` | `String?               @map("project_id") @db.Uuid` |
| `fingerprint` | `String                @db.VarChar(255)` |
| `type` | `String                @db.VarChar(100)` |
| `severity` | `PortfolioAlertSeverity @default(WARNING)` |
| `status` | `PortfolioAlertStatus  @default(OPEN)` |
| `title` | `String                @db.VarChar(500)` |
| `detail` | `String?` |
| `metadata` | `Json                  @default("{}")` |
| `acknowledgedAt` | `DateTime?             @map("acknowledged_at")` |
| `acknowledgedById` | `String?               @map("acknowledged_by") @db.Uuid` |
| `resolvedAt` | `DateTime?             @map("resolved_at")` |
| `resolvedById` | `String?               @map("resolved_by") @db.Uuid` |
| `createdAt` | `DateTime              @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime              @updatedAt @map("updated_at")` |
| `portfolio` | `Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)` |
| `project` | `Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `acknowledgedBy` | `User?     @relation("PortfolioAlertAcknowledgedBy", fields: [acknowledgedById], references: [id], onDelete: SetNull)` |
| `resolvedBy` | `User?     @relation("PortfolioAlertResolvedBy", fields: [resolvedById], references: [id], onDelete: SetNull)` |
| `@@unique([portfolioId,` | `fingerprint])` |
| `@@index([portfolioId,` | `status, severity])` |
| `@@index([projectId,` | `status])` |
| `@@map("portfolio_alerts")` | `Restricción del modelo` |

## PortfolioExportAudit

Tipo: model. Fuente: schema.prisma, línea 1317.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `portfolioId` | `String   @map("portfolio_id") @db.Uuid` |
| `organizationId` | `String   @map("organization_id") @db.Uuid` |
| `exportedById` | `String   @map("exported_by") @db.Uuid` |
| `filters` | `Json     @default("{}")` |
| `rowCount` | `Int      @map("row_count")` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `portfolio` | `Portfolio    @relation(fields: [portfolioId], references: [id], onDelete: Cascade)` |
| `organization` | `Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `exportedBy` | `User         @relation("PortfolioExportActor", fields: [exportedById], references: [id], onDelete: Cascade)` |
| `@@index([portfolioId,` | `createdAt])` |
| `@@index([organizationId,` | `createdAt])` |
| `@@index([exportedById,` | `createdAt])` |
| `@@map("portfolio_export_audits")` | `Restricción del modelo` |

## WorkspaceInstitutionalSettings

Tipo: model. Fuente: schema.prisma, línea 1338.

| Campo o restricción | Declaración |
| :--- | :--- |
| `workspaceId` | `String   @id @map("workspace_id") @db.Uuid` |
| `initiativeTeamId` | `String?  @map("initiative_team_id") @db.Uuid` |
| `activeStandardId` | `String?  @map("active_standard_id") @db.Uuid` |
| `intakeEnabled` | `Boolean  @default(true) @map("intake_enabled")` |
| `triageCriteria` | `Json     @default("[]") @map("triage_criteria")` |
| `reviewCadenceDays` | `Int      @default(7) @map("review_cadence_days")` |
| `requiredInitiativeFields` | `Json @default("[\"title\", \"problemStatement\", \"proposedNextStep\"]") @map("required_initiative_fields")` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `workspace` | `Workspace                @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `initiativeTeam` | `Team?                    @relation("InstitutionalInitiativeTeam", fields: [initiativeTeamId], references: [id], onDelete: SetNull)` |
| `activeStandard` | `WorkspaceProjectStandard? @relation("InstitutionalActiveStandard", fields: [activeStandardId], references: [id], onDelete: SetNull)` |
| `@@index([initiativeTeamId])` | `Restricción del modelo` |
| `@@index([activeStandardId])` | `Restricción del modelo` |
| `@@map("workspace_institutional_settings")` | `Restricción del modelo` |

## Initiative

Tipo: model. Fuente: schema.prisma, línea 1358.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String         @id @default(uuid()) @db.Uuid` |
| `workspaceId` | `String         @map("workspace_id") @db.Uuid` |
| `networkProgramId` | `String?        @map("network_program_id") @db.Uuid` |
| `submittedById` | `String?        @map("submitted_by") @db.Uuid` |
| `title` | `String         @db.VarChar(500)` |
| `description` | `String?` |
| `problemStatement` | `String?        @map("problem_statement")` |
| `proposedNextStep` | `String?        @map("proposed_next_step")` |
| `priority` | `String         @default("MEDIUM") @db.VarChar(20)` |
| `evidence` | `Json           @default("[]")` |
| `attachments` | `Json           @default("[]")` |
| `triageCriteriaSnapshot` | `Json      @default("[]") @map("triage_criteria_snapshot")` |
| `triageAssessment` | `Json           @default("[]") @map("triage_assessment")` |
| `triageOwnerId` | `String?        @map("triage_owner_id") @db.Uuid` |
| `mentorId` | `String?        @map("mentor_id") @db.Uuid` |
| `stage` | `InitiativeStage @default(SUBMITTED)` |
| `decision` | `String?        @db.VarChar(30)` |
| `decisionReason` | `String?        @map("decision_reason")` |
| `receivedAt` | `DateTime       @default(now()) @map("received_at")` |
| `nextReviewAt` | `DateTime?      @map("next_review_at")` |
| `createdAt` | `DateTime       @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime       @updatedAt @map("updated_at")` |
| `workspace` | `Workspace                   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)` |
| `networkProgram` | `NetworkProgram?              @relation(fields: [networkProgramId], references: [id], onDelete: SetNull)` |
| `submitter` | `User?                        @relation("InitiativeSubmitter", fields: [submittedById], references: [id], onDelete: SetNull)` |
| `triageOwner` | `User?                        @relation("InitiativeTriageOwner", fields: [triageOwnerId], references: [id], onDelete: SetNull)` |
| `mentor` | `User?                        @relation("InitiativeMentor", fields: [mentorId], references: [id], onDelete: SetNull)` |
| `participants` | `InitiativeParticipant[]` |
| `workflowHistory` | `InitiativeWorkflowHistory[]` |
| `assignmentHistory` | `InitiativeAssignmentHistory[]` |
| `evaluations` | `InitiativeEvaluation[]` |
| `formalizedProject` | `Project?                  @relation("InitiativeFormalizedProject")` |
| `@@index([workspaceId,` | `stage])` |
| `@@index([networkProgramId])` | `Restricción del modelo` |
| `@@index([submittedById])` | `Restricción del modelo` |
| `@@index([triageOwnerId])` | `Restricción del modelo` |
| `@@index([mentorId])` | `Restricción del modelo` |
| `@@map("initiatives")` | `Restricción del modelo` |

## InitiativeParticipant

Tipo: model. Fuente: schema.prisma, línea 1401.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String                    @id @default(uuid()) @db.Uuid` |
| `initiativeId` | `String                    @map("initiative_id") @db.Uuid` |
| `userId` | `String                    @map("user_id") @db.Uuid` |
| `role` | `InitiativeParticipantRole` |
| `assignedBy` | `String?                   @map("assigned_by") @db.Uuid` |
| `assignedAt` | `DateTime                  @default(now()) @map("assigned_at")` |
| `initiative` | `Initiative @relation(fields: [initiativeId], references: [id], onDelete: Cascade)` |
| `user` | `User       @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@unique([initiativeId,` | `userId, role])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("initiative_participants")` | `Restricción del modelo` |

## InitiativeWorkflowHistory

Tipo: model. Fuente: schema.prisma, línea 1417.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `initiativeId` | `String   @map("initiative_id") @db.Uuid` |
| `fromStage` | `InitiativeStage? @map("from_stage")` |
| `toStage` | `InitiativeStage @map("to_stage")` |
| `decision` | `String?  @db.VarChar(30)` |
| `reason` | `String?` |
| `actorId` | `String?  @map("actor_id") @db.Uuid` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `initiative` | `Initiative @relation(fields: [initiativeId], references: [id], onDelete: Cascade)` |
| `@@index([initiativeId,` | `createdAt])` |
| `@@map("initiative_workflow_history")` | `Restricción del modelo` |

## InitiativeAssignmentHistory

Tipo: model. Fuente: schema.prisma, línea 1433.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String                    @id @default(uuid()) @db.Uuid` |
| `initiativeId` | `String                    @map("initiative_id") @db.Uuid` |
| `subjectUserId` | `String?                   @map("subject_user_id") @db.Uuid` |
| `role` | `InitiativeParticipantRole` |
| `action` | `String                    @db.VarChar(20)` |
| `actorId` | `String?                   @map("actor_id") @db.Uuid` |
| `reason` | `String?` |
| `createdAt` | `DateTime                  @default(now()) @map("created_at")` |
| `initiative` | `Initiative @relation(fields: [initiativeId], references: [id], onDelete: Cascade)` |
| `subject` | `User?      @relation("InitiativeAssignmentSubject", fields: [subjectUserId], references: [id], onDelete: SetNull)` |
| `actor` | `User?      @relation("InitiativeAssignmentActor", fields: [actorId], references: [id], onDelete: SetNull)` |
| `@@index([initiativeId,` | `createdAt, id])` |
| `@@index([subjectUserId,` | `createdAt, id])` |
| `@@map("initiative_assignment_history")` | `Restricción del modelo` |

## ProjectRoleAssignment

Tipo: model. Fuente: schema.prisma, línea 1452.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String                 @id @default(uuid()) @db.Uuid` |
| `projectId` | `String                 @map("project_id") @db.Uuid` |
| `userId` | `String                 @map("user_id") @db.Uuid` |
| `role` | `ProjectOperationalRole` |
| `isPrimary` | `Boolean                @default(false) @map("is_primary")` |
| `assignedBy` | `String?                @map("assigned_by") @db.Uuid` |
| `assignedAt` | `DateTime               @default(now()) @map("assigned_at")` |
| `endedAt` | `DateTime?              @map("ended_at")` |
| `project` | `Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` |
| `user` | `User    @relation("ProjectRoleAssignee", fields: [userId], references: [id], onDelete: Cascade)` |
| `@@unique([projectId,` | `userId, role])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@index([projectId,` | `role])` |
| `@@map("project_role_assignments")` | `Restricción del modelo` |

## Network

Tipo: model. Fuente: schema.prisma, línea 1473.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `ownerOrganizationId` | `String   @map("owner_organization_id") @db.Uuid` |
| `name` | `String   @db.VarChar(255)` |
| `description` | `String?` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `ownerOrganization` | `Organization         @relation("NetworkOwnerOrganization", fields: [ownerOrganizationId], references: [id], onDelete: Cascade)` |
| `organizations` | `NetworkOrganization[]` |
| `members` | `NetworkMember[]` |
| `programs` | `NetworkProgram[]` |
| `externalInvitations` | `NetworkExternalInvitation[]` |
| `accessGrants` | `NetworkAccessGrant[]` |
| `accessAudits` | `NetworkAccessAudit[]` |
| `@@index([ownerOrganizationId])` | `Restricción del modelo` |
| `@@map("networks")` | `Restricción del modelo` |

## NetworkOrganization

Tipo: model. Fuente: schema.prisma, línea 1493.

| Campo o restricción | Declaración |
| :--- | :--- |
| `networkId` | `String                  @map("network_id") @db.Uuid` |
| `organizationId` | `String                  @map("organization_id") @db.Uuid` |
| `role` | `NetworkOrganizationRole @default(PARTNER)` |
| `joinedAt` | `DateTime                @default(now()) @map("joined_at")` |
| `network` | `Network      @relation(fields: [networkId], references: [id], onDelete: Cascade)` |
| `organization` | `Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)` |
| `@@id([networkId,` | `organizationId])` |
| `@@index([organizationId])` | `Restricción del modelo` |
| `@@map("network_organizations")` | `Restricción del modelo` |

## NetworkMember

Tipo: model. Fuente: schema.prisma, línea 1507.

| Campo o restricción | Declaración |
| :--- | :--- |
| `networkId` | `String            @map("network_id") @db.Uuid` |
| `userId` | `String            @map("user_id") @db.Uuid` |
| `role` | `NetworkMemberRole @default(MEMBER)` |
| `joinedAt` | `DateTime          @default(now()) @map("joined_at")` |
| `network` | `Network @relation(fields: [networkId], references: [id], onDelete: Cascade)` |
| `user` | `User    @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `@@id([networkId,` | `userId])` |
| `@@index([userId])` | `Restricción del modelo` |
| `@@map("network_members")` | `Restricción del modelo` |

## NetworkProgram

Tipo: model. Fuente: schema.prisma, línea 1521.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String               @id @default(uuid()) @db.Uuid` |
| `networkId` | `String               @map("network_id") @db.Uuid` |
| `hostWorkspaceId` | `String               @map("host_workspace_id") @db.Uuid` |
| `name` | `String               @db.VarChar(255)` |
| `description` | `String?` |
| `type` | `NetworkProgramType @default(CALL)` |
| `status` | `NetworkProgramStatus @default(DRAFT)` |
| `startsAt` | `DateTime?            @map("starts_at")` |
| `endsAt` | `DateTime?            @map("ends_at")` |
| `createdAt` | `DateTime             @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime             @updatedAt @map("updated_at")` |
| `network` | `Network      @relation(fields: [networkId], references: [id], onDelete: Cascade)` |
| `hostWorkspace` | `Workspace    @relation("NetworkProgramHostWorkspace", fields: [hostWorkspaceId], references: [id], onDelete: Cascade)` |
| `initiatives` | `Initiative[]` |
| `criteria` | `NetworkEvaluationCriterion[]` |
| `invitations` | `NetworkExternalInvitation[]` |
| `accessGrants` | `NetworkAccessGrant[]` |
| `evaluations` | `InitiativeEvaluation[]` |
| `@@index([networkId,` | `status])` |
| `@@index([hostWorkspaceId])` | `Restricción del modelo` |
| `@@map("network_programs")` | `Restricción del modelo` |

## NetworkExternalInvitation

Tipo: model. Fuente: schema.prisma, línea 1547.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String              @id @default(uuid()) @db.Uuid` |
| `networkId` | `String              @map("network_id") @db.Uuid` |
| `programId` | `String?             @map("program_id") @db.Uuid` |
| `email` | `String              @db.VarChar(255)` |
| `role` | `NetworkExternalRole` |
| `resourceType` | `NetworkResourceType @map("resource_type")` |
| `resourceId` | `String              @map("resource_id") @db.Uuid` |
| `permission` | `String              @default("VIEW") @db.VarChar(20)` |
| `token` | `String              @unique @db.VarChar(100)` |
| `status` | `String              @default("PENDING") @db.VarChar(20)` |
| `invitedById` | `String              @map("invited_by") @db.Uuid` |
| `acceptedById` | `String?            @map("accepted_by") @db.Uuid` |
| `expiresAt` | `DateTime?           @map("expires_at")` |
| `revokedAt` | `DateTime?           @map("revoked_at")` |
| `createdAt` | `DateTime            @default(now()) @map("created_at")` |
| `network` | `Network         @relation(fields: [networkId], references: [id], onDelete: Cascade)` |
| `program` | `NetworkProgram? @relation(fields: [programId], references: [id], onDelete: SetNull)` |
| `invitedBy` | `User            @relation("NetworkInvitationSender", fields: [invitedById], references: [id], onDelete: Cascade)` |
| `acceptedBy` | `User?           @relation("NetworkInvitationAcceptor", fields: [acceptedById], references: [id], onDelete: SetNull)` |
| `@@index([email,` | `status])` |
| `@@index([networkId,` | `status])` |
| `@@map("network_external_invitations")` | `Restricción del modelo` |

## NetworkAccessGrant

Tipo: model. Fuente: schema.prisma, línea 1574.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String              @id @default(uuid()) @db.Uuid` |
| `networkId` | `String              @map("network_id") @db.Uuid` |
| `programId` | `String?             @map("program_id") @db.Uuid` |
| `userId` | `String              @map("user_id") @db.Uuid` |
| `role` | `NetworkExternalRole` |
| `resourceType` | `NetworkResourceType @map("resource_type")` |
| `resourceId` | `String              @map("resource_id") @db.Uuid` |
| `permission` | `String              @default("VIEW") @db.VarChar(20)` |
| `grantedById` | `String              @map("granted_by") @db.Uuid` |
| `expiresAt` | `DateTime?           @map("expires_at")` |
| `revokedAt` | `DateTime?           @map("revoked_at")` |
| `createdAt` | `DateTime            @default(now()) @map("created_at")` |
| `network` | `Network         @relation(fields: [networkId], references: [id], onDelete: Cascade)` |
| `program` | `NetworkProgram? @relation(fields: [programId], references: [id], onDelete: SetNull)` |
| `user` | `User            @relation("NetworkGrantUser", fields: [userId], references: [id], onDelete: Cascade)` |
| `@@unique([networkId,` | `userId, resourceType, resourceId])` |
| `@@index([userId,` | `resourceType, resourceId])` |
| `@@map("network_access_grants")` | `Restricción del modelo` |

## NetworkEvaluationCriterion

Tipo: model. Fuente: schema.prisma, línea 1597.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `programId` | `String   @map("program_id") @db.Uuid` |
| `name` | `String   @db.VarChar(255)` |
| `description` | `String?` |
| `maxScore` | `Int      @default(5) @map("max_score")` |
| `position` | `Int      @default(0)` |
| `required` | `Boolean  @default(true)` |
| `program` | `NetworkProgram @relation(fields: [programId], references: [id], onDelete: Cascade)` |
| `scores` | `InitiativeEvaluationScore[]` |
| `@@index([programId,` | `position])` |
| `@@map("network_evaluation_criteria")` | `Restricción del modelo` |

## InitiativeEvaluation

Tipo: model. Fuente: schema.prisma, línea 1613.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String   @id @default(uuid()) @db.Uuid` |
| `initiativeId` | `String   @map("initiative_id") @db.Uuid` |
| `programId` | `String   @map("program_id") @db.Uuid` |
| `evaluatorId` | `String   @map("evaluator_id") @db.Uuid` |
| `recommendation` | `String?  @db.VarChar(30)` |
| `comments` | `String?` |
| `conflictDeclared` | `Boolean @default(false) @map("conflict_declared")` |
| `conflictDetails` | `String?  @map("conflict_details")` |
| `submittedAt` | `DateTime? @map("submitted_at")` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` |
| `initiative` | `Initiative     @relation(fields: [initiativeId], references: [id], onDelete: Cascade)` |
| `program` | `NetworkProgram @relation(fields: [programId], references: [id], onDelete: Cascade)` |
| `evaluator` | `User           @relation(fields: [evaluatorId], references: [id], onDelete: Cascade)` |
| `scores` | `InitiativeEvaluationScore[]` |
| `@@unique([initiativeId,` | `evaluatorId])` |
| `@@index([programId])` | `Restricción del modelo` |
| `@@map("initiative_evaluations")` | `Restricción del modelo` |

## InitiativeEvaluationScore

Tipo: model. Fuente: schema.prisma, línea 1636.

| Campo o restricción | Declaración |
| :--- | :--- |
| `evaluationId` | `String @map("evaluation_id") @db.Uuid` |
| `criterionId` | `String @map("criterion_id") @db.Uuid` |
| `score` | `Int` |
| `comment` | `String?` |
| `evaluation` | `InitiativeEvaluation      @relation(fields: [evaluationId], references: [id], onDelete: Cascade)` |
| `criterion` | `NetworkEvaluationCriterion @relation(fields: [criterionId], references: [id], onDelete: Cascade)` |
| `@@id([evaluationId,` | `criterionId])` |
| `@@map("initiative_evaluation_scores")` | `Restricción del modelo` |

## NetworkAccessAudit

Tipo: model. Fuente: schema.prisma, línea 1649.

| Campo o restricción | Declaración |
| :--- | :--- |
| `id` | `String              @id @default(uuid()) @db.Uuid` |
| `networkId` | `String              @map("network_id") @db.Uuid` |
| `userId` | `String              @map("user_id") @db.Uuid` |
| `resourceType` | `NetworkResourceType @map("resource_type")` |
| `resourceId` | `String              @map("resource_id") @db.Uuid` |
| `action` | `String              @db.VarChar(50)` |
| `metadata` | `Json                @default("{}")` |
| `createdAt` | `DateTime            @default(now()) @map("created_at")` |
| `network` | `Network @relation(fields: [networkId], references: [id], onDelete: Cascade)` |
| `user` | `User    @relation("NetworkAccessActor", fields: [userId], references: [id], onDelete: Cascade)` |
| `@@index([networkId,` | `createdAt])` |
| `@@index([userId,` | `createdAt])` |
| `@@map("network_access_audits")` | `Restricción del modelo` |
