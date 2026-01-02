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
