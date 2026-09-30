# Track Mobile Conversation-First Product Plan

Status: Approved direction; implementation audit and remaining delivery are open.

Owner: Track mobile

Scope: `apps/mobile` and the Convex contracts and authorization checks required by the approved mobile experience.

This plan captures the agreed product direction and a staged route to implementation. It does not claim that every listed item is already complete. Existing work must be checked against the acceptance criteria before a phase is marked done.

## Product outcome

Track mobile should open directly into useful Company conversations, then make personal task work, user-wide activity, and account controls easy to reach. The four primary destinations are Conversations, My Tasks, Inbox, and Profile. Channel and Thread chats, Project boards, and Task Detail remain focused contextual screens.

The current Home screen is the visual source of truth. Keep its hierarchy and useful Project presentation, then carry that visual language into the four destinations. Do not turn the product into a maze of separate lists, dashboards, and decorative screens.

## Locked product decisions

### Navigation and screen scope

Use these primary destinations in this order:

1. Conversations.
2. My Tasks.
3. Inbox.
4. Profile.

Conversations is the signed-in first screen. The existing Home experience is absorbed into this system: preserve its visual language and useful Project patterns, while the first destination focuses on conversations.

Use different bottom navigation treatments by platform:

- **iOS:** keep the requested rounded, translucent bar, large closely grouped icons, and a restrained gooey selection transition. Keep labels and accessibility names clear. Motion must stop or simplify under Reduce Motion.
- **Android:** use a simple, flat bottom navigation layout with evenly sized destinations and no decorative gaps. The bar itself must not be pill-shaped. Do not use glass or gooey motion. Keep the selected destination clear through icon, label, and restrained color treatment, and respect Android system insets and back behavior.

Keep the plus action separate from the four destinations. Place its center at 40% of the navigation bar height. When a Project is selected, open task creation in that Project. In Company-wide scope, ask the user to choose an accessible Project before opening the task form. Never create a task without a clear Project scope. Creating a task from an important message remains the preferred path when it needs conversation context.

Team Workload must leave mobile navigation and the mobile workload surface. A standalone Evidence screen is not needed on mobile. Relevant source messages, attachments, and evidence links remain reachable from the task or conversation that uses them.

### Company and Project meaning

“Company-wide” means all Projects the user is enrolled in for the currently selected Company. It never means all Companies. Inbox is the exception: it is user-global across Companies.

Project membership and server-side capabilities control which Project, Channel, Thread, board, task, and action a person can access. The interface reflects permissions; it does not enforce them. The backend remains authoritative.

### Visual direction

Use a classical, clean, minimal interface with visible content as the main visual element. Establish hierarchy through typography, alignment, spacing, and restrained surfaces before adding decoration. Reuse the Home screen’s existing type roles, spacing rhythm, colors, icons, borders, and card treatment instead of introducing a second visual system.

The provided screenshots and the user's description of the X video are design references. The X page was not available to inspect during earlier work, so do not claim that its motion or full flow has been verified. Follow the user's stated chat pattern and the screenshots, then validate the resulting interaction on real devices.

## Screen and interaction specifications

### 1. Conversations: first impression and Company feed

The first authenticated view should show conversations without requiring a setup step. Select the user's current Company by default. If the Company has no accessible conversations, explain the empty state and offer the next useful action rather than rendering a blank surface.

Use this top-to-bottom order:

1. Company identity and Company switcher.
2. Search and the main filter action near the top.
3. Horizontal Project carousel, styled like the existing Home Project selector.
4. Quiet, ghost-style conversation filters for All, Unread, Channels, and Threads, with All selected by default.
5. A vertically scrolling Company conversation feed grouped by Project.

The default Company view includes all accessible Projects. Each Project begins with a divider containing its name. Channel rows and Thread rows remain visually distinct within the Project section; Thread rows retain the parent Channel name. Use a Channel pill for Channel identity without repeating Project names on every row.

The feed should provide enough information to scan: Channel or Thread name, latest message preview, sender, unread state, and a quiet time label. Use avatars only where they help identify a person. Preserve a clear reading path and do not make every row a raised card.

Selecting a Project in the carousel keeps the user on this screen, immediately marks the Project as selected, shows a short loading state, and then replaces the feed with that Project's authorized conversations. Do not leave old Project content visible as if it belonged to the new selection. Selecting All restores the Company-wide feed. The carousel must scroll on narrow screens without clipping its Project names or actions.

