# Track Web UI/UX Remediation Plan

Date: 2026-09-14  
Status: Remediation slice implemented; final closure remains blocked by environment and parity checks  
Scope: `apps/web` desktop dashboard, its overlays and threads, plus the verification needed to close the parity audit  
Source audit: [`2026-09-14-web-ui-ux-parity-audit.md`](../audits/2026-09-14-web-ui-ux-parity-audit.md)

## Outcome

Track will have one calm, classical-minimal web interface across Company, Project, Channel,
thread, evidence, memory, task, profile, and settings surfaces. A person will always see the
current Company and Project scope, know which navigation item is active, find every important
action with a keyboard or coarse pointer, and receive the same focus, loading, error, success,
overlay, date, status, and notification behavior on every route.

The implementation must preserve the existing Company, Project, Channel, thread, evidence, task,
membership, and authorization model. This is a consistency and usability remediation, not a
product-model rewrite.

## Implementation status

The shared web remediation slice is implemented and verified. It covers the highest-risk gaps
that can be fixed without changing the product model: route-backed Company navigation now uses
links and `aria-current`, raw Company and Project selects use the shared `NativeSelect` contract,
destructive message, task-movement, forward-audience, Company-close, and settings-delete actions
use the shared confirmation dialog, thread and knowledge controls have complete button-group or
tab semantics, message and task actions remain discoverable on keyboard and coarse pointers,
labels expose pressed state, notification items expose filters and direct actions, and profile,
search, timezone, assignee, and thread fields carry stable metadata.

The shared controls also have regression coverage for successful and recoverable confirmation
flows, enum-label formatting, native-select behavior, date-picker behavior, toast feedback, and
the existing task/thread interaction suite. The remaining phases are not silently accepted as
complete: Figma parity, seeded-auth browser coverage for Profile and Project Settings, full
assistive-technology and zoom matrices, large-collection measurements, and the known Convex
pagination failure still need external or backend work.

## Current state and blockers

The audit found a usable shell on the main live surfaces, but it is not closed. The following
conditions must be resolved or deliberately accepted before the final sign-off:

1. The supplied Figma file is not readable by the current connector or browser session. Pixel
   parity, frame coverage, and exact design-token comparison are therefore unproved. Obtain viewer
   or editor access in the connected Figma session before the visual closeout phase.
2. `/profile` and `/workspace/projects/$projectId/settings` cannot establish an authenticated
   session in the latest recheck. The available local origin is rejected by the Convex auth CORS
   policy, and bypassing CORS still presents the signed-out state. Repair the local origin and
   identity bootstrap or supply a stable seeded test identity before accepting those routes.
3. The full repository gate has a known Convex pagination test failure in
   `convex/taskManagement.test.ts:215`. Keep this failure visible and fix it or document an
   approved backend exception before declaring the web remediation complete.
4. The worktree contains unrelated changes. Each implementation step must touch only its owned
   files and must not reset, stash, clean, or overwrite other work.

## Non-negotiable design and engineering rules

1. **One source of truth.** Shared controls, tokens, date formatting, status labels, notification
   rows, and confirmation dialogs must have one owner. Feature CSS may compose those primitives,
   but must not redefine their core geometry.
2. **Scope is visible.** Company, Project, Channel, thread, and task scope must be visible in the
   heading or control context. A user must not infer scope from a selected row or a hidden filter.
3. **Progressive disclosure.** Keep the primary action and decision-critical information visible.
   Put advanced filters, administration, and destructive actions in labelled overlays or sections.
4. **No hover-only actions.** Hover may enhance discovery, but every action must remain available
   by keyboard and on coarse pointers. Touch and keyboard paths must not depend on hover.
5. **Native semantics.** Use links for route navigation, buttons for in-place state changes,
   complete tabs only when a controlled panel exists, and labelled listboxes or native selects for
   choices. Do not apply ARIA roles to partially implemented controls.
6. **Content earns space.** Controls and cards grow to fit content. Use `min-width: 0`, wrapping,
   truncation with a full-value affordance, and bounded scroll only when the user can discover it.
7. **One token ladder.** Control heights, spacing, radii, borders, focus rings, type ramp, status
   colors, and elevations must be semantic light/dark tokens, not route-specific literals.
8. **Feedback is part of the action.** Every async action has idle, pending, success, failure,
   retry, and disabled behavior. Errors use human copy and a next step, not backend enum names.
