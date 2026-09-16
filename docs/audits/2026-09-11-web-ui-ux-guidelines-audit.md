# Track Web UI/UX Audit

Date: 2026-09-12  
Scope: `apps/web/src` and the web application’s public assets  
Standard: Vercel Web Interface Guidelines (retrieved 2026-09-12), WCAG 2.2 AA, WAI-ARIA APG, and the repository UI standard.

## Status

This document records both the source audit and the remediation pass. The Company workspace, its restored shared sidebar, and the corrected task-form validation pass the focused automated and live desktop checks described below. The required repository gate is not green because two Convex task-management tests fail. The audit is not fully closed because those failures and the full assistive-technology, zoom, theme, long-content, and large-data matrix remain open.

## Audit coverage and evidence

- Static scope: 212 files under `apps/web/src` (203 TypeScript/TSX files and 9 CSS files), including 27 route files, 25 shared UI primitives, and the company, tasks, threads, workspace, and profile feature areas.
- Rules source: the installed `web-design-guidelines` skill and its current upstream command document: <https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md>. The review checked the skill's accessibility, focus, forms, animation, typography, content, images, performance, navigation, touch, responsive, theme, locale, and anti-pattern rules.
- Evidence type: source inspection with exact line references, the web lint/typecheck gate, repository test/build results from the current UI work, and a partial Playwright verification on the local app. Static inspection and the partial browser pass cannot prove contrast ratios, complete focus behavior, screen-reader output, layout at every breakpoint, or browser history behavior.
- Browser coverage: the primary design target is the desktop dashboard. The live checks cover the desktop task modal overlay, date-grid keyboard selection, task drawer mention selection, workspace rail, notification filters, and the Company workspace controls. The 320px checks remain overflow safety checks only. Complete the wider desktop theme, zoom, long-content, and assistive-technology matrix before treating the audit as closed.

## Surface inventory

| Surface | Routes/components reviewed | Main risk themes |
| --- | --- | --- |
| Public and auth | sign-in, two-factor, profile, legal/support routes | autofill, async errors, focus, destructive account actions |
| Workspace shell | sidebar, header, rail, route recovery, loaders | scope clarity, navigation semantics, mobile focus, large lists |
| Conversation | composer, message actions, media, threads, voice notes | mention comboboxes, send state, attachment layout, keyboard paths |
| Company and project | company hub, project navigation, administration, migration | represented-company context, tab state, dense controls, destructive actions |
| Tasks | create/admin dialogs, board, inbox, task drawer, date picker | keyboard board movement, form validation, date-grid semantics, pagination |
| Search and evidence | project search, chat search, evidence pages | scope disclosure, URL state, result focus, large result sets |

## Executive assessment

Track has a sound semantic base: most actions use real buttons or links, shared UI primitives exist, loading and error components are present, and the workspace separates company, project, channel, thread, evidence, and task areas. The remaining risk is inconsistency at the shared-control and state-management layers. Locale formatting, dense task/workspace surfaces, incomplete custom-widget semantics, and state held only in React state still need product-wide proof.

The highest-risk findings are:

1. The workspace has several custom controls whose keyboard, focus, and URL-state behavior must be proven across desktop and mobile widths.
2. The shared Button, Badge, Toggle, and dropdown primitives now use explicit transition properties, but focus replacement and reduced-motion behavior still need browser proof everywhere they are composed.
3. The shared date picker now formats labels with the runtime locale, but other date/time surfaces still need one documented locale and timezone policy before translated UI can be trusted.
4. Large task, project, thread, and search collections need an explicit virtualization or bounded-pagination review.
5. Visual hierarchy is split across multiple navigation and context controls, increasing the chance that users lose the active Company, Project, or Channel scope.

## Desktop dashboard rail information architecture

The desktop dashboard should make the selected Company and Project the stable context, then expose work that helps a user decide what to open next. The right rail should not duplicate the main task board because that creates two competing task destinations and consumes the narrowest content column. The implemented order is:

1. Company and Project context: show the selected company name and a short scope sentence so every rail item has an explicit authorization boundary.
2. Recent references: keep the existing attachment list because it gives the active conversation durable evidence without competing with the main timeline.
3. Company threads: show all active or archived threads visible to the selected Project membership, with channel name, reply count, unread state, search, and status tabs. Each row opens the canonical thread route, so the rail is a navigator rather than a second conversation view.
4. Notifications: expose the notification control in the rail toolbar. When the task notification modal opens, show push preference, event type, and read-state filters in that same popover so the user does not have to discover a second filter control.

Useful later additions should earn their space through a concrete workflow: a saved-view switcher for recurring searches, a compact Project health/status summary linked to the authoritative settings route, and a small “needs attention” list that combines unread threads with explicit assignment or mention signals. Avoid adding member rosters, duplicated task lists, generic analytics, or decorative activity feeds until a user action and owner are defined for each one. The rail should remain a focused launch surface with bounded lists, clear counts, and one-click routes.

## Severity model

- Blocker: prevents a primary task, creates a serious accessibility failure, or risks exposing the wrong scope.
- High: likely failure for keyboard, screen-reader, responsive, localization, or stateful workflows.
- Medium: material friction, inconsistency, performance risk, or missing state.
- Low: polish that improves clarity but does not block completion.

## Shared primitives

### `apps/web/src/components/ui/button.tsx`

- `apps/web/src/components/ui/button.tsx:7` - the broad transition was replaced with explicit properties in the remediation pass; verify the focus ring, pressed transform, and reduced-motion result in a browser.
- `apps/web/src/components/ui/button.tsx:7` - the base class includes `outline-none`; every Button usage must retain the provided `focus-visible` replacement, and this contract is not documented or tested.
- `apps/web/src/components/ui/button.tsx:7` - the primitive now includes `touch-manipulation`; verify tap feedback and focus rings on representative mobile controls.
- `apps/web/src/components/ui/button.tsx:7` - the primitive allows icon-only content without enforcing an accessible name; add a development-time guard or a documented requirement in the component contract.

### `apps/web/src/components/ui/badge.tsx`

- `apps/web/src/components/ui/badge.tsx:8` - the broad transition was replaced with explicit properties; verify status changes do not animate unrelated layout properties.
- `apps/web/src/components/ui/badge.tsx:8` - badges are used for status and counts; confirm that no meaning is conveyed by color alone and that status text remains present for screen readers.

### `apps/web/src/components/ui/toggle.tsx`

- `apps/web/src/components/ui/toggle.tsx:9` - the broad transition was replaced with explicit properties; verify `aria-pressed`, focus, and reduced motion in each caller.
- `apps/web/src/components/ui/toggle.tsx:9` - the toggle relies on data attributes for selected styling; verify `aria-pressed`, keyboard activation, and a visible `focus-visible` state in every caller.

### `apps/web/src/components/ui/dropdown-menu.tsx`

- `apps/web/src/components/ui/dropdown-menu.tsx:35` - `outline-none` is safe only if Base UI's focus-visible styling is guaranteed in the rendered menu; add a regression test that opens the menu with keyboard and visibly moves focus through every item.
- `apps/web/src/components/ui/dropdown-menu.tsx:43` - long menus have a max height but no documented scroll/focus behavior; verify that the focused item scrolls into view and that the menu does not trap the page scroll.

### `apps/web/src/components/ui/dialog.tsx`

- `apps/web/src/components/ui/dialog.tsx:55` - the dialog has `outline-none` with an explicit focus-visible ring; confirm the dialog title/description, initial focus, return focus, Escape behavior, and screen-reader announcement in a browser test.
- `apps/web/src/components/ui/dialog.tsx:55` - the dialog now uses `overscroll-contain` with bounded dynamic viewport scrolling; verify wheel/touch scroll chaining and long-content behavior in the browser.
- `apps/web/src/components/ui/dialog.tsx:55` - zoomed text and long translated content must be tested at 200% and 400%; the fixed `calc(100%-2rem)` width and nested padding may clip the action row.

### `apps/web/src/components/ui/date-picker.tsx`

- `apps/web/src/components/ui/date-picker.tsx:98` - the date label now uses the runtime locale through `Intl.DateTimeFormat(undefined, ...)`; keep the calendar/time-zone policy explicit when the application locale service is introduced.
- `apps/web/src/components/ui/date-picker.tsx:71-150` - the calendar now has a keyboard regression test for roving focus, ArrowRight, Enter selection, grid semantics, and clearing. Add Home/End, PageUp/PageDown, and focus-restoration assertions if the picker gains more navigation behavior.
- `apps/web/src/components/ui/date-picker.tsx:89` - `role="grid"`, row/column headers, gridcells, selected state, and roving `tabIndex` are now present. Disabled-date semantics remain open because the current picker has no disabled-date rule.
- `apps/web/src/components/ui/date-picker.tsx:112-113` - Today and Clear have predictable focus order, and the picker now announces selection and clearing through a polite status region.

### Confirmed control and form findings

