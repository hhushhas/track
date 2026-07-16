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
- Standard radii: 6px, 8px, and 12px.

Use semantic CSS variables and shared theme values instead of copying raw colors into components. Preserve the maintained light and dark palettes.

## Layout and hierarchy

- Keep project and group context visible in the workspace.
- Optimize conversation for reading and composing; keep metadata subordinate.
- Use dense lists or tables for members and settings.
- Keep AI answers close to their source messages and visibly distinct from human messages.
- Show evidence, visibility, ownership, and status before decorative details.
- Adapt the information hierarchy to mobile instead of shrinking desktop layouts.

## Interaction states

Every async surface needs a deliberate loading, empty, success, and error state. Errors should explain the failed action and offer a safe retry when the action is repeatable. Destructive actions require clear intent and should not rely on color alone.

Unread, mention, report, blocked, and permission states need text or icon semantics in addition to color. Motion should communicate state change, remain brief, and respect reduced-motion preferences.

## Accessibility

- Support keyboard navigation and visible focus on web.
- Use semantic controls and accessible names.
- Maintain at least 44px touch targets for primary mobile actions.
- Meet WCAG AA contrast for text and meaningful controls.
- Announce async failures and significant state changes to assistive technology.
- Keep references and permission explanations readable without hover.

## Product language

Use the canonical nouns in [PRODUCT.md](./PRODUCT.md). Describe `@track` as an assistant grounded in accessible references. Do not describe AI answers as durable work items; tasks and boards arrive through the future direction in [ROADMAP.md](./ROADMAP.md).
