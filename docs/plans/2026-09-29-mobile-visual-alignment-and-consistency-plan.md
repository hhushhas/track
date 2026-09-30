# Track Mobile Visual Alignment and Consistency Plan

Status: In progress. My Tasks now uses compact, color-coded HomeStatCard summaries, a 12-point gap between the Project, search/filter, and task-view controls, and a registered create action for the plus button. Chat composition now has an iOS-specific pill treatment, send-to-latest handling, optimistic Channel text rows reconciled by message ID, and a visible document attachment action; Android keeps its existing composer layout. Profile appearance choices use a segmented pill, the identity card remains, Home unread count stays visible with revised placement, bottom navigation icons use circular surfaces, and option sheets use the native scroll indicator with a spring return for incomplete drags. The focused pending-message tests pass, and the root lint, typecheck, test, production audit, and build gates pass. The connected Android emulator shows the existing Chats, Channel, attachment, Profile, and task-create flows, but its app build identity was not captured, so those observations do not prove the exact source revision. iOS composer, current-source device review, message sending, and the broader route, content-extreme, accessibility, and platform audit remain open.

Owner: Track mobile

Review date: 2026-09-29

Scope: `apps/mobile` UI structure, alignment, spacing, typography, shared visual components, accessibility, and device verification. Product behavior and backend contracts are in scope only when a visual fix could change or obscure them.

## Outcome

Make the current mobile app feel like one coherent product across its primary tabs, contextual screens, sheets, and chat flows. People must be able to scan content, understand hierarchy, read text, reach controls, and complete common work without clipping, overlap, unexplained layout shifts, or inconsistent visual rules.

The plan covers both confirmed source inconsistencies and defects that can only be confirmed on a current build. Source inspection alone does not prove that a screen looks wrong or works. A screen is complete only after its important states have been exercised on supported devices and the result has been reviewed.

## Product and design constraints

- Keep the approved Track direction: warm-stone surfaces, dark-stone text, one purposeful yellow accent, direct language, and conversation-led project work.
- Keep the current four primary destinations and their approved order: Chats, My Tasks, Inbox, Profile. Chats is the display name for the existing Conversations route; keep Channel, Thread, Project, and Task Detail as contextual destinations.
- Preserve authorization, Company and Project scope, source-message links, navigation return behavior, accessibility labels, and all existing actions while changing presentation.
- Reuse shared tokens and components when the visual job is shared. Keep deliberate platform differences where the mobile product plan calls for them.
- Do not copy another product's screens. Use platform guidance and real references to validate familiar patterns while retaining Track's information model and visual direction.
- Keep every change reviewable. Do not reset, reformat, overwrite, or clean unrelated staged, unstaged, or untracked work.

## My Tasks hierarchy and visual rules

My Tasks must make the personal scope explicit before it shows counts or work. The screen order is:

1. **Title:** “My Tasks” identifies the destination, using the shared display type role.
2. **Company selector:** show the active Company name in a compact control beside the My Tasks heading, at about half the content width. This explains which Company's assignments the page includes and opens the existing Company switch sheet.
3. **Quick summary:** show Open, Needs attention, Today, and This week in a compact two-column grid. Give each metric a distinct soft semantic fill, a visible label, count, and short explanation. Keep every metric visible on a phone and preserve a 48-point touch area.
4. **Project scope:** use compact, horizontally scrollable choices for All Projects and individual Projects. Selection filters every task summary and task section consistently. Keep the detailed member and Channel overview cards for places where that team context helps.
5. **Find and filter:** align search, task filters, and Today/All tasks choices to the same page gutter. Use a clear selected state and retain the text labels for assistive technology.
6. **Work:** Today, week, attention, and assigned-task rows follow the same page edge. Each row gives the title the strongest type role, identifies the assignee, shows Project and Company context, and keeps Channel, due date, and status in a stable order. Today and selected-day empty states use a clear icon, heading, useful explanation, and a path to all tasks.
7. **Week selection:** show each weekday and date together inside a touchable pill. Keep the selected day distinct, announce its task count, and update the task list when selected.
8. **Attention:** keep this section only while its source rule remains overdue or high-priority work. Explain that rule in the interface and verify the helper against representative task states.

## Focused Chats and task-create behavior

