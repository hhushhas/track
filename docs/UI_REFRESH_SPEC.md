# UI Refresh Specification

Status: implemented and locally verified; default-off product surfaces are not
deployed.

This specification turns the approved 2026-07-16 design direction into
executable work for `apps/web`. The high-fidelity reference is
`/Users/macmini/code/track/scratchpad/track-ui-direction-2026-07-16.html`.
Read it in place; do not copy it into or alter it from this isolated worktree.
Open it in a browser; demo states are deep-linkable via URL hashes `#board`,
`#list`, `#mytasks`, `#detail`, `#thread`, `#person`, `#dark`, combinable like
`#board-dark`.

It has two tracks:

- **Track A — design-system refresh** of the running product. No schema, Convex,
  or route changes. Shippable immediately.
- **Track B — task-surface component kit**: the visual and interaction contract
  for the surfaces that [TASK_MANAGEMENT_SPEC.md](./TASK_MANAGEMENT_SPEC.md)
  and [THREADS_SPEC.md](./THREADS_SPEC.md) will ship. Those specifications
  remain authoritative for data, permissions, routing, and behavior; this
  document governs only how their surfaces look and feel.

Where the mockup and the product specifications disagree, the product
specifications win. Known divergences are listed in
[Mockup divergences](#mockup-divergences).

The Company model, tasks, and threads use independent server-authoritative
flags named `companyModel`, `tasks`, and `threads`, configured by
`TRACK_COMPANY_MODEL_ENABLED=false`, `TRACK_TASKS_ENABLED=false`, and
`TRACK_THREADS_ENABLED=false`. Missing or invalid values fail closed. Track A
is unflagged. Track B remains unreachable presentational work until the owning
task or thread flag exposes a fully implemented route; clients consume an
authorized server projection and never use their environment as authority.

The combined repository gate and lightweight local web verification pass. The
Company, task, and thread surfaces remain independently default off and have not
been deployed. Full authenticated browser, native production-build, rollout,
and production proofs remain release work. Local acceptance does not authorize
a production deployment or flag activation.

## Ground rules for every workstream

- Use semantic tokens from `apps/web/src/styles.css` for every color, radius,
  and font. Never introduce a raw hex value in a component (brand marks in
  file-type and import-source logos are the only exception).
- **No all-caps text anywhere.** Never add `text-transform: uppercase` or
  wide letter-spacing to labels. All labels and metadata are sentence case.
  (`.toUpperCase()` for computing avatar initials is fine — initials are not a
  label.)
- Compact and consistent beats decorative. Radii are 6, 8, and 12px only.
- Preserve all existing behavior, accessibility, and privacy semantics.
  Restyling must not remove keyboard focus, ARIA attributes, touch targets,
  announcements, or permission boundaries. WCAG AA contrast holds in both
  themes.
- Both themes always: every change is verified in light and dark mode.
- Match the existing code style; make minimal, surgical edits. Do not
  reformat, rename, or reorganize files beyond the stated scope. Assume a
  shared dirty worktree: stage only your own intended paths (`git add -p`,
  never `git add .`).
- Repository gate before handoff: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`, then load the affected routes from a local build and check the
  browser console.

## Design language summary

The signature system is derived from the Track logo (chat bars + a yellow
round-capped route line ending in a ring with a paper cutout):

1. **State rings** — workflow state categories render as small ring glyphs.
   Shape (not just color) encodes state, so the set stays accessible.
2. **Evidence line** — chat-derived work is marked in yellow: a small
   ring-dot (`origin dot`), an accent-tinted evidence footer, and in the task
   drawer a curved yellow SVG connector that traces the task back to its
   source quote.
3. **Warm paper surfaces, hairline borders, ink text, yellow accent** — the
   existing palette, used more consistently.

Yellow means "attention / evidence / active state". It is never used for
neutral chrome, quotes, or decoration.

## Type system

| Role | Token | Face | Tracking | Used for |
| --- | --- | --- | --- | --- |
| Body / UI | `--font-sans` | Inter | −2% (−.02em) | Messages, names, buttons, cards, forms |
| Display | `--font-display` | `"SF Pro Rounded", ui-rounded, -apple-system` → Inter | 0 | Wordmark, channel/board titles, drawer titles, page headings |
| Metadata | `--font-meta` | Geist | −2% | Timestamps, chips, section labels, evidence captions, counts |
| Identifiers | `--font-mono` | Geist Mono | 0 | Task keys, keycaps (`⌘K`, `↵`), file-extension badges |

Rules:

- JetBrains Mono is retired. Geist takes over the metadata voice; Geist Mono
  is reserved for true identifiers only.
- SF Pro Rounded cannot ship as a webfont (Apple license). The stack must
  fall back through `ui-rounded` to Inter and look correct in the fallback.
  Do not download or bundle SF Pro Rounded.
- Display face weight is 600 at sizes 13.5–17px in current surfaces. Body is
  14px/1.5. Metadata sits at 9.5–10.5px, weight 500–600.
- Minimum font size anywhere is 9.5px, and only for metadata.

## Track A — design-system refresh

Track A is nine workstreams. W1 must land first; W2 and W9 also edit
`apps/web/src/styles.css` and must be serialized with W1 (one owner of that
file at a time). W3–W8 are independent of each other and can run in parallel
after W1 merges.

### W1 — tokens and fonts (`apps/web/src/styles.css`, `docs/DESIGN.md`)

1. Update the Google Fonts import (line 1) to load Inter, Geist, and
   Geist Mono (weights 400–700 for Inter; 400–600 for Geist and Geist Mono).
   Remove JetBrains Mono from the import once W2 removes its last usage.
2. In `:root` and `.dark`, add the missing token that four existing rules
   already reference (`styles.css` lines ~1442, 1575, 3925, 4100):
   - light: `--accent-strong: #8a6400;` (text-safe amber, AA on paper)
   - dark: `--accent-strong: #f5c53d;`
3. Define the four font-role tokens per the type system above:
   `--font-sans`, `--font-display`, `--font-meta`, `--font-mono` (Geist Mono).
   Repoint the existing `--font-heading` alias to `var(--font-display)`.
4. Set body letter-spacing to `-.02em`; identifier and display styles reset
   `letter-spacing: 0`.
5. Update the `@theme inline` mappings so Tailwind font utilities resolve to
   the new stacks.
6. Reconcile `docs/DESIGN.md` "Source tokens" in the same change: interface
   type Inter; display type SF Pro Rounded with `ui-rounded`/Inter fallback;
   metadata Geist; identifiers Geist Mono; note `--accent-strong`.
7. Update `packages/shared/src/theme.ts` only if it declares font names;
   color values are unchanged.

Acceptance: app renders with no visual regression other than typefaces;
`--accent-strong` resolves in both themes; no console font 404s.

### W2 — de-caps and type-role application (`apps/web/src/styles.css`)

Remove every `text-transform: uppercase` from `styles.css` (survey found 17:
lines ~277, 1682, 1768, 2099, 2172, 2466, 2599, 3426, 3617, 4485, 4582, 4648,
4759, 5474, 5799, 5897, 6062 — re-grep, line numbers drift). For each removal:

- convert the label to sentence case at the source if the string itself is
  capitalized;
- reduce `letter-spacing` to ≤ `.01em`;
- if the rule used small caps for hierarchy, keep hierarchy with
  `font-family: var(--font-meta)`, weight 600, and a 0.5–1px size bump
  (10 → 10.5px) instead.

Also de-caps the two component-level usages: `NotFoundPage.tsx:7` and
`attachment-ui.tsx:247` (file-extension badges may stay uppercase **as
identifiers** — `PDF`, `XLSX` — but rendered in `--font-mono`, not via CSS
transform on a sentence label). Leave `identity.ts:26–27` alone (initials).

Then re-point metadata styles: rules that used JetBrains Mono for timestamps,
counts, section labels, and chips switch to `var(--font-meta)`; rules for task
keys/keycaps/extension badges switch to `var(--font-mono)` with
`letter-spacing: 0`. Apply `var(--font-display)` to the wordmark, workspace
headings, and dialog/sheet titles.

Acceptance: `grep -c "uppercase" apps/web/src/styles.css` returns 0 (except
any `.toUpperCase()`-unrelated false positives); no JetBrains Mono reference
remains in the repo except docs history; screenshots of conversation, sidebar,
settings, and search in both themes show sentence-case labels with unchanged
hierarchy.

### W3 — header compaction (`features/workspace/components/WorkspaceHeader.tsx`)

Adopt the mockup header metrics while keeping all current functionality
(search, member controls, rail toggle, notifications):

- height 48px, horizontal padding 16px;
- title in `--font-display` 15px/600; optional muted topic/description in
  `--font-meta` 10.5px, truncating, hidden below ~1180px;
- remove any status pill that states member/company composition; the member
  affordance is the facepile (22px avatars, −5px overlap, `+N` chip) with a
  tooltip stating the member count;
- icon buttons 28px, `--ink-3`, hover `--paper-3`.

The Conversation ⇄ Board tab pair from the mockup ships with Track B / the
task release, not here. Do not add dead tabs.

### W4 — right rail redesign (`features/workspace/components/WorkspaceRail.tsx` + its test)

Restructure the rail (currently notifications/members/project context) into
the mockup's calm stack while sourcing only data that exists today:

- section pattern: `--font-meta` 10.5px/600 sentence-case header with an
  optional trailing quiet action ("View all");
- card pattern: `--paper` background, 1px `--hairline` border, radius 8,
  hover `--hairline-strong`;
- sections now: pinned/recent references (attachments), members, project
  context. "Open tasks" and "Threads" sections arrive with their features;
- width 300–316px, `--paper-2` background, 1px `--hairline` left border.

Keep the existing privacy behavior of the rail exactly as-is (it was
deliberately restricted by a prior fix — restyle, do not re-expand data).
Update `WorkspaceRail.test.tsx` alongside.

### W5 — one quote component (`components/MessageActions.tsx`, `thread-item-components.tsx`)

Unify `QuotedMessageBlock` and `ReplyToMessagePreview` into a single quote
presentation used for reply quotes (and later: task origin quotes, thread
roots):

- neutral block: `--paper-2` background, radius 8, 2.5px rounded left bar in
  `--hairline-strong`; **no yellow** (yellow is reserved for evidence);
- 16px author mini-avatar, author name in `--font-meta` 10.5px/600 with muted
  `· time`, quoted excerpt 12.5px `--ink-3`, single-line clamp;
- whole block is a button that jumps to the source message with a brief
  accent-tint background flash on the target; hover: `--paper-3` background,
  left bar turns `--accent`, and a small jump arrow fades in;
- the affordance must also be reachable by keyboard (focus-visible ring, Enter
  activates).

### W6 — person popover (`features/workspace/avatar-tooltip.tsx`)

Restyle the existing `TeamMemberCard` hover card to the mockup popover:
232px, radius 12, `--shadow-pop`, 36px avatar, name 13.5px/650, role line in
`--font-meta` `--ink-3`, presence line (status dot + text), and the existing
actions as two buttons (primary = ink fill). Hover intent ~350ms in, ~250ms
grace out; also opens on keyboard focus. Keep whatever data it shows today —
do not add new fields.

### W7 — file-type brand marks (`features/workspace/attachment-ui.tsx`)

Extend `AttachmentTypeIcon` so common types render brand-colored marks on a
28px, radius-8 tile (fixed brand colors in both themes):

- spreadsheet (`xlsx`, `xls`, `csv`): `#107c41` tile, white X glyph;
- PDF: `#d93025` tile, white `PDF` in `--font-mono`;
- Figma (`fig`): white tile (dark: `--paper-3`) with the five-shape Figma
  mark;
- Markdown/text: `#24292f` tile, white `MD`;
- everything else: current neutral tile with the extension in `--font-mono`.

Apply wherever attachments render (message attachments, rail references,
search results). Alt text/labels unchanged.

### W8 — vocabulary and framing scrub (copy only)

Remove the client–vendor positioning from user-facing copy; Track is
"Slack + Jira for one team's Projects". Survey hits to fix:

- `routes/sign-in.tsx` (lines ~98, 195, 302), `routes/about.tsx:13`,
  `routes/__root.tsx` (meta description, lines ~9–11): reword marketing copy
  to the PRODUCT.md framing (unified conversation + task management), no
  "client", "vendor", or "two companies" language;
- `WorkspaceSidebar.tsx:137`, `ProjectSettingsPage.tsx:56`,
  `group-avatar.tsx` (lines ~69, 93, 97): replace client/vendor role wording
  in labels and generated avatar tones with neutral equivalents;
- rename user-facing **Group(s)** display strings to **Channel(s)** across
  `WorkspacePageSurface.tsx`, `ProjectSettingsPage.tsx`,
  `project-group-gallery.tsx`, and static pages (`privacy`, `terms`,
  `support`). Display label only: schema tables, Convex functions, variable
  names, and route paths (`groups.$groupId`) are untouched, per the
  compatibility rule in TASK_MANAGEMENT_SPEC.md ("Company-model
  compatibility").
- `routes/privacy.tsx:67`: legal copy — reword only if meaning is preserved;
  if unsure, flag instead of editing.

`projects.clientLabel` (schema) keeps its name; only its UI label changes.

### W9 — token hygiene and radii audit (`styles.css`, `identity.ts`, `__root.tsx`)

- Replace raw hex values in `features/workspace/identity.ts` (lines ~3–6,
  avatar tone palette) with values sourced from CSS custom properties or
  `packages/shared` theme, preserving the exact rendered light-mode colors
  and adding correct dark-mode behavior.
- `routes/__root.tsx:60` (`theme-color` meta): keep a literal but make it
  equal to `--paper` for light and `#151412`-family for dark if a dark
  variant is supported.
- `import-source-logos.tsx` hexes are brand marks — leave them.
- Audit `.track-*` rules in `styles.css` for radius drift (4/5/7px values);
  snap to 6, 8, or 12. Skip any radius that is provably load-bearing (e.g.
  perfect circles).

## Track B — task-surface component kit

Track B components implement the surfaces defined by TASK_MANAGEMENT_SPEC.md
(web experience) and THREADS_SPEC.md. Build them as **presentational
components with typed props and component tests** under
`apps/web/src/features/tasks/ui/` (and `features/threads/ui/` for the thread
pane), driven by fixture data. Do not add routes, navigation entries, schema,
or Convex functions from this specification — surfaces become reachable only
through the feature specs' own phases, so no dead or placeholder controls
ship. Files stay ≤ ~300 lines; split by component.

### B1 — StateRing

One component, five variants keyed by **state category** (never by state
name):

| Category | Glyph | Construction |
| --- | --- | --- |
| `backlog` | dashed ring | 1.5px dashed `--ink-4` |
| `unstarted` | open ring | 1.5px solid `--ink-4` |
| `started` | half-filled ring | 1.5px solid `--accent`, `conic-gradient(var(--accent) 0 50%, transparent 50% 100%)` |
| `completed` | filled ring with paper cutout | `--accent` fill, centered `--paper` inner circle (the logo's terminal ring) |
| `canceled` | struck ring | 1.5px solid `--ink-4` with a 1.5px diagonal strike through the ring |

Sizes: 14px default, 12px in dense rows/cards, 13px in subtasks. The glyph is
`aria-hidden`; the state name is always adjacent text or an accessible label.
Boards may rename states, so the label prop is free text while the glyph binds
to the category.

### B2 — evidence primitives

- **Origin dot**: 7–8px `--accent` ring-dot (accent circle with `--paper`
  center), used inline before origin captions.
- **Evidence footer**: accent-tint strip (`--accent-tint` background, top
  hairline) with origin dot + `--font-meta` caption in `--accent-strong`,
  e.g. "created from this message · {board}". Hover slides in a chevron.
- **Origin connector**: in the task drawer, a curved yellow SVG line
  (2.5px, round caps, ring-dot at each end) connecting the origin section
  edge to the source quote, echoing the logo's route line.
- Captions are sentence case; the quote itself reuses the W5 quote component
  with a jump-to-source action ("Jump to message →" behavior; evidence
  access rules per TASK_MANAGEMENT_SPEC.md).

### B3 — chips

- **Metadata chip**: `--font-meta` 10px/500, 1px `--hairline` border, radius
  6, 2.5px × 7px padding, `--ink-3`; optional leading 14px avatar or icon.
- **Due chip**: metadata chip + calendar icon; due-soon/overdue variant uses
  `--accent-strong` text, 45% accent border, `--accent-tint` background.
  Overdue must also differ by text ("overdue"), not color alone.
- **Label chip**: metadata chip with a leading 7px colored dot from the
  label's token color; label text sentence case.
- **Priority glyph**: three ascending bars (3px wide, 4/7/10px tall).
  `low` = first bar `--ink-4`; `medium` = two bars `--accent`;
  `high` = three bars `--danger`; `urgent` = high glyph inside a
  danger-tinted chip labeled "urgent"; `none` = all bars `--hairline-strong`.
  A text label or tooltip always accompanies the glyph.

### B4 — inline task card (conversation)

Anatomy (max-width 460px, `--paper`, 1px `--hairline-strong`, radius 8):

1. top row: StateRing + title (13.5px/600) + task key right-aligned in
   `--font-mono` 10px `--ink-4`;
2. props row: assignee chip, due chip, priority chip, subtask progress chip
   ("1/3" with check-circle icon);
3. evidence footer (B2).

Hover: border `--ink-4`, −1px translate, small shadow. The whole card opens
the routable task drawer. Data binding, live reactivity, and permission
behavior per TASK_MANAGEMENT_SPEC.md "Live inline cards".

### B5 — board and cards

- Column: 264px, header = StateRing + state name (12.5px/650) + count in
  `--font-meta` + trailing quiet "+".
- Card: `--paper`, 1px `--hairline-strong`, radius 8, padding 10×12. Rows:
  key line (task key in `--font-mono` 10px; 12px StateRing right-aligned),
  title 13px/600, footer = assignee avatar (20px) + origin (origin dot +
  truncating `--font-meta` source caption, e.g. `#launch-plan · today` or
  `thread · Press kit review`) + spacer + due chip + priority glyph.
- Completed/canceled cards dim the title with a 1px strikethrough.
- Suggestion inbox strip (per TASK_MANAGEMENT_SPEC.md suggestion inbox):
  dashed 55%-accent border, `--accent-tint` background, radius 8; header =
  "Suggestion inbox" in `--accent-strong` meta + hint "Track spotted these in
  conversation — nothing becomes a task until you accept it."; rows on
  `--paper` with origin dot, proposed title, source caption, Accept (ink
  fill) and Dismiss (quiet) actions.
- Board header: board name in `--font-display` 14px/600, scope pill
  (`--font-meta` 10px, hairline border, radius 999), Board/List segmented
  control (2px-padded bordered group, pressed = `--paper-3`), Filter button,
  New task primary button (ink fill).

### B6 — list view and My tasks rows

One shared row component for All tasks / list layout / My tasks:
grouped under StateRing + state-name headers; row = 12px StateRing, task key
(`--font-mono` 10px, fixed 58px), title (13px/600, truncates), origin caption,
due chip, assignee avatar, priority glyph; 7×10px padding, bottom hairline,
hover `--paper-2`. My tasks omits the assignee cell. Grouping, filters, and
URL persistence per TASK_MANAGEMENT_SPEC.md.

### B7 — task drawer

The routable right drawer (TASK_MANAGEMENT_SPEC.md "Web experience") renders:

- sticky header: StateRing, `{task key} · {board}` in `--font-mono` 11px,
  copy-link and close icon buttons;
- title in `--font-display` 16px/600;
- one wrapping row of **property chip-buttons** (not a key/value grid):
  state (StateRing + name), assignee (avatar + name), priority (glyph +
  name), due (calendar + date), label chips, quiet dashed "+" to add.
  Each is a real button with hover border `--ink-4` and opens its editor;
- origin section (B2 connector + W5 quote) when evidence exists;
- subtasks: 13px StateRing + text rows, hairline-separated, toggleable,
  header shows "n of m done"; "+ Add subtask" quiet action;
- references list using W7 file marks;
- activity: system items as `--font-meta` lines with a small StateRing,
  comments as 24px-avatar rows, then a comment input.

Sections use a hairline-extended header ("sec" pattern: meta label + 1px rule
filling the remainder). Drawer width ~440px, content padding 16, section gap
16. Empty sections show a quiet explanatory note, not blank space.

### B8 — thread pane

Per THREADS_SPEC.md web experience; visually: pane replaces rail content on
`--paper`, sticky header (thread title in `--font-display` 13.5px/600,
`thread · #channel` meta line, close button), root message, "n replies"
hairline divider, reply messages (26px avatars, 13px body), reply composer.
Messages reuse the conversation message components at reduced metrics.

### B9 — channel task panel and tabs

When the task feature ships its Channel panel and open-task count
(TASK_MANAGEMENT_SPEC.md "Conversation integration"), present the
conversation/board relationship as header tabs (Conversation | Board {n}) —
13px/500, active = 600 with a 2.5px accent underline bar, count in a
`--font-mono` keycap. Rail gains "Open tasks · this channel" (rows: StateRing,
title, key · due meta, assignee avatar) and "Threads" sections using the W4
patterns.

## Interaction standards (both tracks)

- Transitions 120–220ms ease; respect `prefers-reduced-motion` (near-zero
  durations).
- Hover reveals are affordances only — never the sole path to information or
  actions (keyboard and touch equivalents required).
- Tooltips on all icon-only buttons (existing `ui/tooltip.tsx`), sentence
  case, `--font-meta`.
- Focus-visible: 2px `--accent` outline, 2px offset, on every interactive
  element.
- Jump-to-message: smooth scroll to center + one ~1.5s accent-tint background
  flash on the target row.
- Async surfaces keep explicit loading (skeleton), empty, error+retry states
  per DESIGN.md.

## Mockup divergences

The mockup is the visual reference; these details in it are **wrong** and the
specifications above are correct:

1. Task keys are opaque (`T-7K4M2P9Q` style), not sequential `TRK-147`.
   Render whatever key the backend provides; never invent numbering.
2. The standard workflow is Backlog / To do / In progress / Done / Canceled.
   The mockup's "Up next" is only an example of a board-level rename.
3. There are five state categories; the mockup omitted `canceled` (B1 defines
   its glyph).
4. Priority has five values (none/urgent/high/medium/low); the mockup showed
   three.
5. The suggestion inbox is primarily the Tasks-destination Inbox; the board
   strip is a secondary presentation of the same pending suggestions.
6. Demo content (workspace "Nordlys", names, times) is fixture data only.
7. The mockup's instant client-side state changes stand in for reactive
   Convex updates and optimistic mutations defined by the product specs.
8. The mockup contains 5px, 7px, and 10px non-circular radii. Implementation
   normalizes those values to the 6px, 8px, and 12px token set in this
   specification; pills and circles remain fully rounded.

## Verification

Per workstream: targeted `pnpm --filter web test` + typecheck, then
screenshots of the affected surface in light and dark compared against the
corresponding mockup deep-link state. Track B components get component tests
covering each variant (all five StateRing categories, all priority values,
due states, empty/loading/error states).

Web end-to-end acceptance uses Playwright against a local production build on
`localhost`; source inspection or a component render alone is insufficient.
Each affected route is loaded, exercised, compared with the external reference
in both themes, and checked for browser-console and font-loading errors.

Final acceptance for Track A: the running app shows no uppercase labels, the
new type roles everywhere, the compact header, the redesigned rail, unified
quotes, brand file marks, neutral Slack+Jira copy with Channel vocabulary,
`--accent-strong` defined, and no new raw hex — with zero behavioral or
accessibility regressions and a clean repository gate. Passing this local gate
establishes implemented and locally verified UI; it does not mean production
deployment occurred.
