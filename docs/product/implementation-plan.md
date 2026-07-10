# Implementation Plan

## Goal

Translate the product direction into an implementation plan for the current Aether codebase.

This document assumes the existing monorepo, PostgreSQL schema, Express API, Next.js frontend, event store, and realtime collaboration stack remain in place.

The goal is to evolve the current system toward:

- idea intake
- progressive formalization
- project-centered experience
- workspace standards
- honest coverage reporting

## Current System Baseline

The current platform already contains strong primitives:

- `workspaces`
- `projects`
- `boards`
- `lists`
- `cards`
- `documents`
- `teams`
- `events`
- `activity`

This means the implementation should focus on:

- clarifying lifecycle semantics
- promoting `projects` to the center of the experience
- introducing new metadata and reporting layers
- avoiding large structural rewrites unless they unlock future phases

## Proposed Core Model

### Existing entities to keep as first-class

- `Workspace`: container for a program, organization, cohort, company, or practice area
- `Project`: formal initiative record and reporting center
- `Board`: execution surface for a project
- `Document`: project brief, evidence, plan, specification, or memory
- `Team`: group of collaborators attached to a project

### New concepts to introduce

These concepts can be implemented incrementally.

#### 1. Project maturity

Every project should have a lifecycle state separate from operational task status.

Suggested enum:

- `IDEA`
- `DRAFT`
- `FORMALIZED`
- `PLANNED`
- `ACTIVE`
- `ON_HOLD`
- `COMPLETED`
- `ARCHIVED`

This state belongs at the project level, not the card level.

#### 2. Formalization checklist

The system should explicitly track whether a project has crossed the minimum threshold from idea to formalized project.

Suggested computed checks:

- owner defined
- problem/opportunity defined
- team exists
- base document exists
- next milestone exists
- execution board exists

This does not need a separate table at first. It can start as computed backend logic.

#### 3. Coverage tracking

Coverage is a reporting dimension, not just validation.

Each required field should resolve to:

- `NOT_APPLICABLE`
- `APPLIES_EMPTY`
- `APPLIES_FILLED`

At first, coverage can be computed from project fields plus standard rules. Later it can become template-driven.

#### 4. Idea intake

The system needs a lightweight entry state before the current project model becomes too heavy.

There are two valid implementation paths:

##### Path A: Use `projects` directly

Create projects in `IDEA` state with a minimal field set.

Advantages:

- smallest implementation footprint
- reuses all existing permissions and workspace/project infrastructure

Risks:

- project entity becomes overloaded early

##### Path B: Introduce `ideas`

Add a separate `ideas` table and promote ideas into projects when accepted.

Advantages:

- clean domain separation
- better for high-volume intake environments like CREA

Risks:

- more API and UI surface
- promotion flow needs extra logic

Recommendation:

Start with Path A for speed. Only introduce a dedicated `ideas` table if volume, workflow, or analytics make the distinction necessary.

## Schema Changes

## Phase 1 schema changes

Minimal, high-value additions to `projects`:

- `maturity_stage` `VARCHAR(20)` or enum-like constrained string
- `problem_statement` `TEXT NULL`
- `next_step` `TEXT NULL`
- `owner_id` already exists and should remain the formal owner
- `formalized_at` `TIMESTAMP NULL`

Optional:

- `intake_source` `VARCHAR(50) NULL`
- `submitted_by` `UUID NULL`

### Why start here

These fields let the product express the new lifecycle without creating a second intake subsystem immediately.

## Phase 2 schema changes

Introduce workspace-level standards:

- `workspace_project_standards`
  - `id`
  - `workspace_id`
  - `name`
  - `version`
  - `is_active`
  - `definition_json`
  - `created_by`
  - `created_at`
  - `updated_at`

- `project_standard_bindings`
  - `project_id`
  - `standard_id`
  - `version`
  - `bound_at`

This allows workspaces like CREA to require a common structure without turning the product into a rigid institution-only tool.

## Phase 3 schema changes