- Display the existing Conversations route as **Chats** in the screen title and primary navigation; do not rename its route or alter deep links.
- Keep the Company selector compact beside the Chats title. Maintain clear vertical separation between the heading, Project pills, search field, and filter pills.
- Keep Channel opening on the main row. Add a separate accessible chevron that expands related Thread activity and unread details without nesting controls or changing Company and Project scope.
- Preserve grouped message rhythm: closely group consecutive messages from the same author, then add a larger gap before a new sender group. Keep readable bubble padding and message typography.
- Keep the global plus action context-aware. A selected Project opens task creation directly; without a selected Project, first ask where the task belongs, then open the task form in that Project. This preserves the product rule that every task belongs to a Project.

## Channel, Thread, Profile, and shell details

- On iOS, use a compact rounded composer shell with a plus attachment action, readable multiline input, a tactile send control, and a voice control that keeps the existing tap, hold, lock, cancel, and permission flows. Respect Reduce Motion and keep the Android composer layout, attachment icon, and control behavior intact.
- Keep Camera, Photo library, and Document available from the attachment action. Show a sent Channel message immediately, reconcile it by message ID, and move to the latest message after a successful send. In Thread, wait for the reactive list content to update before completing the send-to-latest scroll.
- Keep the Home bell unread count because it explains outstanding notifications. Place the badge within the bell's visual bounds, keep its count legible, and retain a useful accessibility label.
- Use round surfaces for Home header actions and bottom-tab icon wells. Keep primary navigation destinations and the central create action unchanged.
- Keep the Profile identity card. Present System, Light, and Dark as a single horizontal pill control with a clear selected state and screen-reader checked state.
- Remove decorative filled circles from iOS Channel and Thread back and overflow controls. Keep Android's established control treatment.
- Bound option sheets to the available screen height, let their content scroll with a native indicator, keep dragging within the sheet header, and settle an incomplete drag with a restrained spring. Verify sheet dismissal, scrolling, keyboard behavior, and Reduced Motion on device.

Use shared type roles so size, family, weight, and line height communicate the same hierarchy across screens. Use the 4-point spacing family for normal gaps and keep smaller optical gaps only where the component has a clear reason. Use a restrained surface fill or hairline border to group content; reserve shadow/elevation for elements that float above content, such as menus and sheets. A list row does not need a shadow to look interactive: its press feedback, target size, and accessible role provide that cue.

When the viewport narrows or text scales up, let text wrap or let horizontal controls scroll. Do not shrink task titles, overlap adjacent controls, or reduce the 48-point Android touch target to preserve a fixed layout. Check iOS target guidance separately during device review.

## Current baseline and evidence limits

The app already has a shared foundation in `src/constants/theme.ts`: light and dark semantic colors, typography roles, spacing values, radii, touch targets, and bottom navigation clearance. `ThemedText` applies the type roles and a maximum font scale. Several shared UI components use the spacing and radius tokens.

The source also contains local style overrides. Examples include independent title and input sizes in task, project, sign-in, chat, and navigation components; one-off line heights and letter spacing; and small spacing values such as 2, 3, and 5 points. Some are valid optical or platform adjustments. Their existence is a reason to audit them, not proof that each is a defect. A previous small Home typography pass has been made in a heavily modified worktree; inspect its exact diff before changing those files again.

The color and radius conflicts found between `STITCH-DESIGN-RULES.md`, `mobile-ui-ux-guide.md`, and `src/constants/theme.ts` are now reconciled in the two guides. Both document the current secondary and tertiary text colors and the semantic radius roles. The guides also identify smaller spacing values as optical or compact exceptions, which still need component-by-component review. The approved product direction and `src/constants/theme.ts` remain authoritative. Do not change token values in bulk until current-device screens validate the visible result.

