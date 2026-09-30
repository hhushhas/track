# Track mobile UX completion and verification plan

Status: implementation plan, not a completion report

Owner: Track mobile

Last reviewed: 2026-09-24

Scope: `apps/mobile` and only the Convex behavior needed by its Company-wide Team view

## Outcome and user job

A member should see what needs action, enter the right Project, complete or create a task, follow its Channel and thread context, and return without losing their place. Company and Project scope must remain explicit. The interface should feel calm and precise, but visual polish cannot conceal incorrect data, hidden actions, or incomplete flows.

This plan closes observed gaps in the current app. It does not authorize a new information architecture, a production deployment, a dependency change, or a broad web redesign. The current dirty worktree contains other people's work and must remain intact.

The primary user is a Project member who moves between assigned work and Channel discussion. A Project lead also needs a truthful view of status and people; a Company representative sees only the Projects their role and membership permit. The deliverable is an engineering-ready completion plan, not a new visual concept. These roles and the agreed navigation decisions are assumptions for this document; research with representative users is still needed to validate ease of use.

## Product decisions that this plan preserves

| Surface | Final behavior to preserve | Boundary |
| --- | --- | --- |
| Bottom navigation | Home, My Tasks, Team, Inbox, with one central global Create action | The four labelled items are destinations. Create is an action button, not a fifth tab. |
| Home | Task status, Projects, Today's Tasks, then Needs Attention | Project cards expose the next Project and let a member reveal Channels in place or open the Project. No separate Projects destination is restored. |
| My Tasks | Global assigned work with status filters and an in-screen, Company-tabbed accessible-board picker | Selecting a board opens its Project task surface without silently changing Company identity. |
| Global Create | Select Project before creating a task when no Project is already in scope | Inside Project Tasks, use that Project directly. The task form must open after selection. |
| Task Detail | Essential status, due date, assignee, description, checklist, labels, evidence, and one Updates entry point | Discussion and activity are one chronological Updates feed, not competing tabs or duplicate blocks on Task Detail. |
| Conversation | Project → Channels → Channel conversation → focused thread | A thread inherits Channel access. Inbox remains a personal follow-up surface, not a second conversation browser. |
| Team | Company-wide people and Project health, subject to represented Company role and Project membership | The same person must not appear twice in Company workload merely because they belong to two Projects. |
| Calendar | No separate primary Calendar destination | Due dates are chosen while creating or editing a task; date-centric work is available inside task views when useful. |

These decisions take precedence over the earlier Home/Projects/Tasks/Evidence tab proposal. Apple describes tab bars as navigation among top-level areas, not a place for actions, so the custom central Create control needs separate button semantics, stable placement, and its own pressed and disabled states: [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars).

## Known state and evidence boundary

The Android emulator has shown the main route through Home, My Tasks, boards, Project, Channels, conversation, focused thread, Task Detail, and Updates. Project-first Create reaches the New task sheet. The Task Detail status picker works, and the Android date calendar now appears in its edit sheet with visible Apply and Clear actions. The repository lint, typecheck, unit/integration tests, dependency audit, and Expo export passed at the last check.

Those results do **not** prove production readiness. The connected Team screen still showed duplicate people because it used an older backend result. The Add Update tap was intercepted by Expo's development overlay. A task has not been created and read back end to end in the final flow. No iOS simulator, assistive-technology, broad device-size, or release-build pass was completed. Expo export proves bundling, not installed release behavior.

## Work packages and acceptance criteria

### P0. Establish a safe, reproducible baseline

1. Record the exact mobile revision, backend deployment identifier, emulator/device models, OS versions, font scale, theme, locale, and acting Company used for each check. Treat screenshots from different revisions or fixtures as non-comparable.
2. Inventory the current routes, component owners, and supported states. Capture baseline screenshots and short recordings of Home, My Tasks, Team, Inbox, Project, board/list, Task Detail, Updates, Channels, conversation, Threads, focused thread, Profile, Companies, and Notifications. Capture an empty and a populated state where available.
3. Define an isolated development fixture with two Projects that share one user, a board with every status category, one long task history, a conversation with a focused thread, archived/read-only access, and a member with limited permission. Do not delete or overwrite existing user data to manufacture a test state.
4. Identify the exact development Convex target before synchronizing backend code. Verify that it is not production or a shared target that must not be changed. Production deployment or data mutation needs separate, exact authorization.

Acceptance: baseline artifacts are labelled with revision, fixture, platform, dimensions, and state; the backend target and recovery path are known; unrelated worktree changes are preserved.

### P1. Close correctness and data gaps

