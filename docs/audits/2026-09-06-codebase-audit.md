# Track codebase audit

**Date:** 2026-09-06 · **Baseline:** `7e99caa` plus the existing, uncommitted worktree changes · **Status:** all 27 approved on 2026-09-07; implementation in progress

## Executive summary

The biggest opportunities are **reliable collaborative editing, bounded data access, and consistent behavior between web and mobile**. A framework rewrite is not warranted. Track already has useful foundations: a framework-independent shared domain, server-side scope checks, task revisions, idempotency support, paginated thread messages, and notification recovery jobs.

This audit identifies **27 individually approvable items**. Fix the concrete correctness problems first; then address the query shapes that grow with total project history; then consolidate the implementation while preserving current behavior.

### How to make decisions

Every ID is stable. The user approved all 27 on 2026-09-07. The original individual decision register remains below for traceability; implementation status is recorded separately.

Example: `Approve REL-01, REL-02, PERF-01. Reject UX-07. Defer ARCH-04. Discuss REL-05.`

**Priority:** P1 = address first; P2 = next improvement; P3 = optional enhancement. This is an implementation order, not a claim that every P1 is an active outage.

**Size:** S = localized; M = several components/layers; L = staged cross-cutting work. These are scope estimates, not delivery promises. **Evidence:** source-confirmed mechanism unless explicitly marked as observed or an improvement proposal. Performance effects have not been benchmarked.

## Decision register

| ID | Priority | Size | Proposal | Main benefit |
|---|---|---|---|---|
| REL-01 | P1 | M | Protect unsaved task edits from realtime refreshes | Prevent lost work |
| REL-02 | P1 | M | Make message + attachment submission safely retryable | Prevent duplicate/partial sends |
| REL-03 | P1 | S | Keep task-create idempotency keys stable and block duplicate submission | Prevent duplicate tasks |
| REL-04 | P1 | M | Mark only actually viewed thread messages as read | Preserve meaningful unread state |
| REL-05 | P1 | M | Unify web/mobile task-move semantics | Correct permissions, completion rules, and cheaper moves |
| REL-06 | P1 | M | Bind attachment finalization to the message author and upload intent | Preserve message integrity |
| PERF-01 | P1 | L | Paginate/index task lists and return summary projections | Scalable boards and lists |
| PERF-02 | P1 | M | Stop loading a whole project to open one task | Faster task details |
| PERF-03 | P1 | M | Batch per-message task links; defer unopened form queries | Lower chat subscription overhead |
| PERF-04 | P1 | L | Bound Company-exit snapshot finalization | Reliable exits as data grows |
| PERF-05 | P2 | M | Query archive snapshots by task instead of rebuilding all views | Faster archive browsing |
| PERF-06 | P2 | S | Debounce remote project search | Less repeated backend work |
| PERF-07 | P2 | M | Serve sized image previews with known dimensions | Lower transfer/decode cost and steadier chat layout |
| UX-01 | P1 | M | Add full channel history and dependable source jumps | Make old conversation/evidence reachable |
| UX-02 | P2 | M | Isolate and retain composer drafts by scope | Safer navigation between conversations |
| UX-03 | P2 | S | Fix IME Enter handling and keyboard emoji activation | Reliable keyboard composition |
| UX-04 | P2 | S | Use a real modal primitive for project search | Correct focus and keyboard behavior |
| UX-05 | P1 | M | Distinguish unavailable, failed, disconnected, and loading states | Actionable recovery instead of ambiguity |
| UX-06 | P2 | M | Preserve a common project shell and client-side navigation | Less disorientation/context loss |
| UX-07 | P3 | M | Improve AI progress, timeout, and optional partial-answer UX | Better perceived responsiveness |
| ARCH-01 | P2 | M | Derive transport types; validate untyped boundaries | Safer refactors with fewer assertions |
| ARCH-02 | P2 | L | Reuse resolved scope context and isolate legacy compatibility | Less authorization duplication |
| ARCH-03 | P2 | M | Split mixed-responsibility feature controllers incrementally | Easier ownership and changes |
| ARCH-04 | P2 | M | Separate global tokens from feature CSS | More predictable styling |
| ARCH-05 | P1 | M | Give backend/static architecture checks explicit gate ownership | Catch currently unenforced standards |
| ARCH-06 | P1 | M | Automate representative user journeys with repeatable fixtures | Catch client/backend integration regressions |
| ARCH-07 | P2 | M | Establish operation-level performance baselines and budgets | Optimize from evidence |