- `apps/web/src/components/ui/dialog.tsx:55` and `apps/web/src/components/ui/sheet.tsx:57` - popup and sheet motion now has explicit properties and a reduced-motion primitive override; verify the composed focus and scroll behavior in a browser because static CSS cannot prove the user-visible result.
- `apps/web/src/components/ui/select.tsx:45` - the trigger now has a minimum width and a constrained value; verify long assignee, project, status, and relationship labels at narrow widths.
- `apps/web/src/features/workspace/voice-notes.tsx:205-213` - the icon-only record button now has an explicit accessible name; verify the focus ring and recording state announcement.
- `apps/web/src/features/workspace/components/ConversationComposer.tsx:209-212` - automatic focus was removed so route mounts do not open the mobile keyboard; verify explicit open/reply flows still focus the intended input.
- `apps/web/src/features/profile/ProfileSettingsPage.tsx:593-675` - the timezone picker now exposes a searchable combobox/listbox, ArrowUp/ArrowDown/Enter/Escape behavior, outside-click dismissal, active descendant, and focus return. Verify the spoken result count and long-list scroll in the browser.
- `apps/web/src/features/tasks/TaskDetailDrawer.tsx:448-492` - the mention textarea now exposes combobox, listbox, active-descendant, and option-ID wiring. Add browser regression coverage for clipping, pointer selection, and focus restoration before closing the finding.
- `apps/web/src/features/workspace/components/ConversationComposer.tsx:271-321` - the general composer now exposes the same combobox/listbox relationships as task comments. Keep both surfaces on one shared anchored primitive so clipping and keyboard behavior do not drift.
- `apps/web/src/features/company/CompanyProjectConversation.tsx:320-342` - the context tablist now implements Left/Right, Home/End, roving `tabIndex`, and focus-on-activation. Keep this keyboard contract covered if the tab set changes.
- `apps/web/src/features/profile/ProfileSettingsPage.tsx:217,535-549` and `apps/web/src/features/company/CompanyHubPage.tsx:135-178` - profile panels and Company views now synchronize with route search parameters (`panel` and `view`). Verify refresh, deep link, browser back, and opening a shared URL in the live route.
- `apps/web/src/features/workspace/components/WorkspaceSidebar.tsx:415-464` - profile navigation now uses the router link; verify browser-history, open-in-new-tab, prefetch, and focus restoration behavior in the live route.
- `apps/web/src/features/workspace/components/ConversationComposer.tsx:366-379` - the composer still wraps direct actions in a class named `track-composer-more-menu`; verify the rendered DOM has no hidden details/summary trigger and that attachment, memory import, voice, mention, and emoji actions remain reachable at 320px without wrapping over the send button.
- `apps/web/src/features/workspace/search/ChatSearchPopover.tsx:44` and `apps/web/src/features/workspace/search/ProjectSearchDialog.tsx:153-159,188` - the placeholders and loading copy now use the single ellipsis character (`…`). Keep this as a typography regression check when search copy changes.
- `apps/web/src/features/company/CompanyForms.tsx:46-69,85-118,146-173,545-596` - the audited Company inputs now have stable names and autocomplete tokens; verify autofill, email spellcheck, and preserved values after rejected submissions in the browser.
- `apps/web/src/features/tasks/TaskCreateDialog.tsx:110-143` and `apps/web/src/features/tasks/ConversationTaskActions.tsx:124-130` - task creation fields now have stable names and inline validation structure; verify first-error focus, preserved values, and request-state transitions.
- `apps/web/src/features/tasks/TaskDetailDrawer.tsx` and `apps/web/src/features/tasks/TaskAdminDialog.tsx` - task comments, subtasks, Project boards, labels, and workflow saves now keep their submit actions available until a request starts. Empty submission produces an associated inline alert, marks the field invalid, and focuses the first invalid field. The authenticated desktop regression pass confirms these states for all five paths without creating records.
- `apps/web/src/routes/two-factor.tsx:77-100` - the two-factor field now has a stable name, `aria-describedby`, and assertive alert output; verify that invalid-code focus and retry behavior remain stable.
- `apps/web/src/features/workspace/thread-item-components.tsx:241-245` - attachment images now reserve explicit dimensions; verify lazy loading and decoding policy for large, below-the-fold media before adding it globally.
- `apps/web/src/features/profile/ProfileSettingsPage.tsx:793` - the authenticator QR image now reserves an explicit box; verify the security panel remains stable at 200% zoom and with translated helper copy.
- `apps/web/src/components/ThemeToggle.tsx:88-110` and `apps/web/src/features/company/CompanyProjectNavigation.tsx` - the Project and Company workspace sidebars now expose one explicit Appearance menu with System, Light, and Dark radio choices. The selected mode is persisted in local storage and System follows the operating-system color preference. Browser verification remains open for keyboard focus, menu placement in collapsed and expanded sidebars, and system-preference changes.

## Authentication, account, and public routes

### `apps/web/src/routes/sign-in.tsx`

- `apps/web/src/routes/sign-in.tsx:347-354` - audit both logo images for meaningful versus decorative use; the brand mark should use `alt="Track"` only once and decorative duplicate artwork should use `alt=""`.
- `apps/web/src/routes/sign-in.tsx:390-475` - Google and Apple actions need a consistent loading, disabled, cancellation, provider-error, and retry state. Preserve the entered email and password when an error occurs.
- `apps/web/src/routes/sign-in.tsx:423-452` - password visibility controls have labels, but verify that the label changes are announced and that toggling does not move focus or clear the field.
- `apps/web/src/routes/sign-in.tsx:483-499` - development bypass controls must be impossible to expose in production builds and must not compete visually with the real sign-in path.
- `apps/web/src/routes/sign-in.tsx` - auth fields now expose stable `name`, `autocomplete`, `type`, required validation, spellcheck behavior, and an assertive error target. Verify the native first-invalid focus and server-error focus in the browser.

### `apps/web/src/routes/two-factor.tsx`

- `apps/web/src/routes/two-factor.tsx:80` - the field keeps `outline-none` but now supplies an explicit `focus-visible` ring and border. Verify the rendered ring in the browser and keep the class pair together.
- `apps/web/src/routes/two-factor.tsx:80-94` - confirm that the hidden label, input name, autocomplete token, input mode, and inline error are connected. Focus the first useful error target after an invalid code.
- `apps/web/src/routes/two-factor.tsx:64-71` - method choices need an explicit selected state and a single accessible label for the group.

### `apps/web/src/routes/profile.tsx`, `apps/web/src/features/profile/ProfileSettingsPage.tsx`, `apps/web/src/routes/deletion.tsx`

- Account forms must preserve unsaved edits when navigation or route changes occur; add a guard before leaving a dirty form.
- Destructive account deletion must use a confirmation dialog with the exact consequence, required input, cancel path, pending state, and recoverable error.
- Success and failure notices need `aria-live="polite"` or `role="alert"` according to urgency, and focus should move to the notice when the action cannot otherwise be understood.
- Verify that profile image and banner controls expose file type/size limits before upload and keep the existing value when validation fails.

## Workspace shell and navigation

### `apps/web/src/features/workspace/components/WorkspaceSidebar.tsx`

- `WorkspaceSidebar.tsx:174-202` - the mobile open/close and resize controls now expose a keyboard path, current value, min/max, and a 16px step. Verify the spoken value and focus return in the browser.
- `WorkspaceSidebar.tsx:238-260` - the project switcher needs a visible active Company → Project scope and a clear empty state when a user has no accessible projects.
- `WorkspaceSidebar.tsx:275-334` - project and channel lists still need bounded rendering or virtualization when they exceed 50 items; verify that loading more does not reset scroll position or keyboard focus.
- `WorkspaceSidebar.tsx:334` - unread counts now appear before the channel name and the parent button exposes the complete channel and unread context in one accessible name. Verify the collapsed and expanded spoken order.
- `WorkspaceSidebar.tsx:353` - the search trigger now states that it searches Project messages and files. Keep the scope in the accessible name if search expands later.
- `WorkspaceSidebar.tsx:382` - Project settings is now a router link, not a button that changes `window.location`; verify open-in-new-tab and browser history.
- `WorkspaceSidebar.tsx:415-464` - profile and logout controls are rendered from one responsive branch at a time, so duplicate tab stops are not created. Verify collapsed and expanded states in the browser.
- `WorkspaceSidebar.tsx:419-423` - logout confirmation must trap focus, close on Escape, and return focus to the logout trigger.

### `apps/web/src/features/workspace/components/WorkspaceHeader.tsx`

- The workspace header now exposes the current Company, Project, and Channel as one named scope landmark. Verify the spoken label in home, Project, Channel, collapsed-sidebar, and narrow-width states.
- Header actions need a consistent order: back/navigation, scope, search, context actions. Verify the order at narrow desktop widths and when the sidebar is collapsed.
- Any sticky header must not cover the focused message, task, or heading when users navigate by keyboard or anchor.

### `apps/web/src/features/workspace/components/WorkspaceRail.tsx`

- Rail icons need persistent accessible names; hover tooltips cannot be the only label.
- Verify the active route is conveyed by more than color and remains visible in high-contrast mode.
- Keyboard users need a predictable order through the rail before the main workspace content.

### `apps/web/src/routes/workspace.tsx` and `apps/web/src/features/workspace/pages/WorkspacePageSurface.tsx`

- `workspace.tsx:38` - the retry action is correctly a button, but the error region should focus the heading or retry control when the page cannot load.
- The workspace now has one skip link to the named `Workspace content` landmark. Verify that focus lands on the content section without a scroll jump.
- Route transitions now expose a polite workspace announcement for home, Project, Channel, and settings views without forcing a full-page reload. Verify scroll and focus preservation when switching between related Channels.

## Workspace home, company, project, and channel surfaces

### `apps/web/src/features/workspace/pages/WorkspaceHomePage.tsx`

- `WorkspaceHomePage.tsx:59-69` - grouped project lists need a heading hierarchy and a stable empty state for no active projects, no recent projects, and no attention items.
- Project cards should show Company, Project, unread/attention count, assigned work, and last activity without requiring hover.
- If the home feed is global, its heading and filter copy must state that it includes every accessible Company and Project. If it is scoped, the scope must be visible before the first item.
- Large grouped lists need bounded pagination or virtualization and a loading-more state.