9. **Verification is evidence.** A route is complete only after a real browser path, keyboard
   path, overlay path, theme path, and automated checks pass. Compilation alone is not proof.

## Severity and sequencing

P0 items block verification and must be fixed before visual parity can be accepted. P1 items affect
navigation, accessibility, data confidence, or destructive actions and must be completed before
polish. P2 items are consistency and refinement work, but they still need regression coverage because
they affect every repeated surface.

Implement in the order below. Each phase ends with a shippable, reversible state and its own gate.

| Phase | Workstream | Main result | Depends on |
| --- | --- | --- | --- |
| 0 | Baseline and test fixtures | Stable auth, seeded data, route inventory, screenshots, and test harness | None |
| 1 | Tokens and shared primitives | One control, overlay, status, notification, and date contract | 0 |
| 2 | Shell and navigation | One active-state, sidebar, context-rail, and scope contract | 1 |
| 3 | Conversation and threads | Complete tabs, message actions, composer popovers, timestamps, and destructive flows | 1, 2 |
| 4 | Tasks and notifications | Consistent board, filters, assignees, labels, drawers, admin, and notification center | 1, 2 |
| 5 | Search, evidence, and memory | Complete tab semantics, source preview, async announcements, and long-content behavior | 1, 2 |
| 6 | Company, profile, and settings | Consistent forms, selects, timezone, appearance, membership, and recovery states | 1, 2, 0 |
| 7 | Layout, content, and responsive hardening | Token cleanup, overflow, zoom, themes, reduced motion, and coarse-pointer behavior | 2 through 6 |
| 8 | Figma parity and final regression | Every route and overlay checked against Figma and the full production gate | 0 through 7 |

## Phase 0: Baseline, access, and deterministic fixtures

### Work

1. Repair the local development identity path used by `auth:syncDevUser`, or add a documented
   seeded identity fixture that can render `/profile` and `/workspace/projects/$projectId/settings`.
   Keep authorization checks server-side; this fixture must not bypass production auth.
2. Create one deterministic Company, two Projects, three Channels, two threads, at least five
   members, 20 tasks spanning all statuses, notifications in read and unread states, evidence of
   every source type, one memory import, archived and unavailable sources, long names, long labels,
   and long message content.
3. Record route and overlay fixtures in a small test data helper owned by `apps/web` tests. Keep
   IDs stable so screenshots and browser assertions do not depend on random data.
4. Capture baseline screenshots at 1440, 1280, 1024, and 860px in light and dark themes for the
   Company overview, Project overview, Channel, thread, Evidence, Memory, task board, task drawer,
   notification center, Profile, Company Settings, and Project Settings.
5. Add a browser-test command or documented manual runner that can open every route with the seeded
   identity and record console errors, document overflow, focus target, and overlay state.

### Acceptance checks

- `/profile` and Project Settings render real content with no `dev_auth_identity_required` error.
- The same fixture can open every route and overlay in this plan without a random or missing record.
- Baseline screenshots and route data are stored outside production assets and do not include secrets.
- Existing web lint, typecheck, and tests still pass after fixture setup.

## Phase 1: Shared design tokens and primitives

### Owned files and components

- `apps/web/src/styles.css`
- `apps/web/src/features/tasks/task-views.css`
- `apps/web/src/features/threads/thread-workspace.css`
- `apps/web/src/components/ui/select.tsx`
- `apps/web/src/components/ui/date-picker.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/sheet.tsx`
- Existing Button, Popover, Tabs, Toast, Input, Badge, and NativeSelect primitives
- A new shared status, notification-row, and confirmation-dialog component only if an existing
  primitive cannot express the contract without duplicating behavior

### Work

1. Define semantic tokens for canvas, surface, raised surface, text, muted text, border, accent,
   success, warning, danger, disabled, focus, overlay, and selection in both themes. Keep Track
   yellow as the accent and ensure every status color has a readable dark and light variant.
2. Define a compact, regular, and large control ladder. Use one baseline input height per context,
   consistent icon box size, padding, label gap, border, radius, and focus ring. Migrate the current
   30, 36, 40, and 42px field variants to named tokens rather than route-specific literals.
3. Standardize the select contract. Prefer the existing accessible Base UI select for custom menus;
   retain native select only where native platform behavior is a requirement, wrapped with the same
   label, dimensions, focus, disabled, and overflow styles. Remove ad hoc arrow and width patches.
4. Give every select trigger a stable width policy: the field fills its column, text can shrink,
   the selected value has a title/full-value affordance, and the chevron never overlaps content.