Search, unread, Channel, and Thread filters must compose predictably. Search text stays visible while results update. Filters have an obvious selected state and can be cleared without navigating away. Loading, no-results, offline, access-changed, and failure states explain what happened and what the user can do next.

Do not keep a standalone Channel list destination. Channel discovery belongs in the Conversations feed. Do not put the Company-wide Channel list in My Tasks; My Tasks is for assigned work.

### 2. Channel conversation and Thread chat

Both chat screens are mandatory. Opening a Channel or Thread from Conversations opens its focused chat screen. Back returns to the originating conversation context and preserves useful scroll and filter state where practical.

Use the supplied chat references as interaction inspiration: clear sender/message hierarchy, restrained timestamps and delivery/read state, consistent spacing, and a composer anchored above the keyboard and system navigation area. Keep the conversation itself dominant. Avoid decorative panels that compete with messages.

A Thread is a focused conversation inside its parent Channel and inherits that Channel's access boundary. Show enough parent context to orient the user, and keep the Thread and Channel routes permission-scoped. There is no direct-message surface outside Projects and Channels.

The composer must handle keyboard opening, attachments, sending, retry, and offline states without covering the active field or primary action. Sending should give immediate local feedback, prevent accidental duplicate submission, and show an honest failure state when the message did not send.

### 3. Create a task from conversation

Important messages can become tasks. Start creation from the message action so the source is unambiguous. Carry the Company, Project, Channel or Thread, and source message into the task draft. Keep the required form short; ask only for fields needed to create the task, with optional metadata available without blocking the flow.

On success, confirm that the task was created and provide an action to open it. The Task Detail view must preserve a durable link back to the source conversation. On failure, keep the draft and source context so the user can retry safely.

The plus action is a separate task-creation affordance, not a fifth primary destination. It creates within the selected Project, or asks the user to choose a Project from Company-wide scope. Message actions remain the path that attaches source-conversation context automatically.

### 4. My Tasks: Company-wide assigned work

My Tasks is scoped to the selected Company and shows tasks assigned to the current user across accessible Projects in that Company. It is not a feed of all Company tasks and is not the Project board.

Use this content hierarchy:

1. My Tasks title and Company selector.
2. Compact statistics for the selected Company and Project scope.
3. A horizontally scrollable Project selector, with All Projects selected by default.
4. A horizontal task-status carousel for the existing task views, using the current status categories rather than inventing new task states.
5. Attention Needed near the top.
6. Today.
7. The full seven-day week view, visible on the same screen but secondary to Attention Needed and Today. Its day selector is a horizontally scrollable calendar strip.
8. The full assigned-task list, filtered by the selected status.
9. Contextual access to the separate Project task boards.

The selected Project filters the metrics, attention items, today items, weekly items, and task list consistently. Switching Company clears a Project selection that does not belong to the new Company. An explicit All Projects choice restores the Company-wide view.

The week view shows all seven days for the selected week and the user's assigned tasks across the selected Company. Selecting a day updates the visible tasks for that day. Keep Project names visible on task rows so work across Projects stays distinguishable. The week is useful context, not the visual headline of the screen.

Do not show a blank page while task queries are pending. Show a layout-matched loading state, a clear no-tasks state after the query is complete, and a useful error or offline state when data cannot load. If more Project pages remain, show that the Company summaries are partial and offer a visible action to load the remaining assigned-task and week pages. Client query arguments, Convex validators, generated API types, date boundaries, indexes, and tests must agree. The prior `dueDateStart`/`dueDateEnd` mismatch is a regression case.

### 5. Project task board

Keep the board as a separate Project-wide workflow view. It helps the team coordinate work through workflow states, including tasks not assigned to the current user. It does not replace My Tasks.

Project members can view the board. Managers and admins can interact only when the effective Project permission allows it. Assignees can use actions allowed by the existing backend policy. Read-only, archived, and denied states must be clear and must not expose active controls that will fail on submission.

Keep Project, board, group, Company, and membership identity intact when opening a board from My Tasks or Project context. Continue to authorize every query and mutation on the server.

### 6. Task Detail

Redesign Task Detail around the gaps already identified: layout, structure, content organization, and role-based visibility. The source conversation means the Channel or Thread message that explains where the task came from; that context must be visible and openable from the task.

Recommended information order for design and implementation review:

1. Task title and the current workflow state, with the primary allowed action clear.
2. Project and source-conversation context.
3. Assignee, due date, priority, and other task fields grouped by how people use them.
4. Description, checklist, or subtasks, when present.
5. Conversation evidence and attachments that explain the task, without a separate Evidence destination.
6. Comments and task changes in a readable activity area. Confirm whether the current model should present them as one chronological timeline before changing the existing information architecture.
7. Secondary and destructive actions behind a clear contextual menu, subject to permissions.