### `apps/web/src/features/company/CompanyHubPage.tsx`, `CompanyProjectPage.tsx`, `CompanyProjectNavigation.tsx`

- Company and Project pages currently expose many related actions; audit the primary action on each route so users can answer “where am I?” and “what can I do here?” within seconds.
- Keep Company settings, membership administration, relationships, and Project work in separate navigation groups. Do not mix destructive administration actions with daily work links.
- Project navigation must preserve the active represented Company in shared Projects. A Project name alone is not sufficient context.
- Shared Project and archived/read-only states need persistent text labels, not only muted color or an icon.
- The Company Project navigation should use links for route changes so users retain open-in-new-tab and browser-history behavior.

### `apps/web/src/features/workspace/pages/ProjectOverviewPage.tsx`

- The overview should lead with project identity, current Company context, attention summary, and the next useful action. Secondary administration belongs below the work surface.
- Do not duplicate Board, List, My Tasks, and All Tasks controls without stating whether each is global or Project-scoped.
- Empty channels, no tasks, no evidence, archived access, and failed data loads require distinct states with a recovery action.

### `apps/web/src/features/workspace/pages/ProjectChannelsPage.tsx` and `ProjectEvidencePage.tsx`

- Channel and Evidence pages need a single compact scope control: Company → Project → Channel. A row of every project or channel is not a scalable selector.
- Evidence search should state whether it searches messages, files, references, or all three. Results must retain Project, Channel, thread, author, and date context.
- Source previews need meaningful link text and a keyboard path to the original message or task.
- Empty Evidence must explain what qualifies as evidence and offer a clear way to change scope or add source material.

## Conversation, threads, and composer

### `apps/web/src/features/workspace/components/GroupChatPage.tsx`, `ConversationComposer.tsx`, `ScopedConversationComposer.tsx`

- Composer inputs need explicit labels or stable accessible names, correct `autocomplete` behavior, and a visible focus ring.
- Attachment, mention, voice-note, and send actions must each have a keyboard equivalent. Do not make drag-and-drop or long-press the only route.
- The composer must preserve text and attachments through validation errors, retry, offline transitions, and route changes.
- Async send status needs a polite live region. The user should know whether a message is sending, sent, failed, or queued offline.
- Sticky composers must reserve their measured height once. Avoid duplicated bottom padding from both the composer and the scroll container.
- Mention popovers must keep focus predictable, announce the result count, support arrow-key selection, and close without losing the caret position.

### `apps/web/src/features/workspace/thread-items.tsx`, `thread-item-components.tsx`, `apps/web/src/features/threads/ThreadConversationPage.tsx`

- `ThreadConversationPage.tsx:527` - the message region has a label, but verify that date separators, author names, reply context, attachments, and unread state form a logical screen-reader reading order.
- `ThreadConversationPage.tsx:530` - “Load older replies” needs a stable focus position after insertion; do not move the user to the top of the newly loaded content unexpectedly.
- `ThreadConversationPage.tsx:575` - Reply, edit, report, and remove actions must be grouped under an accessible message action menu rather than creating a dense row of controls for every message.
- `ThreadConversationPage.tsx:623-625` - reply cancellation, attachment selection, and send errors need live feedback and focus recovery. The file input needs a visible selected-file summary and a remove action.
- `ThreadConversationPage.tsx:624` - the placeholder “Reply in thread” is not a substitute for a label; retain the `aria-label` and add visible context where space allows.
- `ThreadConversationPage.tsx:571-575` - attachment links need file type, size, and safe download/open behavior. Do not expose raw storage identifiers.
- Thread rows should show the first message author in a consistent pill, reply count, latest activity, and unread state. Keep the author pill from pushing the message preview into overflow at narrow widths.

## Tasks and Kanban

### `apps/web/src/features/tasks/TaskProjectPage.tsx`

- `TaskProjectPage.tsx:161-167` - task-view tabs need a clear selected state, keyboard focus, and URL synchronization so refresh/share/back preserve the selected view.
- `TaskProjectPage.tsx:209-229` - the New task and board controls compete in the same header. Keep Board selector, My/All scope, and Filter as the essential controls; move assignee, priority, due date, labels, and completed/empty toggles into a filter sheet.
- `TaskProjectPage.tsx:190-199` - project and conversation links are correctly links; retain this behavior for every task deep link.
- Board entry from a task must preserve exact `projectId`, represented `companyId`, `membershipId`, `boardId`, and `taskId`. “Open projects” is too ambiguous when the intended result is one board.

### `apps/web/src/features/tasks/TaskBoard.tsx`, `apps/web/src/features/tasks/task-views.css`

- The phone board should display one status column at a time or use a deliberate responsive alternative; simultaneous horizontal column scroll, vertical card scroll, and drag gesture creates competing gesture ownership.
- Cross-column movement needs a visible Move to… action and Undo. Drag-and-drop may remain an enhancement, not the only interaction.
- Remove fixed card heights. Use a two-line title limit, status, priority, due date, assignee, checklist progress, and evidence count. Keep full descriptions in the task detail drawer.
- Hide empty columns by default and collapse large Completed columns. Keep the active column heading and count sticky without clipping focus or content.
- Every board filter and sort state must be reflected in the URL or a shareable route state. Do not keep essential board state only in `useState`.
- During drag, disable text selection and expose a keyboard/tap alternative. Announce the source and destination status to assistive technology.
- Test the board with long titles, no assignee, translated status names, 0/1/1000 tasks, archived/read-only projects, and a narrow viewport.

### `apps/web/src/features/tasks/TaskDetailDrawer.tsx`

- `TaskDetailDrawer.tsx:391-404` - task title, description, status, priority, assignee, board, and due date controls need visible labels or a consistently announced property label. Do not rely on nearby layout text alone.
- `TaskDetailDrawer.tsx:404` - the date picker must use the active locale and a time-zone-safe value; test keyboard navigation and mobile viewport overflow.
- `TaskDetailDrawer.tsx:409` - conflict feedback has an alert role and a recovery action; move focus to the conflict summary when a save conflict occurs.
- `TaskDetailDrawer.tsx:421` - changing scope is a high-impact action. Keep the confirmation text adjacent to the control, require explicit confirmation, and make the resulting audience change visible.
- `TaskDetailDrawer.tsx:424-426` - subtasks need 44px minimum controls, expandable descriptions, completion state, and a stable load-more focus position. Labels should not create a large empty block when none exist.
- Destructive archive/delete actions require confirmation or an undo window and must retain task context after completion.

### `apps/web/src/features/tasks/TaskCreateDialog.tsx` and `TaskAdminDialog.tsx`

- Create-task fields must use visible labels, correct types, stable names, and preserved values after validation failure.
- The bottom sheet/dialog must expose a progress indicator only when the content is genuinely scrollable. A scrollbar is feedback, not a substitute for section headings or field grouping.
- Assignee, priority, status, and board should be compact select controls with clear current values. Do not require a large text field for a finite option.
- Date selection should open a modal calendar with keyboard and screen-reader support on desktop, and a system-appropriate modal on touch devices. The calendar must use the app theme and active locale.
- On submit, keep the button enabled until the request begins, show a request state, prevent duplicate submission, and announce success or failure.

## Search and evidence

### `apps/web/src/features/workspace/search/ProjectSearchDialog.tsx`, `ChatSearchPopover.tsx`, `chat-search.ts`

- Search must state its scope before results appear. A placeholder such as “Find anything” is misleading if the query silently searches one Project.
- Search dialogs need initial focus only when the user explicitly opens search, not on every route mount. Escape must close and return focus to the trigger.
- Results need keyboard navigation, highlighted matching text that remains readable in high contrast, empty state, no-results state, error state, and load-more state.
- Search filters and selected scope should be URL-addressable when they affect the result set.
- Do not render large result arrays without a bounded page or virtualization review.

## Styling, typography, and responsive behavior

### `apps/web/src/styles.css`

- `styles.css:159,1362,6240,6863,7266,9870` - reduced-motion rules exist, but every animated component must be checked against them. A global media query does not prove that JS-driven animation stops.
- Search for any remaining `transition-all` declarations and replace them with explicit property lists. The shared primitives were corrected in this remediation pass; feature CSS still needs a browser motion check.
- Verify focus contrast in both light and dark themes. Focus must remain visible on paper, elevated, glass, selected, danger, and disabled-adjacent surfaces.
- Validate the type scale with long translated strings, 200% text zoom, and browser minimum font settings. Do not let a large navigation header push the primary task below the fold.
- Add `overflow-x: hidden` only at the correct shell boundary. Do not hide horizontal overflow that contains a real board or table interaction.
- Full-bleed overlays and sticky navigation need safe-area equivalents where the PWA is installed on a notched device.
- Use semantic tokens for canvas, surface, raised surface, text, secondary text, border, action, feedback, layer, and motion. Remove one-off magic colors that duplicate the token system.
- Check that all decorative SVG and icon components use `aria-hidden="true"` and all meaningful images have dimensions to prevent layout shift.

## Visual consistency, alignment, structure, and interaction audit

This section records static evidence of the consistency problems reported by the requester. These are source-level findings, so each item still needs a browser pass at the stated breakpoints before it can be closed.

### CSS ownership and cascade drift