The repository is broadly dirty, including staged and unstaged mobile UI files, plan documents, assets, backend files, and web files. Preserve all existing changes. Latest root checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`, and `pnpm build`. Tests passed with 35 mobile files and 144 tests, 47 web files and 133 tests, five shared files and 10 tests, and 20 backend files and 100 tests. The all-platform Expo export bundled Android, iOS, and web. On `emulator-5554`, Chats and a Channel loaded, the attachment menu displayed Camera, Photo library, and Document, the Profile screen showed its identity card and segmented System, Light, and Dark control, and the global plus opened the Project chooser followed by the New task sheet after a Project was selected. The task sheet was left unsaved. The app build identity was not captured, so the device observations do not prove the exact source revision. No message was sent. iOS composer behavior, current-source device review, sheet gesture states, dark mode, large text, accessibility, My Tasks, and the other route/state checks remain open. The project approval rule still applies before `npx expo run:android` can install the source on the emulator.

## Definition of a confirmed finding

Every finding must record:

1. Screen, route, state, platform, device, OS, theme, and text scale.
2. The visible problem and its user impact. Avoid vague descriptions such as “spacing feels off.”
3. Evidence: current-build screenshot, recording, accessibility observation, or reproducible source behavior.
4. Severity: blocker, high, medium, low, or accepted variation.
5. Owning component or screen and the smallest safe correction.
6. A check that proves the correction and a check that proves the surrounding behavior still works.

Mark a source-only concern `needs device review`; do not record it as a confirmed visual defect until it is observed.

## Work phases

### Phase 0: Protect work and establish a usable baseline

1. Record the repository root, branch, staged diff, unstaged diff, and untracked paths. Build a path ownership list for every file likely to change.
2. Inspect the staged and unstaged versions separately for the shared theme, text wrapper, route layouts, Home components, navigation, and screens. Do not infer ownership from `git status` alone.
3. Inventory current routes and map each route to its rendered screen and shared components. Resolve route aliases and old destinations from the current route tree; do not remove or rename routes as part of a visual cleanup without caller analysis.
4. Record package scripts, Node and pnpm versions, active Expo configuration, app version, and current lint, typecheck, test, audit, and export/build results. Save exact errors, including the two known typecheck errors, if they remain.
5. Check whether a compatible emulator or device and current app build are already available. Record installed build identity and connection path before relying on screenshots.
6. Do not run a protected native generation or install command without the explicit approval required by the mobile repository instructions. If a fresh native build is necessary, finish the visual audit plan and state the exact command, target, and possible generated changes before requesting approval.

**Exit evidence:** preserved-worktree map, route/component map, exact current build/device status, automated baseline, and an evidence folder that distinguishes current captures from historical screenshots.

### Phase 1: Audit and resolve the design contract

Create a token and usage audit for color, type, spacing, radii, borders, touch targets, screen gutters, and safe-area handling.

1. Compare `mobile-ui-ux-guide.md`, `STITCH-DESIGN-RULES.md`, `docs/DESIGN.md`, the approved conversation-first plan, and `src/constants/theme.ts`. List each conflict and the surfaces affected.
2. Confirm the authoritative type roles and usage rules: screen title, section title, row title, body, message, field label, metadata, caption, and identifier. Record font family behavior by platform and define when local font overrides are allowed.
3. Confirm screen horizontal inset, compact and standard row gaps, section spacing, card padding, control padding, radius scale, and minimum target sizes. Use the existing 4-point spacing family as the default; document any smaller optical adjustments by component and reason.
4. Decide the card-radius conflict using current Home, list, sheet, and detail screens on both platforms. Do not force every surface into one radius if cards, controls, and pills have distinct semantic roles.
5. Reconcile the theme color documentation with actual light and dark theme tokens. Check contrast for secondary text, tertiary metadata, accent text, selected states, and status colors before changing values.
6. Set a rule for when to use `ThemedText` and when a raw React Native text input or custom text style is appropriate. Give text inputs shared font family, size, line height, and scaling behavior where the platform supports them.
7. Create a compact approved token table in the guide and keep `theme.ts` as the implementation source. Avoid adding a second token file or duplicating values in screens.

**Exit evidence:** one reviewed token contract, documented exceptions, and no unresolved guide-versus-code conflict for values that implementation will change.

### Phase 2: Capture and inspect every important screen family

Capture the current build before editing. Use the same content fixtures and viewport for before-and-after comparisons. Keep screenshots grouped by platform, route, theme, and text scale.

| Screen family | Routes and primary surfaces | Inspect |
|---|---|---|
| App shell | Session restore, sign-in, four tabs, plus action, tab stacks | Safe areas, tab alignment, selected state, screen title placement, system bars, keyboard and back behavior |
| Chats (Conversations route) | Company selector, Project pills, search, filters, grouped Channel and Thread feed | Header alignment, selected scope, row hierarchy, unread activity disclosure, long names, filter rhythm, loading/empty/error states |
| Channel and Thread | Message list, replies, media, task cards, composer, action sheets | Message grouping, sender/time hierarchy, incoming/outgoing balance, reply context, composer/keyboard clearance, control targets |
| My Tasks | Summary, scope, filters, week strip, list and board | Scope clarity, filter alignment, dates/counts, card density, section rhythm, empty and pagination states |
| Task Detail | Title/status, properties, description, checklist, evidence, activity, composer | Reading order, hierarchy, truncation, edit controls, source links, long content, keyboard and bottom inset |
| Inbox | Activity rows, filters, invitation and update states | Title/context distinction, unread emphasis, metadata order, action affordance, cross-Company context |
| Profile and utilities | Profile, notifications, Company/project settings, sheets, date/timezone controls | Form labels, section spacing, control alignment, destructive actions, sheet height and keyboard behavior |
| Project surfaces | Projects directory, Project overview, Channel/project settings | Project identity, navigation context, metrics, rows/cards, role/status metadata, narrow layouts |

For each family inspect light and dark themes, ordinary content and long content, and loaded plus relevant loading, empty, error, disabled, and offline states. Do not manufacture irrelevant states where the route cannot have them. Record text wrapping and line limits, baseline alignment, icon optical centering, gutters, section gaps, and last-row clearance.

**Exit evidence:** a finding register with severity, route, state, evidence link, and owner. No screenshot is described as current unless it came from the identified current build.

### Phase 3: Fix shared foundations first

Fix a shared issue at its owning component once. Do not add per-screen offsets to compensate for a shared component defect.

1. Normalize typography roles in `ThemedText` and migrate repeated screen-local values to those roles. Keep numerical display values tabular where useful and identifiers mono only where semantically correct.
2. Align shared screen gutters, content containers, section gaps, compact row gaps, and bottom content insets with the approved spacing contract.
3. Review `AdaptiveListRow` and competing row implementations. Define a shared row anatomy for leading identity, title, secondary context, metadata, and trailing state. Reuse it only when the content model truly matches; keep chat message grouping separate.
4. Review `ActionButton`, `IconButton`, filters, selectors, Company/Project pickers, cards, banners, empty states, skeletons, and sheets for consistent alignment, typography, borders, radii, and touch areas.
5. Give React Native `TextInput` instances the shared typography and alignment contract. Check placeholder, entered text, selection, multiline growth, and platform-specific vertical centering.
6. Remove stale style rules only after confirming there are no callers. Keep dynamic sizing for avatars, badges, and content-driven layouts where it is intentional.
7. Preserve accessibility labels, roles, states, font scaling, focus order, and hit slop. Do not fix alignment by shrinking essential text or touch targets.

**Exit evidence:** repeated components share the agreed rules, local deviations have documented reasons, and focused checks show no route, interaction, or accessibility regression.

### Phase 4: Correct screen-level hierarchy and alignment

Work in small route groups after shared components stabilize. For each route, compare its title, section start edges, content gutters, row baselines, vertical rhythm, metadata alignment, and bottom clearance against the approved contract.

1. **App shell and Chats:** align Company identity, search/filter controls, Project pills, feed sections, and loading/empty states. Confirm the selected Company/Project remains visually clear without changing scope behavior.
2. **Channel and Thread:** align message content, sender identity, timestamps, reply previews, attachments, task references, and composer. Preserve the distinction between Channel and Thread context.
3. **My Tasks and boards:** align summary metrics, Company/Project scope, filters, date strip, section headings, list rows, board columns, and task cards. Keep project-wide board scope distinct from personal assigned work.
4. **Task Detail:** establish a stable order and alignment for title, status, Project and source context, properties, description, checklist, evidence, updates, and composer. Keep durable source-message navigation obvious.
5. **Inbox and Profile:** standardize row hierarchy and metadata placement; keep global Inbox context distinct from selected Company surfaces; align account settings and grouped controls.
6. **Projects, Project overview, settings, notifications, and sheets:** apply the shared content gutter and type roles, retain platform navigation behavior, and handle compact widths and keyboard presentation.
7. Remove duplicate or contradictory labels only when the same intent is actually repeated; do not alter product language or information architecture as a side effect of spacing work.

Every visual patch must include an observation, a correction, and a before/after capture at the same viewport/state. Avoid broad reformatting because this worktree contains existing changes.

**Exit evidence:** every in-scope route has a current screenshot review, every confirmed medium-or-higher finding is fixed or explicitly accepted with an owner, and the main user flows still preserve their original state and navigation behavior.

### Phase 5: Accessibility, content extremes, and platform review

1. Check the smallest supported width and a representative larger phone on iOS and Android.
2. Check normal and largest supported Dynamic Type/font scaling. Text must wrap or scroll; it must not clip, overlap, disappear, or shrink below the agreed readable size to preserve a fixed layout.
3. Check long Company, Project, Channel, Thread, task, sender, and message names; zero/large counts; multiline messages; long URLs or identifiers; and translated/expanded copy where available.
4. Verify screen-reader names, reading order, selected/disabled/busy states, error announcements, and alternatives to swipe or long press.
5. Verify 44-point iOS and 48-dp Android interactive targets, contrast in both themes, focus visibility, and non-color indicators for selection and status.
6. Verify top and bottom system insets, gesture and hardware back, keyboard show/hide, sheet drag/dismissal, Reduced Motion, and Reduced Transparency where the UI uses transparency.
7. Record unsupported combinations and platform limitations instead of claiming universal support.

**Exit evidence:** a route-by-platform accessibility matrix with observations and no open critical or high-severity issue.

### Phase 6: Regression and release verification

1. Re-run mobile lint, typecheck, and tests after the focused visual changes. Resolve pre-existing baseline failures or keep them clearly separated with owner and exact error; do not attribute them to visual changes without evidence.
2. Run the required monorepo gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`, and `pnpm build`. Report each command and result. Do not skip or weaken a failing check.
3. Export/build the affected app using an approved, non-destructive path. Obtain the required explicit approval before any protected native command listed in `apps/mobile/AGENTS.md`.
4. Exercise the real paths on current builds: session restore to Conversations; Company/Project selection and search; Channel and Thread reading/reply; create a source-linked task; My Tasks and Task Detail return; Inbox item routing; Profile/settings; and sign-in recovery.
5. Record device model, OS, app/build identity, account role, scope, theme, text scale, scenario, result, and screenshot or recording for each critical path.
6. Review the final diff line by line, preserving unrelated staged and unstaged hunks. Check generated files, assets, secrets, debug output, route changes, and documentation.
7. Update `mobile-ui-ux-guide.md` to the accepted final rules and update the professionalization plan only where its current-state evidence has changed. Do not append contradictory amendments; rewrite the current state accurately.