## Reliability and correctness

### REL-01 — Protect unsaved task edits

**Evidence:** [TaskDetailDrawer.tsx:75](/Users/macmini/code/track/apps/web/src/features/tasks/TaskDetailDrawer.tsx:75) resets the edit draft, label selection, and error whenever the entire `detail` object changes. [tasks.ts:266](/Users/macmini/code/track/convex/tasks.ts:266) includes comments, activities, follow state, and references in that reactive result.

**Consequence:** a collaborator adding a comment, or another detail subscription change, can replace locally edited fields even without a change to those fields. The existence of backend revision checks does not prevent this client-side overwrite.

**Proposed change:** initialize on task identity change; preserve dirty fields; retain the revision on which the edit began. Show a deliberate conflict/refresh choice when relevant server fields change. Do not merely change the effect dependency to revision and continue overwriting dirty fields.

**Done when:** type an unsaved title, receive a comment and a remote title update, and retain the local draft with a clear conflict path. Switching to another task initializes the correct form.

### REL-02 — Safely retry message submission

**Evidence:** [useWorkspaceMessageActions.ts:63](/Users/macmini/code/track/apps/web/src/features/workspace/hooks/useWorkspaceMessageActions.ts:63) uploads files, commits the message, attaches each uploaded file, requests AI if mentioned, and only then calls `onAfterSend`. This caller does not supply the optional idempotency key already accepted by [messages.ts:295](/Users/macmini/code/track/convex/messages.ts:295).

**Consequence:** attachment finalization or the AI request can fail after the message exists. The composer stays populated, and another Send starts a new message. Parallel file uploads can also leave successfully uploaded blobs unused when a sibling upload fails.

**Proposed change:** keep one intent ID per send; finalize the message and attachment links atomically where feasible; track uploaded assets for retry/cleanup. Separate “message sent” from “AI request failed” and allow retrying the latter alone. Reuse existing backend idempotency rather than inventing a second system.

**Done when:** fault injection after upload, message commit, and attachment linking never produces duplicate messages; users can distinguish sent content from failed follow-up work.

### REL-03 — Prevent duplicate task creation

**Evidence:** [ConversationTaskActions.tsx:81](/Users/macmini/code/track/apps/web/src/features/tasks/ConversationTaskActions.tsx:81) generates a fresh key inside each submit; the source-create form has no pending submission guard. [TaskCreateDialog.tsx:65](/Users/macmini/code/track/apps/web/src/features/tasks/TaskCreateDialog.tsx:65) also creates a new key per submit. [tasks.ts:437](/Users/macmini/code/track/convex/tasks.ts:437) deduplicates by that key.

**Consequence:** two explicit submissions are two different operations to the server. In particular, double-activating the source-create form while its first call is pending can create two tasks. This is distinct from Convex retrying a single mutation internally.

**Proposed change:** generate the key once for the current create intent, preserve it across explicit retries, and disable/guard submission while pending. Reset it only when starting a genuinely new task.

**Done when:** rapid duplicate activation and a retry of the same intent produce exactly one task; creating the next task still works.

### REL-04 — Make read receipts reflect viewing

**Evidence:** [ThreadConversationPage.tsx:100](/Users/macmini/code/track/apps/web/src/features/threads/ThreadConversationPage.tsx:100) and [mobile thread.tsx:105](/Users/macmini/code/track/apps/mobile/src/app/thread.tsx:105) call `markRead` whenever message data changes, without visibility/viewability checks. [channelThreads.ts:555](/Users/macmini/code/track/convex/channelThreads.ts:555) marks through the thread's latest sequence, not a client-observed sequence.

**Consequence:** new replies can become “read” while the web tab is hidden or the user is looking at older messages. Repeated updates also cause unnecessary read-state writes. Archive immutability is already checked and must remain intact.

**Proposed change:** acknowledge the highest actually viewed sequence while the screen is active, batch acknowledgements, validate the requested sequence server-side, and avoid writes when nothing advanced. Preserve monotonicity and membership isolation.

