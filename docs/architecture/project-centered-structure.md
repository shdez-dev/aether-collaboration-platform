# Project-centered structure

## Rule of ownership

A workspace provides membership, policy, templates and shared configuration. A
project is the operational aggregate: it owns the initiative's formalization,
execution context, evidence and audit trail.

## Relationships

- A workspace contains projects, reusable teams and workspace-level documents.
- A project owns its boards, milestones, direct members and operational documents.
- Boards own lists and cards; they are execution tools, not a parallel product root.
- Documents may remain workspace-level when they are policy or reusable template
  material. Any project brief, evidence or delivery must have `project_id`.

## API boundary

Use project-scoped endpoints for information that is part of an initiative:

- `GET /api/projects/:projectId/documents`
- `POST /api/workspaces/:workspaceId/documents` with an optional `projectId`

The API validates that the project and document workspace are the same. This
preserves existing workspace documents while preventing cross-workspace links.

The frontend mirrors this separation under `features/projects`. Project pages
consume domain clients for documents, teams, members and activity instead of
embedding endpoint strings in UI effects and event handlers.

Planning read models are also project-scoped. `GET /api/projects/:id/backlog`
returns pending cards across linked boards in one authorized query, replacing
client-side fan-out to every board.

Board links are constrained to the project's workspace before they are written.
This prevents a valid project administrator from accidentally joining execution
data from another workspace through a raw board identifier.

Activity is a project-scoped read model as well. Its endpoint verifies workspace
membership before querying the event store and bounds pagination to prevent an
unbounded audit-log response.

All project routes now share `requireProjectMembership`. Resource controllers
receive only already-authorized project requests. Every mutation additionally
passes through `requireProjectEditor`, matching the UI rule that only workspace
`OWNER` and `ADMIN` roles can change a project, its boards, milestones, teams
or direct members.

## Formalization

Workspace standards can now include `document` in `requiredChecklist`. When it
is selected, formalization and coverage are computed from the number of linked
project documents, not from every document in the workspace. Existing standards
remain valid; administrators opt into the rule when they update a standard.

## Migration path

`documents.project_id` is nullable to preserve existing workspace-level data.
New documents created from a project are linked immediately. Existing documents
can be classified incrementally, rather than being guessed or migrated into an
incorrect project.

The transition currently has a matching Prisma migration and startup migration
because the repository has two migration mechanisms. Consolidating those into
one deployment path is the next infrastructure step; new schema changes must
not be added to only one of them.
