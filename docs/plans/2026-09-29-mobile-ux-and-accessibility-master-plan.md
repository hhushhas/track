# Track Mobile UX and Accessibility Master Plan

Status: Not done. The approved mobile UX changes in the current worktree pass the repository lint, typecheck, test, production dependency audit, and build gates. Device accessibility checks and a local route smoke are still unproved because no Android device is connected and the configured remote Convex deployment is not confirmed as development.

Owner: Track mobile

Review date: 2026-09-30

Scope: `apps/mobile`, plus shared or Convex behavior only where an approved mobile journey depends on it.

## 1. Product outcome

Track mobile should let a person move from the right Company conversation to a reply, Thread, or source-linked task without losing content, scope, or confidence about what changed. My Tasks should make assigned work and its Boards easy to scan. Inbox should make follow-up activity clear. Profile and navigation should remain calm, visible, and usable with touch, large text, and assistive technology.

The app keeps four primary destinations in this order: Chats (Conversations), My Tasks, Inbox, and Profile. Project, Channel, Thread, Board, and Task Detail remain contextual destinations. The interface keeps the existing Track visual language, with the explicitly requested jelly treatment on the individual chat screen.

## 2. Product rules that govern every phase

1. **Keep content present during interaction.** A swipe may reveal actions, but it must not drag the message out of view, clip its text, or change which message appears to be acted on.
2. **Make counts describe the visible scope.** A count must match the same Company, Project, date range, search, and applied filters as the rows it describes. For partial data, label the count as incomplete or approximate.
3. **Keep scope attached to the work.** Company, Project, Channel, Thread, membership, and source-message context must survive opening, editing, filtering, retrying, and returning. Inbox remains user-global; My Tasks keeps the active Company scope without adding a Company selector to that screen.
4. **Make gestures optional.** Every important long-press or swipe action needs a labeled, screen-reader-accessible route. Taps remain the primary visible affordance.
5. **Use one interaction grammar for related controls.** Chats and Inbox share search and filter placement and visual treatment. My Tasks uses the same control quality and sheet behavior while keeping its own task-specific choices.
6. **Preserve product meaning while reducing noise.** Remove duplicate cards, repeated explanations, and low-value decoration before removing Company, Project, Channel, owner, due date, status, or evidence context.
7. **Use the same state truth in the interface and accessibility tree.** Selected, expanded, disabled, busy, unread, completed, loading, and error states must be spoken when they change what a person can do.
8. **Keep platform behavior intentional.** iOS may use the approved rounded translucent navigation. Android navigation stays flat and respects Android system navigation, insets, and back behavior.
9. **Do not claim proof from source inspection alone.** Screenshots, recordings, automated checks, and assistive-technology/device checks must match the current build before a phase is complete.

## 3. End-state screen specifications

### 3.1 Chats: Company and Project conversation discovery

Chats is the signed-in landing surface. It opens in the current Company scope and retains the clear reading path agreed in the conversation-first product plan:

1. Company identity and Company switcher.
2. One search field and the filter controls used to find conversations.
3. A horizontally scrollable Project selector presented as the requested pill tabs.
4. Quiet, ghost-style All, Unread, Channels, and Threads views.
5. A vertically scrolling feed grouped under Project-name dividers.

The Project selector remains in pill format on both Chats and My Tasks. It needs a clear selected state, a minimum 44 pt iOS / 48 dp Android hit target, and horizontal scrolling for long names and narrow screens. Switching Project updates the selected state at once and replaces the feed with content from that scope after loading; old-scope rows must not appear under the new selection.

Each Channel row shows its name and useful latest-message context. Each Thread row shows its Thread name and parent Channel. Unread Channels show a small yellow circular badge at the top-right of the Channel logo, with the unread count inside; cap large counts consistently (for example, `99+`). The number must be available to screen readers and must not rely on yellow alone.

Touch-and-hold anywhere on a Channel or Thread row opens its action sheet. It does not open a preview, drawer, or dropdown. The action sheet contains only actions permitted for that destination and uses clear labels, selection, disabled, and destructive states. A normal tap still opens the Channel or Thread.

Search and filters compose predictably and keep the query visible while results change. Loading, empty, no-results, offline, access-changed, error, and partially loaded Project states explain the current condition and the next safe action.

### 3.2 Channel and Thread chat