**Done when:** backgrounded/offscreen arrivals remain unread; viewing them advances the cursor once; archived read state never changes.

### REL-05 — Unify task moves across platforms

**Evidence:** [web TaskBoard.tsx:26](/Users/macmini/code/track/apps/web/src/features/tasks/TaskBoard.tsx:26) uses `tasks.move`; [mobile tasks.tsx:111](/Users/macmini/code/track/apps/mobile/src/app/tasks.tsx:111) uses `tasks.moveTask`. The former checks `canTransfer`, rewrites the destination column, and lacks the open-subtask confirmation used by the latter. The latter checks `canEdit` and uses fractional ranks. See [tasks.ts:691](/Users/macmini/code/track/convex/tasks.ts:691), [tasks.ts:766](/Users/macmini/code/track/convex/tasks.ts:766), and [shared tasks.ts:90](/Users/macmini/code/track/packages/shared/src/tasks.ts:90).

**Consequence:** a limited collaborator allowed to edit their own/assigned task can move it on mobile but be rejected by web board moves. Completion safeguards differ. A web move patches every destination-column task, including unrelated `updatedAt` values, whereas the common mobile path changes the moved task.

**Proposed change:** separate same-board state/rank changes from actual board transfers, with one canonical policy for each. Use neighbor-based ranks for web too; keep completion confirmation and notifications consistent. The existing neighbor endpoint still collects siblings, so separately bound its normal read path rather than calling it constant-cost today.

**Done when:** a shared role/transition matrix gives identical web/mobile outcomes; completing a parent with open subtasks requires the intended confirmation; routine moves do not rewrite unrelated cards.

### REL-06 — Bind attachments to message authorship

**Evidence:** [messages.ts:849](/Users/macmini/code/track/convex/messages.ts:849) authenticates the caller, checks Channel write access and message scope, then inserts an attachment and appends its ID to the supplied message. It does not compare message authorship with the actor/project membership, or resolve a caller-owned upload intent.

**Consequence:** a writable Channel member can call this public mutation with another member's message ID and their own uploaded file, modifying that message's attachment set. The normal client only supplies its newly created message, but the server does not enforce that relationship. This is source-confirmed; no live manipulation was performed.

**Proposed change:** require the author identity applicable to that Project, and bind finalization to the authenticated upload intent and intended message/scope. Resolve authoritative storage metadata rather than trusting client-declared size/type alone. Any moderator editing capability should be an explicit, separate policy.

**Done when:** cross-author and cross-scope finalization are rejected; valid author retries succeed without duplicate links; represented Company identities remain distinct. Can be implemented alongside REL-02, but merits its own approval.

## Performance and scale

### PERF-01 — Bound task list work

**Evidence:** [tasks.ts:188](/Users/macmini/code/track/convex/tasks.ts:188) collects all tasks for the Project or assignee, then filters board/archive/status in JavaScript. Each surviving row resolves related records and calls [taskData.ts:114](/Users/macmini/code/track/convex/lib/taskData.ts:114), which also expands references and checks their sources. Filtering by a board still starts with the Project-wide collection.

**Proposed change:** use query-specific indexes and cursor pagination; return small list/card projections rather than full detail/evidence views. Resolve repeated boards, states, and access context once per page. Keep authorization before result exposure and avoid post-filter pagination that silently drops eligible matches. Window long web lists and native board columns after the data contract is bounded; native message lists already use FlatList.

**Done when:** on a large seeded Project, opening one board reads/returns a bounded page rather than all Project tasks and their evidence. Measure read count, response bytes, reruns, and render cost; preserve complete filtering and explicit load-more/count semantics.

