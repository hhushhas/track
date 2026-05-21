---
version: alpha
name: Track Design System
description: Source of truth for Track's web and mobile product design.
colors:
  ink: "#1b1917"
  ink-2: "#3a3631"
  ink-3: "#6b655c"
  ink-4: "#a39e94"
  ink-5: "#c9c3b8"
  paper: "#faf9f7"
  paper-2: "#f3f1ed"
  paper-3: "#ebe8e2"
  hairline: "#e3dfd7"
  hairline-strong: "#d6d1c6"
  accent: "#f0b100"
  accent-hover: "#e0a300"
  accent-soft: "#fef3c7"
  accent-tint: "#fdf8e8"
  accent-ink: "#7a5800"
  success: "#15803d"
  success-soft: "#dcfce7"
  danger: "#b91c1c"
  danger-soft: "#fee2e2"
  info: "#1d4ed8"
  info-soft: "#dbeafe"
  warning: "#a16207"
  scope: "#c2410c"
  avatar-staff-olive: "#5b6d4a"
  avatar-staff-clay: "#7a4a3a"
  avatar-staff-blue: "#3a4a6d"
typography:
  body:
    fontFamily: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-large:
    fontFamily: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  title:
    fontFamily: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  section-label:
    fontFamily: JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 10.5px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.06em
  metadata:
    fontFamily: JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 10.5px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0.04em
  metric:
    fontFamily: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: 0
rounded:
  xs: 3px
  sm: 4px
  md: 5px
  lg: 6px
  xl: 8px
  full: 9999px
spacing:
  xxs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 12px
  2xl: 14px
  3xl: 16px
  4xl: 18px
  5xl: 24px
  6xl: 32px
  nav-width: 232px
  right-rail-width: 312px
  content-max: 760px
components:
  button-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 28px
    padding: 6px 11px
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    borderColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 28px
    padding: 6px 11px
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    borderColor: "{colors.accent}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 28px
    padding: 6px 11px
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    rounded: "{rounded.xl}"
    padding: 10px 14px
  draft-record:
    backgroundColor: "{colors.paper}"
    borderColor: "{colors.hairline-strong}"
    highlightColor: "{colors.accent-tint}"
    rounded: "{rounded.lg}"
  table-row-draft:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-ink}"
---

# Track Design System

This file is the durable source of truth for Track's product design. New web and mobile UI must use these tokens, product principles, and component rules before inventing new visual language.

## Overview

Track is a dense, calm project communication tool: it should feel like a serious group chat that quietly builds a trustworthy project record in the background.

The product is work-focused, evidence-oriented, and fast to scan. It should feel closer to shadcn/ui, Vercel, Linear, and a polished internal operations console than to a marketing website, generic AI assistant, or social chat app.

The locked product direction is:

- Chat is the primary surface.
- Project and Group context are always visible.
- AI output appears as reviewable work artifacts, not as magic theater.
- Records, evidence, permissions, and visibility need stronger visual clarity than decorative branding.
- Web and mobile must share Track's product identity, information semantics, evidence cues, and permission clarity. Mobile v1 feature scope is controlled by `scratchpad/mobile-v1-implementation-spec-2026-05-16.md`.

## Colors

Track uses a warm neutral system anchored by Deep Stone and Signal Yellow.

- **Deep Stone (`#1b1917`)**: Primary ink, app icon base, active nav, primary buttons, high-emphasis text.
- **Signal Yellow (`#f0b100`)**: Brand signal, AI review activity, suggested classifications, focused attention. Use sparingly.
- **Warm Paper (`#faf9f7`)**: Main app background. Prefer this over pure white.
- **Paper 2 (`#f3f1ed`)**: Navigation, rails, secondary surfaces, composer chrome.
- **Paper 3 (`#ebe8e2`)**: Hover states and deeper warm neutral bands.
- **Hairline (`#e3dfd7`) / Hairline Strong (`#d6d1c6`)**: Dividers, borders, table lines, subtle control outlines.
- **Muted Ink (`#6b655c`, `#a39e94`, `#c9c3b8`)**: Metadata, timestamps, secondary labels, disabled affordances.
- **Semantic accents**: Green for accepted/billable/success, blue for client/task/info, red for blocker/error/clarification, ochre for question/internal caution, rust for scope change.

