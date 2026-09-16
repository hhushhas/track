# Track Mobile Stitch Design Rules

This document is the source of truth for generating or refining Track mobile
screens in Stitch. Read it before every generation or edit. The existing
`mobile-ui-ux-guide.md` contains broader mobile implementation guidance; this
file defines the rules Stitch must follow so every frame belongs to one product
and every flow remains visually and behaviorally consistent.

## Product definition

Track is a mobile command center for project work. It combines Company
collaboration, Projects, Channels, conversation, threads, tasks, boards, and
source Evidence in one permission-aware product.

The product answers three questions quickly:

1. What needs my attention?
2. Where is the conversation, task, or evidence?
3. What is the next useful action?

Conversation is the default source of context. Tasks turn conversation into
durable work. Evidence preserves the message, file, or assistant answer that
supports a task or decision. `@track` is an assistant grounded only in
references the current user can access.

Never introduce direct messages, meetings, Records, Draft Records, generic AI
review queues, or any feature outside the current Track product model.

## Generation contract

Every Stitch request must:

- Name the exact screen or overlay being created.
- State whether it is a route, push destination, bottom sheet, full-screen
  modal, native picker, or alert.
- Reuse the existing Track design system and established screens.
- Use realistic Track content rather than lorem ipsum.
- Preserve Company, Project, Channel, membership, task, and archive context.
- Specify loading, empty, error, offline, permission, disabled, and success
  states that can occur.
- Define the primary action and the exact destination after that action.
- Avoid combining multiple requested screens into one summary frame.
- Avoid inventing new navigation, controls, or product nouns.

When a request contains several screens, create each one as a separately named
screen. If Stitch generates only one screen, run one request per screen instead
of asking it to summarize the remaining screens.

## Product hierarchy

The four primary destinations are always ordered as follows:

```text
Home -> Projects -> Tasks -> Evidence
```

Their jobs are fixed:

| Destination | Job | First content |
|---|---|---|
| Home | Show personally relevant work anywhere | Attention, mentions, replies, assignments, and due work |
| Projects | Show where work lives | Projects grouped by explicit Company context |
| Tasks | Show work to complete | My work, Boards, filters, and suggestions |
| Evidence | Find the source | Permission-scoped messages, files, and references |

Secondary destinations stay inside the owning stack or appear as overlays:

- Project Overview belongs to Projects.
- Channels and Threads belong to the Project stack.
- Channel Conversation and Focused Thread belong to the Channel context.
- Task Detail belongs to Tasks or the source that opened it.
- Inbox belongs to Home and opens the exact source item.
- Companies, Notifications, and Account are secondary destinations.

Do not add Channels, Threads, Inbox, Companies, Notifications, or Account to
the primary bottom navigation.

## Visual system

Track is calm, operational, premium, and reference-first. The interface uses
warm paper, dark stone, and one purposeful yellow attention signal.

### Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FAF9F7` | `#1B1917` | Main screen background |
| `backgroundElement` | `#F3F1ED` | `#292522` | Rows, grouped content, secondary surfaces |
| `backgroundElevated` | `#FFFFFF` | `#232019` | Cards, sheets, elevated headers |
| `backgroundSelected` | `#EBE8E2` | `#3A3631` | Selected rows and controls |
| `text` | `#1B1917` | `#FAF9F7` | Primary text |
| `textSecondary` | `#6B655C` | `#C9C3B8` | Supporting text |
| `textTertiary` | `#8B857A` | `#9A9488` | Timestamps and quiet metadata |
| `accent` | `#F0B100` | `#F0B100` | Attention, selection, progress, primary action |
| `accentStrong` | `#8A6400` | `#F5C53D` | Text on accent-soft surfaces |
| `success` | `#15803D` | `#4ADE80` | Healthy or completed state |
| `danger` | `#B91C1C` | `#FCA5A5` | Errors and destructive actions |

Rules:

- Use one accent hue across every screen.
- Never use raw yellow as body text. Use `accentStrong` for text.
- Use accent-soft backgrounds for selection instead of large yellow fills.
- Use warm greys only. Do not mix cool and warm neutral families.
- Do not use gradients unless a specific brand asset requires one.
- Do not use purple, indigo, neon, or decorative color gradients.
- Color must never be the only signal for unread, selected, archived,
  restricted, destructive, or permission states.

### Typography

Use the platform system sans. Keep one clear display size per screen.

| Role | Size / line height | Use |
|---|---:|---|
| Display | 28 / 34, bold | One main screen or project title |
| Title Large | 20 / 26, bold | Section or Project heading |
| Subtitle | 17 / 22, semibold | Important supporting statement |
| Message | 16 / 22 | Conversation text |
| Body | 15 / 21 | Normal reading content |
| Label | 13 / 18 | Controls and compact metadata |
| Caption | 12 / 16 | Time, status, and secondary metadata |
| Mono | 11 / 15 | Task keys and identifiers only |

