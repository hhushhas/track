# Track Mobile Typography Implementation Plan

**Status:** Ready for implementation after the font choice and license are accepted.  
**Owner:** Track mobile  
**Scope:** `apps/mobile` typography, font assets, supporting design guidance, and visual verification.  
**Out of scope:** Web typography, brand mark redesign, layout redesign, product behavior, and native font generation without its required approval.

## Outcome

Give every app-owned mobile screen one consistent, readable sans family and one semantic type scale. Keep monospace for fixed identifiers such as task keys. Preserve route behavior, content, colors, spacing, accessibility labels, and system-owned controls.

The font research recommends **Manrope V5 Static** as the first candidate. The implementation must use the creator's original, unmodified static files, preserve the required font name and attribution, and verify the exact release terms before adding the files. If its license or glyph coverage does not fit Track, use **Cal Sans v2 UI/Text Static** as the fallback candidate after the same asset and license check. Do not substitute Satoshi or Aeonik without written guidance on their content-authoring terms for a messaging and task app.

Expo SDK 57 is in use and `expo-font` is already installed. Use Expo's native font config plugin with static files. Do not add a font package or use runtime font loading unless a specific native constraint requires it. The plugin is already present in `app.config.ts` as a bare `expo-font` entry; implementation will configure that entry for the approved files.

## Decisions and constraints

1. Use one selected sans family for app-owned interface text, including messages, user-written task text, descriptions, metadata, controls, and pills.
2. Keep operating-system-owned UI in the platform's system font. Use monospace only for fixed-format identifiers, not names, timestamps, counts, or ordinary labels.
3. Keep the current mobile type sizes and line heights as the baseline. Change a value only when a real-device specimen shows a specific readability or layout problem.
4. Use only weights that exist in the approved static release. Do not synthesize bold, compress glyphs, subset, convert, or rename restricted font files.
5. Keep text scaling enabled and check the supported accessibility range. Text must wrap, scroll, or grow instead of clipping or shrinking to fit.
6. Resolve the current documentation conflict with a mobile-specific rule. `docs/DESIGN.md` currently calls for Inter and Geist in interface roles; `apps/mobile/STITCH-DESIGN-RULES.md` currently calls for the platform system sans. Preserve the web direction unless a separate product decision changes it.
7. Preserve all unrelated work in the dirty worktree. `apps/mobile/src/constants/theme.ts` already contains local changes; inspect and merge around them before editing that file.

## Type contract

Keep the existing semantic roles in `src/constants/theme.ts` and route usage through `ThemedText` where possible. This is the starting contract; the implementation audit may identify a role that needs a documented, evidence-based adjustment.

| Role | Size / line height / weight | Typical use |
|---|---|---|
| Navigation title | iOS 17/22; Android 20/26; 600 | Native stack titles. |
| Display | 28/34; 700 | One main screen or project title. |
| Large title | 20/26; 700 | Section and task-detail headings. |
| Subtitle | 17/22; 600 | Important supporting headings and entity titles. |
| Message | 16/22; 400 | Channel and thread content, composer text, and long user-written text. |
| Body | 15/21; 400 | Descriptions, task detail copy, settings, and normal reading content. |
| Body emphasis / title | 15/21 or 15/20; 600 | Row titles, buttons, menu actions, and emphasized body copy. |
| Label | 13/18; 500 | Field labels, compact section labels, and task attributes. |
| Caption | 12/16; 400 or 600 | Helper text, errors, timestamps, author metadata, pills, badges, and counts. |
| Identifier | 11/15; monospace | Task keys and other fixed-format identifiers only. |

Counts, dates, and times retain tabular numerals. Review current local styles below 12 points: promote essential information to the caption role, and keep a smaller exception only when it is nonessential, remains legible on device, and has an accessible text label.

## Code and documentation targets

