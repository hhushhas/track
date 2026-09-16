# Track Mobile UX and UI Implementation Plan

Date: 2026-09-11  
Status: Ready for discussion and staged implementation  
Scope: `apps/mobile` user experience, visual system, navigation, and interaction patterns

## Product outcome

Track must feel understandable at first glance. A new user should know where they are, what the
current Company and Project scope is, what needs attention, and what action will happen after a tap
without reading a manual. The visual system must stay calm and minimal while the interaction model
still gives immediate feedback.

This plan adapts recurring patterns from the supplied task-management references. Those references are
inspiration, not a reason to copy portfolio screens. The implementation must preserve Track's
Company, Project, Channel, thread, evidence, task, and authorization model.

## Design principles

1. **Clarity before decoration.** Every screen has one primary job and one visually dominant action.
2. **Scope is always visible.** Global, Company, Project, Channel, and task scope must never be
   inferred from a selected row or hidden filter.
3. **Progressive disclosure.** Show the decision-critical information first; place advanced filters,
   descriptions, and administration in labelled sheets or expandable sections.
4. **Native behavior.** Use native controls and platform conventions for calendars, keyboards,
   gestures, back navigation, safe areas, and accessibility.
5. **Feedback is part of the action.** Press, loading, success, failure, offline, and Undo states are
   designed together with the default state.
6. **One visual language.** Track yellow is the single accent. Neutral surfaces carry most of the
   interface. Use glass only for the iOS navigation layer where it has a clear functional purpose.
7. **Content earns space.** Cards and sheets grow from their content. Fixed empty heights, unexplained
   blank areas, and duplicated inset ownership are defects.

## Information architecture

| Destination | User question | Default scope | Primary action |
|---|---|---|---|
| Home | What needs my attention? | All accessible Companies and Projects | Open the exact item |
| Projects | Where do I want to work? | Accessible Project memberships | Open Project |
| Tasks | What work is assigned to me? | Global My Tasks | Open task |
| Evidence | What source supports this work? | Selected Company → Project, Channel optional | Search or open source |

Project work then follows: Projects → Project overview → Board, Channels, Evidence, or project task
list. A task deep link must preserve `projectId`, represented `companyId`, `membershipId`, `boardId`,
`taskId`, and read-only/archive context.

## Shared visual system

### Tokens

- Use semantic light and dark tokens for canvas, surface, raised surface, text, secondary text,
  border, accent, success, warning, danger, and disabled content.
- Keep one accent hue across buttons, selected states, progress, and focus accents. Do not introduce
  a new accent per feature.
- Use a 4-point base rhythm. Preferred gaps and paddings are 4, 8, 12, 16, 24, and 32.
- Define one radius scale: compact controls, cards, sheets, and full pills. Use continuous corners on
  iOS rounded rectangles.
- Define one elevation scale. Use restrained borders and shadows; do not add glow to normal cards.

### Typography

- Use the platform type ramp: screen title, section title, headline, body, footnote, and caption.
- Use one display size per screen. Keep metadata smaller and lower contrast, but still readable.
- Limit titles to two lines in cards and show a deliberate truncation affordance where needed.
- Use tabular numerals for counts, dates, and progress values.
- Use the existing app fonts and locale-aware line heights. Verify Arabic/Urdu shaping and long
  translated strings before sign-off.

### Controls

- Minimum touch target is 44pt on iOS and 48dp on Android.
- Every icon-only control has an accessible label and a visible pressed state.
- Use SF Symbols on iOS and Material Symbols on Android. Do not mix unrelated icon families.
- Buttons have explicit default, pressed, focused, disabled, loading, success, and error states.
- Animate only intentional properties such as opacity, transform, and background color. Respect Reduce
  Motion and avoid `transition-all`-style broad transitions.

## Screen plans

### Home: global attention inbox

The header must state that the feed spans every accessible Company and Project. Order items by
mentions/tags first, then assigned overdue work, then recent discussion and task activity. Each item
shows Company · Project, Channel or task context, author, timestamp, unread state, and the exact
destination it opens.

Provide distinct loading, empty, offline, and error states. The empty state explains that mentions and
assigned work will appear here. Do not automatically switch the current Project because one Company
has the most notifications. Attention changes order and badges; the user controls context.

### Projects: resume work and choose context