5. Consolidate DatePicker behavior and formatting. Define locale, timezone, disabled-date,
   today/clear, grid-cell, Escape, outside-click, focus-return, and viewport-collision rules.
6. Define shared `status`, `count`, `scope`, and `filter` pill variants. Centralize enum-to-human
   label and enum-to-color mappings for task status, priority, evidence state, notification type,
   relationship state, and memory processing state.
7. Define one notification row contract with icon, title, supporting metadata, read state, action,
   optional filter state, keyboard focus, and empty state. Use it in Company and task notification
   surfaces.
8. Ensure Dialog, Sheet, Popover, Toast, and picker close controls have a visually compact shape
   but at least a 44px effective hit area. The expanded hit area must not clip at an overlay edge.
9. Remove superseded task and thread rules from the global stylesheet after moving ownership to
   `task-views.css` and `thread-workspace.css`. Do not change unrelated global layout rules.

### Acceptance checks

- A component test proves the same control token values are used by Company forms, task forms,
  thread forms, profile forms, and search fields.
- Every select has a visible focus ring, disabled state, long-value behavior, and consistent menu
  placement.
- Every pill has a semantic variant and passes light/dark contrast review.
- DatePicker opens, selects, clears, closes with Escape, restores focus, handles disabled dates,
  and formats the same date identically in task, evidence, thread, and Company screens.
- No duplicate task board or thread layout block remains in two stylesheet owners.

## Phase 2: Shell, navigation, and scope

### Owned files and components

- `apps/web/src/features/company/CompanyHubPage.tsx`
- `apps/web/src/features/tasks/TaskProjectPage.tsx`
- `apps/web/src/features/workspace/components/WorkspaceSidebar.tsx`
- `apps/web/src/features/company/CompanyProjectConversation.tsx`
- `apps/web/src/routes/workspace.company.settings.tsx`
- Legacy `WorkspacePage` and `CompanyProjectNavigation` components
- `apps/web/src/styles.css` and `company-project-navigation.css`

### Work

1. Make route-backed Company and Project destinations links with `aria-current="page"`. Keep
   `aria-pressed` only for state-only filters or view toggles. Derive visual active styling from the
   same URL/state source so a refresh and browser Back preserve the selected item.
2. Choose a migration boundary for legacy `/workspace/projects/$projectId/*` routes. The default
   is to reuse the Company Project shell and preserve the route as a compatibility entry point.
   If a route must remain legacy, document why and match sidebar width, heading hierarchy, context
   rail, action placement, and theme tokens.
3. Keep Company navigation order stable: Company identity, overview/projects/tasks/threads or the
   approved Company destinations, then profile, appearance, and logout. Preserve the visible footer
   options requested by the product.
4. Make the mobile sidebar a real modal navigation surface. Trap focus, mark the background inert
   while open, close on Escape and outside click, and restore focus to the invoking button.
5. Give the collapsed Project context rail a visible `Context` label or tooltip and an explicit
   `aria-controls` relationship to the controlled panel. Keep Company, Project, and Channel scope
   visible at every collapsed state.
6. Normalize heading scale, sidebar width, rail width, content max-width, and primary-action
   placement across Company overview, Company Settings, Project overview, legacy Project routes,
   Evidence, and tasks.

### Acceptance checks

- Keyboard navigation can reach every route, active state is announced, and browser Back/Forward
  restores the correct view.
- No route presents two competing sidebars or heading hierarchies.
- Opening the mobile navigation makes the page behind it inert and closing it returns focus to the
  trigger.
- The collapsed context rail remains discoverable without hover and exposes its controlled panel.
- Company Settings keeps the shared shell in loading, loaded, unavailable, and error states.

## Phase 3: Conversation, message actions, and threads

### Owned files and components

- `apps/web/src/features/workspace/components/ConversationComposer.tsx`
- `apps/web/src/features/workspace/components/ScopedConversationComposer.tsx`
- `apps/web/src/features/workspace/components/MessageActions.tsx`
- `apps/web/src/features/workspace/hooks/useWorkspaceMessageActions.ts`
- `apps/web/src/features/threads/ChannelThreadBrowser.tsx`
- `apps/web/src/features/threads/CompanyThreadBrowser.tsx`
- `apps/web/src/features/threads/ThreadConversationPage.tsx`
- `apps/web/src/features/workspace/components/CompanyProjectConversation.tsx`
- `apps/web/src/styles.css` and `thread-workspace.css`

### Work