Introduce reusable template/version entities if needed:

- `template_definitions`
- `template_versions`
- `workspace_template_bindings`
- `template_change_proposals`

These should come only after the project-centered lifecycle is working well.

## Backend Plan

## 1. Project domain

The `projects` API should become the main lifecycle API.

### Existing controller to extend

[ProjectController.ts](C:/amadeus-projects/aether-collaboration-platform/apps/api/src/controllers/ProjectController.ts:220)

### Additions

- create project in `IDEA` state by default when minimal fields are provided
- support maturity transitions
- expose formalization status summary in project detail responses
- expose coverage summary in project detail and list responses

### New backend helpers

Suggested service additions:

- `ProjectFormalizationService`
- `ProjectCoverageService`

Responsibilities:

- compute maturity eligibility
- compute formalization checklist
- compute coverage states
- decide when `formalized_at` should be stamped

## 2. Workspace domain

Workspace should define the local standard, not the visible methodology only.

### Existing controller to extend

[WorkspaceController.ts](C:/amadeus-projects/aether-collaboration-platform/apps/api/src/controllers/WorkspaceController.ts:57)

### Additions

- get workspace project standard
- update workspace project standard
- list project coverage within workspace
- list project maturity distribution

This enables a CREA-like workspace to monitor intake and formalization quality.

## 3. Documents domain

Documents should be elevated in the formalization process.

### Existing controller to extend

[DocumentController.ts](C:/amadeus-projects/aether-collaboration-platform/apps/api/src/controllers/DocumentController.ts:37)

### Additions

- support document categorization such as `brief`, `evidence`, `plan`, `spec`
- expose whether a project has a qualifying base document

First implementation can use metadata fields in existing document tables or a new lightweight `document_type`.

## 4. Search and analytics

Search should make ideas and early projects visible, not just active work objects.

### Existing controller to extend

[SearchController.ts](C:/amadeus-projects/aether-collaboration-platform/apps/api/src/controllers/SearchController.ts:9)

### Additions

- include maturity stage filters
- include coverage filters
- support “needs intervention” queries such as:
  - no owner
  - no team
  - no base document
  - stuck in `IDEA`

## API Additions

## Project endpoints

Recommended additions:

- `POST /api/projects/:id/formalize`
- `POST /api/projects/:id/promote`
- `GET /api/projects/:id/formalization`
- `GET /api/projects/:id/coverage`
- `PATCH /api/projects/:id/maturity`

## Workspace endpoints

- `GET /api/workspaces/:id/project-standard`
- `PUT /api/workspaces/:id/project-standard`
- `GET /api/workspaces/:id/project-pipeline`
- `GET /api/workspaces/:id/project-coverage`

## Payload shape recommendation

Project detail responses should start including:

```ts
{
  project: { ... },
  maturity: {
    stage: "DRAFT",
    canFormalize: false,
    formalizedAt: null
  },
  formalization: {
    ownerDefined: true,
    problemDefined: false,
    teamDefined: true,
    boardDefined: false,
    baseDocumentDefined: true,
    nextMilestoneDefined: false
  },
  coverage: {
    percentage: 62,
    fields: {
      problemStatement: "APPLIES_EMPTY",
      nextStep: "APPLIES_FILLED"
    }
  }
}
```

## Frontend Plan

## Current center of gravity to shift

Right now, boards and documents are prominent surfaces. The new UX should put project maturity first.

### Primary frontend principle

Every project page should answer these questions before showing execution tools:

- what stage is this project in
- what is missing to formalize it
- who owns it
- what is the next explicit step
- how complete is the reporting

## 1. Project detail page

Existing page:

[page.tsx](C:/amadeus-projects/aether-collaboration-platform/apps/web/src/app/dashboard/projects/[id]/page.tsx:1)

### First UX changes

- add project maturity banner
- add formalization checklist panel
- add coverage panel
- keep existing board/timeline/documents areas as lower sections or tabs

### Suggested order

