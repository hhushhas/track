# Code-quality backlog

This backlog records high-confidence maintainability problems for a dedicated follow-up. The current cleanup removes proven dead code and leaves these behavior-preserving refactors untouched.

## High priority

### Split workspace orchestration into focused modules

`apps/web/src/features/workspace/pages/WorkspacePage.tsx` is over 1,300 lines and coordinates session synchronization, routing, dialogs, records, chat, notifications, and layout. `apps/web/src/features/workspace/thread-items.tsx` is over 1,000 lines and combines message rendering with draft-review behavior.

This concentration makes permission-sensitive changes difficult to isolate and review. A future pass should extract independently testable controllers and focused components while preserving the existing behavior and route contracts.

### Restore generated Convex API typing in memory actions

`convex/memoryActions.ts` casts both `api` and `internal` to `any`, then invokes backend functions through those untyped values. This removes compile-time validation of names and arguments from a permission-sensitive import workflow.

A future pass should resolve the generated-type constraint and use typed function references throughout the workflow.

## Medium priority

### Align the documented and installed TypeScript baseline

`SPEC.md` names a stable TypeScript baseline while the workspace manifests install `typescript@7.0.1-rc`. Contributors cannot rely on the documented toolchain until one baseline is selected and applied consistently.

### Surface mobile mutation failures

`apps/mobile/src/contexts/track-user-context.tsx` catches and discards errors from actions passed through `withBusy`. The busy state clears without exposing a failure or retry path to the caller.

A future pass should preserve an action-specific error state and surface retryable feedback without leaking sensitive backend details.

### Define an application-level not-found experience

The local sign-in flow currently logs a TanStack Router warning because the root route has no `notFoundComponent` and the router has no default not-found component. Unknown or transient routes fall back to the framework's generic response.

A future pass should add a product-level not-found surface with a safe route back to the application.