1. Replace partial thread tab semantics with either a complete controlled tablist or a labelled
   button group. The recommended implementation uses a complete tablist: `aria-controls`, roving
   `tabIndex`, ArrowLeft/Right, Home/End, Enter/Space, selected styling, and a labelled panel.
   Apply the same contract in Channel, Company thread rail, and focused thread views.
2. Make unread state an accessible part of the thread link name. Keep the visual dot decorative;
   do not rely on `aria-label` on a generic `<i>` element.
3. Keep message actions discoverable without hover. On coarse pointers, show an overflow button;
   on fine pointers, reveal it on hover and focus but reserve its layout space. Ensure keyboard users
   can open Copy, Select, Forward, Create Task, and Delete without pointer movement.
4. Replace the custom message-action focus suppression with the shared measured focus ring. Check
   forced-colors and dark-theme contrast.
5. Give emoji, mention, forward, and message-action surfaces one labelled Popover/Dialog contract:
   focus entry, Escape, outside click, focus containment where modal, focus return, viewport collision,
   and no clipping inside a scroll container.
6. Replace `window.confirm` in `ThreadConversationPage.tsx` with the shared destructive Dialog. Show
   the message context, Cancel/Delete actions, pending state, failure recovery, and focus return.
7. Replace `toLocaleString()` in `ThreadConversationPage.tsx` with the shared formatter and add a
   machine-readable `dateTime`. Use one locale/timezone policy across thread, task, evidence,
   invitations, and memory timestamps.
8. Map thread and message backend errors to human copy with a next step. Preserve the original
   cause in logs without exposing internal categories.
9. Add stable `name`, `autoComplete`, and placeholder metadata to thread search/create fields. Use
   current Company, Project, or Channel scope in helper copy when the surrounding header is hidden.

### Acceptance checks

- The Channel and focused thread tab paths pass keyboard tablist tests and screen-reader semantics.
- Message actions are usable at mouse, keyboard, touch, and coarse-pointer emulation widths.
- Emoji, mention, forward, and action popovers open and close without focus loss or clipping.
- Delete uses the shared confirmation dialog and never opens a browser-native confirmation.
- A long message, author name, thread name, and timestamp remain readable and do not shift the
  composer or hide required actions.

## Phase 4: Tasks, board, drawers, and notifications

### Owned files and components

- `apps/web/src/features/tasks/TaskProjectPage.tsx`
- `apps/web/src/features/tasks/TaskBoard.tsx`
- `apps/web/src/features/tasks/TaskCreateDialog.tsx`
- `apps/web/src/features/tasks/TaskDetailDrawer.tsx`
- `apps/web/src/features/tasks/TaskAdminDialog.tsx`
- `apps/web/src/features/tasks/ConversationTaskActions.tsx`
- `apps/web/src/features/tasks/task-views.css`
- Related notification and task settings components

### Work

1. Give the task filter bar a responsive contract. Group filters by status, priority, date, and
   scope; allow a controlled wrap or a labelled More filters popover; show the active-filter count;
   preserve filter order; and keep clear-all visible. Do not hide controls in an undiscoverable
   horizontal scroller.
2. Make board movement controls consistent with message actions. Reserve space or use one overflow
   button, support keyboard movement and drag alternatives, and keep action visibility stable.
3. Replace native `window.confirm` in `TaskBoard.tsx` when moving a task with open subtasks. The
   dialog must name the task, state the open-subtask count, explain the consequence, and provide
   Cancel/Move actions with pending and failure states.
4. Add `aria-pressed` and a visible selected state to task label chips in Create Task and Task Drawer.
   Use the shared status/pill variants and keep labels readable when many are selected.
5. Apply one assignee field width policy to Create Task, Task Drawer, Chat Task, and filters. Verify
   Unassigned, long names, represented-company suffixes, missing avatars, and disabled loading state.
6. Add stable field names, autocomplete metadata, descriptions, and first-invalid focus to task
   forms. Make source evidence and the originating message visible when creating a task from chat.
7. Complete Task Admin keyboard reorder and overflow behavior at 1024px and 200% zoom. Announce
   reorder success or failure in a shared live region.
8. Replace the task notification implementation with the shared notification row. Keep filters,
   read/unread state, Clear all, Mark all read, direct task navigation, keyboard focus, Escape,
   outside click, loading, no-match, and failure retry consistent with the Company notification
   center.
9. Ensure the Task Drawer keeps its 520px desktop boundary, contained scroll, sticky action area,
   comment mention listbox, evidence links, and activity history without clipping or nested scroll
   traps.
