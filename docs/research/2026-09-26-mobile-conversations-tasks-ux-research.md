# Track mobile Conversations, Chat, and My Tasks: UX research and design direction

**Reviewed:** 26 September 2026  
**Scope:** The first-run Conversations screen, Channel and Thread chat screens, and My Tasks on iOS and Android.  
**Status:** Research and product design guidance. The locked product decisions below remain the source of truth; this document turns them into evidence-based screen and interaction rules.

## Why this research exists

Track is narrowing its mobile experience around three connected jobs: find the right Company conversation, understand and act in a Channel or Thread, and follow through on tasks created from that work. The design should feel calm, clear, and high quality without hiding useful context behind decoration or forcing users through an oversized navigation tree.

This document distinguishes three kinds of statements:

- **Source guidance** is stated by Apple, Android, WhatsApp/Meta, ClickUp, W3C, or Nielsen Norman Group (NN/g) in the linked material.
- **Product decisions** were already agreed in this conversation and are repeated here so research cannot quietly change them.
- **Track recommendations** are design judgments based on those sources, the supplied screenshots, and Track’s Company → Project → Channel → Thread → message → task model. They need validation in the app with real users and real data.

Screenshots can show what a product looks like. They do not prove why a pattern works or that it is right for Track. Mobbin and Dribbble are useful for discovering visual examples and flows; use first-party platform and product documentation, accessibility standards, and observed task testing to decide whether to adopt a pattern.

## Decisions this guidance must preserve

1. **Conversations is the signed-in first screen.** Preserve the current Home screen’s visual language and useful Project patterns, then make conversation the first useful content users see.
2. **Company-wide means one selected Company.** Show conversations and enrolled Projects the current user can access in that Company. A selected Project narrows the same feed to that Project. It never silently means every Company.
3. **Project is a visible carousel/filter.** Keep the Project selector in the Conversations screen. Switching Project updates the same feed with a clear loading or refresh state and correct Project-specific Channels.
4. **The feed combines conversation levels.** Company feed rows are grouped by quiet Project dividers. Channels and Threads are filters in the same screen. A Channel or Thread opens its own focused chat screen; both screens remain mandatory.
5. **My Tasks is Company-scoped and user-assigned.** It shows the current user’s assigned work across accessible Projects in the selected Company. It is not the Company’s full task list or the Project board.
6. **My Tasks hierarchy:** Company and Project selection, compact stats, task-status tabs, Attention Needed, Today, and the full seven-day week view. Attention Needed and Today have greater first-screen emphasis; the week remains easy to reach and complete, but it must not dominate the screen.
7. **Project board and My Tasks stay distinct.** My Tasks helps one person complete assigned work. The Project board helps a Project coordinate the workflow. Members have view-only board access; manager/admin actions depend on Project permissions; assignee actions follow backend capabilities.
8. **Conversation-to-task context is durable.** A task created from a message retains the source Company, Project, Channel or Thread, and message, and Task Detail offers a clear route back while access remains valid.
9. **Navigation is platform-specific by explicit decision.** iOS keeps the approved rounded, translucent navigation treatment with restrained gooey selection. Android uses a simple flat bottom bar: it is not pill-shaped and has no glass or gooey effect. Destinations are Conversations, My Tasks, Inbox, and Profile; Inbox is third and Profile fourth. The accepted plus action stays separate from the four destinations.
10. **Inbox is user-global across Companies.** It contains user activity such as invitations, replies, mentions, suggestions, Channel activity, and task updates. Recent Updates moves into Inbox rather than being duplicated.

These are requirements, not conclusions inferred from the research.

## Research method and limits

I checked first-party Apple HIG and Support pages, Android Developers guidance, WhatsApp/Meta product and design announcements, and ClickUp mobile help pages on 26 September 2026. I used W3C WCAG 2.2 and NN/g for accessibility and general usability principles. Living platform pages can change; recheck them when implementation begins.