Color rules:

- Yellow is a signal, not a background theme. Do not flood pages with yellow.
- Purple AI gradients are forbidden.
- Prefer warm paper, hairlines, type weight, and layout density over saturated color.
- Use semantic color only where it clarifies state, role, type, classification, or urgency.
- On dark stone surfaces, use reversed logo/mark assets and keep yellow as the sharp focal color.

## Typography

Use Inter for product UI and JetBrains Mono for structured metadata.

- **Inter**: All normal UI copy, messages, titles, buttons, controls, body text.
- **JetBrains Mono**: IDs, timestamps, keyboard hints, record codes, section labels, status chips, uppercase metadata.
- **Base size**: 13.5px on web; 13-14px equivalent on mobile.
- **Message text**: 14px web, 13.5-14px mobile, line-height 1.5.
- **Titles**: 14-15px, 600 weight. Avoid oversized headings inside the app shell.
- **Labels**: 10-10.5px mono, uppercase, 0.04-0.08em letter spacing.
- **Metrics**: 22px, 600, tabular numerals where available.

Typography rules:

- Keep letter spacing at `0` for normal prose and controls.
- Use mono labels to make operational metadata scannable, not to decorate.
- Never use hero-scale typography inside the app product shell.
- Prefer concise labels: `Drafts`, `Needs review`, `Last run`, `Visible to`, `Evidence`.

## Layout

The canonical web layout is a three-area work surface:

- Left project/group navigation, fixed around 232px.
- Main conversation or Project Record area.
- Optional right rail around 312px for AI Review state, counts, recent records, details, or inspectors.

Core layout rules:

- Keep app screens full-height and task-oriented.
- Chat content should cap near 760px so long messages remain readable.
- Use hairline dividers and warm surface shifts to separate regions.
- Keep controls close to the work they affect.
- Make Project and Group context visible in headers and navigation.
- Use tables or dense lists for Project Record, audit, members, and settings where scanning matters.
- Do not place cards inside cards. Repeated record items may be cards; whole page sections should not become decorative cards.

Spacing:

- Use a tight 2/4/6/8/10/12/14/16/18/24/32px scale.
- Prefer 6-12px gaps inside dense controls and rows.
- Prefer 14-18px section padding in rails.
- Prefer 24-32px horizontal padding in the main thread on desktop.
- Mobile gets more touch target height, not looser information architecture.

## Elevation & Depth

Track is mostly flat. Depth comes from borders, tonal surfaces, sticky headers, and very soft rings.

- Default containers use 1px hairline borders.
- Draft Records may use a soft yellow outer ring: `0 0 0 3px #fdf8e8`.
- Use small shadows only for real floating layers: popovers, dialogs, menus, mobile device mockups, and drag/drop overlays.
- Avoid heavy drop shadows, glassmorphism, blurred panels, and floating dashboard cards.

## Shapes

The shape language is precise and slightly softened.

- Buttons: 5px radius.
- Chips and badges: 3-4px radius.
- Record cards: 6px radius.
- Composer: 8px radius on web, pill field on mobile.
- Avatars and unread dots: circular.
- Brand mark: compact square with softened corners.
- Mobile shell examples may use large device radii, but product components inside the shell stay compact.

Do not mix very round marketing pills with sharp product controls on the same screen.

## Components

### App Shell

- Left navigation contains brand, project list, group list, counts, and user profile.
- Active nav item uses Deep Stone background with paper text and a small yellow dot.
- Project List and Group List rows must show operational state: unread, Draft Record count, needs-review/billable state where allowed, and last activity.
- The selected Project and Group must be clear without relying on color alone.

### Headers

- Headers use a thin bottom border, warm paper background, compact title stack, member avatars, and action cluster.
- Breadcrumbs are mono uppercase metadata.
- Status chips are small, bordered, and neutral unless they represent urgent state.