10. Centralize task status, priority, due-date, and notification labels. Do not display raw enum
    strings or underscore replacements.

### Acceptance checks

- Board, List, My Tasks, Suggestions, and filtered empty states preserve scope in the URL and heading.
- Every task action works by mouse, keyboard, touch, and coarse pointer. Drag has a keyboard or menu
  alternative.
- Create Task, Create Task from Chat, Task Drawer, Task Admin, and notification popovers share the
  same field, pill, overlay, and error contracts.
- Unassigned and long assignee labels do not truncate the field or overlap the chevron.
- Open-subtask movement uses the shared dialog and returns focus to the task card after completion.
- Notification filters and read-state actions are announced and navigate to the correct task.

## Phase 5: Search, evidence, memory, and source preview

### Owned files and components

- `apps/web/src/features/workspace/pages/ProjectEvidencePage.tsx`
- `apps/web/src/features/workspace/components/ProjectSearchDialog.tsx`
- `apps/web/src/features/workspace/components/ChatSearchPopover.tsx`
- `apps/web/src/features/workspace/components/ProjectMemoryImportDialog.tsx`
- Evidence Preview Sheet and shared result/status components

### Work

1. Complete Evidence/Memory tab semantics with Arrow, Home, End, selected focus, panel
   relationship, and focus retention after switching.
2. Add a named live region for async search result replacement, loading, empty, error, and filter
   changes. Keep the active result stable and return focus to the invoking result after closing a
   source preview.
3. Make Search Hub scope explicit for messages, threads, tasks, files, people, Projects, and
   Channels. Preserve the current Company, Project, and Channel scope in the query and result copy.
4. Standardize Evidence Preview metadata: source type, author, date, availability, provenance,
   linked task, archive/unavailable state, and Open original source. Long quotes must wrap or scroll
   within a bounded region without pushing footer actions off screen.
5. Complete Import Memory states for Text, Links, and Files: validation, processing, success,
   partial failure, retry, access boundary, source provenance, and scope. Keep the checkbox and
   input labels tied with `aria-describedby`.
6. Use shared pills and status labels for evidence scope, processing state, archive state, and
   source type. Do not use raw backend values.

### Acceptance checks

- Search results announce replacement and maintain keyboard position.
- Every result type opens the correct original message, thread, task, file, person, Project, or
  Channel and preserves scope.
- Evidence Preview works for available, archived, unavailable, long-quote, and missing-author
  fixtures.
- Memory import covers validation, pending, success, partial failure, retry, and denied access.
- Evidence/Memory tabs pass Arrow, Home, End, Escape, and focus-return checks.

## Phase 6: Company, profile, appearance, and settings forms

### Owned files and components

- `apps/web/src/routes/workspace.company.settings.tsx`
- `apps/web/src/features/company/CompanyForms.tsx`
- `apps/web/src/features/company/ProjectOwnershipPanel.tsx`
- `apps/web/src/features/profile/ProfileSettingsPage.tsx`
- `apps/web/src/features/company/CompanyHubPage.tsx`
- Project Settings and Company Project administration components
- Shared appearance, dialog, select, and confirmation primitives

### Work

1. Migrate raw Company and Project form selects to the shared select contract, including relationship
   linking, ownership, role, status, invitation, and access controls. The relationship field must
   explain that it links a task or Project to an existing Project relationship and show its selected
   value or empty state clearly.
2. Add stable `name`, `autoComplete`, placeholder, description, and error metadata to profile
   display name, designation, bio, Company identity, description, handle, and membership fields.
   Size the description input to match neighboring inputs while allowing the content area to grow
   deliberately where multiline text is required.
3. Rebuild timezone selection on the shared combobox/listbox contract. Add visible option focus,
   search, no-result copy, Escape/outside close, viewport collision handling, and focus return.
4. Keep System, Light, and Dark appearance options visible in the sidebar/profile menu. Verify the
   menu item radio semantics, theme persistence, initial system preference, and no flash or unreadable
   contrast during a theme switch.
5. Standardize Company notification behavior with filters, read state, direct View action, Clear
   all, and empty/error states. Preserve the notification-before-channel-name treatment in the
   sidebar and ensure its accessible name includes the unread state.
6. Complete Company and Project settings disclosures for membership, roles, invitations,
   relationships, evidence, notifications, archive, snapshots, restore, failed recovery, and
   Company exit. Destructive actions use the shared dialog, not browser confirmation.