The Channel and Thread are focused conversation screens with their parent Project/Channel scope visible. Back returns to the originating list with useful selection, filter, and scroll context where practical. Thread access always inherits the parent Channel permission boundary.

On the specific chat screen, preserve the requested jelly background treatment and remove the unwanted white background behind it. Apply this only to the intended chat surface; retain readable message text, attachment contrast, timestamps, and distinct incoming/outgoing meaning in light and dark appearance.

#### Message gestures and actions

- A left swipe reveals the existing message actions while the message bubble stays anchored in place. The row must not translate its readable message content off the left edge or hide it behind an overflow-clipping parent.
- A right swipe continues to offer Reply where allowed.
- Finishing or cancelling a gesture returns the row to a stable position. If actions remain exposed, their state and dismissal path are clear.
- Touch-and-hold on a message opens the existing Message actions sheet. Do not open a message preview. Do not add an unrequested dropdown or drawer.
- Forward, Report, Reply, Open Thread, Create Task, Copy, Delete, and other currently supported actions retain their eligibility rules, confirmation behavior, and feedback.
- Provide screen-reader custom actions or a visible labeled action control so long-press and swipe are not required. Keep the action sheet itself modal, labeled, dismissible, and reachable by VoiceOver and TalkBack.
- Keep assistant-message actions and media-message actions available through equivalent accessible routes.

The composer stays above the keyboard and system navigation. It supports text, attachments, voice notes, mentions, send, retry, and offline recovery. Sending gives immediate local feedback, prevents duplicate submission, and keeps the draft and source context on failure.

### 3.3 My Tasks: assigned work and Board directory

My Tasks is for work assigned to the current person across the active Company. Keep the Company data scope inherited from app context, but remove the Company-selection dropdown/form from this screen. Show a quiet scope label when needed so users can still tell which Company their tasks belong to. Do not weaken backend membership or authorization checks.

Use this hierarchy:

1. The My Tasks title and concise user identity/context where already required by the current design.
2. The requested lighter statistics-card background, using semantic theme tokens and retaining AA text contrast.
3. One search field and one filter button.
4. One clear task-view set: Today, Upcoming, All, and Done. Add counts only when they describe the same applied query and complete/partial data state as the results.
5. Urgent-only Today items.
6. Urgent-only Due this week items, with the week count beside a calendar control.
7. A Boards directory after the search, filters, task views, and urgent due sections.

Do not show a generic “Needs Attention” section on My Tasks. Today and Due this week contain only Urgent tasks, as explicitly selected by the requester. Normal and low-priority tasks remain reachable in Upcoming and All. Done remains the completed-work view. Status and priority remain available in the filter sheet.

The Board area is a directory, not a task tab inside My Tasks. Use the signed-in person’s profile name as the directory heading, then group that person’s accessible Boards beneath a divider. Show the Boards in quiet, ghost-style rows that visually relate to Channel rows in Chats. Each row shows the Board name, its Project context, and a small task-count or unread badge where that data exists. Do not label an assigned-task total as a notification. Show a notification badge only when the backend provides an actual unread count. Counts must say when they are partial.

#### My Tasks filter behavior

- The filter button opens an interactive bottom sheet with Status, Priority, and Due date controls.
- Controls update a draft selection while the sheet is open. The visible applied count and task list do not change until the user taps Apply.
- Apply commits the draft filters, closes the sheet, and updates rows and counts together. Cancel/close discards draft changes and keeps the prior applied filters.
- Reset/Clear returns the draft selection to its defaults. It changes applied results only after Apply, unless a clearly named immediate reset action is intentionally chosen and documented.
- Expose selected values and sheet actions to screen readers. Focus and dismissal behavior must be tested on both platforms.

#### Due-this-week day picker

- Keep the calendar icon beside the Due this week count.
- Opening the icon shows the days of the selected week. Each day is a labeled, selectable control with weekday, date, task count, and selected state.
- Selecting a day filters the urgent week task list to that day and shows the selected date.
- The calendar icon changes to a close/cross control while the day strip is open. Closing the strip preserves the selected date filter. The separate clear-day action clears that filter.
- The count and list use the same date boundaries, timezone, search, applied task filters, urgent-only rule, pagination coverage, and completion policy.

Every task row presents a readable title, Project and Channel context when available, due date, priority, and status. Completion/status actions are easy to reach, and tapping the task row opens full Task Detail. Completed tasks in All appear in a collapsible group. Empty, loading, no-search-results, offline, error, and partial-Project states explain what is happening and what to do next.