### Buttons

- Default: paper background, hairline-strong border, Deep Stone text.
- Primary: Deep Stone background, paper text.
- Accent: Signal Yellow background, Deep Stone text, only for the dominant action or AI attention action.
- Ghost: transparent until hover.
- Icon buttons are preferred for compact tool actions, with tooltips when the icon is not obvious.
- Button height should usually be 28px on web and 36-44px touch target on mobile.

### Inputs And Composer

- Composer is a first-class surface, not a generic textarea.
- Web composer: bordered 8px container with input area and bottom toolbar.
- Mobile composer: bottom bar, pill field, circular send affordance using stone/yellow.
- Placeholder copy should be specific to the current Group, mention support, and attachment capability when relevant.
- Focus state should use a stronger neutral border, not glowing color.

### Messages

- Messages are chat-like but not bubbly on web. Use avatar column, author metadata, timestamp, role chip, and text.
- Continued messages collapse repeated author metadata.
- Client role chips use blue-soft treatment; staff/owner chips stay neutral or stone.
- Message timestamps and role labels use mono metadata.
- Attachments inherit message visibility and should visually stay attached to the source message.

### Draft Records

Draft Records are AI-proposed work artifacts shown inline near their source messages.

- Use yellow-tint header and soft yellow ring to signal "AI needs review".
- Include type, suggested classification, owner/status if known, summary, evidence, and actions.
- Always show evidence access or evidence count. Evidence is not optional decoration.
- Suggested classification chips use accent tint and inner yellow emphasis.
- Save/accept actions should be clear, but never obscure the fact that this is still a draft.
- Dismiss/ignore must be available but visually secondary.

### Reviewed Records

- Reviewed Records use neutral paper treatment, not yellow.
- Use a small accepted/check indicator and mono stamp such as `Saved record`.
- Include source Group, reviewer, timestamp, visibility, classification, and evidence links.
- Billable classification gets green treatment, but should not imply actual billing/payment.

### Project Record

- Default Project Record view is dense and table/list oriented.
- Columns should support ID, title, summary, type, classification, status, source Group, reviewer/owner, and time.
- Draft rows can be yellow-tinted when mixed into record workflows.
- Filters are compact chips; active filters use Deep Stone.
- Search is compact and aligned with filter controls.
- Record Detail must preserve source Group and source message evidence.

### Conversational AI Surfaces

Track Assistant answers inline in the Group conversation after `@track`.

- Assistant answers should look like message content plus evidence, not like a separate chatbot product.
- Use restrained AI markers: small yellow dot, mono `Track` label, or yellow-tint evidence note.
- Cite or link source messages/Records whenever factual claims are made.
- Use language that supports evidence: `Yes`, `No`, `Partly`, or `I do not see enough evidence`.
- If an answer creates a Draft Record, show the Draft Record inline after the answer with normal review controls.
- Avoid sparkle-heavy AI graphics, purple gradients, theatrical typing cards, and anthropomorphic assistant chrome.

### Notifications

- Notification settings use compact lists, toggles, and per-Group overrides.
- Notification previews must never reveal inaccessible Group content.
- Unread and needs-review indicators should be visible in Project List and Group List.
- Push permission prompts should be plain and tied to product value, not alarmist.

### Empty, Loading, And Error States

- Empty states should be small, operational, and placed inside the working surface.
- Do not use large illustrations or marketing copy inside the app.
- Empty Project List: prompt to create or join a Project.
- Empty Group: state who can see it and invite the first message.
- Empty Project Record: explain that reviewed Records will appear after AI Review and review.
- Loading states: use skeleton rows, muted text, or compact progress. AI Review can use a small yellow pulse or meter.
- Error states: use red only for errors/blockers; include exact recovery action and preserve user input.
- Permission-denied states must explain the boundary: Project membership, Group membership, or reviewer authority.

## Mobile V1 Parity

Mobile v1 must feel like the same Track product while using native mobile spatial patterns. `scratchpad/mobile-v1-implementation-spec-2026-05-16.md` is the controlling implementation scope.