7. Ensure loading, unavailable, denied, and error states retain the shared shell and do not render a
   blank or structurally different page.

### Acceptance checks

- Profile and both settings routes render with the seeded identity and no auth bootstrap error.
- Every form has the correct field name, label, description, error association, first-invalid focus,
  pending state, success feedback, and retry path.
- Relationship and ownership controls explain their purpose and never appear as an empty unlabeled
  input.
- Appearance changes work in System, Light, and Dark modes and persist through refresh.
- Company and Project recovery flows cover archive approval, snapshot, restore, retry, failure, and
  Company exit boundaries with explicit authorization feedback.

## Phase 7: Layout, content, accessibility, and responsive hardening

### Work

1. Remove remaining feature-level geometry literals that conflict with semantic tokens. Keep one
   spacing rhythm, radius ladder, type ramp, baseline, and content max-width across all shells.
2. Apply `min-width: 0`, `overflow-wrap: anywhere`, safe line clamping, and full-value tooltips or
   details views to Company names, Project names, thread names, task titles, user names, status
   labels, message text, evidence quotes, and select options.
3. Test 860, 1024, 1280, and 1440px desktop widths plus 200% and 400% zoom. Prefer wrapping and
   grouped controls before hidden horizontal overflow. Any intentional scroll region must expose a
   visible affordance and retain keyboard access.
4. Check all close controls and icon-only controls for a 44px hit area, accessible name, pressed or
   expanded state, and no clipping at the viewport edge.
5. Check light, dark, forced-colors/high-contrast, and reduced-motion modes. Do not add broad
   transitions. Respect reduced motion for drawers, popovers, toasts, and state changes.
6. Add live-region ownership for async mutation, search, upload, import, notification, and failure
   feedback. Do not duplicate announcements from nested components.
7. Measure large collections with 500 and 1000 tasks, threads, notifications, and evidence rows.
   Bound queries, avoid hidden N+1 work, keep scroll and focus responsive, and use virtualization
   only when measurement proves it is needed.

### Acceptance checks

- No document-level horizontal overflow exists at approved desktop widths or 200% zoom.
- Every important action remains available at coarse pointer, keyboard-only, and forced-colors
  modes.
- Long and translated content does not overlap, silently disappear, or hide a required action.
- Reduced-motion checks show no disallowed movement, and all state feedback remains understandable
  without animation.
- 500/1000-record runs meet the agreed interaction budget and show bounded network/data work.

## Phase 8: Figma parity and final regression closeout

### Preconditions

- Figma viewer/editor access works in the connected session and the actual frames, components, and
  variables are visible.
- The seeded identity and deterministic data can open every route and overlay.
- Phases 1 through 7 are complete and their focused checks pass.

### Work

1. Inventory every Figma frame, component, modal, drawer, popover, bottom sheet, and variant. Map
   each to a route or shared component. Record deliberate differences when the web product contract
   requires behavior not shown in the frame.
2. Compare Company overview, Company Settings, Project overview, Channel, thread, Search, Evidence,
   Memory, task board/list, Task Drawer, Create Task, notifications, Profile, Project Settings,
   Company Settings, participation, and recovery at the same viewport and theme as the Figma frame.
3. Compare measurable geometry: sidebar and rail widths, content insets, control heights, type sizes,
   line heights, border/radius, icon boxes, focus rings, overlay width, overlay scrim, and sticky
   footer position. Fix token or component causes rather than adding route-specific offsets.
4. Run the entire route and overlay matrix below in light and dark themes, keyboard-only mode,
   reduced motion, 200% zoom, long-content fixtures, and failure-injection fixtures.
5. Run the required repository gate. Fix the known Convex pagination failure or obtain an explicit,
   time-bounded exception with owner and recovery plan. Do not hide or weaken the test.
6. Inspect the final diff, generated files, secrets, console errors, network errors, and worktree
   status. Do not commit or deploy unless separately authorized.

## Route regression matrix

Every row needs a real browser result, not only a source inspection. For each route verify initial
loading, populated, empty, error, denied, and long-content states where applicable.

