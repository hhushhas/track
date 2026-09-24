# Company Workspace review

The screenshots show the running web app with disposable local Convex fixtures. The seven directory captures use dark mode at 1600 × 900, and the navigation captures use the system light theme at 1440 × 900 and 390 × 844. They are not the supplied design references. The directory fixture has one company and one project, so screens without tasks or relationships show real empty states.

| Screen | Screenshot |
| --- | --- |
| Overview | [Open screenshot](assets/company-workspace/overview.png) |
| Projects | [Open screenshot](assets/company-workspace/projects.png) |
| Global Tasks | [Open screenshot](assets/company-workspace/tasks.png) |
| Threads | [Open screenshot](assets/company-workspace/threads.png) |
| Relationships | [Open screenshot](assets/company-workspace/relationships.png) |
| People | [Open screenshot](assets/company-workspace/people.png) |
| Settings | [Open screenshot](assets/company-workspace/settings.png) |
| Mobile Overview, 390 px | [Open screenshot](assets/company-workspace/overview-mobile.png) |
| Mobile Company navigation sheet | [Open screenshot](assets/company-workspace/navigation-mobile-sheet.png) |
| Desktop Company sidebar | [Open screenshot](assets/company-workspace/navigation-desktop.png) |

The local Company Tasks route loaded after the `companyOverview:listTasks` function was deployed to the isolated backend. Every captured route had zero horizontal page overflow. The first seven-route sweep had no console or page errors. A later recapture logged one 401 resource response during sign-in; it did not recur on a repeated run, and its cause remains unproved. These local checks do not prove that an existing signed-in session against the shared development deployment has recovered.

Recent activity uses plain-language descriptions for supported Project audit events. The Active people count is zero when no one has an open assignment. With no assigned tasks, the workload card stays compact; with no task creation or completion, the chart shows an empty-state message. The feed reads at most five audit rows per supported action per Project through an action index; large-Company query cost is still unmeasured. On narrow screens, Company navigation opens in a focus-managed sheet without changing the page height. A Google Chrome end-to-end test confirmed Escape returns focus to the menu button, clicking Projects closes the sheet and changes the view, and the desktop sidebar remains visible. The same test found no horizontal page overflow at 320, 390, 768, 1024, or 1440 px. The desktop capture waits for the Company Projects data to settle after reload.

These checks do not prove every role, failure state, dialog, drawer, large-Company data volume, or shared-development session. The Company Workspace remains under review until those paths are exercised.
