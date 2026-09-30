# Track mobile content audit

Reviewed: 2026-09-24

This review covers the user-facing copy in the Expo Router mobile routes and
their shared screen components. It keeps Track’s product terms, permission
boundaries, and existing navigation. The copy should explain what happened and
what the person can do next; it should not expose release flags or backend
language.

## Audit findings addressed

| Surface | Finding | Current direction |
| --- | --- | --- |
| Home | “Committed work” described implementation logic instead of the person’s tasks. | Use “My task progress” and “No tasks to track yet.” |
| Company overview stats | “Company signal,” “Momentum,” and “Deadlines” did not tell people what the counts measured. | Use “Company overview,” “Completed,” and “Overdue tasks,” with a clear 7-day range. |
| Team | The fallback said workload metrics were refreshing even when only project-member previews were available. | State that workload details are unavailable and identify the people being shown. |
| Inbox | “Direct replies” could suggest a direct-message feature, which Track does not provide. | Describe replies to messages and threads. |
| Projects empty state | The copy said Projects created on the web would appear, although the mobile app can create Projects. | Explain the Company scope or say that accessible Projects will appear. |
| Offline Channel and thread states | The copy used contradictory or device-focused wording. | Say that a connection is needed to load the Channel or thread. |
| Access-denied Project state | “Represented membership” was internal product language. | Explain that the selected Company access does not include the Project. |
| Company and task feature states | The copy exposed server release configuration. | Explain that the workspace or task tools are not available here yet. |
| Company selection | “ACT AS” did not explain the identity control. | Use “REPRESENTING.” |
| Project and task empty states | “Initialize this board” and a few other messages used product or implementation jargon. | Use direct next steps such as “Add a task to start tracking work on this board.” |
| Sign-up | The name example used a real person’s name. | Use a neutral example name. |
| Project selection and activity | A few empty-state messages were vague or used “meaningful” as a filter label. | Use direct next steps and “No activity to show yet.” |

## Route inventory

The copy pass reviewed these routes and shared screen surfaces:

- Entry, sign-in, and account: `index`, `sign-in`, `profile`, `notifications`.
- Home and personal work: `today`, `updates`, `inbox`, `tasks`, `task`, and
  `task-history`.
- Project work: `projects`, `project`, `project-settings`, `groups`,
  `conversation`, `threads`, and `thread`.
- Company and insight: `company`, `team`, `stats`, and `search` (evidence).
- Shared content: Home sections, task lists and details, empty states, and
  connection/access messages.

The rest of the route copy was retained where it already names the action,
scope, or result clearly. This is a content review, not a claim that every
interactive state has been visually verified on every device size. Existing
Android captures were reviewed for Home, My Tasks, Team, Task Detail, and task
history; a fresh route-by-route device capture and interaction pass remains
separate verification work.