### 3.4 Inbox

Inbox remains user-global across Companies. Its search field and filter action use the same placement, visual grammar, selected states, touch targets, and sheet behavior as Chats. Inbox-specific filter values remain distinct and are not replaced with conversation-only filters.

Rows identify the activity, person or task, Company/Project/Channel/Thread context, and time. Opening a row goes to the exact authorized source. Revoked access must not leak message previews. Unread, Mentions, Replies, Tasks, Suggestions, Invitations, and other supported states remain clear, with in-place mark-read/invitation feedback and useful empty, offline, partial, loading, and error states.

Keep the global create-task plus action visible and unobscured on Inbox, with an accessible name and target, if it is part of the shared shell. Do not add a second feature-specific plus button without an established product action.

### 3.5 Profile

Profile places the profile icon above the user’s name, email, and role/designation in one centered vertical column. Keep the full identity group centered in the screen content and allow names, email addresses, and role text to wrap or scale without clipping.

Retain the currently supported account, appearance, notification, timezone, Company access, membership, and sign-out actions on their existing permission-aware paths. Group them plainly, preserve clear selection states for appearance settings, and make destructive flows explicit and recoverable where possible.

Keep the global create-task plus action visible and unobscured on Profile, with a screen-reader label and platform-sized hit area, if it is part of the shared shell. Do not introduce an extra Profile-only plus action.

### 3.6 Primary navigation and shared shell

Keep Chats, My Tasks, Inbox, Profile in the approved order. Keep the separate plus action visible and operable on all four primary destinations, including Profile and Inbox. It must not cover a row, filter, system control, or keyboard field.

Apply a slightly glassy treatment to the bottom navigation where allowed by the approved platform contract: restrained translucency on iOS; flat native presentation on Android. The selected navigation pill/hover treatment must respond to direct taps and the requested press-hold-and-slide gesture. Tapping each labeled tab remains a complete alternative to dragging. Screen readers must find and activate every destination without needing the gesture. Respect safe areas, keyboard visibility, Reduce Motion, and platform back behavior.

### 3.7 Other product areas and states

Retain the approved conversation-first product architecture, project/board/task permission rules, source-linked task creation, and Task Detail context. The updates feed remains Inbox work where already consolidated; do not restore removed standalone mobile destinations by inference.

Across Company, Project, Channel, Thread, Board, Task Detail, Inbox, Profile, authentication, notification settings, and contextual utilities, design and verify loading, empty, no-results, offline, error, access-denied/revoked, read-only/archived, and partial-data states where those states can occur. Include a specific action when recovery is possible and do not show stale data under a newly selected scope.

## 4. Accessibility workstream

The global accessibility rule is the acceptance bar: WCAG 2.2 AA as a design/checklist reference, adapted to native iOS and Android controls and assistive technology. The source changes add a labeled message-action route, heading semantics, task-evidence labels, task-filter states, and reduced-transparency handling. A direct WCAG calculation of the seven statistics foreground/background token pairs in each theme measured 4.71:1 to 9.88:1. These source checks do not prove contrast for composite surfaces, badges, glass, images, focus indicators, or all component states. No Android device is connected, so VoiceOver, TalkBack, large-text, focus, gesture, and platform appearance behavior are not verified at runtime.

For every screen and shared component:

- Give each control an accurate accessible name, native role, state, hint when helpful, and a practical hit target.
- Use native header semantics for screen titles and major sections so heading navigation works.
- Expose evidence, unread counts, priority, due state, attachment descriptions, source context, and selected dates when they carry useful meaning. Hide purely decorative symbols from assistive output.
- Ensure swipes and long-presses have visible or custom accessibility-action alternatives.
- Keep modal focus, close/cancel, hardware back, accessibility escape, and return focus predictable.
- Announce meaningful loading, success, error, offline, and filter-result changes without repeatedly reading unchanged content.
- Never use color as the only way to show selected, urgent, unread, complete, or error state.
- Check text, icon, control, focus, badges, translucent navigation, and message-surface contrast in light and dark appearance. Meet 4.5:1 for normal text and the relevant non-text contrast threshold for controls/indicators.
- Support large system text through the app’s intended maximum scale without clipping, overlapping, hiding actions, or making essential names impossible to distinguish. Inspect 200% scale as well as platform-large accessibility text.
- Check high-contrast and reduced-transparency settings. Keep motion optional and confirm Reduce Motion behavior for every custom transition and looping animation.
- Verify keyboard/switch access where applicable and use logical reading and focus order.