1. project header
2. maturity and next action
3. formalization checklist
4. coverage summary
5. operational tabs: board, timeline, docs, activity, team

## 2. Projects list page

Existing page:

[page.tsx](C:/amadeus-projects/aether-collaboration-platform/apps/web/src/app/dashboard/projects/page.tsx:1)

### Changes

- group or filter by maturity
- add “needs formalization” and “needs review” filters
- add quick indicators:
  - owner missing
  - no team
  - no base document
  - stalled in idea

## 3. Workspace page or dashboard

There should be a workspace-level pipeline view, especially for CREA-like environments.

This can be:

- a new page, or
- a new section inside workspace/project dashboards

### Suggested metrics

- ideas submitted
- projects in draft
- projects formalized
- active projects
- coverage average
- percentage missing owner
- percentage missing team
- percentage missing base document

## 4. Idea intake UX

First implementation should be intentionally small:

- title
- short description
- problem/opportunity
- applicant

If implemented through projects-in-idea-stage, the form can simply create a project with `maturity_stage = IDEA`.

## Permissions Plan

## Existing roles to preserve

Workspace roles already exist:

- `OWNER`
- `ADMIN`
- `MEMBER`
- `VIEWER`

These should remain the technical base.

## Product behavior layer on top

### Workspace admin

- defines standards
- reviews pipeline quality
- can promote governance rules

### Mentor/reviewer

This can initially be implemented through workspace role plus project ownership or project membership rules.

Capabilities:

- review idea/draft projects
- request formalization
- assess readiness
- monitor coverage

### Project team

- fills content
- manages execution
- uploads evidence
- works inside the workspace standard

## Events and Audit

The event system is already strong and should be used as a feature here.

New event types to consider:

- `project.idea_submitted`
- `project.maturity_changed`
- `project.formalized`
- `project.coverage_updated`
- `workspace.standard_updated`

These events reinforce the “intent to explicit commitment” thesis.

## Reporting Plan

## First-level reporting

Do not begin with advanced BI. Start with operational truth.

Per workspace:

- count by maturity stage
- count by missing formalization item
- coverage percentage by field
- stale projects with no recent updates

## Second-level reporting

Once workspace standards exist:

- compare cohorts or business units
- compare project completion versus coverage
- identify mentors or teams needing intervention

## Suggested computed fields

- `formalization_score`
- `coverage_percentage`
- `is_stale`
- `needs_intervention`

These can begin as runtime computations before materialization.

## Phased Delivery

## Phase 1: Project-centered lifecycle

Scope:

- add `maturity_stage` and core formalization fields to projects
- add backend computation for checklist and coverage
- update project detail and list views

Success criteria:

- a project can exist meaningfully as `IDEA`, `DRAFT`, or `FORMALIZED`
- project page makes missing formalization visible

## Phase 2: Workspace standard

Scope:

- add workspace-level project standard definition
- add workspace pipeline reporting
- add coverage views for mentors/admins

Success criteria:

- CREA-like spaces can define what “formalized” means locally
- leaders can see where ideas are getting stuck

## Phase 3: Idea intake experience

Scope:

- lightweight idea submission flow
- promote idea into project operation

Success criteria:

- users can enter with low friction
- accepted ideas become structured projects cleanly

## Phase 4: Templates and versioning

Scope:

- template definitions
- versioned standards
- selective workspace upgrades

Success criteria:

- standards can evolve without breaking in-flight projects

## Implementation Notes For This Repo

- Favor extending `projects` before introducing parallel intake entities.
- Favor computed formalization state before denormalizing everything.
- Favor workspace-scoped standards before building a global template studio.
- Keep `boards` and `documents` attached to projects, not competing with them conceptually.

## Immediate Next Tasks

1. Add project maturity and formalization fields to the schema.
2. Add backend project formalization and coverage services.
3. Update project detail API shape.
4. Update project detail page UI.
5. Add workspace pipeline view.

These are the smallest changes that make the new product concept visible inside the current codebase.
