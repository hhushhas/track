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

- Keep Company, Project, and Channel context visible in the workspace, including
  task boards, lists, details, and focused threads.
- Optimize conversation for reading and composing; keep metadata subordinate.
- Use dense lists or tables for members and settings.
- Keep AI answers close to their source messages and visibly distinct from human messages.
- Show evidence, visibility, ownership, and status before decorative details.
- Adapt the information hierarchy to mobile instead of shrinking desktop layouts.

Company is the umbrella, not an alternative workspace mode. Each Project has one
owning Company and can include collaborating Companies. Company navigation groups
owned and collaborating Projects without duplicating their work. An internal
Project does not require a partner relationship. Existing Projects without a
confirmed Company assignment remain reachable from the Company hub. Assignment
is explicit; navigation must not silently assign them or expand access.

Collapsing navigation removes labels while preserving grouped controls, Company
and Project identity, accessible names, and header actions. Long names must not
push switchers out of their container. Conversation and task views share the
same Company/Project navigation rather than substituting a generic workspace.

## Interaction states

Every async surface needs a deliberate loading, empty, success, and error state. Errors should explain the failed action and offer a safe retry when the action is repeatable. Destructive actions require clear intent and should not rely on color alone.

Unread, mention, report, blocked, and permission states need text or icon semantics in addition to color. Motion should communicate state change, remain brief, and respect reduced-motion preferences.

Company identity appears only where it changes interpretation. Acting Company
is explicit in navigation and Project controls; compact Company badges accompany
message authors, represented Project memberships, invitations, and approvals.
The badge remains subordinate to the person's name and never uses color as its
only signal. Restricted administrative surfaces describe the authority boundary
without exposing Channel names, counts, snippets, or member activity.

Exit archives use an unambiguous read-only treatment and explain the frozen
cutoff, including the owning Company's identity at that cutoff. Audience-expanding invitations name the Companies and people that will
gain access before confirmation. Suspension, stale approval, access loss,
snapshot failure, and cleanup failure each retain a safe retry or recovery path.

Snapshot preparation has a visible, temporary read-only state for every Project
participant while the immutable cutoff is captured. A failed capture retains
that state until retry or cancellation; verified capture releases it. This is
separate from the exiting Company's permanent read-only archive. Only authorized
Company administrators see capture management controls.

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

Company-based Channel conversations use the shared composer controls for files,
voice, mentions, emoji, and scoped memory import. Those controls preserve the
represented Company membership and the destination Channel. Aggregated task
lists combine equivalent statuses across boards and distinguish genuinely
different workflows instead of repeating unexplained status headings. Task
titles remain readable when long or written in mixed left-to-right and
right-to-left text.

## Company Project implementation boundaries

`CompanyProjectPage` resolves route scope, subscriptions, and actions.
`CompanyProjectConversation` composes the shared navigation, Channel timeline,
and scoped composer. `CompanyProjectAdministration` owns membership,
participation, archive, and exit controls. `CompanyProjectNavigation` and the
typed Company Project link helpers preserve Company, Project, and represented
membership context across conversation and task routes.

Feature styles live beside their owning Company, task, thread, and conversation
components; shared tokens and base primitives remain global.

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
