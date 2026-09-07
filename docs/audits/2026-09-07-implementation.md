# Approved audit implementation

Scope: the 27 proposals approved from the [codebase audit](./2026-09-06-codebase-audit.md).
No additional product work, production deployment, or commit is included.

## Implemented product and data changes

| Audit IDs | Implementation |
|---|---|
| REL-01, REL-03 | Dirty task edits survive realtime refreshes; conflicts remain explicit. Task creation retains its retry key and blocks duplicate submission. |
| REL-02, REL-06 | Message retries retain identity; server-validated upload intents bind attachments to author, destination, and represented membership. |
| REL-04 | Read cursors follow viewed messages rather than the newest available server message. |
| REL-05 | Web and mobile task moves use the same revision-aware backend operation. |
| PERF-01, PERF-02 | Paginated task summaries, indexed child/detail queries, and separate activity/comment pages replace whole-project detail loading. |
| PERF-03 | Visible messages share task-link batches; unopened forms defer their queries. |
| PERF-04, PERF-05 | Company exit capture/finalization uses bounded scheduled batches and normalized immutable archive rows. Archive task readers use indexed lookups/pages. |
| PERF-06, UX-04 | Project search is debounced and uses the shared modal primitive. |
| PERF-07 | Private server-generated image previews carry dimensions and preserve original-image fallback. |
| UX-01 | Cursor-based Channel history and contextual source jumps make older evidence reachable. |
| UX-02, UX-03 | Composer drafts are scope-isolated; IME composition and keyboard emoji activation are handled explicitly. |
| UX-05, UX-06 | Recovery states distinguish unavailable/loading/error conditions; Project surfaces share navigation and shell components. |
| UX-07 | Assistant phases, deadlines, and retry states are explicit on web and mobile. |
| ARCH-01, ARCH-02 | Transport types are derived; legacy archive boundaries are decoded; resolved permission context is reused. |
| ARCH-03, ARCH-04 | Feature controllers and styles are split into responsibility-specific modules without changing the product model. |

Exit preparation briefly pauses Project writes while capturing the cutoff. A
failed capture remains resumable or cancellable. Indexed legacy archive search
requires the migration steps in [architecture documentation](../ARCHITECTURE.md).

## Verification and tooling status

The standard Node 24 gate passes: lint, backend/client typecheck, **126 tests**,
production dependency audit, and production build. The production bundle budget
also passes: 3,272,988 public bytes, 1,157,919 JavaScript bytes, and a 263,907-byte
largest JavaScript asset. These are generated-output measurements, not download
size, field performance, or a before/after speedup claim.

ARCH-05 introduces canonical q9 architecture/type-aware lint ratchets against
the pre-implementation baseline, explicit Convex checks, and CI scanner setup.
Its integrated run passes all five lanes: client types, type-aware lint ratchet,
Convex types, Semgrep ratchet, and dependency boundaries, with no skipped lanes.

ARCH-06/07 use the actual Track client and an isolated local Convex fixture,
with CI evidence and browser/bundle budgets. One complete run passed all six
real-client browser journeys: sign-in and posting, Project scope switching, source-linked task evidence,
archived read-only access, dirty-draft preservation during a remote update, and
board workflow moves. The latest Node 24 run passed five; the task-detail journey
timed out. A preserved failure trace shows a local Convex `auth:getAvatarUrls`
query timeout and recovery-boundary navigation failure before task editing.
This does not establish a dirty-draft defect. Browser acceptance
is therefore not consistently green. The runtime performance collector first
exceeded the 5-second readiness limit during authentication; a diagnostic run
allowing 30 seconds for measurement remained at “Opening first channel.” No
current runtime report was produced, and stale metrics were removed. Thresholds
have not been relaxed to hide these failures. ARCH-06/07 acceptance remains open:
there is no repeatably green browser run or valid comparable runtime baseline.
The required Codex CLI review reached its 30-minute timeout (exit 124)
without a verdict. Review is incomplete, not passed; the one-run-per-handoff
protocol precludes an automatic repeat.

Manual Helium verification passed for Channel posting, source-linked task
creation, scope-isolated draft retention, archived read-only conversation, and
search focus restoration from both the sidebar and keyboard shortcut. Fresh
browser console checks were clean. These checks used the isolated local fixture,
not production.

The isolated local servers were stopped and shared development endpoint settings
were preserved. No production access, deployment, commit, or push was performed.