Mobile v1 includes:

- Project List and switching.
- Group List and switching.
- Group Conversation.
- Messages, attachments, voice notes, mentions, and presence.
- `@track` streaming assistant.
- Real unread counts.
- Native push notifications.
- Notification settings.
- Native 2FA challenge when required.
- Account/Profile with Privacy, Terms, Support, and Delete Account.
- Report/flag actions for user messages, voice notes, attachments, and assistant answers.
- Member and Group settings where authorized.

Mobile v1 excludes:

- AI Review run button.
- Draft Record review and classification.
- Project Record viewing, filtering, detail, and export.
- Audit trail.

Mobile design rules:

- Preserve semantics; change interaction shape.
- Use native navigation patterns: stack headers, back affordance, bottom composer, sheets for tools/detail.
- Preserve conversation design parity: message anatomy, reply quotes, assistant rows, evidence chips, attachment treatment, and compact Track metadata.
- Use 36-44px touch targets.
- Avoid hiding evidence/source functions behind desktop-only rails.
- Keep destructive/privacy/security actions findable without making Account feel like a desktop settings console.
- Permission prompts must be action-triggered and plain: microphone for voice notes, push for mentions/messages, photos/documents only when attaching.
- Web right rail maps to mobile sheets, tabs, or detail screens.

## Accessibility

- Meet WCAG AA contrast for normal text and controls.
- Do not communicate state by color alone; pair with label, icon, position, or count.
- Keyboard navigation is required on web for project/group switching, composer, filters, record review, menus, and dialogs.
- Focus states must be visible and consistent.
- Screen reader labels must include Project, Group, visibility, and state when relevant.
- Tables need accessible headers and row actions.
- Touch targets on mobile must be large enough even when the visual style is compact.
- Motion must respect reduced-motion settings.

## Motion

Motion should be quiet and utility-driven.

- Use 120-180ms transitions for hover, focus, open/close, chip selection, evidence expansion, and rail/sheet entry.
- AI Review may use a subtle yellow pulse only while activity is live.
- Streaming Assistant responses should render smoothly without causing layout jumps.
- Avoid parallax, bouncing, confetti, oversized loaders, animated gradients, and decorative motion.

## Product-Specific State Language

Use these canonical labels consistently:

- `Project`
- `Group`
- `Conversation`
- `AI Review`
- `Track Assistant`
- `Draft Record`
- `Record`
- `Project Record`
- `Evidence`
- `Source Messages`
- `Reviewer`
- `Billable`
- `Included in Scope`
- `Official Note`
- `Internal Only`
- `Needs Clarification`
- `Ignore`

Avoid synonyms that blur semantics:

- Do not call Groups "channels" unless product language changes globally.
- Do not call Draft Records "AI cards" or "suggestions" in durable UI.
- Do not call Project Record a "database", "CRM", or "contract".
- Do not imply Billable means charged, invoiced, or paid.

## Do's And Don'ts

- Do make the UI feel like a normal project chat that remembers important facts.
- Do keep Records close to the messages and evidence that created them.
- Do make Group visibility and access boundaries visible in context.
- Do preserve shared web/mobile identity, message grammar, and evidence semantics even when feature scope or layout differs.
- Do use warm neutral surfaces, hairline borders, compact controls, and mono metadata.
- Do reserve Signal Yellow for brand signal, AI activity, suggestions, and the single highest attention item.
- Do use tables and dense lists for operational review surfaces.
- Do keep screenshots, exports, and evidence visually traceable to their source Group.
- Don't create a landing-page hero when building the product app.
- Don't use generic purple AI UI, neon gradients, big sparkle motifs, or chat bubbles everywhere.
- Don't make the interface look like a social messenger at the expense of evidence and review.
- Don't hide evidence, source messages, or visibility behind vague icons.
- Don't add decorative cards around every page section.
- Don't use pure white/black as the default palette when Track's warm stone system is available.
- Don't introduce new colors without mapping them to state, role, or record semantics.