**Exit evidence:** all required automated checks pass, critical paths work on supported iOS and Android builds, findings are closed or explicitly accepted, the final diff is scoped, and current evidence can be reproduced.

## Finding register template

Use one record per defect:

```text
ID:
Severity:
Route/component:
Platform/device/OS:
Theme/text scale/content state:
Observed defect and user impact:
Evidence path:
Root cause:
Smallest correction:
Behavior/accessibility risk:
Focused regression check:
Before/after evidence:
Status/owner:
```

## Completion criteria

The plan is complete only when all of the following are true:

- The design guide and implementation agree on the active type, spacing, color, radius, gutter, and touch-target rules.
- Every in-scope screen family has been reviewed on a current build, not only in source or historical screenshots.
- Repeated components use shared rules, and every approved exception has a reason and owner.
- No critical or high-severity visual, content, accessibility, or alignment defect remains open.
- Long content, empty/loading/error/offline states, large text, both themes, keyboard, and safe areas have evidence appropriate to each screen.
- Existing route, scope, permission, message/task, and navigation behavior remains intact.
- Required automated gates and real-path device checks pass, or any blocker is reported with exact evidence and a named next action.
- The final repository diff contains only intended work and preserves all pre-existing user changes.

“Every possible screen and device combination” is not a testable finite promise. This plan uses a route/state matrix, boundary cases, and representative device coverage so remaining limitations are explicit rather than hidden behind a blanket claim.
