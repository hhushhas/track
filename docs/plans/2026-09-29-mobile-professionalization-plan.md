# Track Mobile Professionalization and Release Readiness Plan

Status: In progress. Automated quality gates pass, but current-device and user validation remain incomplete, so the app is not release-ready.

Owner: Track mobile

Review date: 2026-09-29

Scope: `apps/mobile`, and only the shared or Convex contracts required to support its approved user paths.

## Outcome

Deliver a mobile app that people can use every day to find the right Company conversation, understand its Project and Channel context, respond, turn important discussion into durable tasks, and follow those tasks through completion. Conversations, My Tasks, Inbox, and Profile remain the four primary destinations. Channel, Thread, Project, and Task Detail remain contextual routes.

The target is a calm, classical, minimal product with dependable behavior on supported iOS and Android devices. The app must be clear with real data, long names, large text, weak connectivity, denied access, and empty states. Visual similarity to Airbnb, Uber, Linear, or WhatsApp is not the acceptance criterion. The acceptance criterion is a coherent Track product that meets the quality gates below.

“10/10” is a release-readiness label for this plan, not a promise or a subjective design score. Do not use it until every release gate has evidence from the current build and target devices.

## Product decisions that remain locked

- The four primary destinations are Conversations, My Tasks, Inbox, and Profile, in that order.
- Conversations is the signed-in first screen. The Company selector, Project selector, search, and filters must keep the active scope clear.
- Company-wide means all accessible Projects in the selected Company. Inbox is user-global. Every item and mutation retains its actual Company, Project, Channel, Thread, and membership scope.
- A Thread belongs to a Channel and inherits its access boundary. Track has no direct-message surface outside Projects and Channels.
- Discussion is the default source of work context. A task created from a message keeps a durable, permission-checked link to that message.
- iOS and Android may use different navigation materials as specified in the approved plan. Android navigation stays flat and non-pill-shaped; iOS may use the approved rounded translucent treatment.
- Keep the warm-stone surfaces, dark-stone text, and purposeful yellow accent. Reuse the existing tokens and Home patterns. Do not add decoration to compensate for weak hierarchy.
- Preserve all unrelated staged, unstaged, and untracked work. Do not edit `docs/DESIGN.md` as part of this plan. Do not remove routes, backend behavior, or shared web behavior without tracing callers and approved replacement paths.

## Current evidence and limits

The source contains substantial implementation for Company conversations, search and filters, Channel and Thread chat, message actions, replies, attachments, voice notes, mentions, read state, task creation from a message, My Tasks, Inbox, Profile, and permission-aware contextual navigation. These capabilities still need current-build device evidence before they can be marked as working.