| Area | Primary files | Planned change |
|---|---|---|
| Font integration | `apps/mobile/app.config.ts`, `apps/mobile/assets/fonts/` | Add approved original static files and configure the existing Expo font plugin. Include the applicable license and attribution with the shipped font assets. |
| Shared tokens | `apps/mobile/src/constants/theme.ts`, `apps/mobile/src/components/themed-text.tsx` | Map the selected family once, retain semantic roles, and keep the mono role limited to identifiers. |
| Navigation | `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/components/primary-stack.tsx`, `apps/mobile/src/components/primary-navigation.tsx` | Apply the shared family to app-owned header titles and tab labels without changing labels, routes, or navigation behavior. |
| Shared controls | `action-button.tsx`, `adaptive-list-row.tsx`, `compact-pill-button.tsx`, `options-sheet.tsx`, `empty-state.tsx`, `app-toast.tsx`, and related shared components | Replace repeated local font declarations with semantic roles; keep layout-specific styles local. |
| Chat and task text | `composer.tsx`, `chat/`, `task-detail-content.tsx`, `task-list-content.tsx`, `task-board.tsx`, `task-ui.tsx` | Cover message bodies, sender names, timestamps, attachments, inputs, task titles, descriptions, properties, and identifier exceptions. |
| Route surfaces | `src/app/`, `src/screens/`, and route-owned dashboard components | Audit every shipped route and state listed below for direct `Text`, `TextInput`, navigation, and third-party text styling. |
| Guidance | `apps/mobile/STITCH-DESIGN-RULES.md`, `apps/mobile/mobile-ui-ux-guide.md`, and the mobile section of `docs/DESIGN.md` | State the chosen mobile family, role mapping, mono rule, license reference, and SDK constraint in one consistent direction. Do not change web typography in this task. |

The current source inventory includes direct styles in 22 TypeScript files. The shared theme alone does not control them all. Audit raw React Native `Text` and `TextInput`, navigation options, badge counters, the date/calendar package, sign-in, logo-adjacent text, and third-party components. Keep the Track wordmark's brand treatment separate where it is a deliberate logo choice.

## Implementation sequence

### 1. Confirm assets and the design contract

1. Select Manrope V5 Static, or the documented Cal Sans fallback, from the official publisher source.
2. Verify the exact file release, available static weights, glyph coverage for Track's supported languages, permitted application embedding, and required attribution against the license distributed with those files.
3. Preserve the publisher filenames and contents. Add only the weights actually used; keep the license notice with the assets and include the required attribution in the app's existing license/about surface, or add a concise license entry if none exists.
4. Update mobile design guidance so it states one family and the role contract above. Clarify that the web font direction is unchanged.

**Exit evidence:** the exact files and license are recorded, the chosen family covers supported text, and the mobile design docs agree.

### 2. Wire font files into the native app

1. Configure the existing `expo-font` plugin in `app.config.ts` with the approved static files, following the SDK 57 plugin format.
2. Define the selected sans family centrally in `src/constants/theme.ts`; keep the system monospace or approved identifier family separate.
3. Confirm the iOS internal family names and Android font mappings resolve to the intended regular, medium, semibold, and bold files.
4. Keep font loading out of the React startup path if native bundling works, so the app does not flash from system text to custom text.

**Exit evidence:** Expo config resolves all font paths, every requested weight maps to a real file, and the app's first rendered text uses the chosen family in native builds.

### 3. Migrate shared components first

1. Update `ThemedText` only where a semantic role is missing or misassigned. Preserve its current type names where existing callers depend on them.
2. Move shared buttons, navigation labels, row titles, pills, badges, empty states, toast text, sheets, and form fields onto the type roles.
3. Apply the body and message roles to `TextInput` styles, including placeholder and entered text. Preserve multiline growth, selection, cursor behavior, keyboard appearance, and minimum touch sizes.
4. Check native date pickers and `react-native-calendars` for supported font configuration. Use the shared family when the package supports it; otherwise document the platform-owned exception instead of patching its internals.
5. Remove a local font declaration only after verifying all consumers and retaining any legitimate role distinction.

**Exit evidence:** shared components use the canonical roles, local exceptions have a reason, and there is no accidental monospace use for ordinary copy.

### 4. Migrate screens in route groups