Use four sections: Needs attention (maximum three), Recent (three to five), All projects grouped by
Company, and a collapsed Archived/read-only section. A row contains Project name, Company name,
attention count, open assigned task count, last meaningful activity, and archive/read-only status.

Keep account, appearance, privacy, deletion, and sign-out actions in Profile/Account. A project row is
an explicit navigation target, not a hidden context switch. Empty states distinguish no memberships,
no recent projects, and no attention items.

### Project overview

Lead with Company → Project identity, access state, attention summary, and the next useful action.
Use explicit actions: Open board, Channels, Evidence, and View tasks. Rename ambiguous “Open
projects” actions to the exact destination. Archived or read-only access remains visible in the header
and disables only actions the backend rejects.

### Tasks inbox

Default to global My Tasks. Each card shows title, Company · Project, status, due date/overdue state,
priority, assignee, checklist progress, and evidence count. Selecting a card opens the task directly.
Keep filters compact: My/All and Filter. Put assignee, priority, due date, labels, completed, and
empty-column options in a filter sheet. Persist meaningful filter state in the route when the existing
navigation supports it.

### Project Kanban board

On phones, show one status column at a time. A sticky header contains Company → Project, board
selector, My/All scope, and Filter. A horizontal status strip shows status name and count; the active
column scrolls vertically. Hide empty columns by default and collapse a large Completed column.

Cards are content-driven and show a two-line title, priority, due date, assignee, checklist progress,
and evidence count. Full descriptions remain in task detail. Cross-column drag is optional; the
primary action is card status → Move to… → destination status → optimistic update → Undo. Read-only
boards expose the reason actions are disabled.

### Task detail

Start with title, Company → Project context, status, priority, assignee, board, and due date. Use
compact labelled controls for finite values. “View project” opens the exact Project overview. “Show
on board” opens the exact board, status column, and highlighted task.

Checklist items are expandable subtasks with a 44pt/48dp row, checkbox, one- or two-line title,
description preview, and overflow actions. Completing a parent with open items presents the count and
Review checklist, Complete anyway, and Cancel. Completion provides haptic feedback and Undo.

Labels stay compact. When none exist, show Add labels inside More details instead of an empty block.

### Create-task sheet

Use a short form-sheet with grouped sections: title and description, then assignment and planning.
Assignee, priority, status, and board are select controls with current values, not large text fields.
Date opens a themed modal calendar. The sheet uses one scroll owner and displays a progress scrollbar
only when the content is genuinely scrollable; the scrollbar never replaces section headings.

Preserve values after validation, prevent duplicate submits, show request progress, and announce
success/failure. The submit control remains reachable above the keyboard and home indicator.

### Evidence

Replace the primary Search tab with Evidence while retaining search inside Evidence. Use one compact
scope control: Company → Project → Channel, with Channel defaulting to All accessible channels.
Results state whether they are messages, files, references, or task-linked evidence and retain source
context: Project, Channel, thread, author, and date. Empty and no-results states explain what counts as
evidence and how to change scope.

### Threads and conversation

Keep the first message author in a consistent pill, but prevent the pill from consuming the message
preview width. Group author, timestamp, message, attachments, replies, and unread state in a stable
reading order. Reply, edit, report, and remove actions live in an item menu rather than a dense row.

The composer owns its internal padding. Navigation owns the closed-keyboard safe area, and the
keyboard controller owns keyboard movement. Do not combine multiple inset systems. Preserve draft text
and attachments through retries, offline transitions, and route changes. Send state must distinguish
queued, sending, sent, and failed.

### iOS bottom navigation

Use four labelled destinations: Home, Projects, Tasks, Evidence. The bar has a transparent/glass
surface so content remains visible beneath it, with sufficient contrast in both themes. The selected
indicator is a continuous rounded pill with the icon and label optically centered. Hold and drag may
move the indicator with a spring and gooey stretch, but release must snap to the nearest destination,
announce the selected tab, and remain usable with Reduce Motion. The pill may extend beyond the bar
border without clipping; the bar itself must not become a touch-blocking opaque rectangle.

Android keeps its existing bottom navigation behavior unless a separate Android decision is approved.

## Navigation and state rules

- Tabs are peers. Switching tabs does not slide content and preserves each tab's stack.
- Push deeper screens; use sheets for short selection/filter tasks; use modal stacks for multi-step
  creation; use replace for one-way auth/onboarding completion.