Shared touch targets and text scaling are already present in many primitives, and the updated message and navigation animations honor Reduce Motion. The theme token check passes the 4.5:1 normal-text threshold for the sampled statistics pairs, but composite surfaces, badges, glass, images, focus indicators, and every component state still need device review.

## 5. Prioritized findings and success measures

| Priority | Work | Done when |
| --- | --- | --- |
| P0 | Protect content during message gestures | Repeated left/right swipe, cancellation, and interrupted-gesture checks never hide or misidentify the target message. |
| P0 | Accessible message actions | VoiceOver and TalkBack users can inspect a message and open its actions without needing swipe or long-press. |
| P1 | My Tasks hierarchy and behavior | The generic Needs Attention section and Company selector are absent; urgent-only Today/week, four views, draft/apply filters, calendar preservation, Board order, and count consistency all match this plan. |
| P1 | Chats discovery and action behavior | Project pill tabs work; unread Channel badges are correct; Channel/Thread hold opens actions only; search/filter and scope states remain clear. |
| P1 | Inbox/Profile consistency | Inbox search/filter matches Chats; identity is centered on Profile; shared plus remains visible and operable. |
| P1 | Navigation gesture and platform treatment | Taps and press-hold-slide both work; iOS/Android treatment matches the approved contract; insets and content hit areas remain correct. |
| P1 | Semantic structure | Main screen/section titles are navigable headings; task evidence and important status data appear in accessible output. |
| P1 | Accessibility and large-text proof | Screen-reader traversal, 200% text, contrast/state visibility, Reduce Motion, and high-contrast/reduced-transparency settings pass on supported devices. |
| P2 | Visual surface refinement | Statistics cards are modestly lighter; the specific chat preserves jelly material without the unwanted white background; dark/light contrast stays clear. |
| P2 | Robust states and content extremes | Long names, no data, no results, offline, failures, partial loads, archived/read-only, and revoked access have clear display and recovery behavior. |

## 6. Execution phases and gates

### Phase 0: Baseline and change protection

1. Read repository and mobile instructions, inspect staged/unstaged/untracked changes, and map each requested behavior to its current owner component and data source.
2. Compare the running app’s build identity with the source before using device evidence. Keep existing user changes and unrelated generated artifacts untouched.
3. Create a route/state inventory for Chats, Channel, Thread, My Tasks, Project Board, Task Detail, Inbox, Profile, navigation, sign-in, notifications, and contextual utilities.
4. Record each item as source-confirmed, device-confirmed, failing, or not yet verified. Do not copy stale screenshots into completion evidence.

**Exit gate:** a reviewed baseline matrix exists, current-build status is known, and all affected routes and shared components have owners.

### Phase 1: Shared accessibility and interaction foundations

1. Add accessible message actions without relying on gestures; check media and assistant messages.
2. Add screen/section heading roles, task evidence semantics, accurate dynamic labels/counts, and consistent selected/expanded/busy states.
3. Check shared button, pill, filter-sheet, modal, toast, tab, plus, and navigation behavior for label, hit target, focus, announcement, and dismissal.
4. Establish contrast checks for both themes and composites; support or deliberately validate high-contrast and reduced-transparency platform settings.
5. Keep the current 2× font scaling policy and correct layouts that clip or truncate essential content at large sizes.
6. Use Impeccable’s native audit to review code-level accessibility and adaptivity after each major screen family is implemented, then run its polish pass after valid findings are fixed.

**Exit gate:** core controls have non-gesture access, semantic navigation is present, and a screen-reader pass can be run end to end.

### Phase 2: Chats, Channel/Thread actions, and message gestures

1. Implement stationary-bubble left-swipe action reveal, stable close/cancel behavior, and right-swipe Reply.
2. Ensure long-hold on a Channel/Thread row opens an action sheet with no preview/drawer/dropdown.
3. Place yellow unread count badges at the top-right of Channel logos and expose the same count to assistive technology.
4. Align Project tabs to pill format and verify search/filter composition, loading, no-results, partial coverage, and scope replacement.
5. Retain the specific chat’s jelly background while removing the unwanted white backing, and verify text/media contrast in both themes.