**Team workload identity.** Keep Company workload keyed by canonical user ID, not a Project-member ID or display name. Test one person assigned work in multiple Projects, two distinct people with the same display name, unassigned work, completed work, and a represented-Company member who may not see another Project. Sync only to the verified development target, then compare the connected Team screen with the backend result. The duplicate-person issue is closed only when both query tests and the live screen show one row per accessible person with correct totals. Do not hide duplicates by merging equal names in the client.

**Create-task transaction.** Exercise Home, My Tasks, Inbox, and Project Tasks entry points. For global entry, choose a Project first, then open the New task sheet; for Project Tasks, open the sheet in that Project. Verify title, board, status, priority, assignee, due date, optional description, validation, duplicate-submit prevention, busy state, cancellation, keyboard reachability, and retained draft after a recoverable failure. Submit one task in an isolated development fixture and read it back in the selected board, My Tasks when assigned to the actor, Task Detail, and any due-date grouping. Verify a denied Project and a lost connection fail safely. Do not create disposable tasks in a shared user workspace without a safe cleanup plan.

**Updates integrity.** Make the Updates feed a complete, stable chronology. Test interleaved comments and state/date changes, same-timestamp ordering, archived comments, pagination of each source independently, and absence of duplicate “commented” events. The label and accessible name must not call the number of loaded rows a total when more pages exist. Use a backend total or say “Showing N updates” until all pages load. Format activity values as human dates in the user's locale and time zone while retaining the canonical date value for writes. Verify the Add composer opens, retains text on send failure, prevents duplicate send, and shows the new update once after success. The composer may be tested in a development build without the Expo overlay; an overlay-blocked tap is not a pass.

Acceptance: data shown on screen agrees with authoritative queries, and each mutation is observed after read-back. Tests cover denied, stale, paginated, and failed-write cases.

### P2. Finish interaction and navigation behavior

1. Test the four tab stacks and central Create action as distinct controls. Repeated rapid taps must not create two sheets or leave an invisible native Modal over the destination. Opening and dismissing a sheet must restore touch and assistive focus. Back first closes a temporary sheet, then undoes navigation. Deep links must preserve Project, Channel, board, represented Company, membership, and archive/read-only scope.
2. Test Project → Channels → conversation → Threads → focused thread → source message, plus every back path. A thread preview stays in the Threads screen and reveals only the last message; Open thread is the explicit deeper route. Archived Channels and threads must not expose an active composer.
3. Test My Tasks filters for All, Open, Completed, every available workflow status, empty groups, Company scope, and long task names. The board picker remains an in-screen bottom sheet with horizontal Company tabs and Project-grouped boards, not a side drawer. Its Company tabs must be scrollable and reachable with assistive technology.
4. Test Task Detail's edit affordances: status, due date, assignee, checklist, description, labels, and evidence links. A value change must show the current selection, allow cancel without a write, give feedback while saving, and show a recoverable error on failure. Date selection must never present two nested native modals or hide Apply behind the home indicator.
5. Test board and list switching, horizontal column navigation, status changes, completed tasks, and read-only behavior. The phone board must use the available vertical area; its bottom content must remain reachable above navigation and gesture insets.

Acceptance: every visible control produces its named result or a clear reason it is disabled; no route loses scope; no action requires an undiscoverable gesture.

### P3. Apply restrained visual and content polish

Use existing semantic theme, type, spacing, radius, and icon tokens. Fix observed problems without redesigning screens that already work:

- Project overview: keep the Company name readable or give a deliberate two-line/wrapping treatment; do not show an unexplained `NORTHSTAR...` fragment when space exists.
- Board: separate the task count from status dots; make the adjacent-column peek intentional, not an accidental clipped label. Confirm the column and bottom inset at compact widths.
- Inbox: give title, Company/Project context, time, and the reason for attention a stable reading order. Allow long context to wrap or truncate by rule; keep the red overdue signal legible without making every row visually loud. Filters remain visible below the header and use the same pill treatment as My Tasks.
- Task Updates: replace raw `YYYY-MM-DD` activity prose with a localized, readable date; make system events quieter than human comments while retaining full information. The Add action must not compete with a floating overlay in a release build.
- Home: preserve status → Projects → Today's Tasks → Needs Attention, partially visible next Project card, contained black reveal button, compact Open Project action, and tall/narrow task cards. Check that the bottom navigation never hides the first or last item.
- Shared controls: audit icon meaning and weight, optical alignment, touch area, header spacing, text contrast, pill baselines, shadows, and wrapping. Make scope visible without repeating a large heading twice.