This ordering is a design recommendation for the detail-page refinement; it does not approve deleting task fields or changing backend policy. Members, managers, admins, and assignees see actions based on effective server capabilities. Preserve the source link through task edits, status changes, and navigation.

### 7. Inbox: user-global activity

Inbox is user-global across Companies and is the third destination. It collects new activity requiring follow-up: invitations, replies, mentions, suggestions, Channel activity, and task updates. Move Recent Updates into Inbox rather than showing the same update stream in two places.

Use a scannable activity list with clear activity type, person or task, Company/Project/Channel context, and time. Provide useful filters such as All, Unread, Mentions, Replies, Tasks, Suggestions, and Invitations where those types exist. Keep invitation decisions and mark-read behavior attached to the relevant item and show success or failure in place.

An Inbox row opens the exact Channel, Thread, Task, or invitation context that produced the activity. A user-global Inbox query must still check that the user can currently open its linked Project content. Do not leak message previews after access has been revoked.

An empty Inbox is a designed state that says what will appear there. A blank content area is never an acceptable empty state.

### 8. Profile and contextual settings

Profile is the fourth destination. Keep necessary account and profile actions and refine their grouping and feedback. Company and Project settings remain contextual utilities when needed; they do not become additional bottom tabs. Review current Profile and settings actions before moving or removing any of them.

Keep authentication, notifications, theme choice, Company access, and membership management on their approved, permission-aware paths. Do not invent extra Profile sections without a current user need. Exact Profile contents remain an audit item because the discussion established its destination and quality bar, not a final field-by-field inventory.

### 9. Existing Home Project and theme defects

Preserve the Home Project selector's visual style while fixing these previously reported defects:

- Only one Project drawer can be open at a time. Opening another closes the first.
- The open Project drawer shows that Project's Channels. It does not reuse or omit another Project's Channels.
- An expanded drawer does not stretch neighboring cards or change their layout unexpectedly.
- Project cards have enough mobile width for member avatars and the Open Project action to remain visible. No avatar or button may be clipped at supported widths or font scales.
- Switching light and dark theme updates every phone-number input, text field, keyboard appearance, and major action. Colors and contrast must change in the same interaction, without stale surfaces or text.

The plus affordance's accepted Q6.5 recommendation and requested vertical placement are audited alongside these navigation fixes. Do not treat the plus control as permission to add a fifth tab.

## Screen consolidation decisions

| Existing surface or behavior                                                                   | Decision                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current Home presentation                                                                      | Keep its visual language and useful Project patterns; make Conversations the first destination.                                                                                         |
| Home/Today as a separate primary destination                                                   | Fold the first-impression conversation job into Conversations and put today's assigned work in My Tasks. Remove a route only after incoming links and useful actions have replacements. |
| Team Workload                                                                                  | Remove from mobile. Keep only separately approved Project member or access controls in their proper context.                                                                            |
| Standalone Evidence                                                                            | Remove from mobile. Preserve task source links and relevant conversation attachments in context.                                                                                        |
| Standalone Channel list/browser                                                                | Do not keep as a separate destination. Show Channels in Conversations. Keep Channel chat.                                                                                               |
| Standalone Thread browser/list                                                                 | Do not keep as a separate destination. Show Threads in Conversations. Keep Thread chat.                                                                                                 |
| Recent Updates                                                                                 | Fold into Inbox.                                                                                                                                                                        |
| Task statistics                                                                                | Show within My Tasks for the selected Company/Project scope.                                                                                                                            |
| My Tasks                                                                                       | Keep as a primary destination.                                                                                                                                                          |
| Project task board                                                                             | Keep as a distinct Project-wide workflow surface.                                                                                                                                       |
| Task Detail                                                                                    | Keep and redesign.                                                                                                                                                                      |
| Inbox and Profile                                                                              | Keep as primary destinations three and four.                                                                                                                                            |
| Other routes such as search, Project directory/settings, task history, groups, and invitations | Audit route purpose and callers before deciding. Do not delete them by inference. Keep necessary utilities contextual until replacements are proven.                                    |

Removing a mobile route does not authorize deleting stored data, backend functions used by web, or another client's feature. Check deep links, notifications, tests, Expo Router routes, and cross-platform callers before route cleanup.

## Design and interaction rules

### Visual hierarchy and restraint