- Back always undoes navigation. It may be blocked only for an in-flight irreversible request or
  unsaved modal work with an explicit confirmation.
- Server state remains in the existing Convex/query layer. Ephemeral sheet, focus, and scroll state
  stays local. Avoid introducing a second source of truth for theme, locale, or authentication.
- Optimistic mutations must include rollback/error feedback and an Undo action where appropriate.

## Accessibility and localization gates

- Verify VoiceOver and TalkBack labels, focus order, modal focus trapping, Escape/back dismissal, and
  focus restoration for every sheet, dialog, menu, and picker.
- Verify Dynamic Type/large font sizes, 200% text scaling, screen zoom, and long translated strings.
- Use locale-aware date and number formatting with an explicit time-zone policy.
- Set RTL direction at the shell. Keep brand marks unmirrored and use `dir="auto"`-equivalent behavior
  for user-generated text.
- Do not communicate status by color alone. Announce loading, success, failure, queued, and offline
  states.

## Implementation phases

1. **Baseline and tokens:** inventory current components, remove conflicting spacing/inset ownership,
   define semantic colors, type ramp, radius, elevation, icon, and motion tokens.
2. **Navigation and shell:** correct iOS safe areas, bottom navigation glass/pill geometry, scope
   headers, tab semantics, and back behavior. Leave Android navigation unchanged.
3. **Home and Projects:** implement global attention ordering, project grouping, recent/archived states,
   and explicit Company → Project context.
4. **Tasks and board:** simplify controls, implement one-column mobile board, Move to… with Undo,
   card hierarchy, status completeness, and deep-link preservation.
5. **Task creation/detail:** implement compact selects, themed modal calendar, expandable checklist
   descriptions, validation retention, keyboard-safe sheet behavior, and conflict handling.
6. **Evidence and threads:** establish scoped Evidence search, source context, author pills, composer
   inset ownership, attachment states, and thread focus behavior.
7. **Hardening:** test localization, RTL, themes, offline/error paths, performance, accessibility,
   and release builds. Remove temporary compatibility code after verification.

## Regression matrix

Test every phase on compact iOS, standard iOS, large iOS, 360dp Android, 393dp Android, and a large
Android device where supported.

- First launch, returning launch, signed-out, signed-in, expired session, and offline startup.
- System light/dark, stored Light/Dark/System preferences, and theme switching during a session.
- English LTR and every configured RTL locale with long Company, Project, task, and thread names.
- Home global feed ordering, mention priority, unread counts, empty state, retry, and deep links.
- Project grouping, archive/read-only access, recent ordering, and no-access behavior.
- Task list filters, board selector, all statuses, status counts, hidden empty columns, completed
  collapse, Move to…, optimistic failure, Undo, and read-only behavior.
- Create-task sheet scrolling, progress scrollbar, keyboard opening/dismissal, modal calendar,
  validation, duplicate-submit prevention, and restored draft values.
- Task detail checklist expansion, descriptions, labels, conflict resolution, and exact board routing.
- Thread author pill, reply spacing, load older messages, attachments, draft preservation, failed send,
  retry, and keyboard-safe composer layout.
- iOS pill press/hold/drag, snap behavior, clipping, reduced motion, VoiceOver, and content visibility.
- Android bottom navigation unchanged and Android calendar presented as a modal.

## Definition of done

- A new user can identify scope and the next action on every primary screen without instruction.
- All primary flows work in light/dark themes, LTR/RTL, large text, offline/error states, and supported
  device sizes.
- No screen has duplicated keyboard or safe-area padding, clipped controls, hidden status options, or
  ambiguous project routing.
- All touch targets meet platform minimums and all meaningful controls are announced correctly.
- Lists are bounded or virtualized where they can grow.
- Motion is purposeful, interruptible, reduced-motion aware, and verified in a release-style build.
- Focus, back navigation, optimistic updates, rollback, and Undo are tested on the real user path.
- Typecheck, lint, tests, build, and a simulator/emulator walkthrough pass before release.

## Decision gates before implementation

Approve the four-destination information architecture, the one-column phone board, the modal calendar,
the expandable checklist, and the iOS-only glass navigation behavior as the product baseline. Any
departure should name the affected user job, scope rule, platform behavior, and regression test.