For each changed screen, compare baseline and final captures at identical data, theme, font scale, and viewport. Record intended differences, inspect the complete scroll range, and check text at 2× screenshot zoom. A screenshot alone does not prove that a sheet, keyboard, animation, or back path behaves correctly; record those flows and inspect them at normal speed and frame by frame. Motion must explain feedback or location, remain interruptible, and respect Reduce Motion.

Acceptance: no clipped labels or controls, inconsistent alignment, hidden action, unintended overlap, or unexplained decorative effect remains in the changed states. No unrelated visual regression is accepted.

### P4. Complete cross-platform, accessibility, and failure-state proof

Run the complete hero journey on a compact iPhone, a current iPhone, a compact Android phone (about 360dp), and a standard Android phone (about 393dp). Include a tablet only if it is an officially supported target. If an iOS device or simulator is unavailable, mark iOS manual validation as **not done** rather than treating an iOS bundle as equivalent proof.

On the primary device, inspect each changed screen in light and dark themes, default and enlarged text, long Company/Project/task names, and both populated and empty data. Exercise loading, offline, recoverable error, permission-denied, archived/read-only, and returning-from-background states. Verify safe areas, keyboard appearance and dismissal, bottom CTA reachability, screen rotation if supported, and reduced motion. Capture any untested locale or RTL requirement explicitly; do not claim localization passes from English screenshots.

Use TalkBack on Android and VoiceOver on iOS to check names, roles, selected/disabled state, focus order, modal focus, announcements after load/save/error, and focus restoration after dismissal. Check touch targets against the stricter project/platform target of at least 44pt on iOS and 48dp on Android, with adequate space between adjacent controls. WCAG's smaller web minimum is not a reason to shrink mobile controls: [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). Check status by text or icon as well as color. Android edge-to-edge and keyboard insets must keep actions tappable: [Android window insets](https://developer.android.com/develop/ui/compose/system/insets).

Acceptance: a person can complete each core journey with touch and the platform screen reader; each supported size/theme/state has captured proof; unavailable environments are listed as blockers, not silently marked passed.

## Verification matrix

| Journey or state | Automated assertion | Manual visual/functional proof |
| --- | --- | --- |
| Company-wide Team workload | Cross-Project same-user, same-name distinct users, totals, authorization | Connected development backend returns one person row with accurate totals; role changes alter only permitted data. |
| Global Create | Route choice, Project identity, duplicate-submit and error tests | Home/My Tasks/Inbox → choose Project → sheet → submit → board/My Tasks/detail read-back; cancel and keyboard paths. |
| Project Create | Project-scoped route and board default | Project Tasks → sheet with correct Project/board; save and back without scope drift. |
| Task Updates | Merge, pagination, formatting, idempotent send, permission tests | Existing history, long history, Add composer, send, failure/retry, archived state. |
| Navigation | Tab mapping and context-aware Create tests | Four tabs, Project hierarchy, deep links, hardware/gesture back, rapid taps, sheet dismissal. |
| Visual system | Token and component checks where practical | Identical-fixture before/after captures for each changed screen, full scroll and motion review. |
| Accessibility | Accessibility-label and state tests where practical | TalkBack and VoiceOver completion, large text, contrast, reduced motion, focus restoration. |
| Reliability | Existing unit/integration suite | Offline/slow/error/returning-app paths and installed development or release-style build. |

## Execution order and stop conditions

1. Freeze the baseline and identify the safe backend target. Do not begin live Team verification until the target is known.
2. Close P1 correctness gaps with focused tests and real read-back. A failing backend or create-task path blocks cosmetic sign-off.
3. Close P2 navigation and interaction gaps in small, reviewable changes. Verify each change on the emulator before changing another flow.
4. Apply P3 polish with paired screenshots and recordings. Keep fixes local; do not replace the design system or change unrelated web screens.
5. Run P4 across supported platforms and states. Fix findings, then rerun the affected matrix.
6. Run the repository gate in isolation from resource-heavy emulator or build jobs when timing matters: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`, and `pnpm build`. If a test times out, diagnose it and rerun the focused case and full gate; do not increase timeouts merely to claim green.
7. Inspect every changed line, final status, screenshots, generated outputs, secrets, and unrelated work. Do not stage, commit, push, or deploy unless separately requested. Record observed evidence and name every remaining unproved behavior.

The work is **Done** only when the current backend and both supported mobile platforms pass the applicable matrix, no high-severity visual or functional finding remains, and the real task and conversation paths succeed end to end. Otherwise report **Not done** with the exact failure, target, and next required action. A production rollout, native regeneration, or protected Expo command remains outside this plan without its required exact-target approval.