- Let messages, tasks, and activity carry the screen. Use cards only when they improve grouping or touch clarity.
- Keep one primary visual emphasis per screen. The most important next action must be easy to identify without competing buttons.
- Use consistent type roles, line heights, spacing, icon weights, border radii, and semantic colors from the existing Home design system.
- Use Project dividers and subtle separators to group dense conversation content. Avoid repeatedly enclosing every row in a heavy card.
- Use ghost-style filter controls where requested: quiet at rest, plainly selected, with an adequate touch target and accessible selected state.
- Fit real content: long Project and Channel names, task titles, avatars, localization, and large system text. Prefer wrapping or truncation with access to the full name over clipping.
- Theme colors are semantic. Light/dark changes update the full rendered control tree, including keyboard and primary actions.

### Interaction feedback and motion

- Acknowledge a tap at once with a small local state or color response. Do not make a control wait for a network round trip before it feels pressed.
- Use motion only to explain selection, hierarchy, location, progress, or completion. Peer tab changes feel lighter than navigation into a chat or task detail.
- Project switching keeps the current screen in place, marks the new selection immediately, then shows matching loading feedback until the new scope is ready.
- Use sheets for short filters and choices; use routes for content that needs its own navigation history. Back closes a transient filter first, then follows normal route history.
- Keep gestures optional. Every important swipe action also has a visible control.
- Respect reduced motion. Stop looping motion when the surface is offscreen. Do not use shimmer or animation to mask a stalled request.
- Show a specific recovery action after failure: retry, reopen, retain the draft, or return to the still-valid surface.

### Accessibility and device fit

- Label each tab and control for screen readers, announce selected/expanded/loading states, and preserve logical focus order.
- Keep sufficient text and control contrast in both themes. Do not rely on color alone for unread, status, or selected state.
- Honor font scaling without clipping Project avatars, Open Project buttons, filters, composer controls, or task actions.
- Respect safe-area and keyboard insets. Scroll content must not be obscured by iOS tab surfaces, Android system navigation, or the keyboard.
- Test Android gesture and three-button navigation, and iOS home-indicator/safe-area behavior.

## Information architecture and route map

```text
Signed-in app
├── Conversations (first destination)
│   ├── Company-wide feed
│   ├── Selected Project feed
│   ├── Channel conversation
│   ├── Thread conversation
│   └── Create task from source message
├── My Tasks (Company-scoped, current-user assignments)
│   ├── All Projects / selected Project
│   ├── Attention Needed / Today / full week
│   ├── Assigned task list and status filters
│   ├── Project task board (contextual, Project-wide)
│   └── Task Detail with source conversation
├── Inbox (user-global activity)
├── Profile
└── Contextual utilities
    ├── Company and Project selection/access
    ├── Project directory and settings where required
    ├── Notifications and invitations
    └── Contextual Create task action with Project selection
```

## Implementation plan and phase gates

One approved goal should cover these phases. A phase checkpoint records evidence, open decisions, and the next work. It should not trigger repeated approval requests for decisions already locked here. Do not call the whole goal complete while any required route, permission path, or real-device check remains open.

### Phase 0: Baseline audit and preservation

1. Inventory the current mobile routes, bottom navigation, Home Project carousel, drawers, Channel/Thread/chat paths, task surfaces, Inbox, Profile, theme controls, Convex queries, and role checks.
2. Compare each item in this plan with the current source and connected-device behavior. Label it `working`, `partial`, `missing`, or `unverified` with file and runtime evidence.
3. Separate approved removals from pending route decisions. Check callers and shared web use before changing a route or backend function.
4. Confirm that the plus action keeps the four-destination order, sits at 40% of the bar height, creates in a selected Project, and asks for a Project in Company-wide scope.
5. Preserve all pre-existing staged, unstaged, and untracked work. Leave `docs/DESIGN.md` untouched.

**Exit evidence:** a route and permission matrix, a baseline screenshot set, an exact missing-work list, and a safe file-level change order.

### Phase 1: Navigation, Home patterns, and platform behavior

1. Establish Conversations, My Tasks, Inbox, and Profile in the agreed order and make Conversations the signed-in first screen.
2. Keep the four routes as peer destinations, with each tab preserving its own appropriate navigation state.
3. Implement the iOS glassy rounded treatment and restrained gooey selection; implement the Android flat, non-pill navigation bar with a clear selected state and no glass or gooey motion.
4. Apply the selected-Project task-creation behavior without making the plus a fifth primary destination.
5. Fix Project drawer exclusivity, Project-specific Channel content, neighboring-card layout, avatar visibility, and Open Project clipping.
6. Fix theme propagation for every phone-number input, text field, keyboard, and main action.