- `apps/web/src/styles.css:7988-8034` is now the single desktop task-tab definition, with the mobile overflow variant kept at `:9463-9477`. Before this pass the same selector was split across three blocks, so confirm the consolidated rule preserves the active dotted border and mobile indicator in browser screenshots.
- `apps/web/src/styles.css:9222-9233` is now the only composer action-row definition. The obsolete absolute popup rule was removed because the product requirement is to show composer options directly; verify that the inline row remains usable at 320px.
- `apps/web/src/styles.css:2233-2260` is now the single workspace shell geometry definition and uses the runtime sidebar/rail variables. `apps/web/src/features/company/company-surfaces.css:139-143,1347-1353` still contains a legacy and modern Company shell block, while `company-project-navigation.css:28-32` repeats the 236px / 292px grid. The remaining Company duplication can still create different content anchors until the legacy block is removed after visual verification.
- `apps/web/src/features/company/company-surfaces.css:3-4` explicitly labels the first rules as legacy and says modern rules override them. Keeping both layers makes spacing, border, and typography changes order-dependent. Remove legacy selectors after the modern surface is canonical, or isolate them behind a route-scoped legacy class with an owner and removal condition.

### Tokens, spacing, and geometry

- `apps/web/src/styles.css:410-454` defines the semantic `--paper`, `--hairline`, `--ink`, `--card`, `--border`, and `--radius` tokens, but the same file and Company CSS still use direct `border-radius` values from 6px through 16px (`styles.css:50,58,71,88,101,110`; `company-surfaces.css:38,66,91,109`). The result is a surface hierarchy that is hard to predict: similar cards, panels, and controls do not share a radius scale. Define a small radius ladder and use semantic names for panel, control, and pill shapes.
- The codebase uses both the mapped shadcn names (`var(--card)`, `var(--border)`, `var(--muted)`) and the lower-level visual names (`var(--paper)`, `var(--paper-2)`, `var(--hairline)`) in adjacent surfaces (`styles.css:58-74` versus `styles.css:7398-7418`). They currently map to related colors, but future theme changes can make the two groups diverge. Select one token vocabulary at component boundaries and reserve raw palette tokens for the theme definition.
- `apps/web/src/styles.css:49-72` fixes board columns at 248px and dense-list columns at `90px minmax(180px,1fr) 150px 90px`. At narrow widths this leaves no measured space for translated titles, long assignee names, or touch controls. Define a minimum readable card width, then allow non-essential columns to collapse or move below the title instead of relying on horizontal clipping.
- `apps/web/src/features/company/company-surfaces.css:139-153,1347-1362` gives the Company shell and channel sidebar separate fixed widths, padding systems, and border tokens. The content column therefore starts on a different x-coordinate from the task shell even when both are shown as the same three-column product layout. Create one shell geometry contract for navigation, content, and context rail widths.
- Responsive rules change the same shell at several unrelated thresholds (`styles.css:9455-9483` at 1080px, `styles.css:9485-9541` at 820px/700px, and `company-surfaces.css:2129-2137` at 520px). The breakpoints should be named by layout state, not repeated as route-local numbers, so a sidebar collapse and a tab reflow happen at the same usable width.

### Alignment and typography

- `apps/web/src/styles.css:40-42,8036-8041` uses a 1.65rem display heading, 0.64rem eyebrow, and 10px route labels, while Company headings and labels use a separate display/meta scale (`company-surfaces.css:479-496,2000-2010`). Similar page headers therefore have different baselines, tracking, and vertical rhythm. Define shared page-title, eyebrow, and supporting-copy styles and let a feature opt into a documented size variant.
- `apps/web/src/styles.css:5005,5230,8513` contains 8px and 9px text. These sizes may be acceptable for a compact metadata badge, but they are used in navigation/status contexts where 200% zoom and translated text need to remain legible. Set a minimum body-adjacent size and verify compact labels at zoom before keeping them.
- `apps/web/src/styles.css:9245-9247` and `company-surfaces.css:2052-2056` ellipsize project and context-tab labels without an explicit `title` or expanded description. Long names can become indistinguishable to sighted users even when the DOM still contains the full string. Preserve the full name for assistive technology and expose it on hover/focus where the visual label is truncated.
- Task tabs switch from a grid at desktop to a right-aligned horizontal scroller at 820px (`styles.css:8044-8059,9527-9540`), while Company context tabs switch from equal-width columns to one column at 520px (`company-surfaces.css:2013-2020,2129-2137`). Both are tab-like navigation but use different alignment, selected indicators, and reflow rules. Standardize selected-state geometry and define one overflow pattern for all product tabs.
- `apps/web/src/features/tasks/TaskProjectPage.tsx:191-200` uses plain anchors for the standalone task sidebar while the same file uses router navigation for task tabs (`:162-175`) and the workspace sidebar uses `Link` for project tasks (`WorkspaceSidebar.tsx:364-377`). Full page reloads, focus loss, and inconsistent active-state handling are likely on the standalone route. Use one navigation primitive for internal routes and reserve plain anchors for external or document navigation.

### Interaction and state consistency

- `apps/web/src/features/workspace/components/WorkspaceSidebar.tsx:379-393` now renders Project Settings as a router `Link`, matching the neighboring Project and Task destinations and preserving browser-history and open-in-new-tab behavior.
- The logout confirmation now uses the shared `Dialog` primitive (`WorkspaceSidebar.tsx:472-484`), which supplies modal semantics, Escape handling, focus containment, and return focus for both expanded and collapsed sidebar states.
- Feedback announcements are not uniform: Company hub notices use `aria-live="polite"` (`CompanyHubPage.tsx:319-323`), two-factor errors use `role="alert"` and assertive live output (`routes/two-factor.tsx:100`), and form-level errors use a mix of alert and non-alert paragraphs (`CompanyForms.tsx:520`, `workspace.company.settings.tsx:49`). Define a feedback policy: polite for successful background saves, assertive for blocking errors, and one live region per surface.
- Task filters update the URL through router navigation (`TaskProjectPage.tsx:224-255`), task tabs also navigate through buttons (`:162-175`), and channel selection changes local state through buttons (`CompanyProjectConversation.tsx:156-190`). The visual affordance is the same, but the persistence and browser-history behavior differ. Label route state versus local state in the component contract and use links for durable destinations.
- Task-drawer and conversation-composer mentions now use the shared anchored listbox primitive. Verify clipping, stacking, scroll ownership, pointer selection, and focus restoration in both surfaces; mobile keyboard resize and the wider accessibility matrix remain open.
- Save and submit controls use different disabled and feedback rules across Company forms, task creation, and thread actions. Some disable on empty input, some allow submit and return an inline error, and some only expose a live notice. Establish one form state contract for idle, validating, submitting, success, and failure so button width, spinner placement, error position, and preserved input remain stable.

### Required visual and interaction regression pass

For every finding above, test the affected route at 320px, 768px, 1024px, and 1440px, in light and dark themes, with a long Project/Channel/person name, 200% zoom, keyboard-only navigation, and reduced motion. Record screenshots for the shell columns, page header baselines, tabs, drawers, menus, and logout dialog. Close a finding only when the visual anchor, keyboard order, focus return, URL/history behavior, and screen-reader announcement match the shared component contract.

## Internationalization and RTL

- `apps/web/src/components/ui/date-picker.tsx:98` is a confirmed English-only date label. Replace it with the active locale.
- Search all web routes for `toLocaleDateString('en'`, hardcoded month/day names, hardcoded “Today/Tomorrow/Next week”, and concatenated English status text.
- Set `dir` at the application shell for RTL locales and use `dir="auto"` for user-generated message, task, and project text. Do not mirror brand marks.
- Test Arabic/Urdu or the project’s configured RTL language with long Company names, Project names, thread titles, task descriptions, dates, numbers, and punctuation.
- Mark Track, project keys, task keys, URLs, and code tokens with `translate="no"` where browser translation could corrupt identifiers.
- Use `Intl.DateTimeFormat` and `Intl.NumberFormat` with an explicit locale and time zone for every user-facing date, time, count, and numeric comparison.

## Performance and resilience

- The following surfaces contain potentially unbounded `.map()` rendering and need measured thresholds: `WorkspaceSidebar`, `WorkspaceHomePage`, `TaskInbox`, `TaskDetailDrawer` subtasks/references, `ThreadConversationPage` messages, search results, and project/channel galleries.
- Prefer server pagination with deterministic ordering. A Load more control must preserve focus and scroll position.
- Avoid layout reads during render. Any width/height measurement used for the board, sidebar, composer, or drawer should be batched and tested during resize.
- Loading, partial, empty, offline, permission-denied, and stale-authorization states need separate UI. A missing record must not produce a blank panel with no recovery action.
- Network retries must not duplicate messages, tasks, comments, or attachments. The UI should expose retry and retain user input.

## Screen-by-screen acceptance checklist

### Workspace and Projects

- A first-time user can identify the active Company, Project, and Channel without opening a menu.
- Home explicitly says whether attention is global across all accessible workspaces.
- Projects separates attention, recent, active grouped projects, and archived/read-only access.
- Project selection never silently changes the Company context without visible feedback.

### Tasks and Board

- Global My Tasks does not require a Project selection.
- A task opens its exact source Project and board.
- Board filters show only essential controls by default.
- Move to… works without drag, has optimistic feedback, and offers Undo.
- Checklist rows expose descriptions and remain usable at 200% zoom.

### Threads and conversation

- The source message, author pill, replies, attachments, and reply composer have a logical reading order.
- Reply, attachment, retry, cancel, and report actions work with keyboard and touch.
- Composer bottom spacing is owned by one inset mechanism.

### Search and Evidence

- Search scope is explicit and never silently defaults to an unrelated Project.
- Evidence keeps Company, Project, Channel, thread, author, and date context in every result.
- Empty and no-result states explain the next action.

### Auth and settings

- Every field has a label, name, correct type, autocomplete, inline errors, and preserved input.
- OAuth, two-factor, profile, and deletion flows expose loading, cancellation, failure, retry, and success states.
- Destructive actions require confirmation or undo.

## Requested admin-panel issue regression matrix