1. **App shell and account:** launch/splash text, sign-in, navigation headers, bottom tabs, Company selector, and Profile.
2. **Conversation work:** Chats, Channel, Thread, message and assistant content, author names, timestamps, mentions, attachments, voice notes, and composer.
3. **Task work:** My Tasks, project board and list, task cards, task detail, create/edit forms, checklists, source-message evidence, and task comment composer.
4. **Workspace and updates:** Company and Project directories, project overview/settings, Inbox, notifications, search, filters, and scope selectors.
5. **Transient states:** date and timezone pickers, option sheets, dialogs, menus, empty/loading/error/offline states, and toasts.

Within each group, migrate all text in one shared surface before moving to the next. Keep labels and text content unchanged. Avoid repository-wide formatting and avoid combining typography work with spacing, color, or product behavior changes.

**Exit evidence:** the route inventory is complete, every app-owned text element uses a role or a documented exception, and routes, scope, actions, and navigation still behave as before.

### 5. Review visual and accessibility boundaries

Review both iOS and Android in light and dark themes, with ordinary and large accessibility text. For each route group, include short and long content, empty/loading/error states where relevant, keyboard-open forms, and a narrow phone width. Check:

- Line wrapping, clipping, truncation, baseline alignment, and text-input vertical alignment.
- Weight fidelity, punctuation, numerals, diacritics, and glyph fallback.
- Message readability, task title scanning, metadata contrast, pill fit, and badge legibility.
- Screen-reader labels, order, selected/disabled states, and text scaling.
- Layout stability when font scale changes and during startup.

Capture before/after screenshots from the same identified current build and state. Record device, OS, build identity, theme, font scale, route, content condition, and result. Do not treat historic screenshots or source inspection as device proof.

**Exit evidence:** every route group has current iOS and Android visual evidence, and no critical or high-severity typography or accessibility issue remains.

### 6. Verify and hand off

Run the project-required gates after implementation: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`, and `pnpm build`. Run focused mobile lint, typecheck, and tests as well. Review the final diff and preserve the existing dirty worktree.

Exercise real local flows that include sign-in rendering, Chats and Thread reading, message composition, task creation and editing, Task Detail, Inbox, Profile, forms, and sheets. Confirm the font files ship in native iOS and Android builds. Report evidence per platform and list any unsupported font or accessibility combinations.

The active AGENTS instructions for this mobile task require immediate explicit approval before commands such as `npx expo prebuild`, `npx expo run:ios`, or `npx expo run:android`. Stop before any such command and request approval for the exact command and target after the code and config changes are ready for review. Config edits and JavaScript-only checks do not replace native font verification.

**Exit evidence:** all applicable gates pass, required local real-path checks pass on current native builds, font attribution ships, and the final diff contains only intended typography changes.

## Risks and controls

| Risk | Control |
|---|---|
| Font license or app-authoring terms do not fit Track. | Confirm the exact Manrope V5 terms before adding files; use the Cal Sans candidate only after its own license review. |
| Existing typography guidance conflicts. | Update the mobile-specific guidance and clarify the mobile/web boundary before code migration. |
| A family lacks a required glyph or weight. | Check official static assets and supported-language glyph coverage first; do not synthesize or silently fall back. |
| Direct styles bypass the theme. | Use a tracked source inventory and screen-by-screen audit; config-only changes are not completion evidence. |
| The font changes line wrapping or screen density. | Keep current sizes initially and check long content, large text, and narrow devices on both platforms. |
| Existing local edits are overwritten. | Inspect the current diff for every touched file and make surgical edits around existing work. |
| Native build commands alter generated platform files. | Obtain the exact approval required by the active mobile agent instructions before any protected command; inspect generated diffs afterward. |

## Completion checklist

- [ ] Font family, exact release, static files, license, and attribution are recorded.
- [ ] Mobile typography guidance has one authoritative family and role contract.
- [ ] Expo SDK 57 loads the intended font natively on iOS and Android without a startup flash.
- [ ] Shared typography tokens cover all app-owned screen text, controls, inputs, pills, and metadata.
- [ ] Monospace appears only on identifiers; system-owned UI retains platform typography.
- [ ] Light/dark themes, supported locales, large text, narrow layouts, and content extremes have been reviewed.
- [ ] Existing product behavior and accessibility semantics remain intact.
- [ ] Required automated gates and native real-path checks pass, with evidence recorded.
- [ ] The final diff is scoped and preserves unrelated user work.