Rules:

- Use sentence case for headings, buttons, sheets, and labels.
- Do not use all-caps labels.
- Do not use monospace for names, timestamps, or ordinary labels.
- Keep long titles readable at large text sizes.
- Use tabular numerals for counts, times, and dates.

### Spacing and shape

Use a 4-point base grid. Allowed spacing values are 4, 8, 12, 16, 24, and 32.

- Standard screen horizontal padding: 16.
- Compact row gap: 8.
- Section gap: 24.
- Card radius: 12.
- Small control radius: 8.
- Large action radius: 20 only when the control is intentionally pill-shaped.
- Pill radius is reserved for filters, badges, status chips, and navigation
  selection.
- Every rounded rectangle uses continuous corners.
- Do not invent screen-specific radii or arbitrary spacing values.
- Do not nest cards inside cards unless the inner surface has a clear semantic
  purpose such as a source quote or warning.

## Alignment and layout rules

Every screen must use one alignment system:

- Screen content starts and ends on the same 16-point horizontal guides.
- Header title and body content share the same primary alignment edge.
- Section headings align with the rows below them.
- Leading icons and avatars use one consistent column.
- Trailing chevrons, counts, timestamps, and actions use one consistent edge.
- Controls in the same group share height, radius, and baseline.
- Do not center one card while surrounding content is left-aligned without a
  deliberate empty-state or auth reason.
- Do not use negative margins to repair spacing.
- Use one spacing value between repeated elements. Do not alternate 10, 14, 18,
  or other off-grid values.
- Keep the main action in the same vertical location across related screens.

### Standard row anatomy

Use this structure for Projects, Channels, Threads, Inbox, and Tasks:

```text
[avatar or icon] [title, one or two lines]
                [Company · Project · Channel · status]
                                      [chevron or state]
```

Rows must:

- Be at least 64 points high.
- Keep the title as the strongest text.
- Show context before timestamps.
- Use a chevron only when the full row opens a destination.
- Keep destructive and secondary actions in a sheet or native context menu.
- Wrap or safely truncate long names without pushing trailing content away.

## Component contracts

Use the same component anatomy across the app.

### Navigation

- Bottom navigation always contains Home, Projects, Tasks, and Evidence.
- Each tab has an icon, visible label, selected state, and accessibility state.
- Home may show the global attention badge.
- iOS may use native glass material; Android uses an elevated tonal surface.
- Tabs are peers. Do not animate them as a horizontal page carousel.
- Re-tapping the active tab returns to its root.
- Push deeper screens. Use replace for one-way auth transitions.

### Headers

- Use the native stack title whenever possible.
- Header actions must serve the current screen's main job.
- Use at most two header actions on a detail screen.
- Move secondary actions to a sheet.
- Conversation headers must preserve Channel identity.
- Task headers must preserve the task key.
- Detail screens must have an obvious back action.

### Buttons

- Use one primary action per screen or sheet.
- Use secondary actions for cancel, alternate paths, or low-risk choices.
- Use destructive actions only for deletion, archive, account removal, or report.
- Button labels use one canonical phrase for one intent.
- Buttons show disabled, loading, success, and error states.
- Never hide a failed action behind a disabled button with no explanation.

### Cards and surfaces

- Use cards to group information with one shared decision or context.
- Prefer tonal separation and hairlines before shadows.
- Use one elevation system throughout the app.
- A card must have a clear reason to exist: context, action, warning, or source.
- Do not make every row a floating card.

### Empty states

Every empty state must answer:

1. What is empty?
2. Why is it empty?
3. What can the user do next?

Use a small relevant icon, short title, one explanation, and one useful action.
Never use only “No data”.

### Loading and errors

- Use skeletons that match the final layout shape.
- Keep last-known content visible during safe background refreshes.
- Use local progress inside the active button or row.
- Keep user input after validation or network failure.
- Explain what failed and provide Retry when retry is safe.
- Do not expose internal IDs, raw Convex errors, HTTP errors, or stack traces.

## Sheets and modal rules

Use a bottom sheet for a short interruption: filters, options, profile actions,
pickers, and short forms. Use a pushed route for a destination with its own
identity or multiple steps. Use a full-screen modal for immersive media.

Every sheet must have:

- A visible title.
- A grab handle.
- A close action.
- A scrim that dismisses when safe.
- Safe-area bottom padding.
- Native back behavior.
- Grouped sections where choices have different meanings.
- 44-point minimum rows on iOS and 48dp on Android.
- Selected, disabled, loading, empty, and error states.
- Drag-to-dismiss behavior with restrained spring motion.

Current sheet families:

- Filter Inbox.
- Start thread.
- Message actions.
- Add to message.
- Switch Channel.
- Conversation Notifications.
- Report.
- Choose Project.
- Choose Channel.
- Choose board.
- Move to.
- Create task and its Board, Status, Priority, and Assignee pickers.
- Search tasks.
- Filter and sort.
- Task Status, Priority, Assignee, Due Date, Description, Labels, and More.
- Account.
- Timezone.
- Two-factor authentication.
- Sign out confirmation.
- Delete account confirmation.
- Forward message when the current flow exposes it.

Do not represent a sheet as a fake page with a full navigation header. Do not
put a second sheet over a sheet unless the platform can support it; preserve the
draft and close the parent sheet before opening a native picker.

## Screen flow rules

The canonical flow is:

```text
Launch
  -> Sign In or Home

Home
  -> Inbox
  -> Task Detail
  -> Channel Conversation
  -> Focused Thread

Projects
  -> Project Overview
  -> Channels
  -> Channel Conversation
  -> Threads
  -> Focused Thread
  -> Task Board
  -> Task Detail
  -> Evidence

Tasks
  -> Board or My Work
  -> Task Suggestions Inbox
  -> Task Detail
  -> Discussion or Activity

Evidence
  -> Choose Project
  -> Choose Channel
  -> Source Message, Thread, Task, or Image Viewer
```

Rules:

- Keep the user's place when returning from a detail screen or sheet.
- Preserve the exact Company and Project membership context through deep links.
- Back undoes navigation, not a completed event.
- Do not trap back except for an irreversible request in progress or unsaved
  work that needs confirmation.
- Sign in and sign out are one-way transitions and must replace the old route.
- Read-only Company exit archives remove composers and mutations while keeping
  source content readable.

## Content language

Use these canonical nouns exactly:

- Company
- Project
- Channel
- thread
- task
- board
- reference
- Evidence
- @track

Use plain active labels:

- “Create task”
- “Open board”
- “Start thread”
- “Add a comment”
- “Save profile”
- “Try again”
- “Review latest”

Do not alternate between “Workspace”, “Team”, “Room”, “Conversation space”, or
other synonyms when the product means Company, Project, or Channel.

## State matrix

For every generated screen, explicitly design the applicable states:

| State | Required treatment |
|---|---|
| Loading | Skeleton matching final layout |
| Empty | Reason, explanation, next action |
| Offline | Clear offline message and safe available actions |
| Permission denied | Explain the authority boundary without leaking private data |
| Access changed | Explain that the content or membership changed |
| Read-only | Show content, remove unavailable mutations, explain why |
| Validation error | Place specific copy near the affected control |
| Network error | Keep input and offer safe Retry |
| Saving/sending | Local progress and disabled duplicate submission |
| Success | Immediate, quiet confirmation |
| Conflict | Explain that the record changed elsewhere and offer Review latest |
| Long content | Wrap, scroll, or truncate without breaking alignment |

## Motion and feedback

- Use native transitions for navigation.
- Use a short spring for sheet presentation and drag dismissal.
- Use subtle press feedback under 150ms for frequent controls.
- Use haptics once per meaningful selection or completed action.
- Never animate readable list data for decoration.
- Do not bounce ordinary buttons, cards, tabs, or rows.
- Respect Reduce Motion with immediate transitions or cross-fades.
- Keep keyboard movement tied to the live keyboard position.

## Accessibility rules

- Label every icon-only action.
- Expose selected, disabled, busy, and expanded state.
- Use visible labels for form fields.
- Do not rely on placeholder text as the only label.
- Keep contrast readable in light and dark themes.
- Support Dynamic Type and Android font scaling.
- Keep text readable when names, quotes, and task titles are long.
- Make attachment, archive, report, delete, and permission states explicit in
  text as well as iconography.
- Keep content above the home indicator and bottom navigation.

## Stitch review checklist

Before accepting a generated frame, check:

- Is this the exact named screen or overlay?
- Does it use the same 16-point screen margins as existing frames?
- Do all repeated rows share the same anatomy and height?
- Do all cards share the same radius and border treatment?
- Are all controls aligned to the same baselines and trailing edge?
- Is the primary action clear within three seconds?
- Is Company, Project, Channel, or Task context visible where needed?
- Is the yellow accent used only for attention, selection, progress, or action?
- Are loading, empty, offline, permission, error, and read-only states defined?
- Does the back action return to the exact previous context?
- Does each sheet behave like a sheet rather than a page?
- Are touch targets at least 44pt/48dp?
- Does the frame work in light mode, dark mode, and large text?
- Are there any arbitrary gaps, inconsistent radii, duplicate labels, gradients,
  emoji icons, or unaligned controls?

If any answer is no, refine the existing frame with a targeted edit. Do not
regenerate the entire project and introduce a new visual language.