**Exit evidence:** visual and interaction checks on iOS and Android at narrow widths and large font scales; no wrong Project Channels, no clipped Project actions, and no stale theme controls.

### Phase 2: Company-wide Conversations

1. Confirm server query contracts for Company, Project, Channel, and Thread scope, access checks, ordering, and bounded pagination.
2. Build the Company selector, search/filter row, Project carousel, ghost filter tabs, Project dividers, Channel pills, and feed rows using Home design tokens.
3. Ensure selecting a Project updates one shared feed with clear selection and loading feedback.
4. Cover all, unread, Channel-only, Thread-only, search, empty, offline, query error, and access-change states.
5. Connect Channel and Thread rows to their required chat routes and retain route context.

**Exit evidence:** a member sees exactly their selected Company's accessible conversations; filters and Project changes return correct data; no stale cross-Project rows or duplicate list surfaces remain.

### Phase 3: Channel/Thread chats and message-to-task flow

1. Refine both chat screens around readable message history, a fixed keyboard-aware composer, quiet metadata, and clear parent context.
2. Implement loading, send, failed-send, retry, attachment, offline, unread, and return-to-feed behavior.
3. Add message-to-task creation with the source Company, Project, Channel/Thread, and message preserved.
4. Verify a task detail can reopen its source only while the user retains access.

**Exit evidence:** a person can open a conversation, send or retry a message, create a task from it, open the task, and return to the same valid conversation context.

### Phase 4: My Tasks, board, and Task Detail

1. Confirm Company-scoped current-user task query and date-range validator, generated API, index, and deployed development contract all match.
2. Implement or refine the Company selector, Project selector, scoped stats, Attention Needed, Today, weekly calendar strip, assigned task filters, and visible task cards.
3. Keep the complete seven-day view visible but subordinate to Attention Needed and Today.
4. Keep Project board distinct and enforce member view-only and capability-based manager/admin/assignee actions in the backend.
5. Refine Task Detail structure, source conversation, task fields, checklists/subtasks, attachments/evidence context, and activity presentation. Confirm before merging comments and task updates into one timeline if the existing data model or product behavior differs.

**Exit evidence:** filters produce consistent counts and rows after pagination completes; partial Company summaries stay visibly labeled with a way to load more; all seven days work; role-denied writes fail server-side; source links survive task updates; blank states distinguish loading from no assigned tasks.

### Phase 5: Inbox and Profile

1. Consolidate invitations, mentions, replies, suggestions, Channel activity, task updates, and Recent Updates into one user-global Inbox model.
2. Add clear activity filters and contextual routes, with safe invitation and read/unread feedback.
3. Audit Profile and settings controls. Preserve account, appearance, notification, and access tasks on a coherent path; do not invent new sections.
4. Check revoked Project access so old Inbox events cannot expose unreadable message content.

**Exit evidence:** each required event type appears once, Inbox remains Company-independent, activity links open permitted content, and Profile retains required account settings.

### Phase 6: Approved route consolidation

1. Remove Team Workload and standalone Evidence from mobile.
2. Consolidate Channel and Thread discovery into Conversations while keeping both chat routes.
3. Put Recent Updates in Inbox and task statistics in My Tasks.
4. Replace the separate Home first-impression destination with Conversations while preserving useful Home design patterns.
5. Audit remaining routes such as Search, Groups, Task History, Project directory/settings, invitations, and notification settings individually. Remove only after purpose, callers, web dependencies, and replacement behavior are verified.
6. Regenerate route declarations and remove obsolete navigation links only after the replacement user paths pass.

**Exit evidence:** no dead route links, no lost approved action, no accidental web/backend deletion, and no remaining standalone destination that duplicates the agreed core surfaces.

### Phase 7: Full verification and completion

1. Run focused behavior and authorization tests for Company/Project scope, Channel inheritance, Thread access, Company task filters, week boundaries, Inbox visibility, role capabilities, and source-conversation links.
2. Run mobile lint, typecheck, tests, production dependency audit, and export/build; run the monorepo gate where practical.
3. Run the app on connected iOS and Android devices or simulators. Verify all four tabs and the full critical journeys in light and dark themes.
4. Test narrow devices, large system text, keyboard and safe-area overlap, Reduced Motion, slow/offline network, empty/error states, drawer exclusivity, and Project avatar/action clipping.
5. Inspect final diffs and worktree status. Preserve unrelated changes and report each unverified path plainly.