| Route or surface | Required regression checks |
| --- | --- |
| `/sign-in` | Keyboard order, labels, invalid credentials, pending state, password visibility, OAuth/error state, focus recovery, 320px containment, high contrast. |
| `/two-factor` | Code entry, invalid code, resend pending/success/failure, recovery action, focus after error, Back behavior. |
| `/profile` | Identity load, save success/failure, field errors, timezone search, appearance System/Light/Dark, logout confirmation, focus return. |
| `/onboarding/profile` | Same profile validation with onboarding completion and no premature navigation. |
| `/workspace/company` | Active nav, search, Company switch, notification popover, appearance menu, project card actions, empty/error states, no overflow. |
| Company Projects, Relationships, People | Search, filters, create/edit/invite dialogs, selected row state, role/status labels, relationship purpose, long names, empty states. |
| `/workspace/company/settings` | Shared shell in loading/loaded/error states, anchor navigation, identity, members, roles, invitations, relationships, recovery, danger confirmation. |
| Project overview | Scope heading, channels, participating Companies, shortcuts, Company threads rail, collapsed rail label and `aria-controls`. |
| Channel conversation | Unread-before-name, channel tabs, message actions, composer attachments/voice/mention/emoji, send pending/success/failure, coarse pointer. |
| Focused thread | Source context, complete tabs if present, replies, rename/archive, delete confirmation, timestamps, source navigation, back/focus return. |
| Project Channels | Create/edit/archive, selected Channel scope, validation, long Channel names, empty results, dialog focus. |
| Evidence hub | Evidence/Memory tab keyboard contract, filters, source states, search, preview drawer, source navigation, long quote. |
| Memory import | Text/Links/Files, scope, validation, processing, success, partial failure, retry, denied access, Escape/focus return. |
| Search Hub and Chat Search | Scope visibility, result type grouping, async announcement, empty/error, active result, source navigation and return focus. |
| Task board/list/My Tasks/Suggestions | URL view state, filters, active count, clear-all, board movement, keyboard alternative to drag, 500/1000 rows, empty states. |
| Create Task/Create Task from Chat | Labels, assignee width, dates/picker, evidence link, pending/success/failure, first-invalid focus, task navigation. |
| Task Detail Drawer | Sheet focus, field controls, Unassigned/long assignee, labels `aria-pressed`, subtasks, comments/@mention, evidence, activity, conflict/error retry. |
| Task Admin | Workflow row keyboard reorder, overflow at 1024px/200% zoom, validation, pending/error announcements, cancel/focus return. |
| Task notification center | Open/close, filters, unread/read, Clear all, Mark all read, direct navigation, no-match/error, Escape/focus return. |
| Project Settings | Authenticated render, details, membership, Channels, access, evidence, notifications, archive, recovery, Company exit authorization. |
| Participation/recovery | Owner/member/invite states, archive approval, snapshot, restore, retry/failure, denied actions, explicit Company boundary. |
| Legal/support/deletion | Long content, links, responsive containment, deletion warning and confirmation, error/pending state, focus return. |

## Overlay regression matrix

For every overlay, run: open by mouse and keyboard, focus entry, labelled title/description,
loading, validation error, success, failure/retry, empty state, long content, internal scroll,
Escape, outside click where allowed, close-button hit target, focus return, theme contrast, reduced
motion, and 200% zoom.

| Overlay family | Additional assertions |
| --- | --- |
| Create/Edit Project, Channel, Company, relationship, member, and invite | Correct scope remains visible; first invalid field receives focus; async save cannot double-submit; destructive actions use shared Dialog. |
| Create Task and Create Task from Chat | Assignee and labels remain readable; source evidence link survives creation; success opens or links to the created task. |
| Task Admin | Keyboard reorder has an equivalent to drag; dense rows do not clip at 1024px or 200% zoom. |
| Task Drawer | Sheet focus is contained; comment mention listbox is keyboard usable; sticky actions remain visible; server conflict has retry. |
| Company and task notifications | Same row, filter, read-state, empty, and focus contract; direct navigation closes safely and preserves return context. |
| Project Search and Chat Search | Result replacement is announced; active result is stable; opening and closing a source returns focus. |
| Import Memory and Evidence Preview | Long quote/source metadata is bounded; unavailable/archived copy explains the next step; footer action remains reachable. |
| Timezone and DatePicker | Complete listbox/grid keyboard behavior, disabled states, locale/timezone policy, viewport collision, Escape, and focus return. |
| Emoji, mention, forward, and message actions | One close contract, coarse-pointer access, no scroll-container clipping, selected/copy success feedback, and focus restoration. |
| Logout, delete, move, archive, restore, and Company exit | Explicit consequence, authorization boundary, pending state, retry/failure, Cancel/Delete or equivalent, and no browser-native confirmation. |

## Test strategy and evidence