The supplied [X video](https://x.com/jaimintf/status/2102827785811333410) was reviewed in Chrome on 28 September 2026 after the earlier direct fetch returned HTTP 403. The short demo shows a white, text-first message list, a small horizontal circle row, a quiet search field, compact All/Unread/Groups filters, subdued timestamps and unread dots, a lightweight new-conversation sheet, and a sparse chat with a fixed composer. It moves from list to chat without a decorative dashboard. The video describes an Expo liquid-glass concept, so its translucent treatment is inspiration for restrained iOS navigation rather than an Android requirement. The four supplied images were also treated as visual references; these are visual observations, not evidence from user testing.

The public WhatsApp material explains the purpose and placement of its filters, and its Help Center documents search behavior. It does not publish a full design specification for every chat-screen detail. ClickUp help documents current mobile features and workflows; it is product documentation, not independent proof of usability. Apple and Android guides establish platform expectations, not a requirement to copy their appearance exactly.

## What the references actually support

### Apple: hierarchy, lists, navigation, and platform fit

Apple describes tab bars as a way to move among top-level app areas, and recommends keeping each area’s navigation state. Its list guidance says a list is a strong fit for text-heavy content, that rows should stay concise, and that the selected state should make the navigation path clear. For Track, this supports four stable peer destinations and a text-first conversation feed with consistent rows and visible Project grouping. It does not support turning every content row into a floating card. ([Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars/), [Apple HIG: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables/))

Apple’s current search guidance treats search placement as a choice tied to both navigation and search scope. Its Messages app supports narrowing searches by person/conversation and shared-item type, then opens a chosen result in its original conversation. For Track, the search field should tell the user whether it searches the selected Company, selected Project, current Channel, or Thread. A result should reopen the exact message with enough surrounding context to understand it. ([Apple HIG: Searching](https://developer.apple.com/design/human-interface-guidelines/searching), [Apple Support: Search in Messages on iPhone](https://support.apple.com/guide/iphone/search-in-messages-iph17c111fb6/ios))

Apple’s loading guidance favors showing useful content quickly and using a loading indicator instead of an unexplained blank screen when a short wait is necessary. Track should preserve the existing feed while a new Project scope loads only when that content is safe to show; otherwise clear or mask it so old Project rows cannot be mistaken for the newly selected Project. Use row-shaped placeholders when no safe cached rows exist, then replace them without shifting the whole screen. ([Apple HIG: Loading](https://developer.apple.com/design/human-interface-guidelines/loading/))

Apple’s accessibility guidance calls for support for larger text and sufficient contrast in both light and dark appearances. Its current materials guidance reserves translucent materials for functional layers and navigation. Track’s iOS treatment can therefore feel glassy at the navigation layer while the message and task surfaces stay quiet, opaque enough to read, and structurally clear. ([Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials))

### Android: familiar navigation, content-first layouts, and system space

Android recommends three to five same-level destinations in its mobile navigation bar, using tabs for a secondary set of sibling views. It also recommends adapting navigation when the available window gets larger. This aligns with Track’s four agreed destinations and supports keeping filters within Conversations rather than adding another bottom destination. Track’s explicit Android visual choice remains a simple, flat, non-pill bar. ([Android: Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns))

Android identifies list-detail as a natural pattern for messaging: a list opens a focused detail view on compact screens, while larger screens can show more panes. Its system-bar and inset guidance also matters to chat: the composer, bottom navigation, and keyboard must respect system gesture space instead of covering content. ([Android: Common layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/common-layouts), [Android: System bars](https://developer.android.com/design/ui/mobile/guides/foundations/system-bars), [Android: Window insets](https://developer.android.com/develop/ui/compose/system/insets))

### WhatsApp: filters near the list, search back to message context

WhatsApp announced All, Unread, and Groups filters at the top of the chat list so people could find conversations without scrolling through the full inbox. Its Meta design article connects the Android bottom-navigation move with making room for filters above the list. Its Help Center describes searching message text and content types, including media, links, audio, documents, and polls, and opening a result at its message in the conversation. These are useful precedents for Track’s All, Unread, Channels, and Threads controls and for context-preserving search. They are evidence of WhatsApp’s product rationale, not proof that every filter or the exact WhatsApp styling belongs in Track. ([WhatsApp: Find Messages Faster with Chat Filters](https://about.fb.com/news/2024/04/whatsapp-chat-filters/), [Meta Design: Keeping WhatsApp fresh, simple and approachable](https://www.meta.com/design-at-meta/blog/whatsapp-user-interface-update/), [WhatsApp Help Center: How to search WhatsApp](https://faq.whatsapp.com/1131773267485499/))

### ClickUp: mobile work is task detail plus focused activity

ClickUp’s mobile help documents separate task Details and Activity tabs, shows task location breadcrumbs, and exposes key fields such as status, assignee, priority, and dates near the task title. It also supports creating tasks from Chat messages and using a mobile Home area for assigned work, replies, activity, and upcoming tasks. This suggests two practical ideas for Track: establish task identity and key fields early in Task Detail, and let a useful message create a task without losing its source context. ClickUp’s broad Home capability set is not a reason to copy its surface count; Track’s agreed goal is a more focused conversation-first product. ([ClickUp: Intro to mobile tasks](https://help.clickup.com/hc/en-us/articles/15147409985559-Intro-to-mobile-tasks), [ClickUp: Intro to Home on mobile](https://help.clickup.com/hc/en-us/articles/15146214337559-Intro-to-Home-on-mobile), [ClickUp: Create tasks and subtasks on mobile](https://help.clickup.com/hc/en-us/articles/15147770180759-Create-tasks-and-subtasks-on-mobile))

### Usability and access standards

NN/g’s recognition-over-recall guidance supports keeping Company, Project, Channel/Thread, task status, due date, and source context visible when they help the next decision. Its progressive-disclosure guidance supports keeping frequent work visible and placing rare controls in a clear secondary location. Use it to decide what belongs in the first viewport; do not use it as an excuse to hide common task or conversation actions. ([NN/g: Recognition Rather Than Recall](https://www.nngroup.com/articles/recognition-and-recall/), [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/))

WCAG 2.2 AA sets a 24 × 24 CSS-pixel minimum target or qualifying spacing for web targets. Apple recommends 44 × 44 pt hit regions and Android recommends 48 × 48 dp touch targets. These values are platform-specific units, not interchangeable pixels. Treat them as a floor when creating compact icon controls, then verify actual target geometry, spacing, and one-handed use on devices. ([W3C: WCAG 2.2 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [Apple: UI Design Dos and Don’ts](https://developer.apple.com/design/tips/), [Android: Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility))

## Design thesis for Track

Track should feel like a **quiet working surface**: a person can recognize where a message belongs, read the message, and act on it without decoding a decorative interface. Premium quality comes from consistency, content fit, response speed, legibility, and respectful motion. It does not come from adding a blur, gradient, shadow, oversized stat, or rounded card to every block.

“Clean morphism” is a visual direction, not a platform standard. Interpret it as restrained depth and smooth transitions around functional surfaces, with the content hierarchy still doing the work. Use the current Home screen’s visual language as the source system. Keep stable alignment, typography roles, spacing, semantic colors, and component behavior consistent. Use surface contrast, thin dividers, and whitespace before shadows. Reserve stronger material or elevation for navigation, an active sheet, or an action that must be distinct.

Minimalism must not remove needed context. A Channel row still needs enough information to distinguish it from another Channel. A task still needs a readable title, status, deadline, and Project context when those are relevant. Hide infrequent details behind a clearly named route or menu, not behind an undiscoverable gesture.

## Screen 1: Conversations, the first useful view

### Job and first impression

**User job:** “Show me what is being discussed in my selected Company, help me find the right Project or unread conversation, and let me enter it immediately.”

The screen should open with the Company scope visibly named and the Company-wide conversation feed already present. Do not show a feature tour or a blank dashboard before conversation content. If no content exists or access is still loading, use a clear state that says what is happening and what the person can do next.

### Recommended content order

1. **Company context and screen identity.** Make the selected Company visible and provide a predictable way to switch it. Keep a clear screen name such as “Conversations” so this surface is not confused with user-global Inbox.
2. **Search and filters.** Search should state its scope. Keep All selected by default, with one-tap Unread, Channels, and Threads. Avoid adding low-value filters to the first row; move advanced narrowing into the filter sheet.
3. **Project carousel.** Include All Projects plus accessible Projects. Make the selected Project visually and accessibly clear. Project cards may carry the same useful cues as Home, but must not consume so much height that users lose the conversation list.
4. **Conversation feed.** In All Projects mode, group rows under quiet Project dividers labeled with the Project name. Within the current grouping, make the Channel/Thread identity visible. In a selected Project, show that Project’s Channels and Threads only. Do not duplicate a standalone Channel list screen.

### Feed row anatomy

Each row should answer “where is this, what changed, who said it, and should I open it now?” in one scan. Use:

- A readable Channel name or Thread title, with a small type cue where the title alone is ambiguous.
- The latest useful message preview and author, clipped only after preserving the start of the sentence and the distinction between a message and a reply.
- A quiet timestamp with sensible recency formatting.
- An unread mark or count that does not rely on color alone.
- Optional participant avatars only when they explain participation and fit without clipping the title or preview.
- The Project divider as the cross-Project context. Within a Project, do not repeat the Project label in every row unless it resolves ambiguity.

Prefer text-first rows with fine separators over nested cards. Use a stronger surface only for a real grouping or selected/filter state. Keep row height stable enough for scanning, while allowing two-line previews and larger text to reflow.

### Interaction contract

| User action                    | Immediate response                                                   | Result and recovery                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Open Conversations             | Show selected Company and useful feed content, cached where safe     | If first load is pending, show feed-shaped placeholders and a retry path on failure; never leave the whole screen blank                     |
| Switch Company                 | Update the visible Company label and selection state immediately     | Query only accessible Projects and conversations for that Company; prevent stale rows from being shown as if they belong to the new Company |
| Select a Project               | Keep user in this screen and mark the Project active immediately     | Refresh the same feed with that Project’s Channels/Threads; show subtle progress, preserve the selection, and offer retry if loading fails  |
| Select Unread/Channels/Threads | Give immediate selected-state feedback                               | Apply the filter to the visible Company/Project scope; keep the active filter visible and provide a simple route back to All                |
| Type a search                  | Keep query text visible and debounce network work                    | Show scoped results with author, Project, Channel/Thread, and excerpt; tapping a result opens the exact message context                     |
| Open a feed row                | Brief local press feedback, then a predictable navigation transition | Open the correct Channel or Thread; back returns to prior Company, Project, filter, and useful scroll position                              |
| Refresh or load more           | Indicate work near the list boundary                                 | Preserve already-loaded rows where safe; prevent duplicate rows and make retry available after recoverable failure                          |

### Feed states to design

- **Loading:** known structure is visible; placeholders match row dimensions so content does not jump.
- **Empty Company:** explain that no accessible conversations exist yet and point to the next permitted action or Company/Project selection.
- **Empty filter:** say there are no unread Channels/Threads in this scope and offer “Show all”.
- **Search with no match:** keep the query and scope; offer clear search reset.
- **Offline:** retain safe cached content, label it stale/offline, and let the user retry. Never imply a send or refresh succeeded when it did not.
- **Error:** explain whether loading failed and provide a retry without erasing selected Company/Project/filter state.
- **Access changed:** remove content that is no longer available and explain that the conversation can’t be opened if a saved result points to revoked access.

## Screen 2: Channel and Thread chat

### Job and visual hierarchy

**User job:** “Understand this conversation, follow the latest messages, respond, and turn important discussion into work.”

The chat should borrow familiar messaging behaviors without copying WhatsApp’s brand. The conversation is the main canvas. Persistent structure should answer who/where the user is talking with and how to reply. Controls and metadata should stay quiet until needed.

Recommended order:

1. **Compact header:** back, Channel or Thread title, small Project/Channel parent context, and only the most relevant actions. A Thread header must show its parent Channel so the user understands its scope.
2. **Message history:** readable author, time, message, attachments, reply/thread context, and meaningful state. Use day markers and spacing to chunk time. Distinguish consecutive messages without repeating a full author block unnecessarily.
3. **Message actions:** show common actions near the message on tap/press, with keyboard and assistive alternatives where supported. “Create task” should be explicit. Place rare actions in More; destructive actions require clear confirmation or safe undo.
4. **Fixed composer:** remains reachable above the keyboard and safe area. Keep the text, attachment, and send controls legible in both themes. It must resize for multiline input and never cover the latest message or the send action.

Use one calm message language for both Channel and Thread. Differentiate a Thread through parent context, reply relationship, and title, not through an entirely different design. Avoid turning every bubble into a large raised card. Group consecutive messages from one author, separate time periods lightly, and use accent color for meaningful state only.

### Chat interaction contract

| User action                     | Immediate response                                                   | Result and recovery                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Open chat from feed             | Show destination identity and recent history promptly                | Maintain the source route context so Back returns to the same Company/Project/filter position                         |
| Scroll older/newer              | Keep reading position stable as older messages load                  | Insert history without jumping the reader; expose a return-to-latest affordance when far from the end                 |
| Draft a message                 | Keep draft visible as keyboard opens and layout changes              | Do not lose text on transient failure, navigation interruption, or a theme change                                     |
| Send                            | Give local acknowledgement at once and distinguish pending from sent | On failure, preserve text and provide retry; never silently drop or falsely mark as sent                              |
| Open a Thread                   | Show its parent Channel and focused reply history                    | Back returns to the source conversation without losing useful position                                                |
| Create a task from a message    | Open task creation with source context already attached              | Keep the source message link, Project, Channel/Thread, and Company; confirm success with a direct link to Task Detail |
| Long-press or open message menu | Show actions anchored to the selected message                        | Make the same actions available through an accessible alternative; do not hide a core action behind long-press alone  |
| Open attachment                 | Show the media/document clearly and preserve the chat return path    | Support loading, unavailable, and retry states; do not lose draft text                                                |

### Composer and keyboard acceptance rules

- The composer stays above the software keyboard and platform gesture area on iOS and Android.
- Opening the keyboard does not resize the message list into an unusable sliver or cover the newest message.
- The send target remains enabled only when sending is valid, and its state has enough contrast in both themes.
- A multiline draft grows to a sensible maximum, then scrolls internally; it does not push the send action offscreen.
- Attachments, voice notes, and message actions remain secondary to typing and sending.
- Dark/light theme changes update the composer, text input, keyboard appearance request, icons, and primary send action together. There is no mixed-theme transition state left hanging on the control.

## Screen 3: My Tasks

### Job and first screen

**User job:** “Tell me what assigned work needs attention now, then let me see and plan the whole week for this Company.”

The screen must not be a dashboard that makes the person interpret numbers before they can find a task. Give a clear scan path from scope to priority to task action. Keep the current Home design language, but use task-specific hierarchy and controls.

### Recommended content order

1. **Company header and Project selector.** Show which Company is active. Offer All Projects and individual accessible Projects. Preserve scope when navigating into a task and back.
2. **Compact stats.** Keep only metrics that aid a decision in this view (for example open, due soon, overdue, completed for the selected scope). Use quiet figures and explicit labels. Stats summarize the work; they must not displace the task list.
3. **Task-status tabs/carousel.** Keep states understandable and count/selection behavior consistent. Ensure the user can reach all statuses without horizontal clipping or confusing it with the Project carousel on Conversations.
4. **Attention Needed.** Surface overdue, blocked, or otherwise actionable tasks that need intervention. Use the actual backend state and permission model; do not invent urgency.
5. **Today.** Show assigned tasks due or scheduled today in a direct, compact list. Make status and due information scannable and let an authorized user take the next action from the row.
6. **Full seven-day view.** Include all seven days for the selected Company and Project scope. Use a compact date strip or calendar-like weekly section that can select a day and reveal its tasks. This is a planning view available in the same screen, not the main hero and not a replacement for Today.
7. **Project board entry.** Keep the board available as a distinct Project workflow view, clearly labeled so users understand it includes Project work beyond their own assignments.

### Task row anatomy

Each task row should put the task title first, then show only the details needed to choose and perform the next action: status, due date/day, Project context when not obvious from the selected scope, and perhaps assignee when it helps. Use consistent status labels and semantic color plus text/icon cues. Keep secondary metadata quiet. A tap opens Task Detail; any swipe shortcut must also have a visible alternative.

### Task interaction contract

| User action                    | Immediate response                             | Result and recovery                                                                                                       |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Switch Company                 | Update Company identity and selection state    | Reload stats, selectors, and tasks from only that Company; do not flash prior Company data as current                     |
| Select Project                 | Mark selection immediately                     | Recompute visible assigned tasks and stat scope; empty result states identify the selected Project and offer All Projects |
| Change status tab              | Keep tab selection clear                       | Filter the same Company/Project scope with stable scroll behavior; show counts only when they are correct for that scope  |
| Open Attention Needed item     | Open focused Task Detail                       | Preserve task-list return state; show the reason for attention and an authorized next action                              |
| Select a day in the week       | Highlight date and update that day’s task list | Keep full week dates visible, including month/year boundary; handle weeks with no tasks clearly                           |
| Mark task status or reschedule | Reflect local pending state immediately        | Confirm server success; on failure restore truthful state and offer retry or a clear explanation                          |
| Open Project board             | Navigate to Project-wide Board                 | Preserve Project identity; display view/action controls according to the server-backed role capability                    |

### Task Detail structure

Task Detail is one of the identified quality gaps. Use a stable first-screen order:

1. Back and contextual menu.
2. Company/Project breadcrumbs and source context when task came from conversation.
3. Task title and status, with an edit path that does not make the title hard to scan.
4. High-value properties: assignee, due date, priority, and any essential Project fields.
5. Description and checklist/subtasks.
6. Attachments/evidence context and activity/comments, arranged so users can tell what is content, what is proof, and what changed.
7. Permission-aware actions. Do not display an enabled-looking write action that the backend will deny.

ClickUp’s mobile split between Details and Activity demonstrates one way to keep task fields and discussion distinct. Track should test whether a compact Details/Activity switch or one continuous structured page is clearer with its actual fields and message-source link. Do not merge comments and task updates into one timeline until the existing event/data model is confirmed. In every layout, the source conversation remains recognizable and directly reachable while permission allows it.

## Visual system: classical, clean, restrained depth

### Hierarchy before decoration

- Use one clear screen title and an explicit Company/Project scope.
- Let order, type size/weight, spacing, alignment, and contrast create hierarchy before color or shadow.
- Keep small metadata quiet but readable. Do not make time, author, or status so faint that the row loses meaning.
- Use consistent leading/trailing alignment across Project dividers, feed rows, task rows, and chat content.
- Use thin rules or whitespace to group ordinary rows. Reserve cards for genuinely grouped or independently actionable content.
- Keep one accent for current scope, active selection, and the main action. Status colors are semantic and never the only status signal.

### “Clean morphism” interpreted safely

Use smooth spatial continuity for a real transition: a selected Project updates its feed; a conversation row opens that conversation; a source message opens task creation. Keep the selected object’s identity recognizable. Use restrained translucency only where a functional navigation layer needs it on iOS, with a stable readable backing. Android stays flat by decision. Do not blur or animate the conversation content itself as a permanent effect, and do not add shadows that make ordinary rows appear clickable when they are not.

Motion should communicate a selection, location, progress, or completion. Use immediate local press feedback. Keep navigation transitions brief; avoid staggered row entrances, large overshoot, or ambient animation in reading surfaces. Reduce nonessential motion when the platform’s Reduce Motion setting is enabled. ([Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Apple accessibility: Reduced Motion evaluation](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria))

### iOS and Android behavior

| Concern           | iOS                                                                                                       | Android                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Bottom navigation | Approved rounded/translucent surface; restrained gooey selection; labels/accessibility names remain clear | Flat bar, not pill-shaped; selected icon/label has clear contrast; no glass or gooey effect |
| System area       | Respect home-indicator safe area; content and composer clear the tab surface                              | Respect gesture or three-button navigation inset and edge-to-edge system bars               |
| Back              | Native-feeling back action and preserved feed context                                                     | System back and predictive/back-stack behavior return to source context                     |
| Keyboard          | Composer and search respond smoothly to keyboard appearance and dismissal                                 | Composer and search resize/pan with IME insets; send and active input stay visible          |
| Touch feedback    | Light, quick feedback consistent with iOS settings and Reduce Motion                                      | Standard Android pressed/ripple feedback; no simulated iOS gooey effect                     |

The supplied iOS screenshots are mood and hierarchy references only. The approved Android navigation decision is explicit and takes priority over a screenshot that happens to use a rounded bar.

## Interaction quality and performance rules

1. **Acknowledge every tap immediately.** Local pressed/selected state must not wait for a network response.
2. **Keep loading in context.** Project changes update the selector first, then show progress within the feed. Do not use a full-screen blocking loader for a normal filter switch.
3. **Keep lists bounded and virtualized.** Paginate the Company feed and task list. Do not load every Project, Channel, Thread, message, and task up front to create the illusion of completeness.
4. **Avoid visible layout jumps.** Reserve row geometry, use stable skeletons, and preserve scroll anchors when refreshing or loading older messages.
5. **Keep scope authoritative.** Company and Project filters must map to server-side query contracts and authorization. The UI’s label, filter, and results must agree.
6. **Make failed work recoverable.** Keep drafts, preserve chosen filters, and expose a retry where safe. Do not disguise errors as empty data.
7. **Measure perceived speed on devices.** Record cold open to first useful content, Project-switch response, search response, chat open, send acknowledgement, and task update. Set targets from a representative development dataset and real device baseline before treating milliseconds as acceptance thresholds.
8. **Do not use motion to fake speed.** A skeleton or local response can make progress legible, but must not conceal a stalled request or show stale scope as fresh.

## Accessibility and content-fit acceptance

- Support increased system text without clipping Project names, channel titles, task titles, avatars, buttons, tab labels, or the composer.
- Do not use color alone for selected filter, unread, overdue, blocked, sent/pending/failed, or permission states.
- Make all icon actions named for screen readers and all long-press actions reachable by a visible control or accessible menu.
- Ensure touch targets have adequate size and spacing; use platform units correctly and inspect the actual hit area rather than the icon glyph alone.
- Test light and dark appearance across every field, composer, keyboard request, icon, selected state, and primary action. A theme change must be atomic from the user’s point of view.
- Support Reduce Motion and avoid flashing, prolonged pulsing, or animated depth in the reading path.
- Use plain labels: All, Unread, Channels, Threads, Attention Needed, Today, and the selected weekday/date. Explain scope near the selector or search rather than relying on a tutorial.
- Test long Company/Project/Channel/person/task names, no avatar, large unread count, multiline message, attachment failure, empty week day, very small device width, and large font settings.

## Validation plan: prove the experience with tasks

Research findings are design inputs, not proof that Track is usable. Validate the design as a set of jobs on actual phones with representative seeded data. Include one-handed use, first-time understanding, a narrow Android device, an iPhone with safe-area/keyboard behavior, larger text, and light/dark themes.

### Conversation scenarios

1. Open the app and identify which Company and Project scope is shown without explanation.
2. Find unread activity, then switch back to All.
3. Filter to Threads, identify the parent Channel, and open the right Thread.
4. Switch a Project and confirm the feed changes to that Project’s Channel/Thread content without confusion or stale rows.
5. Search for a phrase and open the exact message in context.
6. Return from a Channel/Thread and verify the prior feed scope and position remain useful.

### Chat scenarios

1. Read a Channel and distinguish author, time, new messages, and thread replies.
2. Reply with a multiline draft while the keyboard opens; verify no message or send control is covered.
3. Simulate a send failure and retry without losing text.
4. Create a task from a specific message and return from Task Detail to the original conversation.
5. Use message actions without relying on long-press alone.

### My Tasks scenarios

1. Identify current Company scope and choose a Project.
2. Find an overdue/blocked task in Attention Needed and understand why it is surfaced.
3. Find Today’s work and update one task using an authorized action.
4. Inspect every day in the seven-day view, including a week crossing a month boundary and a day with no tasks.
5. Open the Project Board and confirm it is understood as Project-wide work, distinct from My Tasks.
6. Open Task Detail, locate its conversation source, and verify actions match role and backend permission.

### Suggested success measures

Use observed results rather than aesthetic opinion alone:

- People correctly describe Company-wide scope as the selected Company, not all Companies.
- People can find a specific unread Channel/Thread and return without losing their context.
- People can distinguish a Project divider from a Channel/Thread row and distinguish a Channel from a Thread.
- A message-derived task retains its source and users can navigate back to it.
- Users understand My Tasks as their assigned work and the Project Board as the wider Project workflow.
- No critical path has clipped controls, keyboard overlap, stale cross-scope content, or an unrecoverable loading/error state.
- Record task completion, wrong turns, time to find the item, accessibility issues, and qualitative confusion; use these findings to revise the hierarchy.

## Pattern library: what to study and what not to infer

| Reference                     | Use it to study                                                                                      | Do not infer                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Apple HIG and Apple Messages  | Platform conventions, search scope, list hierarchy, native transitions, dynamic text and contrast    | That Track needs to imitate Apple’s brand, copy its exact layout, or use every latest material effect                           |
| WhatsApp/Meta                 | One-tap chat filters, placement above the conversation list, message search that returns to context  | That its consumer chat assumptions, feature set, bubble styling, or scale directly fit Company/Project work                     |
| ClickUp mobile docs           | Task field hierarchy, separate task activity, quick task creation, mobile Home and inbox patterns    | That a customizable tile dashboard is appropriate for Track’s focused first screen                                              |
| Mobbin and Page Flows         | Compare complete real-app paths, transitions, empty/error states, search and filters across products | A screenshot alone proves usability or contains the entire interaction model                                                    |
| Dribbble and visual galleries | Explore typography, surface treatment, avatar treatment, and motion ideas                            | Polished concept art is production-ready; it often omits data density, role rules, loading, accessibility, and failure behavior |
| NN/g, W3C, Android, Apple     | Usability heuristics, progressive disclosure, accessibility targets, and platform behavior           | General guidance replaces Track-specific task observation or server authorization                                               |

For a focused Mobbin review, compare at least three messaging products and two task products on the same jobs: locate unread activity, search a message, open a Thread, create a task from discussion, find today’s work, and navigate week dates. Record the flow and states, not only the first screenshot. Dribbble can inform a visual direction after those jobs are understood.

## Decision summary

The research supports the direction already agreed: Conversations first, one Company-scoped feed, Project selection in place, simple visible filters, quiet Project dividers, focused Channel/Thread chats, durable message-to-task context, and a My Tasks screen that prioritizes what needs action while keeping the whole week accessible. A professional minimalist interface should make scope and content clear before it uses surface effects. Preserve the native feel that differs by platform: restrained translucent iOS navigation and flat, non-pill Android navigation.

The recommendation that needs the most direct user validation is the exact first-screen vertical density: Company header + search/filters + Project carousel + feed. The decision is not to remove any of those agreed concepts; testing should find the smallest comfortable heights and how they respond to scroll, keyboard, and large text while keeping conversations visible at first sight.

## References

### Platform and accessibility sources

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars/)
- [Apple HIG: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables/)
- [Apple HIG: Searching](https://developer.apple.com/design/human-interface-guidelines/searching)
- [Apple HIG: Loading](https://developer.apple.com/design/human-interface-guidelines/loading/)
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple: UI Design Dos and Don’ts](https://developer.apple.com/design/tips/)
- [Apple Support: Search in Messages on iPhone](https://support.apple.com/guide/iphone/search-in-messages-iph17c111fb6/ios)
- [Android: Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [Android: Common layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/common-layouts)
- [Android: System bars](https://developer.android.com/design/ui/mobile/guides/foundations/system-bars)
- [Android: Window insets](https://developer.android.com/develop/ui/compose/system/insets)
- [Android: Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)
- [Android: Accessibility testing](https://developer.android.com/codelabs/basic-android-kotlin-compose-test-accessibility)
- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [Apple accessibility: Reduced Motion](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria)

### Product and usability references

- [WhatsApp/Meta: Chat filters](https://about.fb.com/news/2024/04/whatsapp-chat-filters/)
- [Meta Design: WhatsApp UI update](https://www.meta.com/design-at-meta/blog/whatsapp-user-interface-update/)
- [WhatsApp Help Center: Search](https://faq.whatsapp.com/1131773267485499/)
- [ClickUp: Home on mobile](https://help.clickup.com/hc/en-us/articles/15146214337559-Intro-to-Home-on-mobile)
- [ClickUp: Mobile app](https://help.clickup.com/hc/en-us/articles/15145935126679-Intro-to-the-mobile-app)
- [ClickUp: Mobile tasks](https://help.clickup.com/hc/en-us/articles/15147409985559-Intro-to-mobile-tasks)
- [ClickUp: Create tasks and subtasks on mobile](https://help.clickup.com/hc/en-us/articles/15147770180759-Create-tasks-and-subtasks-on-mobile)
- [NN/g: Recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/)
- [NN/g: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Mobbin](https://mobbin.com/)
- [Page Flows](https://pageflows.com/)
- [Dribbble](https://dribbble.com/)