The full repository checks passed on 2026-09-29 against the current working tree: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`, and `pnpm build`. The root tests passed across mobile (132 tests), web (133 tests), and Convex (100 tests). Expo export produced web, Android, and iOS bundles. The production dependency audit initially found a moderate Undici advisory; the workspace override and lockfile now select patched Undici 7.29.1, and the audit passes. An auth guard test also timed out in the full suite; its test harness now skips unrelated Better Auth component registration, the focused test passes, and the full suite passes. The mobile lint scan initially included a local minified export folder and emitted 10,723 warnings; the export directory is now ignored without deleting its files, and a rerun passes with zero warnings or errors.

An earlier Playwright web journey run did not reach test execution. The isolated local web server logged `NitroViteError: Vite environment "nitro" is unavailable`, and Playwright timed out waiting for its webServer after 360 seconds. Its temporary clone and output were removed. The requester has explicitly excluded browser end-to-end testing from the current work, so no rerun is planned and no browser pass is claimed.

Read-only ADB inspection found an Android 17 / API 37 x86_64 emulator (`emulator-5554`) with `ai.q9labs.track/.MainActivity` installed at version 1.2.0 (versionCode 15; last update 2026-09-29 16:00:08). A screenshot and accessibility-tree capture showed Conversations after the first spacing reduction (`%TEMP%/track-mobile-conversations-after-spacing.png` and `%TEMP%/track-mobile-window-after-spacing.xml`). The tree exposed labels and click targets for the Company selector, Project tabs, search, filters, Channel rows, notification bell, and Create task button; selected states were present for the active Project and primary tab. It also showed the floating task button overlapping part of the bottom-right Channel and Thread hit areas. A later capture showed My Tasks (`%TEMP%/track-mobile-conversations-final-review.png`), so it does not prove the final Conversations spacing tweak. CUA reports `apps: []`; no tap or screen-reader interaction was available. The install step is complete per the requester; no reinstall was run.

The current source has a dedicated compact Project tab component for Conversations, a full-width Company selector, no numeric unread badges in Channel rows, and a count-free bell sheet backed by the Company-scoped Inbox attention query. Notification rows show Project and Channel context, distinguish Thread activity, and route to the source message. Project and Channel labels remain data-driven; the notification settings sheet uses the active Channel name. Channel icons use circular surfaces and lighter weight. A long press on Channel or Thread rows now opens a floating peek with Project and Channel context and recent message content; a normal tap still opens the full conversation. The bottom-right plus remains the existing task-creation action. The Conversations header now starts 8 px below the safe area; header and list gaps use 4 px steps, the Project heading row is 32 px rather than 48 px, and the feed no longer adds an extra filter-bottom or section-top margin. Controls keep their existing touch targets. Automated regression checks cover notification-sheet states, notification context and routing, Channel and Thread preview content, and the task-from-message title, primary source reference, title limit, fallback, and idempotency key. The full automated gate passes. Native sheet and long-press interaction, final-source emulator layout, and the complete chat-to-task journey remain unverified.

The repository remains broadly dirty with pre-existing staged, unstaged, and untracked work; preserve all of it and keep changes limited to owned paths. No current-build mobile screenshots, accessibility run, complete device journey, moderated user session, or named human review is available.

## Remaining work and handoff

"Tighter spacing" means a consistent 4–8 px rhythm between the Conversations title, Company selector, Project tabs, search field, filters, and first Project divider. The screen keeps the device safe-area inset and 16 px horizontal page padding. The title row stays compact; the selector, tabs, search, filters, and icon controls keep their touch targets. The current source uses an 8 px safe-area offset, 4 px header and list gaps, a 32 px Project heading row, 8 px divider top padding, and no extra filter-bottom or section-top margin. The first screenshot showed the heading and feed moving closer together. A fresh Conversations screenshot after the final 8 px reduction is still needed; do not reduce touch targets to make the page denser.

The following items remain open. Keep this list current and do not label the app release-ready until each required proof exists.

1. **Finish Android screen verification.** ADB screenshot and accessibility-tree evidence exist, but CUA exposes no app surface. Capture the Conversations screen after the final spacing change and verify the notification sheet, Company selector, Project selection and scrolling, filters, Channel disclosure, long-press peek and normal-tap navigation, and task-action press behavior if the Android app surface becomes available. The installed app is already present; do not reinstall it.
2. **Complete the chat-to-task journey.** The full automated tests pass, but the real UI sequence has not been exercised: open a Channel, send or receive a message, open a Thread and reply, create a task from its source, open Task Detail, and return to the source. Also check attachment and voice-note permissions, retry and draft recovery, offline/loading/error/empty states, and Company/Project access changes. iOS runtime proof also needs an available simulator or device.
3. **Finish accessibility verification.** The Android tree confirms labels, selected states, and minimum control hit areas for the captured screen. Large text, screen-reader navigation, keyboard behavior, Reduced Motion, contrast, and safe areas still need direct platform checks on Android and iOS.
4. **Verify the notification sheet on a device.** Pure regression tests cover loading, empty, and populated states, newest-message selection, deduplication, Channel/Thread context, and source deep links. They do not render the native sheet or press the bell; verify those interactions when CUA exposes the Android app or a supported iOS device is available.
5. **Complete independent usability and release review.** Run representative user sessions on the main Conversations and task journeys, record task success and critical confusion, fix critical/high findings, and obtain a named reviewer’s acceptance of the evidence and any remaining low-risk issues.
6. **Keep browser end-to-end testing excluded.** The requester asked not to run browser E2E. The earlier pre-test Nitro/Vite timeout remains historical context only; do not rerun it as part of this plan.
7. **Maintain release evidence.** The final source revision passed `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --prod`, and `pnpm build`. Rerun them if source changes again, review the owned diff and worktree, and update every exit gate. Do not edit `docs/DESIGN.md` as part of this plan.

### Execution checkpoint

| Work area | Status | Evidence or remaining proof |
|---|---|---|
| Automated repository gate | Pass | `pnpm lint`, `pnpm typecheck`, `pnpm test` (mobile 135, web 133, Convex 100), `pnpm audit --prod`, and `pnpm build` pass. Browser E2E was excluded by requester instruction. |
| Current device and route inventory | Partial | ADB identifies `emulator-5554`, Android 17 / API 37 x86_64, with version 1.2.0 / versionCode 15 installed. A Conversations screenshot and accessibility tree exist after the first spacing reduction. A later capture showed My Tasks, so final Conversations spacing and direct route interactions still need a stable capture. CUA has no Android app surface. |
| Conversations UI refinement | Partial; visual evidence only | Screenshot and accessibility tree show the Company selector, Project tabs, search, filters, dynamic Project/Channel content, count-free bell, Channel icons, and task button. The source gap was reduced again after that screenshot. Bell press, unread feed states, tab changes, clipping on other widths, and task-action behavior remain unverified. |
| Notification-sheet model | Pass; device UI unverified | Twelve mobile-attention unit tests pass. They cover loading, empty, populated, filtering, sorting, deduplication, Channel/Thread context, and deep-link targets; they do not render the native sheet or exercise its controls. |
| Conversation long-press preview | Automated content model pass; device gesture unverified | Three tests cover Channel context, Thread source/latest reply, and duplicate-message suppression. Long-press timing, native overlay layout, and tap-versus-hold behavior need device verification. |
| Conversations, chat, and source-linked task journey | Partial; device path unverified | Regression tests cover message-to-task draft title, stable idempotency key, and primary source message reference. The live Channel/Thread/reply/task/source-return loop has not been exercised on iOS or Android. |
| Accessibility and platform behavior | Partial | Android accessibility tree exposes labels, selected states, and touch target bounds for primary controls. Large text, actual screen-reader traversal, keyboard, safe areas, Reduced Motion, contrast, and iOS behavior remain unverified. |
| Usability and release review | Not started | No representative user sessions or named human review have been completed. |

## Quality model

Every screen and journey has four separate status fields:

| Status | Meaning |
|---|---|
| `working` | The current implementation meets its behavior contract and has direct runtime evidence. |
| `partial` | A known part works, but one or more required states or paths fail or are missing. |
| `missing` | The required behavior is not implemented. |
| `unverified` | Code suggests support, but current-build runtime evidence is absent. |

Never convert `unverified` to `working` from source inspection, old screenshots, or a remembered test result. Record the build identifier, device and OS, account role, scope, scenario, result, and screenshot or recording for every runtime claim.

## Delivery sequence

### Phase 0: Preserve work and establish the true baseline

1. Record branch and worktree state. Inspect staged and unstaged diffs for every planned file before editing. Make a path-level ownership list so existing work is not overwritten.
2. Inventory Expo routes, deep links, notifications, primary tabs, contextual routes, shared components, Convex query and mutation contracts, feature flags, role checks, and relevant web callers.
3. Map each approved requirement to its implementation, test, device evidence, and current status. Include Conversations, Channel chat, Thread chat, message-to-task, My Tasks, Project board, Task Detail, Inbox, Profile, sign-in/session restore, settings, and route consolidation.
4. Locate the actual emulator or device, determine which app build is installed, and confirm how it is connected to the local development runtime. Do not start a protected native rebuild or run a command listed in the repository's approval section without explicit approval.
5. Separate old screenshots from current-build captures. Mark capture age and route identity. Treat console warnings as leads to reproduce, not as current defects until reproduced.
6. Record current install, lint, typecheck, test, audit, build/export, and run commands from package scripts and repository guidance. Capture baseline output before implementation work.

**Exit gate:** a route-and-capability matrix, exact current build and device identity, current screenshot set for the four tabs and chat journey, worktree preservation map, and prioritized gap list. Every listed item has one of `working`, `partial`, `missing`, or `unverified`.

### Phase 1: Stabilize the navigation shell and shared design system

1. Verify session restore lands directly on Conversations for signed-in users and on Sign in for signed-out users, with no incorrect-screen flash.
2. Verify the four tabs, independent navigation state, selected-state announcement, plus-action position, safe-area behavior, and platform-specific tab treatment.
3. Audit shared headers, Company and Project selectors, Project carousel and drawers, filters, rows, sheets, buttons, loading states, empty states, banners, and floating actions.
4. Compare all shared components with the mobile guide: warm/cool gray family, semantic token use, type roles, spacing rhythm, radius scale, borders, contrast, and minimum touch targets.
5. Fix shared defects once at their owning component. Avoid adding per-screen overrides for a shared visual rule.
6. Check long Company/Project names, small-width layout, screen-reader names and states, font scaling, keyboard colors, and light/dark theme propagation.

**Exit gate:** all four tabs work on iOS and Android at the smallest supported width; no content or action is obscured by tabs, system bars, or safe areas; large text remains usable; active tab and primary controls are understandable without color alone.

### Phase 2: Make Conversations a reliable discovery surface

1. Verify Company selection, active membership, Project membership, Channel inheritance, deterministic order, and pagination against server-side authorization.
2. Verify Company-wide and selected-Project scope. On scope changes, show the new selection immediately, show a loading state, and never present old rows under a new scope.
3. Exercise All, Unread, Channels, and Threads filters independently and in combination with search. Confirm read Channels and read Threads do not leak into Unread results.
4. Verify search results open the exact Channel or Thread and exact source message where supported. Confirm query text and filters behave consistently after navigation and return.
5. Check Projects with no Channels, Channels with no messages, Projects with only Threads, archived Projects, revoked access, no-results search, offline, slow network, first-page loading, and pagination.
6. Confirm one Project drawer can be open at a time and it always shows the selected Project's own Channels.

**Exit gate:** Company and Project scopes are correct for every test account; all filter/search combinations have observed results; route return preserves practical context; loading, empty, offline, error, and access-change states explain what happened and give a safe next action.

### Phase 3: Complete and validate the conversation-to-task journey

This is the highest-priority product journey because it proves Track's core promise: discussion leads to work without losing its source.

1. **Enter:** sign in and land on Conversations. Select a Company and Project. Confirm every visible conversation belongs to that scope.
2. **Orient:** open a Channel from the feed. Verify the header shows enough Company/Project/Channel context, and back returns to the same feed scope and useful scroll position.
3. **Read:** inspect grouped messages, sender identity, time labels, reply quotes, thread links, attachments, and any task cards. Check long text, image/file errors, voice playback, and history pagination.
4. **Reply:** select a message by visible action and, where supported, swipe. Confirm the quote preview identifies the right author and text, cancel is clear, and sending keeps the reply relation.
5. **Send:** send text, a reply, a mention, an attachment, and a voice note using a safe development fixture. Verify immediate feedback, no duplicate sends, upload progress, draft behavior, failed-send recovery, retry idempotency, and offline messaging.
6. **Open a Thread:** create or open a Thread under the Channel, send a reply, return to the parent Channel, and verify context and read state. Verify archived Threads are visibly read-only.
7. **Create work:** long-press or open actions on the intended source message, create a task, and verify the exact Company, Project, Channel/Thread, source message, task title, board status, and idempotency key.
8. **Review work:** open the success destination, inspect Task Detail, follow its source-conversation link, and return to Task Detail. Verify authorization still applies after membership changes or archive state changes.
9. **Recover:** repeat creation after a network failure or double tap. Confirm no duplicate task is created and the source context remains available when retry is allowed.
10. **Close the loop:** change task status or add an update, return to My Tasks, and confirm the row and counts reflect the change without losing the originating conversation.

**Exit gate:** a fresh-build recording proves the complete journey from Conversations to source-linked Task Detail and back on Android and iOS. No stale scope, duplicate message/task, broken return route, silent failure, or permission bypass occurs. Keep failed drafts and give a clear retry path.

### Phase 4: Make both chat screens production-ready

1. Review Channel and Thread screens separately; they share a conversation model but have different parent context and navigation jobs.
2. Check message reading order, sender grouping, timestamps, outgoing/incoming surfaces, unread boundary, date dividers, assistant output, reply previews, task cards, media layouts, and very long content.
3. Check composer alignment when idle, typing, multiline, reply-selected, attachment-selected, uploading, sending, recording, voice-locked, error, offline, and keyboard-open.
4. Verify keyboard open/close, drag dismissal, Android back behavior, safe-area and tab-bar insets, focus retention, and composer visibility on narrow devices.
5. Verify every message action's eligibility and resulting feedback: Reply, Open Thread, Create task, Forward, Copy, Report, and Delete where enabled. Keep destructive confirmation explicit.
6. Verify screen-reader focus order and labels for message content, media, quoted source, voice controls, composer, mention suggestions, action sheets, and errors.
7. Verify Reduced Motion behavior and avoid custom motion for frequent actions unless it communicates state.
8. Reproduce the historical duplicate-key warning against the current build. Fix it only if it reproduces; add a regression assertion for the actual collection key source.

**Exit gate:** all chat states above have screenshots or recordings; no clipping, overlap, duplicate-key warning, lost draft, ambiguous action, or stale message scope remains. All controls meet platform touch-target guidance and are labelled.

### Phase 5: Finish My Tasks, boards, and Task Detail

1. Verify My Tasks is assigned work for the current user in the selected Company, not a Project-wide task list.
2. Test All Projects and individual Project scope, status filters, search, Today, seven-day week, overdue/attention states, no work, partial pagination, and query failure.
3. Compare counts with the loaded result set. Clearly label partial summaries and expose a way to load remaining pages.
4. Check task completion and status changes, assignment and due-date edits, optimistic state, conflicts, cancellation, and denied actions.
5. Verify boards stay Project-wide and permission-aware. Test member, assignee, manager/admin, archived, and denied roles against server outcomes.
6. Review Task Detail hierarchy: title and state, Project and source context, assignee and due date, description/checklist, attachments/evidence, comments and activity, then secondary actions.
7. Verify source context survives status changes, edits, notification entry, app restart where expected, and access revocation.

**Exit gate:** My Tasks counts and rows agree after pagination; all seven date buckets behave at timezone boundaries; role-based actions match backend capabilities; board and Task Detail preserve exact Project and evidence context.

### Phase 6: Finish Inbox, Profile, authentication, and contextual utilities

1. Test Inbox as user-global across Companies. Cover every supported type: invitations, mentions, replies, Channel activity, task updates, and suggestions.
2. Open each item and verify it routes to its exact authorized target. Re-check access before rendering private previews; test deleted and revoked source content.
3. Test filters, unread state, mark-read timing, invitations, errors, offline state, and empty state.
4. Review Profile and account settings without inventing new product sections. Verify appearance, notification, timezone, account, sign-out, and destructive flows as implemented.
5. Test sign-in errors, retained input, session restore, provider availability, keyboard behavior, and safe offline messaging.
6. Audit every remaining route: Company, Projects, Project settings, Search, Task History, notifications, invitations, and any legacy destination. Trace app links, notifications, deep links, tests, and web/backend use before removing or replacing anything.

**Exit gate:** no duplicate activity surfaces; every Inbox item opens authorized content; Profile and auth actions have clear outcomes; no route is removed without a verified replacement and caller audit.

### Phase 7: Accessibility, platform, and content review

Run this pass on all four tabs and all critical contextual screens:

- iOS and Android, light and dark theme, smallest supported width, normal and largest supported text scales.
- Screen-reader reading order, control names, selected/disabled/busy states, announcement of success and failure, text scaling, and usable alternatives to gestures.
- Contrast for text, icons, unread state, selected filters, message bubbles, task status, and destructive actions.
- Touch targets of at least 44 points on iOS and 48 dp on Android, except platform-specific controls with an equivalent accessible hit area.
- Safe areas, edge-to-edge system bars, keyboard, tab bar, modal sheets, hardware back, gesture back, and screen rotation/resizing where supported.
- Plain, consistent product terms: Company, Project, Channel, Thread, task, board, and source message. Remove implementation wording, duplicate labels, and unexplained abbreviations.
- Reduced Motion and reduced transparency behavior.

**Exit gate:** no critical or high accessibility issue remains; every visual or copy issue has a severity and disposition; independent accessibility review is complete for critical journeys.

### Phase 8: Automated, backend, and reliability verification

1. Add or update focused tests for observable behavior and regression cases. Cover navigation scope, filter composition, idempotent sends and task creation, composer retry/drafts, source links, pagination overflow, week boundaries, Inbox access changes, and permission denials.
2. Test backend authorization for allowed and denied Company, Project, Channel, Thread, task, and Inbox paths. UI hiding is never treated as authorization proof.
3. Run mobile lint, typecheck, tests, dependency audit, and production export/build. Run the root monorepo gate where practical and report each skipped check with its exact reason.
4. Review dependency and lockfile changes. Check generated Expo routes/API types where applicable, secrets, debug output, unexpected assets, and build output.
5. Check performance on representative data: list virtualization, pagination, subscription fan-out, cold start, navigation response, image loading, memory, and long chat history.
6. Test unstable network, request timeouts, app background/foreground, interrupted uploads, server conflict, retry, and safe recovery.

**Exit gate:** all required gates pass on the final source revision; no retry-until-green behavior or weakened assertions; performance has measured evidence for critical screens; authorization tests cover allowed and denied actions.

### Phase 9: Usability validation and release decision

1. Run moderated usability sessions with 5 to 8 representative users if access is available. Include new and returning users and varied project roles. Do not describe internal review as user research.
2. Give participants these tasks without teaching the UI: find an unread Channel, reply to a message, open its Thread, turn a message into a task, find the task later, and return to its source. Also test Company switching and Inbox navigation.
3. Record task completion, time, wrong turns, errors, recovery, and a short ease rating. Capture consented screen recordings without exposing real private work.
4. Triage observations by severity and frequency. Fix all critical blockers and high-frequency failures, then rerun affected tasks.
5. Have a named human reviewer inspect the final current-build screenshots, interaction recordings, accessibility findings, and test evidence.
6. Update `mobile-ui-ux-review.md` to the actual final state. Replace “Ready for retest” only for screens with complete evidence and reviewer disposition.

**Exit gate:** all critical user tasks meet the agreed success threshold, no unresolved critical usability issue remains, evidence is reviewed by a named human, and the release owner accepts remaining low-risk issues explicitly.

## App-wide journey matrix

| Journey | Required proof |
|---|---|
| Session restore and sign in | Correct signed-in/out destination, no flash, safe errors, keyboard and retry behavior. |
| Conversations discovery | Correct Company/Project scope, search/filter results, pagination, empty/offline/error states. |
| Channel reply | Exact channel context, reply quote, composer/keyboard, send success and retry. |
| Thread reply | Parent Channel shown, correct Thread membership, read-only/archive, back to source. |
| Message to task | Correct source reference and Project board, idempotent retry, Task Detail opens source. |
| My Tasks | Current-user assignment scope, accurate counts after pagination, date and status filters. |
| Project board | Server-enforced role behavior, status transitions, safe denied/read-only state. |
| Inbox | User-global items, exact destination, no private preview after access changes. |
| Profile and settings | Theme and preference persistence, account actions, clear errors and recovery. |
| Route return and deep link | Correct originating tab, scope, filter, scroll context where practical, and platform back behavior. |

## Severity and release gates

Do not release with an unresolved blocker or high finding in these categories:

- A user can read or mutate another Company, Project, Channel, Thread, task, or private Inbox item.
- A message or task can be duplicated, lost without feedback, or detached from its source during normal retry.
- A primary control is inaccessible, obscured by the keyboard/system UI, or impossible to use with large text or assistive technology.
- A selected Company or Project is unclear or content from the previous scope appears under the new scope.
- A primary route or notification/deep link opens the wrong context or cannot return safely.
- A reproducible runtime error, duplicate-key warning, crash, or data integrity issue affects a critical path.

Medium and low findings need an owner, explicit disposition, and a follow-up date. Do not hide them inside a general “polish” label.

## Definition of “10/10 release-ready”

The app may use this label only when all statements are true:

1. Every locked product decision maps to a current implementation and an observed result.
2. All primary routes and approved contextual routes work on supported iOS and Android versions.
3. The complete Conversation → Channel/Thread → reply → message-derived task → Task Detail → source return loop passes on both platforms.
4. Loading, empty, error, offline, denied, archived, retry, and partial-pagination states are clear and recoverable on every critical path.
5. Server-side authorization is tested for both allowed and denied cases, including access changes.
6. Accessibility, large text, light/dark themes, keyboard, safe areas, Reduced Motion, and minimum touch targets pass the stated device matrix.
7. Mobile and monorepo quality gates pass on the final revision, and critical performance has measured evidence.
8. No blocker or high issue remains, no stale or misleading route remains, and the final diff preserves unrelated work.
9. Current-build screenshots/recordings exist for every screen family and critical interaction, with a named human review.
10. User testing supports the main navigation and core task completion, or the absence of user evidence is explicitly stated and the release is not called user-validated.

## Reporting format at each checkpoint

Report one status: `Done` or `Not done`. A checkpoint report must list:

- The phase and exact acceptance criteria completed.
- Current build, device/OS, test account role, and Company/Project scope.
- Commands run and observed results, not remembered results.
- Screenshot/recording and accessibility evidence.
- Open blockers, high findings, and unverified paths.
- Files changed and confirmation that unrelated work remains preserved.
- Next phase and its exit gate.

Do not call the whole project complete while any required screen is `partial`, `missing`, or `unverified`.
