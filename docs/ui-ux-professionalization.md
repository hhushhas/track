# Track Web UI/UX Professionalization Specification

Status: active implementation standard
Owner: Track web
Last reviewed: 2026-09-16

## Outcome

Track presents one calm, professional product across Company, Project, Channel,
thread, task, evidence, settings, profile, and authentication surfaces. The
interface uses a classical minimal visual system with clear hierarchy, strict
alignment, restrained color, accessible controls, and predictable responsive
behavior.

The product-specific visual idea is an operational ledger: conversations,
tasks, and evidence share aligned rows and fine rules, while a restrained amber
signal marks current scope, active navigation, and actionable work. The amber
signal is never used as decoration.

## Acceptance criteria

1. Every authenticated surface uses the same semantic color, spacing, type,
   radius, control-height, focus, and motion tokens.
2. Company, Project, task, and thread navigation use the same active-state and
   density rules.
3. Page headers share one hierarchy: scope, title, context, then actions.
4. Panels represent meaningful boundaries. Whitespace and rules group ordinary
   content without placing every section in a card.
5. Conversation messages use one anatomy for author, time, body, reply context,
   attachments, linked work, and actions.
6. Message actions are available on pointer hover, keyboard focus, and coarse
   pointers. Destructive actions remain behind confirmation.
7. Desktop, tablet, mobile, 200% zoom, dark mode, reduced motion, empty, loading,
   error, disabled, and long-content states remain usable.
8. The changed routes have no browser console errors and the repository gate
   passes.

## Foundation contract

### Color

- Canvas: neutral porcelain, not warm cream.
- Raised surface: white in light mode and quiet graphite in dark mode.
- Text: graphite with two quieter levels.
- Rules: neutral gray with a stronger control border.
- Signal: Track amber, reserved for current scope, focus, and primary creation.
- Status colors: semantic green, red, and blue with quiet tinted backgrounds.

Components consume semantic roles such as `--surface-canvas` and
`--text-secondary`. Raw palette values are private implementation details.

### Typography

- Inter is the reading face for body copy and controls.
- Geist is the display and utility face for headings, metadata, and numbers.
- Page titles use 28px on desktop and 24px on small screens.
- Message body copy uses 14px with a 1.55 line height.
- Supporting text never falls below 11px.
- Headings use balanced wrapping and numbers use tabular figures where useful.

### Spacing and shape

- Spacing follows a 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Controls use 32px, 36px, or 40px heights.
- Controls use a 6px radius, cards 8px, and large panels 10px.
- Shadows are reserved for temporary overlays. Persistent panels use rules.

### Motion

- Feedback transitions take 120 to 180ms.
- Layout transitions take at most 260ms.
- Only opacity and transform animate where practical.
- Reduced motion reduces transitions to 1ms and removes nonessential animation.

## Layout contract

### Workspace

```text
Global navigation | Main workspace | Optional context rail
236px             | flexible       | 300px
```

The global navigation collapses to 48px. The context rail disappears below
1080px and becomes in-flow context. Below 820px, navigation uses the existing
mobile sheet and the main content becomes one column.

### Conversation

```text
Conversation header
Message timeline
Composer
```

The timeline has one readable content measure and consistent gutters. Messages
are rows, not independent floating cards. A thin conversation spine connects
avatars and day boundaries without reducing text contrast.

Message action order is Reply, Create task, Forward, More. Low-frequency and
destructive actions remain in More. If reactions are added later, React belongs
between Reply and Create task.

### Company and settings

Company routes retain the global navigation and use the same page-header and
content widths as Project routes. Settings use a sticky local index on desktop
and a horizontally scrollable index on small screens.

### Tasks

Task views share the same navigation density, page header, toolbar, and control
tokens as conversations. Board columns may scroll horizontally, but every drag
operation must keep its existing click or keyboard alternative.

## Regression matrix

| Surface | Desktop | Tablet | Mobile | Dark | Keyboard | Long content |
| --- | --- | --- | --- | --- | --- | --- |
| Company overview | required | required | required | required | required | required |
| Company settings | required | required | required | required | required | required |
| Project overview | required | required | required | required | required | required |
| Channel conversation | required | required | required | required | required | required |
| Focused thread | required | required | required | required | required | required |
| Task board and list | required | required | required | required | required | required |
| Project settings | required | required | required | required | required | required |
| Profile and sign-in | required | required | required | required | required | required |

## Verification

Automated checks:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

Browser checks:

1. Open the Company overview, Projects, Company settings, a Channel, a focused
   thread, Tasks, Project settings, Profile, and sign-in routes.
2. Check 1440px, 1024px, 768px, and 390px widths.
3. Complete primary actions with pointer and keyboard.
4. Check visible focus, message-action access, menus, dialogs, and sheets.
5. Check light, dark, reduced-motion, empty, loading, error, and long-content
   states available in the development data.
6. Confirm there are no console errors, clipped controls, horizontal page
   overflow, or hidden focus targets.

## Migration rule

The `track-ui-v2` body class and `professional-ui.css` are the authoritative
visual layer during migration. Existing feature styles continue to own feature
layout and behavior, but new global visual decisions belong in the design-system
layer. After all routes use shared primitives, obsolete global overrides can be
removed in a separate mechanical cleanup with screenshot comparison.
