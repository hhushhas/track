# Company Workspace review

The screenshots show the running web app with disposable local Convex fixtures. The original directory captures use dark mode at 1600 × 900, and the navigation captures use the system light theme at 1440 × 900 and 390 × 844. The refined Settings captures use dark mode at 1280 × 900 and 390 × 844. They are not the supplied design references. The directory fixture has one company and one project, so screens without tasks or relationships show real empty states.

| Screen | Screenshot |
| --- | --- |
| Overview | [Open screenshot](assets/company-workspace/overview.png) |
| Projects | [Open screenshot](assets/company-workspace/projects.png) |
| Global Tasks | [Open screenshot](assets/company-workspace/tasks.png) |
| Threads | [Open screenshot](assets/company-workspace/threads.png) |
| Relationships | [Open screenshot](assets/company-workspace/relationships.png) |
| People | [Open screenshot](assets/company-workspace/people.png) |
| Settings, refined dark desktop at 1280 px | [Open screenshot](assets/company-workspace/settings-refined-dark.png) |
| Settings, refined mobile lower actions at 390 px | [Open screenshot](assets/company-workspace/settings-refined-mobile-bottom.png) |
| Assign Project dialog, dark desktop | [Open screenshot](assets/company-workspace/settings-assign-dialog-dark.png) |
| Mobile Overview, 390 px | [Open screenshot](assets/company-workspace/overview-mobile.png) |
| Mobile Company navigation sheet | [Open screenshot](assets/company-workspace/navigation-mobile-sheet.png) |
| Desktop Company sidebar | [Open screenshot](assets/company-workspace/navigation-desktop.png) |
| Activity chart with a created task | [Open screenshot](assets/company-workspace/activity-chart-7-days.png) |
| Overview with task activity, desktop | [Open screenshot](assets/company-workspace/overview-with-task.png) |
| Overview with task activity, mobile | [Open screenshot](assets/company-workspace/overview-with-task-mobile.png) |
| Overview at 1280 px with Company A data | [Open screenshot](assets/company-workspace/overview-1280-isolation.png) |
| Create Company modal, desktop | [Open screenshot](assets/company-workspace/settings-create-company-dialog-desktop.png) |
| Create Company modal, mobile | [Open screenshot](assets/company-workspace/settings-create-company-dialog-mobile.png) |

The local Company Tasks route loaded after the `companyOverview:listTasks` function was deployed to the isolated backend. Every captured route had zero horizontal page overflow. The first seven-route sweep had no console or page errors. A later recapture logged one 401 resource response during sign-in; it did not recur on a repeated run, and its cause remains unproved. These local checks do not prove that an existing signed-in session against the shared development deployment has recovered.

Recent activity uses plain-language descriptions for supported Project audit events. The Active people count is zero when no one has an open assignment. With no assigned tasks, the workload card stays compact; with no task creation or completion, the chart shows an empty-state message. The feed reads at most five audit rows per supported action per Project through an action index; large-Company query cost is still unmeasured. On narrow screens, Company navigation opens in a focus-managed sheet without changing the page height. A Google Chrome end-to-end test confirmed Escape returns focus to the menu button, clicking Projects closes the sheet and changes the view, and the desktop sidebar remains visible. The same test found no horizontal page overflow at 320, 390, 768, 1024, or 1440 px. The desktop capture waits for the Company Projects data to settle after reload.

The activity chart uses the installed Recharts library and the Company Overview query. A Google Chrome end-to-end run created a real project and task, confirmed the Created tooltip and the 7-, 30-, and 90-day ranges, then filtered to that project. The 90-day chart kept its newest day visible after resizing, and a focused user could press Arrow Left to reach earlier dates. The page had no horizontal overflow at 320, 390, 768, 1024, or 1440 px, and the mobile hidden data table did not add blank page height. The browser reported no page errors in that run. The screenshots show the disposable local test data, not production data.

Another Google Chrome run created two Companies through the live Settings route. It confirmed that Company B showed zero of Company A's open tasks, Projects, and recent activity, then switched back and restored Company A's data. Settings now offers a Create Company modal; Escape closes it and returns focus to the trigger. The modal stayed inside a 390 px viewport, and the Overview cards used two columns at 1280 px so their labels remained readable. This test used disposable local data and does not prove shared-development or production isolation.

The Settings page now keeps the profile and lifecycle actions in one short reading path. People and Relationships administration remain in their existing sidebar destinations; pending-invitation revocation moved to People so it is not lost. Chrome captured the light and dark desktop page, the Create Company and Assign Project dialogs, and the top and lower actions at 390 px. The lower mobile capture shows the owner actions reachable without horizontal overflow. The browser test opened the real assignment flow, created a second Company, checked dialog Escape and focus return, switched Companies without stale Overview data, and invited then revoked a person on People. It did not execute a legacy Project migration or suspend or close a Company.

These checks do not prove every role, failure state, dialog, drawer, large-Company data volume, or shared-development session. The Company Workspace remains under review until those paths are exercised.