**Exit gate:** video evidence shows that content stays in place during gestures, action routes are discoverable, and Channel/Thread selection opens the correct scope.

### Phase 3: My Tasks and Board directory

1. Remove the generic Needs Attention content and Company selector control from My Tasks while retaining inherited Company scope and a useful scope label.
2. Add/confirm Today, Upcoming, All, Done views and correct counts.
3. Restrict Today and Due this week to Urgent tasks. Keep regular/low tasks reachable in Upcoming and All.
4. Make the filter sheet interactive with draft and applied state, explicit Apply/Cancel/Clear behavior, and count changes only after apply.
5. Keep week count and calendar together; implement day selection, close-without-clear, and explicit clear-day behavior.
6. Place the ghost-style Board directory after filters and urgent sections, with Project context and truthful task/unread counts.
7. Ensure every task row exposes title, Project/Channel, due date, priority, status, completion, and full-detail navigation.

**Exit gate:** the same test fixtures produce matching rows and counts across each view, filter combination, day selection, pagination state, and completion transition.

### Phase 4: Inbox, Profile, and shared create action

1. Align Inbox search and filter presentation with Chats while preserving Inbox-specific filter choices and global scope.
2. Center the Profile name, email, and role vertically in one identity column with the profile icon.
3. Verify the global plus action on Inbox and Profile is present, visible, non-overlapping, correctly scoped, and accessible.
4. Confirm Inbox deep links remain authorized and route back safely.

**Exit gate:** screen recordings demonstrate matched search/filter behavior and usable Profile/Inbox controls on both platforms.

### Phase 5: Navigation polish and consistency

1. Apply slightly translucent/glassy navigation on iOS and the approved flat Android layout.
2. Make the selected/hover pill respond to taps and the press-hold-slide interaction; keep tap navigation and assistive alternatives complete.
3. Test the plus target, floating bar, safe areas, keyboard, list padding, and Android gesture/three-button navigation for overlap.
4. Apply the lighter statistics-card background through theme tokens without weakening text or icon contrast.

**Exit gate:** every primary route remains reachable and the shell never obscures content or touch targets at supported text scales.

### Phase 6: Full accessibility, content, and state validation

1. Walk every route with VoiceOver and TalkBack using a consistent checklist for order, labels, actions, state, announcements, focus return, and modal dismissal.
2. Inspect platform-large and 200% font scale; test long user names, emails, Company/Project/Channel/Thread/Board/task names, and translated-length stress strings where available.
3. Verify light/dark contrast, translucent surfaces, notification badges, status/priority indicators, focus visibility, high-contrast, reduced transparency, and Reduce Motion.
4. Exercise loading, empty, no results, offline, access revoked, archived, read-only, partial query, retry, and failed action states.
5. Check screen rotation/resizing and split/multi-window behavior where supported by the product’s device range.

**Exit gate:** no P0/P1 accessibility or task-completion failure remains; all exceptions are named, justified, and accepted by the reviewer.

### Phase 7: Regression and delivery decision

1. Add or update focused behavior tests for gesture intent, action opening, applied filter counts, urgent-only selection, date boundaries, selected-day retention, partial counts, Company/Project scope, unread badges, and deep links.
2. Run the mobile/root required gates from the repository guide: lint, typecheck, test, production dependency audit, and build. Preserve and report pre-existing failures instead of hiding them.
3. Install or launch a current build through the approved workflow; do not use protected native regeneration/run commands without the required immediate approval.
4. Capture device/OS/build identity, screenshots, full-flow recordings, accessibility-tree evidence, and focused test output for Android and iOS.
5. Inspect every intended diff and confirm no unrelated work, generated files, credentials, or stale docs were changed.
6. Run the required scoped code review for nontrivial implementation and resolve valid findings.
7. Make a clear release recommendation using observed evidence. Do not call the app user-validated without user testing.

**Exit gate:** all relevant automated gates and real user paths pass on current builds; no unresolved P0/P1 issue remains; remaining limitations are explicit.

## 7. Acceptance scenarios

