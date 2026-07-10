# Product Direction

## Core Idea

Aether is not primarily a task manager. It is a platform that helps teams move an initiative from `idea` to `operating project` without losing clarity, structure, or autonomy.

The product should feel flexible on the surface while remaining consistent underneath. Different sectors may use different language and methods, but all projects should pass through a common standard of formalization.

## Product Thesis

Most ideas do not fail because of lack of talent. They fail in the gap between intent and execution:

- the idea is not formalized
- the team is not formed
- the scope is not explicit
- the documentation is incomplete
- the work is not visible enough for mentors or leaders to intervene on time

Aether exists to close that gap.

## Aether Core Standard v1

Every project in Aether should be readable through a shared operational standard, even if the visible language changes by workspace or industry.

### Required project minimums

- title
- problem or opportunity
- owner
- current stage
- status
- next milestone or next step
- base documentation status
- team status
- evidence status
- coverage status

### Master maturity stages

- `IDEA`
- `DRAFT`
- `FORMALIZED`
- `PLANNED`
- `ACTIVE`
- `ON_HOLD`
- `COMPLETED`
- `ARCHIVED`

### Coverage semantics

Analytics must distinguish these three states:

- `NOT_APPLICABLE`: the field did not exist or is not required for this template/version
- `APPLIES_EMPTY`: the field applies but has not been filled
- `APPLIES_FILLED`: the field applies and contains valid data

This rule exists to keep dashboards honest and prevent false averages.

## Product Layers

### 1. Intake

The user starts with an idea, not a full project plan.

The intake layer should keep friction low and capture the minimum needed to decide whether the idea deserves to move forward.

Typical fields:

- title
- short description
- problem to solve
- applicant
- category or type

### 2. Formalization

The initiative crosses from intention to explicit commitments.

This is the core of the product. A project becomes formalized when it has enough structure to be followed by mentors, leaders, or collaborators.

Expected outputs:

- owner defined
- team started
- scope documented
- next milestone defined
- status visible
- minimum evidence attached

### 3. Operation

Once the project is formalized, the user can manage execution through operational tools such as:

- Kanban
- Timeline or Gantt
- documents
- dependencies
- activity feed

These tools should support the project lifecycle, not define the product by themselves.

## Roles

### Workspace Administrator

Defines the workspace-level rules, templates, required fields, visibility, and reporting requirements.

### Mentor or Reviewer

Guides projects through formalization, reviews quality, helps unblock teams, and decides when a project is mature enough to move forward.

### Project Team

Owns the project content and execution inside the guardrails defined by the workspace.

## Primary Lifecycle

This is the default lifecycle Aether should support across sectors:

1. A user submits an idea.
2. The idea is reviewed or accepted into a workspace.
3. The idea becomes a draft project.
4. The project is formalized through required fields, people, and documents.
5. The project enters planning and operation.
6. Mentors and leaders monitor progress and coverage.
7. The project is completed, paused, or archived with full traceability.

## Mapping To The Current System

The current codebase already contains most of the building blocks needed for this direction.

### Existing entities

- `workspaces`: container for a program, organization, cohort, studio, company, or area
- `projects`: formal unit of initiative and reporting
- `boards`: operational workspace for a project
- `lists` and `cards`: work units, stages, actions, commitments, or milestones
- `documents`: briefs, plans, specs, evidence, or project memory
- `teams`: collaboration structure
- `events` and `activity`: audit trail and accountability

### Interpretation going forward

- `projects` should become the center of the product experience
- `boards` should be treated as execution tools attached to a project
- `documents` should support formalization first, then collaboration
- `workspaces` should define standards, language, and visibility

## UX Principles

- Do not force advanced project management tools too early.
- Do not let ideas live forever without clear formalization status.
- Show maturity and coverage before showing operational complexity.
- Keep the visible language local to the workspace.
- Keep the underlying data model and reporting standard global.

## CREA Example

In a context like CREA, the workspace should function as a bridge between raw ideas and executable projects.

### What CREA needs

- a place to receive ideas
- a standard to formalize them
- visibility for professors and reviewers
- a shared environment for project teams once accepted

### What the applicant needs

- a low-friction way to submit an idea
- guidance to turn it into a real project
- a space to form a team, document progress, and manage execution

This same model can work in marketing, construction, consulting, innovation programs, and other domains by changing language and templates without changing the operational backbone.

## Near-Term Product Roadmap

### Phase 1

- make `projects` the primary entity in the user journey
- introduce explicit maturity states
- introduce formalization and coverage indicators

### Phase 2

- add idea intake flow
- add idea-to-project promotion
- add workspace-level project standards

### Phase 3

- add templates and versioned standards
- add upgrade flows for workspace templates
- add richer institutional or multi-team analytics

## Product Positioning

Aether should not be presented only as institutional software.

Externally, it should be framed as a platform that helps teams turn ideas into clear, executable projects.

Internally, it should be governed by a strong standard of formalization, coverage, and traceability.

## Related Docs

- [Implementation Plan](./implementation-plan.md)