**Goal completion evidence:** every locked decision is implemented, every approved route has a working replacement, server authorization and query contracts pass, automated gates pass, and real-device journeys show the intended result. A successful compile alone does not complete the goal.

## Role and capability matrix

| Person's relationship        | Conversation access                                                       | Project board                                      | Task actions                                                         |
| ---------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Project member               | Only joined Channels and their Threads, subject to current backend access | View-only, as agreed                               | Only actions allowed by backend policy for their assignment and role |
| Manager                      | Project/Channel scope allowed by membership                               | Interact when Project permission grants it         | Backend capability decides each write                                |
| Admin                        | Project/Channel scope allowed by membership                               | Interact when Project permission grants it         | Backend capability decides each write                                |
| Assignee                     | Source conversation only while still permitted                            | View or act according to role and board capability | May use backend-authorized task actions                              |
| Non-member or revoked member | Denied                                                                    | Denied                                             | Denied                                                               |

This matrix describes default product intent, not a replacement for the existing capability model. Phase 0 must map the names to actual server-side roles and permissions before implementation changes.

## Quality gates

### Visual and content quality

- The existing Home visual language remains intact and recognizable.
- Conversations is useful on first open and does not require navigating elsewhere to find activity.
- Project names, avatars, Open Project, filters, task titles, and buttons do not clip at supported mobile sizes or text scales.
- Each screen has one clear job and an obvious first action.
- All Company/Project/user scope is visible in context where a selection could change data.
- Theme changes immediately update phone-number inputs, keyboards, text, surfaces, and primary buttons.

### Interaction quality

- Taps get immediate feedback. Search and filter results remain tied to their visible controls.
- Loading is explicit and never masquerades as an empty screen. Empty states explain what belongs there. Errors explain a recovery action.
- Switching Company or Project never briefly presents unauthorized or mislabeled stale content.
- Keyboard, safe area, system bars, and bottom navigation do not cover active content or actions.
- Back, tab re-entry, sheet dismissal, deep links, and route state are predictable on each platform.
- Motion supports state and hierarchy, respects Reduced Motion, and remains smooth on an ordinary device.

### Data, permission, and performance quality

- Backend authorization checks every protected read and write. Client-only visibility never grants access.
- Company-wide queries stay Company-scoped, bounded, paginated, and deterministically ordered.
- Thread content inherits Channel authorization; Inbox previews re-check linked access.
- Task date arguments, Convex validators, generated types, indexes, and deployed development functions agree.
- Lists remain virtualized. Avoid unbounded fan-out or one subscription per Project.
- Creating tasks from conversation is idempotent and retains source context after success or recoverable failure.

### Required journey tests

1. Sign in and land on Conversations with the selected Company and its Projects.
2. Search and filter unread, Channel, and Thread content; select a Project and return to All.
3. Open a Channel and a Thread; send a message and return to the feed.
4. Create a task from a message and open its Task Detail source context.
5. Switch Company and Project in My Tasks; compare stats, Attention Needed, Today, and all seven week days.
6. Open a Project board as a member, manager/admin, assignee, and denied non-member; verify read and write outcomes.
7. Open each Inbox activity type and confirm it routes to the right permitted content.
8. Change themes with every phone-number field and major action in scope.
9. Exercise Project drawers on small screens and confirm one open drawer, correct Channel data, visible avatars, and a fully visible Open Project action.

## Platform research

The four destinations fit common mobile navigation patterns, but the final appearance follows the user's explicit platform decisions. Apple's guidance says tab bars represent top-level destinations and should not be used as action bars; this is why the plus control stays a separate create affordance. Android guidance supports three to five same-level destinations in a navigation bar and recommends adaptive navigation on larger windows. Android edge-to-edge guidance requires system insets to protect content and touch targets. The user's Android-specific direction is stricter for appearance: the bottom bar itself must not be pill-shaped.

- [Apple Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars/)
- [Apple Human Interface Guidelines: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars/)
- [Android Developers: Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [Android Developers: Navigation bar](https://developer.android.com/develop/ui/compose/components/navigation-bar)
- [Android Developers: System bars](https://developer.android.com/design/ui/mobile/guides/foundations/system-bars)
- [Android Developers: Window insets](https://developer.android.com/develop/ui/compose/system/insets)

Research checked: 2026-09-26. Platform rules inform behavior and safe areas; they do not override the approved custom iOS treatment or the explicit non-pill Android bar.