This matrix separates source evidence from behavior that still needs a browser pass. A source match is not a complete regression check.

| Reported issue | Source evidence | Current audit result | Regression check still required |
| --- | --- | --- | --- |
| Pending Channel archive query throws `channel_steward_required` | `CompanyProjectPage.tsx` now gates `channels.listPendingArchive` with `canQueryPendingChannelArchives`, which requires an active manager steward before the query is sent. | Client-side authorization gating is implemented; the server denial remains the expected response for an unauthorized direct call. | Open the same Project as a non-steward, staff member, archived member, and active steward. Confirm only the steward path calls the query, no uncaught client error appears, and the API still denies a forged direct request. |
| Task drawer comment @-tagging | `TaskDetailDrawer.tsx:448-492` adds the placeholder, suggestion list, and arrow-key selection. | Implemented in source; accessibility wiring remains a high finding. | Type `@`, filter, ArrowDown/Up, Enter, Tab, Escape, click an option, submit, and confirm the caret and mention text are correct. |
| Assigned person “Unassigned” truncates | `TaskDetailDrawer.tsx:400` and shared `select.tsx:45` use the shared trigger. | Minimum width was added; visual proof remains open. | Open the drawer at 320/768px, choose Unassigned and a long person/company label, then verify no clipping or layout shift. |
| Calendar/date/time pickers | `date-picker.tsx` is used by task due dates and history filters; timezone is a separate custom picker. | The shared date picker now has a semantic keyboard grid and polite selection/clear announcements. Locale policy, timezone picker, and the absence of a dedicated time picker remain open. | Test every date entry, month navigation, Today/Clear, keyboard selection, mobile overflow, locale, and timezone search/escape/focus return. |
| Task tabs dotted border/alignment | `TaskProjectPage.tsx:161-175`, `styles.css:8044-8078,9267-9284`. | URL-selected tabs and active dotted styling exist, but duplicate CSS blocks and active-only borders need visual proof. | Compare every tab at desktop/mobile, keyboard focus, selected border, text baseline, and drag/drop or horizontal scroll behavior. |
| Sidebar channel notifications before name | `WorkspaceSidebar.tsx:334` renders unread indicator before the channel content. | Source order passes. | Verify visual order in expanded/collapsed/mobile sidebar and screen-reader name includes channel plus unread count once. |
| Switch Project clarity and sidebar profile/logout | `WorkspaceSidebar.tsx:398-490` renders profile, theme, and logout actions in both rail states. | Source controls exist; focus return and the complete responsive traversal still need proof. | Collapse/expand, switch projects, open/close logout confirmation, Escape, keyboard traversal, and profile navigation without a full reload. |
| Company description sizing | `CompanyForms.tsx:169-170` uses three rows and the shared description class. | Source sizing change exists. | Check empty, one-line, and long descriptions at 320px, 200% zoom, and dark theme; save and reload. |
| Assign existing Project relationship input | `MigrationPanel.tsx:87` supplies a “multiple Companies” label and empty-state explanation. | Source copy and fallback exist. | Verify relationship options load, no-relationship state is actionable, selecting one updates the preview, and submit errors retain values. |
| Create Task modal placement/overlay | `TaskCreateDialog.tsx:107-109` uses shared Dialog; `dialog.tsx:28-59` centers the popup with backdrop. | Source structure passes; browser focus/scroll-lock proof is open. | Open from chat and task screens, verify centered overlay, dimmed background, Escape, outside click, focus trap/return, and long-content scrolling. |
| Chat “Hit” modal status | `ConversationTaskActions.tsx:125-126` renders the selected workflow status or “No workflow status available.” | Fallback text is present in source. | Exercise no-board, loading, valid-board, and failed-query states and confirm status is visible, announced, and never blank. |
| Chat message Copy text/Select message | `MessageActions.tsx:102-104` contains both menu actions. | Source actions exist. | Open the three-dot menu with mouse and keyboard, copy, select, dismiss, and verify toast/focus/selection behavior on long and multiline messages. |
| Chat input options visible directly | `ConversationComposer.tsx:352-379` renders attachment, memory, voice, mention, and emoji controls in the composer bar. | Source options are direct children; the legacy class is now layout-only and narrow-layout proof is open. | Verify all actions remain visible at 320px, have labels, do not overlap Send, and preserve caret/text. |
| Remove “Saved” from sent messages | Search found no sent-message Saved label; `CompanyHubPage.tsx:147` still uses “Saved.” for a generic company operation notice. | Message-specific label appears removed; do not remove generic save feedback without product intent. | Send chat, task, and thread messages and confirm no Saved marker appears on the message row; confirm unrelated save notices remain understandable. |

### Added desktop dashboard regressions

- Right rail: `WorkspaceRail.tsx` now replaces the task section with a selected-company thread browser. At 1440px, switch Channels and Companies, verify the rail keeps its width and hierarchy, confirm only authorized company threads appear, and verify collapsed/expanded rail focus and scroll behavior.
- Notification modal: type, read-state, and push-preference filters now open inside the notification feed so the active scope is visible in one place. Open notifications, change each filter, confirm the list and empty state update, mark items read, close/reopen, and verify the filter state remains scoped to the Project.

## Company workspace sidebar and control regression

The Company overview uses the shared Company and Project navigation again. It no longer has a separate 272px width preference, hidden Company switcher, or screenshot-specific sidebar skin. The shared saved width, resize handle, 48px collapsed state, Company selector, profile link, and logout action now behave the same on Company and Project routes.

- `CompanyProjectNavigation.tsx:60-181` owns one sidebar width key and applies the same collapse and resize state for every Company surface. This prevents a route change from replacing the user's established sidebar width.
- `company-project-navigation.css:602-637,742-754,885-897` applies the shared row layout, hover state, collapsed geometry, and desktop icon alignment to both buttons and router links. Tasks and Threads therefore keep a 33px row and centered icon instead of breaking onto separate lines.
- `company-project-navigation.css:85-97` and `company-overview-reference.css:182-191` provide visible focus treatment for the restored navigation, profile/logout controls, dashboard actions, project links, and icon buttons.
- `CompanyHubPage.tsx:205-284,610-619,1023-1148` makes New Project open the real creation panel, scroll it into view, and focus its first control. The scroll behavior follows `prefers-reduced-motion`.
- `CompanyHubPage.tsx:228-250,563-606` makes the notification popover close on outside pointer input or Escape, returns focus to the bell on Escape, and connects the trigger to the popover with `aria-controls` and `aria-expanded`.
- The disabled Reports row was removed because no Reports route or supported report workflow exists. This removes a false affordance instead of presenting a control that cannot complete an action.
- The project-card three-dot glyph was replaced with an arrow that accurately communicates the card's existing navigation behavior. The People view retains its three-dot control because that icon opens a real member action menu.

Observed desktop regression evidence on the authenticated local Company workspace:

- Overview, Projects, Relationships, People, and Settings each opened the matching level-one heading.
- New Project changed the route to `?view=projects`, opened the Create a Company Project disclosure, and focused an input.
- The notification bell opened its connected popover; Escape removed the popover and returned to the trigger path.
- Searching for `Patient` reduced the visible Project cards from three to one.
- Sidebar collapse set the shared shell width variable to 48px and expand restored the saved 239px width.
- Tasks and Threads navigated to their canonical scoped routes with the active Company and Project membership identifiers preserved.
- The Company switcher, profile route, logout action, resize control, project cards, and all visible dashboard action icons have a real navigation or action owner. No disabled or decorative control is presented as an available action.
- The browser console contained zero errors during these checks.

## Remediation applied in this pass

### Company overview design implementation

The Company overview now adapts the approved Figma frame `Track - Company Overview & Portfolio` (`1:3103`) to Track's live product model. The implementation keeps the Figma frame's editorial hierarchy, thin borders, restrained amber signal, compact portfolio data, and stable left navigation without copying its excessive panel density.

- The page order is now Company identity, four decision metrics, active Projects, upcoming work, connected partner Companies, and recent portfolio activity. This keeps the primary Project path visible before secondary context.
- Project cards use real ownership, description, Channel, unread, and update data. Decorative bars that could be mistaken for measured progress were removed.
- Connected partners replaces the duplicate People summary card. The People count and navigation remain available, while the overview uses the saved space for relationship context that is specific to Company collaboration.
- The duplicate top-right profile avatar was removed because the sidebar footer already owns profile, Appearance, and logout actions.
- The Project search has an explicit Company scope, supports `Ctrl/Cmd+K`, and filters the rendered Project links without changing backend scope.
- Every overview color now resolves through the shared paper, ink, border, accent, status, shadow, radius, and avatar tokens. The screen no longer forces a dark palette, so Light, Dark, and System use the same layout and information hierarchy.
- At the observed 1920 by 901 desktop viewport, the final dark layout used `#151412` paper and `#eee9dd` ink, rendered two 902px-wide Project rows in one column, and matched the viewport width with no document overflow. The Light browser pass also matched the viewport width and preserved the same geometry.
- The live authenticated route exposed Company and Project navigation, Company switching, profile, Appearance, logout, Project search, notifications, Project links, metric navigation, and New Project as real controls. System mode was restored after theme verification.

Focused verification for this Company overview pass: web lint passed, web typecheck passed, 12 Company route/query/acting-state tests passed, and the complete web production build passed through client, SSR, and Nitro generation.

### Project workspace design implementation

The Project workspace overview adapts the approved Figma frame `Track - Project Overview & Participating Companies` (`1:825`) to Track's live Company, Project, Channel, thread, membership, and task model. It keeps the frame's project-command hierarchy, thin borders, compact metrics, restrained amber signal, and narrow context rail without copying unsupported Sprint, progress, file-verification, presence, or activity claims.