### Automated unit and component checks

- Test enum-to-label and enum-to-color mappings for every status, priority, notification, evidence,
  relationship, memory, and recovery state.
- Test tokenized control dimensions, select long-value handling, assignee width, pill variants, and
  close-button hit areas.
- Test tablist Arrow/Home/End behavior, selected focus, `aria-controls`, and panel association.
- Test label chips with `aria-pressed`, unread accessible names, filter counts, and clear-all behavior.
- Test DatePicker, timezone listbox, Popover, Dialog, Sheet, and Toast open/close/focus behavior.
- Test human error mapping and preservation of retry context without exposing backend categories.

### Browser and integration checks

- Use the deterministic identity and data from Phase 0 to execute every route and overlay in the
  matrices above.
- Assert no uncaught console error, no unexpected network error, no document overflow at approved
  widths, and correct focus after open/close/mutation.
- Exercise mouse, keyboard-only, touch/coarse pointer, light/dark, reduced motion, and 200% zoom.
- Inject server failures for save, delete, move, invite, search, import, notification actions,
  archive, restore, and Company exit. Verify retry and focus recovery.
- Exercise 500 and 1000 record fixtures for tasks, threads, notifications, and evidence. Record
  render latency, scroll responsiveness, query count, and memory behavior.

### Accessibility checks

- Run the repository's available automated accessibility checks and inspect the resulting DOM.
- Verify visible focus, accessible names, role/state/value, live-region announcements, modal
  containment, focus return, contrast, forced colors, zoom, and reduced motion manually in a real
  browser.
- Confirm every icon-only control, status, unread marker, and scope indicator has a useful accessible
  name or is explicitly decorative.

### Visual checks

- Capture the same route at 1440, 1280, 1024, and 860px in light and dark themes.
- Compare tokens and geometry against the Figma frames after access is restored. Use measured
  differences for widths, insets, type, line height, radius, border, icon boxes, overlay scrim, and
  sticky action placement.
- Fix the shared token or primitive when a repeated mismatch appears. Do not add a one-off offset to
  a single route unless the product contract requires it and the reason is documented.

## Delivery, rollback, and decision gates

1. Keep each phase in a focused diff. Do not run repository-wide formatters or broad refactors.
2. Before each phase, inspect `git status` and the relevant diff. Preserve unrelated changes.
3. If a primitive migration causes a route regression, revert only that phase's owned files or use a
   feature flag for the new control contract. Do not reset the shared worktree.
4. Do not deploy, mutate production data, change production configuration, or commit without the
   user's explicit authorization for that exact action.
5. Stop and request a decision at these gates:
   - Figma viewer/editor access or an approved alternative visual source.
   - Development identity provider or seeded identity ownership.
   - Select primitive choice if native and custom behavior cannot share one contract.
   - Legacy Project shell migration versus a documented permanent boundary.
   - Whether the known Convex pagination failure is included in this release or tracked as an
     approved backend blocker.

## Definition of done

This remediation is **Done** only when all statements are true:

- Every P0 and P1 finding in the audit has a code change, test evidence, or a named approved
  exception with owner, reason, risk, and expiry.
- Every P2 consistency finding has one shared implementation and regression coverage.
- Every listed route, drawer, dialog, sheet, popover, picker, disclosure, and thread path passes its
  route or overlay matrix in a real browser.
- Figma frames are readable and the measured visual comparison is complete, or a deliberate product
  decision records the approved difference.
- Company, Project, Channel, thread, evidence, task, profile, settings, and recovery scopes remain
  visible and authorization boundaries remain enforced server-side.
- All important actions work with mouse, keyboard, touch/coarse pointer, light/dark themes,
  forced-colors, reduced motion, long content, and 200% zoom.
- The web lint, typecheck, test, audit, and build gates pass. The root Convex pagination test is
  fixed or has an approved, time-bounded exception.
- The final diff contains no secrets, debug output, generated junk, unrelated work, or stale
  documentation, and the final worktree status is reported honestly.

## Final handoff evidence

The closeout must include:

1. A list of changed shared primitives and feature files.
2. A route and overlay matrix with pass, fail, blocked, or approved-exception status for every row.
3. Light/dark, keyboard, coarse-pointer, zoom, reduced-motion, long-content, and failure-injection
   evidence.
4. Figma frame comparison evidence and every deliberate difference.
5. Automated gate output, including any remaining backend blocker.
6. A short rollback note for each phase that changed shared controls or route shells.