**Basis:** Convex specifically recommends avoiding unbounded collection and using indexes/pagination for growing result sets. [Convex best practices](https://docs.convex.dev/understanding/best-practices).

### PERF-02 — Make task detail proportional to one task

**Evidence:** [TaskDetailDrawer.tsx:53](/Users/macmini/code/track/apps/web/src/features/tasks/TaskDetailDrawer.tsx:53) subscribes to all Project tasks merely to filter children. [tasks.ts:282](/Users/macmini/code/track/convex/tasks.ts:282) collects the complete comment and activity history in the detail query.

**Proposed change:** query children through the existing parent index; split summary/editable state from paginated comments/activity and on-demand evidence. Do not reload form state when a history page arrives.

**Done when:** opening a task with three children does not fetch unrelated Project tasks; long activity feeds load in bounded pages; realtime comments do not reset drafts. Coordinate with REL-01 and PERF-01 without making either a prerequisite for the parent-index fix.

### PERF-03 — Reduce chat subscription fan-out

**Evidence:** [ConversationTaskActions.tsx:104](/Users/macmini/code/track/apps/web/src/features/tasks/ConversationTaskActions.tsx:104) mounts `tasks.listForMessage` per message; [task-inline-cards.tsx:47](/Users/macmini/code/track/apps/mobile/src/components/task-inline-cards.tsx:47) has the same pattern. Unopened web source-create popovers subscribe to boards, assignees, and labels at [ConversationTaskActions.tsx:59](/Users/macmini/code/track/apps/web/src/features/tasks/ConversationTaskActions.tsx:59).

**Proposed change:** batch task-link summaries for the currently loaded message IDs or include them in a bounded conversation projection. Fetch create-form choices only when opened. Convex can share identical queries, so this is not a claim that each identical boards query causes a separate network request; the message-ID-specific queries are genuinely distinct.

**Done when:** loading 80 messages does not create 80 separate task-link subscriptions; opening a task-create popover fetches its choices once; offscreen/closed UI does not add avoidable subscriptions.

### PERF-04 — Make Company exit scale safely

**Evidence:** [projectExit.ts:301](/Users/macmini/code/track/convex/projectExit.ts:301) finalizes in one mutation. It loops Project members, their Channels and threads, collects thread messages, and materializes task snapshots for each entitlement. Existing asynchronous memory snapshot preparation does not bound this final database transaction.

**Proposed change:** stage immutable, cutoff-bound snapshot batches using the existing operation identity; deduplicate shared reads while preserving per-member visibility; then perform a small atomic eligibility/visibility transition. Use indexed latest-message/count data rather than reading every message to find the latest. Preserve cancellation, retry, archive redaction, and access-revocation invariants.

**Done when:** a representative large exit completes within transaction limits, resumes after interruption, and never exposes a partial archive or post-cutoff data. This is a source-backed growth risk, not a reproduced production limit failure. L-sized design work is justified here.

### PERF-05 — Index archived task views

**Evidence:** [taskData.ts:164](/Users/macmini/code/track/convex/lib/taskData.ts:164) loads eight snapshot categories and repeatedly maps/filters links, references, comments, and activities for every task. Callers including task detail and per-message cards rebuild this representation before filtering to their target.

**Proposed change:** retain immutable archive semantics but query by entitlement plus task/source identity. Separate summary and detail projections; group related rows once when a batch is needed. Add the smallest archive indexes/validated payload contracts required by real callers.

**Done when:** opening one archived task or one message's linked tasks no longer materializes all archived task histories. Shared snapshots must not accidentally widen any member's archive scope.

### PERF-06 — Debounce remote project search

**Evidence:** [useWorkspaceData.ts:77](/Users/macmini/code/track/apps/web/src/features/workspace/hooks/useWorkspaceData.ts:77) passes raw input into a reactive query for every change after two characters. [search.ts:53](/Users/macmini/code/track/convex/search.ts:53) searches and enriches multiple sections for the `all` filter.

**Proposed change:** keep input immediate but debounce only the server query, roughly 150–250 ms as a starting point to tune. Preserve the previous results with an updating indicator and prevent stale results from being mistaken for the new term. Skip queries while closed. Consider parallel section enrichment only after measuring the new baseline.

**Done when:** typing a phrase quickly produces far fewer distinct backend queries without sluggish input; closing/reopening, clearing, keyboard selection, and scope changes remain correct.

### PERF-07 — Use appropriately sized image previews

**Evidence:** [thread-item-components.tsx:242](/Users/macmini/code/track/apps/web/src/features/workspace/thread-item-components.tsx:242) renders the storage URL directly. [image-attachment.tsx:97](/Users/macmini/code/track/apps/mobile/src/components/chat/image-attachment.tsx:97) starts with a default aspect ratio and updates it after the original image loads; it already has placeholders, error UI, and recycling keys.

**Proposed change:** store trustworthy dimensions and a small set of preview variants; use preview URLs for conversation tiles and originals for explicit viewing/download. Lazy-load offscreen web media and reserve layout space. Keep the existing native caching/error behavior; do not introduce public derivatives that bypass scope policy.

**Done when:** a phone photo displayed as a small tile transfers a preview rather than the original, and intrinsic sizing avoids post-decode jumps. Measure bytes and scrolling on representative attachments; no current CLS or LCP score is claimed.

## UI/UX

### UX-01 — Complete channel history and evidence navigation

**Evidence:** [useWorkspaceData.ts:71](/Users/macmini/code/track/apps/web/src/features/workspace/hooks/useWorkspaceData.ts:71) loads 80 messages; [mobile conversation.tsx:92](/Users/macmini/code/track/apps/mobile/src/app/conversation.tsx:92) loads 120. Neither is the paginated thread-message API. Web source focus waits for a message in `visibleMessages` at [useWorkspaceThreadInteractions.ts:165](/Users/macmini/code/track/apps/web/src/features/workspace/hooks/useWorkspaceThreadInteractions.ts:165), but its channel query does not pass the backend's supported `targetMessageId`.

**Consequence:** ordinary scrolling cannot reach older Channel history. A Project-search result or evidence link to an older message can navigate to the Channel without actually finding its message. Mobile already passes a target ID; threads already paginate—preserve both improvements.

**Proposed change:** extend bounded history pagination to Channels, support loading context around a target, preserve the scroll anchor, and provide a clear unavailable state for removed/restricted sources. Align assistant-answer history so older answers do not disappear independently.

**Done when:** a search result well beyond 120 messages opens at the correct source with neighboring context, and older history remains browsable. [Convex pagination](https://docs.convex.dev/database/pagination) provides a reactive foundation.

### UX-02 — Keep drafts scoped to their conversation

**Evidence:** [WorkspacePageController.tsx:57](/Users/macmini/code/track/apps/web/src/features/workspace/pages/WorkspacePageController.tsx:57) stores a single composer value. [usePendingAttachments.ts:18](/Users/macmini/code/track/apps/web/src/features/workspace/hooks/usePendingAttachments.ts:18) similarly stores pending files independently of a scope-keyed draft. Neither is a per-conversation draft store. Full document navigation also discards component state.

**Proposed change:** maintain session drafts keyed by authenticated identity, acting membership, Project, Channel, and thread. Restore text/reply state when returning; deliberately clear on sign-out or access loss. Treat file selections separately—do not persist raw private files implicitly. Disk persistence beyond the session is a distinct product/privacy choice, not required by this approval.

**Done when:** navigate A → B → A with unsent text and recover A's text without presenting it as B's draft; identity changes never inherit another identity's draft.

### UX-03 — Fix keyboard composition edge cases

**Evidence:** [GroupChatPage.tsx:377](/Users/macmini/code/track/apps/web/src/features/workspace/components/GroupChatPage.tsx:377) handles Enter as send/mention selection without checking IME composition. Emoji insertion uses only `onMouseDown` at [GroupChatPage.tsx:472](/Users/macmini/code/track/apps/web/src/features/workspace/components/GroupChatPage.tsx:472).

**Proposed change:** respect composition events before Enter shortcuts; use semantic click/keyboard activation for emoji while preserving the textarea selection. Keep Shift+Enter and existing mention navigation intact.

**Done when:** accepting an IME candidate does not send a message; Tab + Enter/Space selects an emoji; mouse insertion retains the intended caret position. These are source-confirmed missing handlers, not completed device/accessibility tests.

### UX-04 — Give project search real modal behavior

**Evidence:** [ProjectSearchDialog.tsx:124](/Users/macmini/code/track/apps/web/src/features/workspace/search/ProjectSearchDialog.tsx:124) builds a custom overlay with `aria-modal`, but no modal primitive, focus containment, or focus restoration. Its global Enter handler can open the active result regardless of which control inside the dialog is focused.

**Proposed change:** reuse the existing Dialog component; scope result keyboard handling to the search input/list; contain focus and restore it to the trigger on close. Keep accessible input labeling and selected-result state explicit.

**Done when:** Tab/Shift+Tab stay inside the open dialog, Escape returns focus, and Enter on a filter or Close button performs that control's action—not an unrelated search result. [W3C modal-dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### UX-05 — Make failure and recovery intentional

**Evidence:** [tasks.ts:278](/Users/macmini/code/track/convex/tasks.ts:278) catches all errors from task access/detail assembly and returns `null`; list paths similarly catch-and-skip. [router.tsx:5](/Users/macmini/code/track/apps/web/src/router.tsx:5) supplies a not-found component but no app-specific default error UI. [CompanyProjectPage.tsx:248](/Users/macmini/code/track/apps/web/src/features/company/CompanyProjectPage.tsx:248) turns arbitrary error messages into display text; mobile task-board errors are recovered using a string regex.

**Proposed change:** distinguish expected denial/unavailability from unexpected failures using structured boundary errors. Preserve deliberately generic unauthorized/not-found responses so existence is not leaked. Add recoverable route/feature error states and explicit reconnect/loading states; retain already loaded content where appropriate. Do not suppress backend defects into empty lists.

**Done when:** an injected server failure produces retryable UI and a correlated diagnostic, a denied task remains generically unavailable, and a slow connection does not look like “no tasks.” [Convex application errors](https://docs.convex.dev/functions/error-handling/application-errors).

### UX-06 — Preserve project context during navigation

**Evidence:** [TaskProjectPage.tsx:117](/Users/macmini/code/track/apps/web/src/features/tasks/TaskProjectPage.tsx:117) constructs a separate sidebar and raw anchor navigation; [useWorkspaceThreadInteractions.ts:272](/Users/macmini/code/track/apps/web/src/features/workspace/hooks/useWorkspaceThreadInteractions.ts:272) uses document navigation for search results. Company, legacy workspace, thread, and task pages compose their shells separately.

**Proposed change:** share the project identity/breadcrumb/navigation shell and use typed client-side links for internal routes, preserving Company membership and selected view/filter context. Reuse existing visual language; this is not approval for a redesign. Do not share private data across identities merely to avoid loading.

**Done when:** conversation → task → evidence → Back preserves Project/Company context, filter selection, and appropriate scroll/draft state without a full document reload.

### UX-07 — Improve perceived AI responsiveness

**Evidence:** [assistantNode.ts:284](/Users/macmini/code/track/convex/assistantNode.ts:284) labels the operation a stream, but awaits attachment reading, memory context, and `generateTrackText` before completing the answer. [AssistantAnswer.tsx:32](/Users/macmini/code/track/apps/web/src/features/workspace/components/AssistantAnswer.tsx:32) mainly presents Thinking or the final content. [ai.ts:45](/Users/macmini/code/track/convex/lib/ai.ts:45) contains a direct provider fetch without an explicit request deadline.

**Proposed change:** first add honest stages, bounded provider waits, and an actionable failure/retry state. Optionally add throttled partial text delivery if measured wait times justify it; distinguish unverified partial text from finalized evidence-backed output. Avoid a database mutation for every token.

**Done when:** slow runs show meaningful progress and eventually resolve or fail with recovery; optional partial rendering reduces time to useful feedback without exposing unfinished evidence or multiplying write cost. This is an enhancement, not a claim of measured excessive latency.

## Architecture and developer experience

### ARCH-01 — Trust generated contracts, validate untyped boundaries

**Evidence:** [web task-types.ts:13](/Users/macmini/code/track/apps/web/src/features/tasks/task-types.ts:13), [TaskDetailDrawer.tsx:16](/Users/macmini/code/track/apps/web/src/features/tasks/TaskDetailDrawer.tsx:16), and [mobile task-detail-types.ts:3](/Users/macmini/code/track/apps/mobile/src/components/task-detail-types.ts:3) redeclare transport views; query results are then asserted to those shapes. Archive payloads, assistant context (`v.any()`), and AI JSON also rely on assertions. Generated API references contain `as any` escape hatches in callers such as [crons.ts:7](/Users/macmini/code/track/convex/crons.ts:7).

**Proposed change:** derive transport result types from the generated API, using named projections where a client needs a subset. Keep domain contracts in `packages/shared` free of Convex/framework dependencies. Validate model output and persisted polymorphic snapshots with concrete schemas/discriminated variants. Remove assertions along the boundaries being changed, not via an indiscriminate repo-wide rewrite.

**Done when:** changing a backend result breaks the relevant callers at compile time, malformed boundary data is rejected deliberately, and shared domain code still imports no framework or database package.

### ARCH-02 — Reuse scope resolution; isolate compatibility

**Evidence:** [requestAuthorization.ts:23](/Users/macmini/code/track/convex/lib/requestAuthorization.ts:23) and [taskPolicy.ts:34](/Users/macmini/code/track/convex/lib/taskPolicy.ts:34) implement separate legacy/company resolution paths; task lists repeatedly resolve Project/Channel context. Shared capabilities already exist, so this is consolidation of real duplication, not a new policy engine.

**Proposed change:** establish a request-local resolved actor/Project/membership context, with small capability-specific operations that reuse it. Keep legacy normalization at the boundary, and reuse Channel access per distinct Channel in batch reads. Keep task-specific permissions distinct from general Channel permissions. Never globally cache permission decisions across users or revocation events.

**Done when:** the legacy/company/archive/removed-member role matrix remains green, and one list page does not repeatedly reconstruct identical Project authorization. Removing legacy support is explicitly outside this item.

### ARCH-03 — Split by responsibility, not file size

**Evidence:** [CompanyProjectPage.tsx:37](/Users/macmini/code/track/apps/web/src/features/company/CompanyProjectPage.tsx:37) combines conversation, invitations, Channel membership, archive/exit operations, and navigation. [WorkspacePageController.tsx:43](/Users/macmini/code/track/apps/web/src/features/workspace/pages/WorkspacePageController.tsx:43) still owns many UI states and effect contracts despite existing hook extraction.

**Proposed change:** extract coherent Company lifecycle/admin sections from conversation, colocate action state with the feature that owns it, and reduce long setter-heavy hook contracts. Publish a short responsibility map for actual feature entry points. Reuse shared behavior across clients only where domain logic is genuinely the same; native/web rendering should remain platform-specific.

**Done when:** adding a conversation action does not require editing Company-exit UI; an admin operation can be understood and tested independently; splitting files does not add pass-through wrappers or new abstractions without callers.

### ARCH-04 — Make CSS ownership predictable

**Evidence:** [styles.css:1](/Users/macmini/code/track/apps/web/src/styles.css:1) is about 11,100 lines in this snapshot, containing global tokens, authentication, workspace, messages, tasks, company surfaces, and responsive overrides. It is imported globally by the root route. The issue is mixed ownership/cascade coupling, not the line count alone.

**Proposed change:** retain a small global theme/token layer, move cohesive feature styles beside their owners, and consolidate repeated rules as each feature is touched. Keep shared web/native tokens where semantics match; do not force native layouts into CSS abstractions. Preserve branding and current visuals.

**Done when:** the owner of a task/Company style is obvious, feature changes do not unexpectedly alter sign-in or conversation, and desktop/mobile plus light/dark screenshot comparisons show no unintended drift. Do not promise bundle savings without production measurements.

### ARCH-05 — Make repository gates enforce repository standards

**Evidence:** the Turbo dry-run lists lint/typecheck tasks only for web, mobile, and shared. Root [package.json:18](/Users/macmini/code/track/package.json:18) invokes those tasks; no dedicated backend lint task is present. Their lint commands use ordinary `oxlint .`; no q9 architecture/type-assertion gate configuration is wired in. [convex/tsconfig.json:1](/Users/macmini/code/track/convex/tsconfig.json:1) is not explicitly invoked by a root typecheck task.

**Important distinction:** backend files can be transitively typechecked through frontend generated-API imports; this is not a claim that Convex code receives no TypeScript checking. The missing part is explicit backend ownership under its own configuration, plus lint/architecture enforcement. Root lint passing does not establish compliance with the stronger written standards.

**Proposed change:** explicitly own backend lint/typechecking, add the established q9 gate packages required by the workspace standards, and ratchet genuine existing debt without hiding failures or weakening tests. Keep generated code excluded intentionally, not arbitrary backend files.

**Done when:** a backend lint violation, banned new assertion, and shared-to-framework import each fail the appropriate gate; CI and local commands report the same coverage. Inspect transitive checking before adding redundant heavy tasks.

### ARCH-06 — Test integrated journeys, not just pieces

**Evidence:** [.github/workflows/ci.yml:1](/Users/macmini/code/track/.github/workflows/ci.yml:1) runs repository checks and unsigned native builds, but no browser/device user journey. [e2e/maestro/README.md:1](/Users/macmini/code/track/e2e/maestro/README.md:1) explicitly says existing flows are not wired into CI and assume an already signed-in session. Existing backend task/thread tests are valuable and should stay.

**Proposed change:** curate a small deterministic suite with isolated dev fixtures: sign-in/bootstrap, send plus failure/retry, source-to-task, dirty task editing with another actor, board move parity, scope switching, and archived read-only behavior. Add keyboard/modal checks and focused screenshot checkpoints. Use remote/device runners; do not blindly run a directory of one-off coordinate flows as the acceptance suite.

**Done when:** CI proves representative actual journeys against an isolated fixture and reports failures with useful traces/screenshots; repeated runs do not depend on someone's existing session or mutate production.

### ARCH-07 — Define measurable performance budgets

**Evidence:** [observability.ts:17](/Users/macmini/code/track/convex/lib/observability.ts:17) already records operational events, and AI completion records duration. The inspected CI has no repeatable route/query performance budget. This audit did not collect production traces, bundle measurements, or field web-vitals.

**Proposed change:** choose representative dataset sizes and record query documents/bytes, active subscriptions, task-open latency, send acknowledgement latency, board move writes, and conversation scroll responsiveness. Add production-build route/bundle measurements and selected field metrics only where useful. Separate operational telemetry from durable domain audit history and set retention for the former; avoid logging message bodies or credentials.

**Done when:** each approved performance change has a comparable before/after result and a regression threshold. Start with lightweight repeatable fixtures and existing tooling—not a new observability platform by default.

## Suggested implementation sequence

1. **Protect user work:** REL-01, REL-02, REL-03, REL-05, REL-06; add targeted regression coverage with each. REL-04 protects unread semantics.
2. **Make conversation and tasks scale:** UX-01, PERF-01, PERF-02, PERF-03. PERF-04 should precede relying on large Company exits.
3. **Close the recurring gaps:** ARCH-05 and ARCH-06; UX-03/UX-04 are localized wins. Add ARCH-07 baselines as performance changes begin, not after they ship.
4. **Consolidate incrementally:** ARCH-01 through ARCH-04 alongside the affected feature work. PERF-05/06/07 and UX-02/05/06 can be approved independently. UX-07 is optional.

## Scope, verification, and limitations

- Mapped web, mobile, shared, Convex, CI, and E2E structure; traced the cited hot paths, callers, policy helpers, and related tests. This is a broad engineering audit, not a claim that every line or every runtime state was exercised.
- Reviewed the working tree as it existed, including unrelated ongoing edits; findings are not all attributable to the current commit or to one author. Evidence line numbers may move as other work continues.
- **Passed:** `pnpm lint`; three package tasks, zero reported warnings/errors. **Checked:** Turbo's lint/typecheck dry-run graph.
- **Vitest:** the local invocation completed successfully and reported **32 test files / 520 tests passed** in 70.70 seconds. The requested invocation selected the task-management and Channel-thread test paths, but the reported run covered more files; the counts here are the runner's actual output. No complete lint/typecheck/test/audit/build gate or production benchmark is claimed for this documentation-only audit.
- **Rendered observation:** localhost landing page appeared blank; captured console output showed a React Grab version warning but no application error explaining it. Further navigation was blocked by another extension UI. The blank page is an unresolved local observation, not a confirmed shipped defect; authenticated visual quality and mobile-device behavior remain unverified.
- `agents-macmini` SSH timed out. Local fallback checks were limited to lint, the gate graph, and the Vitest invocation; no remote checkout or processes were created.
- No production access, backend configuration changes, feature implementation, dependency installation, commits, or pushes were performed.

## Explicitly not recommended

No framework/database rewrite, microservice split, speculative cache layer, global authorization cache, blanket memoization, or design-system replacement. Preserve the shared pure domain, existing scope boundaries, independent release flags, archive immutability, and current tests. Focus investment on the concrete paths above.
