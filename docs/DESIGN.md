# Design

Track should feel calm, operational, and reference-first. The interface uses warm paper surfaces, dark stone text, and yellow for attention and action. Decoration must never outrank access, status, or references.

## Source tokens

The web tokens live in `apps/web/src/styles.css`; cross-platform primitives live in `packages/shared/src/theme.ts`.

- Primary stone: `#1b1917`.
- Accent yellow: `#f0b100`.
- Accent strong (text-safe amber): light `#8a6400`, dark `#f5c53d` (`--accent-strong`).
- Paper: `#faf9f7`.
- Secondary paper: `#f3f1ed`.
- Success: `#15803d`.
- Danger: `#b91c1c`.
- Information: `#1d4ed8`.
- Interface type: Inter (`--font-sans`).
- Display type: SF Pro Rounded with `ui-rounded` / Inter fallback (`--font-display`). Do not bundle SF Pro Rounded.
- Metadata: Geist (`--font-meta`).
- Identifiers: Geist Mono (`--font-mono`) for task keys, keycaps, and extension badges.
- Standard non-circular radii: 6px, 8px, and 12px. Pills and circles may use a
  fully rounded radius.

Use semantic CSS variables and shared theme values instead of copying raw colors into components. Preserve the maintained light and dark palettes.

## Layout and hierarchy

- Mobile Home is the global attention surface. It aggregates authorized
  mentions, direct replies, task attention, suggestions, invitations, and
  assigned work across every Company and Project; a stored acting Company must
  never hide global work. Each row carries its represented Company, Project,
  and Channel or task context and opens the exact source.
- Mobile primary navigation is four peer tabs: Home, Projects, Tasks, and
  Evidence. Each tab owns an independent stack. Inbox is a filtered attention
  history inside Home, while Project, Channel, and thread routes stay in the
  Projects stack and task detail stays in the Tasks stack.
- The selected mobile tab uses a brief liquid stretch-and-settle transition that
  respects Reduce Motion. Supported iOS versions may use native system glass;
  unavailable glass and Reduce Transparency use a semantic blur fallback. The
  established Android bottom-navigation surface remains platform-native and
  does not inherit the floating iOS glass treatment.
- Repeated mobile collection rows use two information levels: identity/action
  and context on the left, then one stable time/state slot on the right. The row
  may grow under narrow widths or larger text instead of introducing a third
  competing metadata line.
- Global Tasks is the signed-in member's open work across accessible Projects.
  A Project board is entered through an explicit Project context and presents
  one vertically scrolling status column at a time on phones. Moving through a
  status menu is the reliable primary interaction; drag is never required.
- Evidence replaces global Search as a primary destination. Search remains
  available inside Evidence, with a permission-aware Company/Project/Channel
  scope that is always visible before results are shown.
- Keep Project and Channel context visible in the workspace.
- Optimize conversation for reading and composing; keep metadata subordinate.
- Use dense lists or tables for members and settings.
- Keep AI answers close to their source messages and visibly distinct from human messages.
- Show evidence, visibility, ownership, and status before decorative details.
- Adapt the information hierarchy to mobile instead of shrinking desktop layouts.

## Interaction states

Every async surface needs a deliberate loading, empty, success, and error state. Errors should explain the failed action and offer a safe retry when the action is repeatable. Destructive actions require clear intent and should not rely on color alone.

Unread, mention, report, blocked, and permission states need text or icon semantics in addition to color. Motion should communicate state change, remain brief, and respect reduced-motion preferences.

Company identity appears only where it changes interpretation. Acting Company
is explicit for represented Project actions but never filters global Home,
Projects, Tasks, or Evidence visibility; compact Company badges accompany
message authors, represented Project memberships, invitations, and approvals.
The badge remains subordinate to the person's name and never uses color as its
only signal. Restricted administrative surfaces describe the authority boundary
without exposing Channel names, counts, snippets, or member activity.

Exit archives use an unambiguous read-only treatment and explain the frozen
cutoff. Audience-expanding invitations name the Companies and people that will
gain access before confirmation. Suspension, stale approval, access loss,
snapshot failure, and cleanup failure each retain a safe retry or recovery path.

Thread lists sit inside their parent Channel and separate active from archived
conversation. Each row states follow and unread status in text. The focused
route keeps the Channel return path and optional source message visible, loads
older replies without replacing the current stream, and gives authorized
creators or stewards explicit rename, archive, and reopen controls. Archived
threads and archived parent Channels remove composers and creation controls.

Web thread controls use the maintained UI primitives and keyboard focus rules.
Mobile uses full-screen Expo Router destinations, native message action sheets,
swipe reply, document and audio pickers, and touch targets of at least 44px.
Both surfaces retain unsent text after failure and distinguish loading, empty,
offline, denied, conflict, and read-only states without relying on color.

## Access hierarchy

Company roles are Owner, Admin, and Member. Company membership never grants a
Project role implicitly. Company Projects use Manager and Member, while Channel
management is presented as Channel Manager even though the persisted compatibility
field remains `isSteward`.

Protected operations enforce the same hierarchy in Convex that the interface
communicates: active Company membership, then active Project membership, then
active Channel membership, then the action-specific role. Company administration
queries may include member email and invitation data; basic Company and
Project-manager member-directory queries expose only the data required by those
surfaces. Proposed Projects allow limited management, archive-pending Projects
restrict changes, and archived Projects and Channels are read-only.

## Accessibility

- Support keyboard navigation and visible focus on web.
- Use semantic controls and accessible names.
- Maintain at least 44px touch targets for primary mobile actions.
- Meet WCAG AA contrast for text and meaningful controls.
- Announce async failures and significant state changes to assistive technology.
- Keep references and permission explanations readable without hover.

## Product language

Use the canonical product nouns: Company, Project, Channel, thread, task,
board, and reference. Describe `@track` as an assistant grounded in accessible
references. Do not describe AI answers as durable work items. Task management
and Channel threads are implemented and production-enabled alongside Company
collaboration, and all three remain independently disableable through their
server-authoritative controls.
