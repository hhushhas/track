# Runtime boundaries

Track keeps framework-independent task and conversation rules in
`packages/shared`. Convex owns authenticated scope resolution, persistence,
revision checks, and mutation idempotency. Web and mobile derive transport
shapes from generated Convex function types.

## Conversation and tasks

Channel and thread history use cursor-based pages. Source jumps load a target
with neighboring messages instead of assuming it is in the newest page. Read
cursors advance monotonically to messages the client actually viewed.

Message submission carries a stable retry key and finalizes its attachments
atomically. Upload intents bind the authenticated author, represented
membership, destination, and server-observed storage metadata. Assistant work
is a separate operation; retrying it does not resend the human message.

Task lists and boards use paginated summary projections. Description, history,
children, comments, and evidence belong to detail queries or their own pages.
Visible conversation rows share batched task-link queries. Task movement uses
one server contract on web and mobile, including revision and workflow rules.
Dirty task forms retain local edits when realtime data changes and surface
conflicts before overwriting another participant's work.

Composer text and reply drafts are session-scoped by identity, represented
membership, Project, Channel, and thread. Raw selected files are not persisted
as text drafts. Private image previews are generated server-side with known
dimensions; originals remain available when a preview cannot be generated.

## Company exit archives

Exit preparation captures an immutable cutoff in bounded, resumable batches.
Project writes temporarily pause during capture; reads remain available.
Failed captures retain the write pause until retry or cancellation. Verification
releases that pause before later Project activity can change the frozen view.

Operation-backed archives store normalized member, Channel, thread, and task
snapshots. Per-member Channel visibility is a separate authorization boundary,
not a property inferred from another member's snapshot. Readers use indexed
pages and point lookups; legacy embedded archive data remains a compatibility
path. Finalization and cleanup are scheduled batches, not one transaction
proportional to the whole Project.

Archive task search uses stored search fields and exact public-key indexes.
Existing snapshots require the archive-search backfill before relying on those
indexes after an upgrade. Before enabling the indexed archive-search reader on
a deployment, run the internal cursor jobs
`internal.taskArchiveMaintenance.backfillArchiveSearchFields` once for each
existing `projectArchiveEntitlements` ID, and
`internal.taskArchiveMaintenance.backfillExitSnapshotSearchFields` once for
each existing `(projectCompanyId, operationId)` staging scope. Each job
reschedules its next cursor page and is safe to resume with the last cursor;
do not run either job against production without an approved migration window.
No migration or deployment to production is implicit in a local verification
run.

## Verification

Canonical q9 type-aware lint scans the checked TypeScript source roots in web,
mobile, shared, and Convex. The lint and Semgrep baselines contain only debt
from the pre-audit source snapshot. Fingerprints are independent of line
numbers; lint also preserves occurrence counts across module moves. Newly
introduced violations fail rather than silently expanding the baseline.
Generated transport files and the explicitly documented Semgrep parser
exceptions in `.semgrepignore` remain covered by TypeScript and the other
applicable gates. Do not regenerate either baseline from a failing worktree.

The repository gate covers backend and client types, lint, tests, dependency
audit, build output, and canonical architecture checks. Browser journeys must
exercise the actual Track application and Convex backend with isolated data;
a standalone imitation UI is not end-to-end coverage. See
[`e2e/README.md`](../e2e/README.md) for setup and measured budget definitions.