- `view=overview` is now a real route state. It renders the Project overview, survives refresh and browser history, and keeps the represented Company and Project membership in every destination.
- Project switcher links now open the overview first. The left navigation exposes separate Overview, Conversation, and Tasks links, so each destination supports open-in-new-tab and normal browser history.
- The overview order is Project identity and primary conversation action, four factual summary metrics, Project brief, Context Channels, participating Companies, work shortcuts, and the existing Company thread rail.
- Project, Channel, membership, unread-thread, ownership, member, and date values come from authorized Convex queries. No decorative progress value is presented as real Project health.
- The right rail remains a searchable active/archived thread navigator scoped through the represented Project membership. It does not duplicate the task board.
- Empty Channels, unavailable ownership, hidden member counts, archived Channels, and no active threads each retain readable text instead of leaving broken or unexplained panels.
- The Project status uses text plus a status dot. Dates use a stable `Intl.DateTimeFormat`, numeric metrics use tabular figures, headings use balanced wrapping, icons are decorative where their adjacent text owns the label, and all navigation uses semantic links.
- Light, Dark, and System resolve through shared semantic tokens. The authenticated 1920 by 901 checks preserved the same grid in light and dark modes with a document size of exactly 1920 by 901 and no page-level overflow.
- The live route loop passed: Overview opened Conversation with `#General`, the message composer and Company thread rail remained available, and the Overview link returned with the same Company, Project membership, and Channel scope.

Focused verification for this Project workspace pass: web typecheck passed, web lint passed, and 10 focused Company route/query tests passed. The complete web test, audit, and production-build results are recorded in the final gate below.

### Channel and thread workflow implementation

The Channel conversation and Thread conversation complete Workflow 1 from the Project overview. They adapt the Figma frames `Channel Conversation & Thread Pane` (`1:3703`) and `Thread Detail Workspace` (`1:10115`) to the live Track model while preserving the established Project navigation, semantic theme tokens, thin dividers, compact typography, and restrained amber interaction signal.

- The Channel header now leads with the selected Channel and keeps the Project as breadcrumb context. The composer names the Channel and explains that typing `@` opens the mention picker.
- The left navigation keeps Overview, Conversation, Tasks, and every visible Channel in one stable Company and Project shell. Every route preserves the represented Company and Project membership.
- The right rail shows all Company-visible Project threads across Channels. It supports search, Open and Archived views, unread state, bounded pagination, and direct thread creation in the active Channel. The task list is not duplicated in this rail.
- Thread search applies the selected Open or Archived status inside the indexed Convex query before its 12-result limit, so one status cannot crowd valid results from the other status out of the rail.
- Creating a thread uses the existing authorized Convex mutation with a retry-safe idempotency key. Success opens the new thread with the same Company, Project, membership, and Channel scope.
- Channel creation has its own request lock, so composer activity cannot re-enable the Channel form while the creation request is still pending.
- The Thread route uses the same three-column desktop hierarchy: Company and Project navigation, focused conversation, and a narrow context rail. The context rail shows status, reply count, follow state, source-message context, and manager-only rename controls.
- Thread replies use the shared scoped composer, so mentions, attachments, voice notes, emoji, Project memory import, reply context, and `@track` behave the same as the Channel composer.
- The Thread timeline hides entries older than the common safe boundary while message and assistant histories have independent cursors. This keeps the visible merged timeline contiguous, while an explicitly deep-linked target remains visible.
- Follow, unfollow, archive, reopen, rename, reply, delete, task creation, and report controls keep their existing backend owners. Archived Project or thread state remains read-only.
- Light, Dark, and System use the same layout and semantic tokens. At 1920 by 901, the Project overview, Channel conversation, and Thread conversation each matched the viewport width and height without page-level overflow.
- Empty Channel and thread states, inaccessible source messages, async notices, inline errors, loading states, and read-only states remain explicit. Inputs have accessible labels, stable names, appropriate autocomplete behavior, and specific example placeholders.

Focused regression evidence for this workflow: web lint and typecheck passed; 7 focused navigation and composer tests passed; the authenticated browser created `Workflow 1 regression` in `#General`, opened it, typed `@` to expose Channel, person, and Track Assistant options, sent a reply, observed the reply count change to 1, returned to the exact Channel route, and rendered the new thread in the Company rail. The same Channel and Thread routes passed light and dark theme checks with no document overflow and no Track console errors. System mode was restored after verification. A final scoped `codex review` reported no findings after the merged-timeline boundary, status-scoped search, retry idempotency, focus restoration, semantics, and request-lock corrections.

- Shared Button, Badge, Toggle, Switch, and Tabs now use explicit transition properties and touch-friendly interaction classes.
- Dialogs and sheets contain overscroll, respect reduced motion at the primitive boundary, and expose a visible popup focus ring.
- Shared selects keep a readable minimum width; task creation fields now have stable names and inline title feedback.
- Chat composer auto-focus was removed, voice recording received an explicit accessible name, and chat/task mention popovers expose combobox/listbox relationships.
- Timezone options expose listbox semantics; company context tabs support roving tab focus plus Home/End navigation.
- Profile navigation now uses a router Link, two-factor errors are announced and associated with the code field, and search placeholders use the correct ellipsis character.

## Implementation pass: completed source fixes

The following fixes were implemented in the web source during this pass. They still need browser verification where noted, but each change is present in the code and covered by the web typecheck/lint gate.

- `WorkspaceSidebar.tsx` now renders Project Settings as a router `Link`, so it supports normal browser history, preloading, and open-in-new-tab behavior like the neighboring Project and Tasks destinations.
- `WorkspaceSidebar.tsx` now uses the shared Dialog primitive for logout confirmation. The two duplicated responsive popup copies were removed, and the shared modal owns backdrop, Escape, focus return, scroll containment, and reduced-motion behavior.
- `TaskProjectPage.tsx` now uses router `Link` elements for task tabs, the Track home link, the Project conversation link, and the Project group link. Group context is preserved through the canonical group route instead of a manually assembled query URL.
- Task tab CSS now styles both buttons and links, keeps the active dotted border and indicator aligned, and removes the link underline from the navigation surface.
- Workspace shell fallbacks now use the runtime sidebar and rail variables consistently. The collapsed desktop width is aligned to the shared 48px sidebar sizing contract instead of a separate 56px constant.
- Company shell legacy geometry now uses the same 236px navigation and 292px context-rail contract as the modern Company navigation.
- Attachment previews, message images, QR codes, and provider icons now include explicit width and height attributes to reduce layout shift.
- Workspace project, group, and invite dialogs no longer force `autoFocus`, avoiding keyboard jumps on mobile while allowing the shared Dialog focus behavior to run.
- Light and dark themes now declare `color-scheme`, headings use balanced wrapping, and task/company surfaces have shared control, card, and panel radius tokens.
- Workspace and Company shells now include dynamic viewport sizing so mobile browser chrome and notched-device insets do not reduce the usable app height unexpectedly.
- Decorative sidebar icons now expose `aria-hidden="true"`, and message-action placeholders use the required typographic ellipsis.
- Workspace project, group, and invite dialog inputs now have stable names, appropriate autocomplete, required validation where applicable, and submit buttons that remain enabled until a request starts.
- Root and web packages now use the same React 19.2.7/ReactDOM 19.2.7 pair, and composer regression tests assert the new accessible `combobox` role instead of the old `textbox` role.
- The responsive sign-in shell now overrides the more specific conversation variant at narrow widths, so a 320px viewport uses one column instead of retaining a 360px minimum panel.
- The Company project navigation now keeps task tabs left-aligned and horizontally scrollable on narrow screens. The active tab keeps its dotted border and readable text baseline.
- The shared date picker now uses a roving calendar focus model with Arrow/Home/End/PageUp/PageDown navigation, Enter/Space selection, month-grid semantics, and regression coverage for selection and clearing.
- The workspace shell now exposes a skip link and named content/navigation landmarks. Sidebar resize exposes an ARIA value step, channel buttons announce channel and unread context, and Project search states its scope.
- Company views and profile panels now synchronize with route search parameters, so refresh, deep links, and browser back can restore the selected view.
- Sign-in email/password fields now have stable autofill names, correct spellcheck and autocomplete behavior, native required validation, and an assertive, focusable error announcement.
- The desktop workspace rail now removes the task list from the channel context rail and replaces it with a selected-company thread browser. The browser scopes results through the authorized Project membership, includes channel context, unread state, active/archived tabs, and search, and remains available in the collapsed/expanded rail shell.
- Task notification type and read-state filters now live inside the notification feed popover beside the Project push preference, so opening notifications exposes the full filter state in one modal.
- Task comment, subtask, board, label, and workflow actions now use one visible submit contract: validation runs on activation, the first invalid field receives focus, `aria-invalid` and `aria-describedby` expose the error, the action is disabled only while its request is pending, and submitted text is trimmed before persistence.
- The Convex development-auth tests separate the fast environment policy from the slower mutation-boundary integration checks. The integration checks keep their assertions and use an explicit 15-second limit, so the normal repository test command no longer fails on the default five-second per-test limit.

## Implementation pass: remaining work required

These items need additional design or runtime work and must not be marked complete from static source inspection alone:

- Keep the desktop and mobile task-tab rules co-located and documented as one component contract. The obsolete absolute composer-menu block was removed in this pass, and the remaining inline action row now has one class definition.
- Remove or isolate the legacy Company CSS block after confirming no legacy route depends on it. The audit must include a route inventory and screenshots before deleting the old selectors.
- Replace remaining raw radius, spacing, and typography literals across feature CSS with the shared semantic token ladder. The first pass only establishes and applies the highest-impact panel/card/control tokens.
- The shared anchored mention listbox now serves task comments and chat. It owns option indexing, active-option scrolling, pointer selection, keyboard selection, and section styling in one component. Browser checks cover both surfaces; mobile keyboard resize remains open.
- The right rail now uses the bounded `channelThreads:listProjectPage` query with a 40-item initial page and an accessible “Load more threads” action. The legacy `listProject` query remains available for existing callers, and the new page path has a Convex regression test.
- Standardize save/error announcements and form state transitions across the remaining Company forms, task creation, thread actions, and profile settings. Workspace dialogs and the audited task detail/admin actions now follow the submit-button rule; the remaining surfaces still need preserved input, request state, and first-error focus checks.
- Complete the desktop dashboard verification at 1440px in both themes, with long labels, 200% zoom, keyboard-only input, reduced motion, and screen-reader announcements. Keep the 320px, 768px, and 1024px passes as responsive safety checks, not as the primary layout target. The partial Playwright pass covers desktop task modal/date-grid behavior and task mentions, but the wider rail, theme, and assistive-technology checks remain open.
- Keep the passing Vitest regression gate in CI so a future dependency install cannot reintroduce duplicate React runtimes or stale mention-role assertions.

These changes are source-verified by lint, focused tests, audit, build, and the live paths described below. The full repository gate is not green because the filtered task-pagination test fails deterministically. A later web typecheck is also blocked by an unrelated `CompanyHubPage.tsx` notification-union change that reads `senderName` from an invitation without that property. Screen-reader, zoom, theme, long-content, and the broader large-list regression matrix remain open.

## Observed automated checks

- `pnpm --filter web lint`: passed.
- `pnpm --filter web typecheck`: Workflow 3 passed before the later notification-union edit. The current rerun reaches no Workflow 3 errors but fails in `CompanyHubPage.tsx:593` because an unrelated invitation union member has no `senderName` property.
- `pnpm --filter web build`: passed after the remediation pass. Vite completed client, SSR, and Nitro output generation.
- `pnpm --filter web test -- --run`: passed after the Workflow 3 review fixes. Vitest completed 37 test files and 104 tests, including regression coverage for stable Search Hub sections, represented-Company search destinations and Evidence links, destination-state persistence, Gregorian date keys, Unicode and duplicate-name mentions, app toasts, the composer, date picker, Company query scope, and thread navigation.
- `pnpm lint`: passed for web, mobile, shared, and Convex lint gates.
- `pnpm typecheck`: passed for Convex, web, mobile, and shared packages before the later notification-union edit. A current full rerun would inherit the same unrelated web type error described above.
- `pnpm test`: failed in the root Convex phase. Web passed 36 files/101 tests, mobile passed 22 files/69 tests, shared passed 5 files/10 tests, and Convex passed 17 files with 88 passing tests and one failure. `returns bounded task pages, child pages, and history pages` expected the filtered high-priority task ID but received an empty page because `collectTaskListPage` paginates before applying post-query priority filters. The failing test is outside the Workflow 3 files, but the required repository gate remains failed until it passes.
- `pnpm audit --prod`: passed with no known vulnerabilities.
- `pnpm install --frozen-lockfile --filter web... --child-concurrency=1 --network-concurrency=1`: passed and rebuilt the workspace links. Aligning `apps/web` with the root React 19.2.7/ReactDOM 19.2.7 pair removed the duplicate-runtime hook failures.
- Scoped `codex review`: found six Workflow 2 defects in destination-state persistence, date serialization, mention reconciliation, Unicode mention search, notification naming, and audit status. All six findings were corrected and the focused checks were rerun afterward.
- A scoped Workflow 3 `codex review` found four initial defects in represented-Company task navigation, the People destination, Evidence discoverability, and assistive keyboard guidance. A follow-up review found an unsafe test fixture and stale represented-Company risk in People navigation. All six findings were corrected; the final implementation uses the canonical acting-Company storage helper before opening Company People, and the focused navigation, search-section, Company-scope, and acting-Company tests pass.
- Playwright browser pass on local `http://localhost:3001`: at 320px, the sign-in route exposed the conversation-shell overflow before the responsive fix and no longer did after the fix. A local demo session then loaded Company, Project, Channel, and task-board routes with no console errors; the Channel unread label appeared before the Channel name; composer actions were visible; task tabs computed as left-aligned flex items with a dotted active border; and the task drawer opened with a working `@` mention listbox. ArrowDown set `aria-activedescendant` and Enter inserted `@Daniel Brooks ` into the combobox. The route pass produced one browser warning but zero console errors.
- Playwright desktop pass on the authenticated local workspace at 1440px opened the Create Task dialog at `[410,158,620,584]` with an `[0,0,1440,900]` `bg-black/80` overlay and no document overflow. The shared date picker exposed a seven-column grid; ArrowRight moved focus from Friday 11 September 2026 to Saturday 12 September 2026 and Enter selected `Sep 12, 2026`.
- The authenticated Company Project dashboard at 1440px rendered a 292px right context rail at `[1148,0,292,900]` with no task section, a Company threads panel with seven visible rows, channel context, Open/Archived tabs, and search. Collapsing the rail produced the intended 48px `[1392,0,48,900]` state, and reopening restored 292px without document overflow or console errors.
- The authenticated Company Project dashboard now exercises `channelThreads:listProjectPage`: the Open tab rendered seven loaded threads, switching to Archived selected the tab and rendered one archived thread, and the browser captured zero Track console errors. Projects with more than 40 raw thread records expose the same rail-level “Load more threads” control rather than silently stopping at 60.
- The desktop task notification popover rendered at `[1030,51,390,508]` with a Notifications header, Clear all action, Project push preference, type/status filters, stacked notification cards, event icon, task key, timestamp/read state, and View route links. The route produced zero console errors.
- In that notification popover, selecting the Unread status option changed the combobox label to Unread and produced the scoped “No notifications match this filter.” empty state without closing the modal.
- The authenticated task drawer at 320px remained inside the viewport (`[65.6,0,294.4,800]`, document `scrollWidth` 320) and its comment textarea exposed `Type @ to tag someone`; the shared listbox returned six options with `aria-posinset` metadata. The chat composer returned nine options through the same component, and keyboard selection inserted a mention. This is a responsive safety result, not the desktop design target.
- A public sign-in width sweep at 320px, 768px, 1024px, and 1440px reported no horizontal overflow (`scrollWidth` matched the viewport client width at each size). The only warning was the development React Grab version notice.
- Authenticated workspace width checks at 320/768/1024/1440px reported no document horizontal overflow. The current authenticated Company workspace pass also verified every sidebar destination, all Company section buttons, Project search, the notification popover, New Project form focus, and the 48px/saved-width collapse cycle with zero console errors. Both themes, 200%/400% zoom, long translated labels, high contrast, reduced motion, and screen-reader output remain unproved.
- The authenticated desktop task-form pass invoked blank Project board, label, workflow-board, subtask, and comment actions. Each path rendered its expected inline alert, set `aria-invalid="true"`, linked the control with `aria-describedby`, and focused the invalid field. Entering a valid value cleared the local board and subtask errors. No board, label, subtask, comment, or workflow update was submitted during this validation-only pass. The application emitted no runtime exception; two browser-extension listener errors were present and were not produced by Track code.

## Workflow 2: Conversation to Task Execution

Workflow 2 uses one compact desktop hierarchy across conversation-derived creation, task planning, task detail, and notifications. The Company and Project navigation remains unchanged, while each task surface uses the shared paper, ink, hairline, amber-accent, radius, focus, and motion tokens.

- **Create Task from Chat Modal:** The message action opens a centered, focus-trapped dialog over a dimmed backdrop. The dialog identifies the operation as Conversation to task, previews the source text, states that the source remains scoped evidence, and provides named Title, Description, Board, Status, Assignee, Priority, Due date, and Label controls. Channel boards and default workflow states are provisioned automatically when absent. Cancel and Create task form one stable footer. Successful creation produces a top-right toast containing the task key, renders the linked task below the message, and preserves the message as the primary evidence reference.
- **Task Board and List:** The stable screen heading is Tasks. Board, My tasks, List, and Suggestions use short labels with the existing left-navigation selection treatment. The selected board or list scope and loaded result count sit below the heading. Filters remain in route state and expose an explicit Clear action when active. Board columns use consistent state icons, count pills, separators, drop areas, add actions, task cards, and accessible left/right movement controls. Empty board and empty filter states include a direct Create task action.
- **Task Detail Drawer:** The right drawer uses a 520px desktop work surface with a restrained overlay, sticky context header, editable title and description, aligned status, priority, assignee, and date controls, and clearly separated Labels, visibility scope, Subtasks, Evidence, and Comments and activity sections. The Unassigned control keeps a stable readable width. Comment entry exposes “Type @ to tag someone”, renders an anchored listbox, and supports arrow, Enter, Tab, and Escape interaction. Comments and activity use shared locale-aware timestamps.
- **Task Notification Center:** The top-right bell opens a 430px task activity panel with Project-membership scope, push preference, event-type and read-state filters, unread treatment, direct task navigation, and Mark all read. Loading, no-notification, and no-filter-match states are distinct, so a pending query is never presented as an empty inbox.

The live desktop regression path created task `T-HQ3A7S6D` from the `JGHJGH` Channel message. The success toast appeared, the inline card linked to the new task, and its drawer displayed `JGHJGH` as message evidence. The same pass verified Board-to-In progress movement through the keyboard-accessible move action, List view rendering of Project- and Channel-scoped tasks, the full-width Unassigned selector, locale-formatted activity, and the task-comment mention list with four eligible Project members. The notification panel opened with preference and filter controls and the correct zero-state. No production system was accessed.

