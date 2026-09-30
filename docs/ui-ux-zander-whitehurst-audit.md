# UI/UX audit against Zander Whitehurst's public design principles

Date: 2026-09-23

## Audit status

This is a source-based product audit. The live X profile returned HTTP 403 in
the available browser, so the profile was reviewed through an indexed public
mirror. The mirror exposes the profile identity, post titles, metadata, and
comments, but the embedded videos did not play. This report treats the titles
as design prompts, not as proof of every video detail.

The audit covered the current Track mobile source under `apps/mobile/src` and
the current web source under `apps/web/src`. It did not claim a fresh emulator
or browser visual pass, because no new runtime session was started for this
report. Runtime screenshots and interaction checks are required before any
finding is marked fixed.

## Source and confidence

- Profile index: [Zander Whitehurst on 24vids](https://www.24vids.com/channel/zander_supafast).
- Relevant indexed posts: [mobile menu columns](https://www.24vids.com/video/stop-adding-columns-to-mobile-menus-p-tw-2102397708807934324), [centered text](https://www.24vids.com/video/stop-centering-text-in-your-ui-p-tw-2090368430914310313), [borders](https://www.24vids.com/video/stop-adding-borders-to-your-ui-p-tw-2080000671781110136), [content](https://www.24vids.com/video/stop-adding-content-to-your-ui-p-tw-2053925539019165904), [containers](https://www.24vids.com/video/stop-adding-containers-to-your-ui-p-tw-2084623671444799847), and [primary buttons](https://www.24vids.com/video/stop-designing-with-primary-buttons-p-tw-1802684455670136954).
- Platform check: Apple says a tab bar is for navigating between top-level areas, while actions belong in a toolbar. Apple also recommends labels and avoiding hidden overflow navigation. See [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) and [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars).
- Accessibility check: touch targets, focus visibility, and non-text contrast must remain visible and usable when borders or containers are reduced. See [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [focus appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance), and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).

## The design principles extracted from the profile

The repeated theme is reduction with intent:

1. Remove layout structures that do not improve grouping, scanning, or action
   clarity.
2. Prefer one strong hierarchy over several equally loud panels.
3. Do not center long-form content when left alignment improves reading.
4. Do not use borders, cards, or containers as decoration. Use them when they
   explain ownership, scope, state, or interaction.
5. Make primary actions deliberate. A screen should not make every action look
   primary.
6. Use established platform icon systems instead of custom icon drawings.
7. Preserve useful context when simplifying. The comments on the indexed posts
   repeatedly warn that aggressive reduction can hide search, remove context,
   lower contrast, or make controls harder to discover.

The final caveat is important: these are reduction heuristics, not universal
rules. Track is a permission-aware work system. Company, Project, Channel,
thread, task, evidence, and status are not decorative content. They must remain
visible when they change what the user can see or do.

## Executive verdict

Track is directionally aligned with the principles, but the product still has a
hierarchy problem. The mobile Home screen is well ordered in source as Task
status, Projects, Today's Tasks, then Attention, but each section contains a
large surface, multiple labels, and several secondary actions. The web client
adds another layer of panels, rails, filters, and parallel global views. The
result is not a lack of polish; it is competition between too many valid
things.

The highest-value correction is to establish one reading path per screen:

```text
identity and scope -> primary decision -> supporting context -> secondary actions
```

Anything that does not serve that path should be collapsed, moved to a focused
destination, or removed. Do not remove context that explains permission,
ownership, source, or state.

## Findings by surface

### 1. Mobile Home

**What is working**

- `src/screens/today.tsx:235-250` has the correct top-level order: Task status,
  Projects, Today's Tasks, Attention.
- `src/components/company-project-carousel.tsx` keeps the next Project card
  partially visible, which communicates horizontal continuation.
- Project cards expose the Project name, role, Company, task count, Channel
  count, members, Open Project, and a Channel drawer. This supports real work
  context rather than a purely decorative dashboard.
- `src/components/company-work-sections.tsx` gives today's task a clear title,
  Channel pill, date, comments, assignee, progress, status, and board route.

**Confirmed gaps**

- The Project card is a nested container: artwork, primary area, project mark,
  details row, avatars, Open Project pill, black arrow button, and optional
  Channel drawer. Each element is defensible, but the combined card has too
  many competing boundaries. This is the clearest mobile example of the
  profile's “containers” warning.
- The Project card has two ways to open the same Project: tapping the main card
  and tapping Open Project. Keep the whole card tappable, but make the explicit
  button a compact secondary affordance, not a second visual primary action.
- The Project card uses a decorative artwork layer behind operational content.
  The artwork is acceptable only when text contrast remains stable in light and
  dark themes. This needs runtime contrast checks on short and long Project
  names.
- Today's Tasks is another horizontal card carousel. Projects and Today's Tasks
  therefore use the same interaction pattern twice in one scroll. Keep the
  Project carousel because it previews scope; consider a vertical compact task
  list or a single featured task plus “View all” for Today's Tasks.
- Task status uses four large cards and then Today's Tasks repeats task state,
  date, progress, and status. The summary should remain, but it should be a
  navigation summary, not a second task browser.
- The Home surface contains “See all” actions for several sections. If every
  section has a See all action, the page becomes a directory rather than a
  focused landing screen. Keep it for Projects and My Tasks; use a count or
  inline link for low-priority sections.

**Recommendation**

Keep the current section order. Reduce the visual weight inside each section:
use one Project card action row, one compact task preview pattern, and fewer
decorative boundaries. Do not remove Company, Project, Channel, status, or
source context.

### 2. Mobile My Tasks

**Confirmed gaps**

- `src/components/tasks-dashboard.tsx` puts board selection, search, filter,
  and view switching in a compact toolbar, then adds a second horizontal status
  flow. This is useful power, but the first viewport can feel like controls
  before work.
- The screen mixes board context, view mode, filters, suggestion review, and
  task content. A first-time user must infer which control changes the scope
  and which changes only the presentation.
- The product history includes duplicate task headings and completed-task
  visibility problems. Even when the current code path is corrected, the
  information architecture is fragile because the screen title, board selector,
  and task content can all communicate “My Tasks.”

**Recommendation**

Use one title, one compact scope control, and one segmented presentation
control. Put search and filters behind a single Filter button with an active
count. The board drawer should be an in-screen bottom drawer as requested,
with Company and Project grouping, but it should not become another full
navigation surface.

### 3. Mobile task detail

**What is working**

- `src/screens/task.tsx` makes status, due date, assignee, priority, and the
  next decision actionable.
- Status and due date controls are visible controls, not hidden gestures.
- Task updates are summarized and routed to `task-history`, which is better than
  placing the complete activity feed in the main detail scroll.
- Loading, offline, read-only, restricted-context, conflict, and error states
  are represented explicitly.

**Confirmed gaps**

- The hero, next-decision panel, checklist/description/references, and updates
  summary are still stacked as several large surfaces. The user must scan many
  containers before reaching the task's actual work.
- “Project context” and board metadata are visually close to the title and
  status controls. Context should be quieter than the task title and decision.
- The task detail screen has no single visual explanation that status and due
  date are editable. The controls are present, but their affordance depends on
  recognizing them as pills. Add a small “Tap to edit” hint only on first use
  or use a consistent trailing chevron/edit icon. Do not add a permanent helper
  sentence to every task.
- The updates summary is a good separation boundary. Keep the full activity and
  discussion out of the main screen unless the user opens “Task updates.”

**Recommendation**

Use this hierarchy:

```text
task title and key -> status / due date / assignee -> next decision
-> checklist and description -> linked source context -> task updates
```

Labels remain useful when they affect filtering or automation, but they should
live in a compact “Details” row or an overflow editor rather than becoming a
full section when empty. Description and checklist stay on the main detail
surface because they explain the work. Activity and discussion stay behind the
updates destination.

### 4. Mobile Inbox, Threads, and Conversation

**What is working**

- `src/screens/inbox.tsx` uses pill filters and a visible source-thread pill.
- Inbox now has an explicit top inset and a non-transparent native header, which
  prevents filters from sitting behind the header.
- `src/screens/threads.tsx` has an in-screen preview drawer and loading states.
- `src/screens/conversation.tsx` and `src/screens/thread.tsx` use platform-aware
  headers and the shared `PlatformIcon` mapping.
- The recent icon direction is sound: reuse platform symbols and semantic names
  rather than inventing a custom icon family.

**Confirmed gaps**

- Inbox filters, thread status filters, search, and source pills all use pill
  language. Pills are helpful for state and compact metadata, but using them for
  every control makes the hierarchy flat and visually noisy.
- The Threads screen has a context card, segmented filters, search, preview
  drawer, list rows, and creation actions. This is functionally rich, but the
  first viewport needs one dominant task: browse threads or create a thread.
- Channel, thread, and inbox surfaces can show similar message previews. The
  distinction must be explicit: Inbox is “needs my attention,” Threads is
  “focused Channel discussions,” and Conversation is “the complete Channel
  stream.”

**Recommendation**

Use pills for filters and status only. Use a plain search field, simple list
rows, and one neutral preview surface for content. Keep the preview drawer to
the last message plus Project, Channel, thread name, unread state, and Open
thread. Do not repeat the full conversation in the drawer.

### 5. Mobile Team / Project Health

**Confirmed gaps**

- Team is a global work surface with Project and task health. That makes it
  useful, but it overlaps with Home when both show Project progress, task counts,
  and member information.
- The Project Scope tab was correctly treated as optional rather than a default
  destination. Scope belongs in Project details or settings unless it supports
  a recurring decision.
- Stats cards can use color, but color must support a label and number. It must
  not become the only status signal.

**Recommendation**

Keep Team as the cross-Project workload and people surface. Home should answer
“what needs my attention now,” while Team answers “how is the wider team and
Project portfolio doing.” Remove repeated explanatory copy and avoid putting
the same Project progress row in both places unless the context changes.

### 6. Web company dashboard and global work

**Confirmed gaps**

- `CompanyOverviewDashboard.tsx:140-170` presents four stats, Project progress,
  Recent activity, workload, activity charts, partners, and quick actions. This
  is a full operations dashboard, not a lightweight overview. The structure is
  valid for an administrator, but it needs progressive disclosure for normal
  users.
- `CompanyGlobalWork.tsx:113-158` combines task summary cards, a task toolbar,
  task list, and a Project-grouped global thread browser. The user can switch
  between tasks and threads, but the page still exposes both concepts in the
  same overall surface. This risks becoming a second Home and a second Inbox.
- The global task toolbar has seven filter choices plus search. This is powerful
  but too much for the default viewport. Use the most common filters first and
  place the rest behind More filters with a visible active count.
- Company threads are grouped by Project, which is correct for scope, but every
  Project group can contain its own search, status controls, and thread list.
  The repeated controls create a large vertical cost.

**Recommendation**

Give the Company page one default job: portfolio overview for administrators or
cross-Project work for contributors. Keep a clear mode switch for Tasks and
Threads, but do not render both full browsers as equal peers by default. Move
the second browser behind a deliberate mode change.

### 7. Web navigation and Project workspace

**What is working**

- `WorkspaceSidebar.tsx` makes Project and Company identity explicit.
- Project Channels are grouped, unread thread counts are shown, and Search,
  Tasks, and Settings are separated from Channel navigation.
- `CompanyProjectNavigation.tsx` preserves Company, Project, and represented
  membership context.

**Confirmed gaps**

- The web workspace uses a persistent sidebar, a main content region, and a
  rail. That is appropriate for desktop, but the combination can create three
  simultaneous navigation hierarchies: Company/Project sidebar, page tabs, and
  right rail controls.
- Active navigation uses filled backgrounds, borders, counts, icons, and helper
  metadata. The selected state is clear, but the density is high. Reduce active
  state decoration to one strong signal plus the label.
- The sidebar includes project switcher, Company link, Channel list, Search,
  Tasks, and Settings. This is not wrong, but it should be tested with long
  names, many Channels, and collapsed navigation because the number of labels
  can force truncation.

**Recommendation**

Keep the desktop sidebar because it preserves scope and supports frequent
switching. Reduce the number of independent visual boxes inside it. Treat the
right rail as optional context, not a second required navigation system.

### 8. Web tasks, threads, and task detail

**Confirmed gaps**

- `TaskProjectPage.tsx` puts search, five filter controls, an archive checkbox,
  clear action, Board/List/Calendar mode, and the task surface into one path.
  The page is capable, but its first impression is a control panel.
- `TaskDetailDrawer.tsx` and the shared task styles contain separate sections
  for description, properties, checklist, evidence, comments, and activity.
  The code now removes borders from activity cards in the later design layer,
  which is a good direction, but the overall drawer still contains many
  sections with repeated separators and action affordances.
- Web thread browsers expose search, Active/Archived tabs, creation, unread
  state, reply counts, and load-more. This is complete, but the repeated controls
  appear in both Channel and Company contexts.

**Recommendation**

For tasks, keep the default board/list decision visible and consolidate filters.
For task detail, make the property row the compact edit surface and keep
discussion as the primary continuation. For threads, show the latest message
preview and purpose text in a row only when available; do not add placeholder
copy that makes every row taller.

## Principle-by-principle score

This score measures implementation direction, not a usability study.

| Principle | Mobile | Web | Verdict |
|---|---:|---:|---|
| Clear top-level navigation | 4/5 | 4/5 | Strong, but global work modes need sharper separation. |
| Content hierarchy | 3/5 | 3/5 | Main weakness: many valid sections compete at once. |
| Reduction of containers and borders | 2/5 | 3/5 | Real opportunity to remove redundant grouping. |
| Action clarity | 3/5 | 3/5 | Controls exist, but primary versus secondary weight is uneven. |
| Context and scope visibility | 5/5 | 5/5 | A core strength and must not be lost during simplification. |
| Platform icon consistency | 4/5 | 4/5 | Good semantic icon system; keep using native/library icons. |
| Loading and failure states | 4/5 | 4/5 | Strong explicit state coverage; verify every screen at runtime. |
| Accessibility structure | 4/5 | 4/5 | Good labels and touch targets in reviewed code; contrast/focus need runtime proof. |

## What not to copy blindly

Do not remove all borders. Track uses borders to separate touchable rows,
permission scopes, Project groups, and status controls. Remove a border only
when background, spacing, typography, or a clear interaction state still makes
the grouping obvious.

Do not remove all content. Company, Project, Channel, source, status, due date,
and ownership are core meaning. Remove duplicate descriptions, repeated counts,
and low-value helper text before removing the context that explains a task.

Do not hide important search or actions behind “More” when users need them often.
Apple's navigation guidance also favors visible, labeled top-level navigation.
Use a compact filter control for secondary choices, but keep the primary task
and the active scope visible.

Do not turn every button into a neutral text link. A clear primary action is
helpful when the screen has one obvious outcome. The problem is multiple primary
buttons with equal visual weight.

Do not replace the current semantic icon system with custom artwork. The recent
`PlatformIcon` direction is aligned with the profile's icon advice and with
platform familiarity.

## Prioritized implementation plan

### P0: clarify the job of each surface

1. Write a one-sentence job statement into screen-level design notes:
   Home = personal attention and quick routing; My Tasks = execution; Inbox =
   unresolved attention; Team = cross-Project workload; Threads = focused
   Channel discussions; Conversation = complete Channel stream.
2. Remove duplicate titles and duplicate task browsers from the same viewport.
3. Make Company, Project, Channel, source, and ownership context persistent
   wherever a user can edit or navigate across scopes.

### P1: reduce hierarchy noise without losing meaning

1. Mobile Home: keep the current order, reduce nested Project-card surfaces, and
   change Today's Tasks to a compact list or one featured task plus View all.
2. My Tasks: merge search and filters behind one control, keep the selected
   Board/Project visible, and make the in-screen board drawer grouped by Company
   and Project.
3. Task detail: keep title, state, date, assignee, next decision, checklist,
   description, and linked source. Move full updates and discussion to the
   separate updates destination.
4. Inbox and Threads: reserve pills for state and filters; use ordinary list
   rows for message previews and one consistent inline preview drawer.
5. Web global work: make Tasks and Threads explicit modes rather than two full
   browsers competing on one default page.

### P2: visual and interaction polish

1. Check every status icon for distinct semantics and accessible labels.
2. Audit every filled button and reduce to one primary action per context.
3. Check button widths with long translations, long Project names, Dynamic Type,
   Android font scaling, and narrow devices.
4. Remove redundant borders and nested backgrounds only after screenshot review.
5. Check dark-mode contrast for artwork, accent pills, unread markers, progress
   bars, and selected controls.
6. Keep loading skeletons and error states consistent across conversation,
   thread, task, board, and drawer routes.

## Required validation before implementation is called complete

The next implementation pass should record evidence for:

- iPhone-sized narrow screen and Android narrow screen.
- Larger mobile screen and Dynamic Type/font scaling.
- Light and dark themes.
- Empty, loading, error, offline, read-only, archived, and restricted states.
- Long Company, Project, Channel, thread, and task names.
- Home order and scroll behavior with the bottom navigation visible and hidden.
- Project card action, Channel drawer, task card, board drawer, and create-task
  flow.
- Inbox filter placement below the header.
- Thread preview drawer showing only the latest message.
- Task status/date editing with a visible affordance.
- Web sidebar collapsed and expanded, Company and Project switching, task modes,
  thread modes, and task detail drawer.
- Accessibility labels, focus visibility on web, minimum mobile targets, and
  contrast of non-text state indicators.

## Bottom line

The profile's strongest lesson for Track is to remove competing presentation
layers, not product meaning: keep scope and action context visible, but make one
decision dominate each screen. The first implementation wave should target Home,
My Tasks, task detail, and global work mode separation before adding more visual
decoration or new navigation actions.