1. From Chats, select a Project pill and open an unread Channel; the feed, badge, Channel header, and back path all preserve the same Project/Channel scope.
2. Long-hold a Channel or Thread row; its action sheet opens without preview. Tap instead; the conversation opens.
3. In a Channel, swipe a long message left and right, cancel mid-swipe, and repeat at top/bottom scroll boundaries; the message remains visible and the intended action is clear.
4. With VoiceOver/TalkBack enabled, read a message, invoke message actions without gestures, perform an allowed action, dismiss the sheet, and return to the same reading location.
5. In My Tasks, apply Status/Priority/Due date drafts, cancel, reopen, then apply; canceled values never affect counts, and applied values change list and count together.
6. Confirm Today and Due this week contain Urgent tasks only. Select a week day, close the calendar, and verify that the day remains selected until Clear is activated.
7. Confirm My Tasks shows no Company dropdown or generic Needs Attention section, retains Company context, and lists Boards after filters and urgent work.
8. In Board rows, verify task totals are not called notifications, unread badges only use real unread data, and partial totals are identified.
9. In Inbox, search and open filters using the same interaction pattern as Chats. Verify the scope remains user-global and every result opens an authorized source.
10. On Profile, confirm the icon sits above the name, email, and role in one centered vertical identity group at normal and large text sizes.
11. On Inbox and Profile, confirm the plus action is visible, labeled, has a full target, and opens a correctly scoped task flow without covering content.
12. Verify bottom navigation by direct tap and press-hold-slide, then repeat with Reduce Motion and screen reader enabled; all tabs remain individually reachable.
13. Compare the lighter statistics background and jelly chat surface in light/dark appearance and confirm all text, status, icon, and focus contrasts remain readable.
14. Repeat key flows with no data, loading, no search results, offline, slow network, partial pagination, long labels, revoked access, archived/read-only content, and failed requests.

## 8. Review artifacts and status reporting

### Implementation checkpoint: 2026-09-30

| Gate | Result | Evidence or remaining limit |
| --- | --- | --- |
| Mobile regression | Pass | The mobile suite passed 36 files and 152 tests, including task-view scoping and urgency, task filters, navigation, and message-swipe cancellation. |
| Web and shared regression | Pass | The web suite passed 47 files and 133 tests; shared-domain tests passed 5 files and 10 tests. |
| Root and Convex regression | Pass | The root Vitest suite passed 20 files and 100 tests. The earlier `convex/companyRelationships.test.ts` timeouts did not recur. |
| Lint and typecheck | Pass | Root `pnpm lint` and `pnpm typecheck` completed successfully on the settled source. Mobile lint reported zero warnings or errors. |
| Production dependency audit | Pass | `pnpm audit --prod` reported no known vulnerabilities after the workspace override and patch update. |
| Production build | Pass | `pnpm build` completed for the web app and Expo web, Android, and iOS bundles. |
| Device and assistive technology | Not verified | `adb devices -l` listed no device. Android and iOS VoiceOver/TalkBack, large text, gesture, focus, and current-build flows still need device evidence. |
| Local route smoke | Not run | The Expo server was stopped without opening the app. `apps/mobile/.env` enables the development auth bypass and supplies a remote Convex URL but does not identify the target as a development deployment; keep the app disconnected until the exact target is confirmed. |
| Scoped code review | Pending | `codex review --uncommitted` started, but its review process was interrupted before it reported findings. Rerun the review after this checkpoint update. |
| Visual stat-card check | Source-only | The statistics palette and card surfaces were lightened. The mobile routes do not currently mount the `HomeStatsSection` or `TaskStatusSummary` components, so a visible stat-card change is not proven in a live route. |
| Diff and repository safety | Pass | `git diff --check` passed. Existing working-tree changes were preserved; no commit, push, deployment, or native regeneration command was run. |

The implementation remains not done until the scoped review completes, the exact development backend target is confirmed for a local route smoke, and the required current-device accessibility and user-path checks pass. Do not describe the app as user-validated or release-approved before those checks.

For every implementation checkpoint, record:

- The changed behavior and accepted decisions.
- Files and shared components affected.
- Tests/checks run with the observed result.
- Platform, OS version, build identity, and account/scope used for device review.
- Screenshots/recordings for layout and gesture behavior.
- Accessibility-tree and VoiceOver/TalkBack observations.
- Open issues, severity, owner role, and next safe action.

Keep the related conversation-first plan for product architecture and the visual-alignment plan for their existing decisions. Use this document as the single consolidated execution checklist for the additional requests and accessibility work; reconcile any conflicting old implementation note with the explicit decisions in Sections 2–4 before changing code.