The source audit, implementation inventory, repository gate, and a partial live browser regression pass are complete. The implementation is not closed until the wider responsive, keyboard, theme, long-content, and assistive-technology matrix is executed.

## Workflow 3: Search, Evidence, and Memory

Workflow 3 uses one Project knowledge surface for retrieval, verification, and permission-aware context. It keeps the established Company and Project navigation, the selected-company thread rail, and Track's paper, ink, hairline, and amber token system.

- **Search Hub:** The centered command dialog now searches messages, files, tasks, threads, Channels, people, and the current Project. The header states the current Project scope, filter labels remain visible in a balanced two-row toolbar, result groups follow a stable order, and the footer exposes keyboard movement, opening, and closing instructions to assistive technology. Selecting a message or file opens its Channel and source message, selecting a thread opens the focused thread, selecting a task preserves the represented Company when opening its drawer route, selecting a person opens the represented Company's People view, and selecting the Project opens its overview.
- **Evidence Hub:** The primary stream groups task-linked sources into compact, scannable cards with source type, Channel scope, author, date, linked task, excerpt, and a visible Project-to-source provenance path. Local text and source-type filters do not widen the server-authorized result set. Loading, disabled, empty, and no-match states remain distinct.
- **Project Memory:** The memory view shows the memory-box state, runtime and schema when available, each visible import's source kind, scope, source count, processing state, summary, and date. The import action reuses the existing centered, focus-managed Text, Links, and Files dialog. Company-project imports remain Channel scoped by default, while archived participants receive a read-only snapshot state.
- **Evidence Preview Drawer:** Selecting evidence opens a focused right drawer with the excerpt, author, recorded time, availability, linked task, and a Project-to-Channel-to-thread provenance chain. The primary action returns to the original source and preserves message focus when a source message exists. Items without a navigable source show an explicit unavailable state.

The authenticated desktop regression pass opened Finance Dashboard at 1920 by 953, displayed one permission-filtered evidence source, opened its preview drawer, switched to Project memory, and opened the centered memory import dialog. The Search Hub rendered at about 630px wide with all eight filters visible in a balanced grid. The checked route retained the fixed left navigation and Company thread rail without document overflow. The Evidence link was exercised from Project Overview and returned to Project Knowledge with the represented Company and Project membership intact. Light and dark modes kept the same hierarchy, the dark Evidence Preview stayed within the viewport at 384px wide, and its source link preserved Company, membership, Channel, and message context. Browser logs contained no Track errors. Web lint and 37-file/104-test Vitest checks passed. Live people and Project search results require the development Convex deployment to load the changed backend function before they can be exercised end to end.

## Workflow 4: Company Collaboration

Workflow 4 uses one Company directory pattern for Projects, relationships, and people, then carries the same ownership and access language into Project participation. The screens reuse the approved Company shell, semantic theme tokens, thin borders, compact type scale, restrained amber selection state, and fixed desktop navigation.

- **Projects Directory:** A four-part summary separates total visible work, owned work, collaborating work, and items needing attention. Search covers Project name, description, and owning Company. All, Owned, Collaborating, Proposed, Archived, and Ownership pending filters preserve lifecycle boundaries. The directory shows owner, represented member role, status, update time, and a scoped Project link. Incoming proposals remain actionable through the existing accept and decline mutations, while internal and shared Project creation stay in progressive disclosures.
- **Relationships Screen:** The summary exposes relationship, active-partner, shared-Project, and invitation counts. Search covers relationship and participant Company names, while All, Active, Forming, and Inactive filters keep lifecycle state visible. Each partner card states the collaboration boundary as Company relationship to shared Project to explicit Channel access. Existing invite, participant, removal approval, leave, and shared-Project actions remain connected to their authorized Convex mutations.
- **People and Membership Screen:** The summary separates Company people, active people, administrators, and pending invitations. Search covers display name, email, and role. Active, Suspended, and Invited filters keep member records separate from invitations. Rows expose person, email, Company role, account state, and only the role or status actions allowed by the existing capability resolver. Pending invitations show exact email, role, expiry date, and pending state.
- **Project Participation Screen:** The Project context rail now leads with Company participation role, the current user’s Project role, Project lifecycle state, and the active represented-member count. A visible access-boundary notice explains that Project membership does not expose every Channel. Ownership confirmation, partner invitation, Project member management, Channel participation, archive approval, and Company exit controls keep their existing backend owners and failure handling.

The authenticated desktop regression pass opened Projects, Relationships, People, and the Project participation panel at 1440 by 1000. Project filtering and search produced the correct empty and ownership-pending states, changing Company views cleared stale search text, and the New relationship action opened its disclosure and focused Relationship name. The Project participation panel retained the 292px context rail, produced no document overflow, and exposed its structure as a named region. Light and dark modes both resolved through semantic tokens; System mode was restored afterward. Browser logs contained no Track errors. The only warning was the existing React Grab development-version notice.

## Workflow 5: Administration and Settings

Workflow 5 extends the approved Track desktop shell into administration without creating a second visual language. Project settings, Company settings, profile settings, and archive/recovery controls use the same fixed navigation, centered content measure, thin hairlines, paper surfaces, compact type scale, amber selection state, semantic light/dark tokens, and visible keyboard focus treatment.

- **Project Settings:** The Project settings route now starts with an identity and health summary, then exposes stable anchors for Details, Channels, Notifications, Access, Evidence, and Lifecycle. Existing Project identity editing, Channel creation and archiving, member invitations and roles, access mode, evidence retention, notification mode, and deletion actions remain wired to their authorized mutations. Lifecycle copy distinguishes active, archive-pending, and archived state, and explains that restoration requires participating Company approval.
- **Company Settings:** The Company settings route is a functional administration surface rather than a placeholder. It includes Company profile and handle editing, member role and suspension controls, invitation management, relationship visibility, access-boundary guidance, Company suspension, and owner-only close controls. The left anchor rail keeps long settings pages scannable while the summary strip makes handle, active people, relationships, and invitations visible before any destructive action.
- **Profile and Appearance:** Profile settings now include an explicit Appearance card with System, Light, and Dark controls. Profile copy states who can see the profile, security and timezone panels retain their existing behavior, and a scoped notifications card links back to Project and Channel notification controls instead of implying an unsupported global preference.
- **Archive and Recovery:** Project participation now shows the lifecycle boundary and a recovery stepper for snapshot capture, verification, and access removal. Pending, active, and failed snapshot states remain visible, with retry and finalize actions owned by the existing backend mutations. Project settings links to Company recovery controls so an administrator can follow the same boundary without guessing where recovery lives.

The authenticated browser regression pass rendered Project participation with the 292px context rail and verified the new lifecycle and recovery structure. It also rendered Company Settings with real Company data, the summary strip, anchor navigation, member actions, invitations, relationships, recovery guidance, and owner-only danger controls; the page had no document overflow or Track console errors. Chrome disconnected before the Profile route could receive a screenshot, so Profile visual parity remains unproved even though its route passed lint, typecheck, and production build. The direct Figma connector remains unavailable on the current plan; the implementation preserves the established Figma-derived Track shell and tokens rather than inventing a new visual system.

Focused source evidence for this workflow: web lint and typecheck passed; the Company collaboration, query-scope, and sidebar sizing regression files passed 13 tests; production build and production dependency audit passed. The required repository test gate remains not green because the existing Convex task-pagination test expects a filtered task that the current bounded page returns empty. That backend failure is outside the Workflow 5 files and was not changed in this pass.

## Required verification plan

1. Run the web lint, typecheck, unit tests, and production build using the repository commands.
2. Start the web app on localhost and test sign-in, onboarding, workspace loading, Company switching, Project switching, Channel navigation, thread reply, search, evidence, task creation, task editing, board movement, archive, and logout.
3. Repeat the primary flows at approximately 360px, 768px, 1024px, 1440px, 200% zoom, and 400% zoom.
4. Complete the same flows with keyboard only: Tab, Shift+Tab, Enter, Space, Escape, arrows, Home/End, and browser back/forward.
5. Test a screen reader in at least one desktop browser and verify landmark names, headings, live regions, dialog focus, menu focus, date-grid semantics, and status announcements.
6. Test light/dark themes, reduced motion, high contrast, offline/slow network, empty data, long translated content, and archived/read-only access.
7. Measure list rendering with 50, 500, and 1000 records. Record render time, interaction latency, memory, and scroll stability before selecting virtualization thresholds.
8. Run a scoped code review on the changed audit scope after remediation and keep screenshots for material layout changes.

## Prioritized remediation order

### P0: prevent broken or misleading interaction

- Verify the explicit shared transition properties and unsafe focus defaults in a browser with reduced motion enabled.
- Verify the date-picker locale formatting and calendar keyboard semantics; the picker now formats labels with the runtime locale.
- Add explicit scope to workspace, Project, task board, search, and Evidence surfaces.
- Prove dialog/menu/composer focus management and error recovery.

### P1: make daily work efficient

- Simplify task board controls and provide Move to… plus Undo.
- Rebuild checklist rows with descriptions and stable touch/keyboard targets.
- Consolidate composer inset ownership and async send feedback.
- Add bounded pagination or virtualization to large workspace, thread, task, and search lists.

### P2: polish and scale

- Complete RTL, locale, high-contrast, reduced-motion, and zoom verification.
- Align semantic tokens and responsive breakpoints across the shell.
- Add component contracts and regression tests for shared Button, Dialog, Menu, Select, DatePicker, Tabs, Toast, and navigation primitives.
