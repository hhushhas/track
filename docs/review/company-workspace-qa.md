# Company Workspace review

The screenshots show the running web app in dark mode with a disposable local Convex fixture. Desktop captures use a 1600 × 900 viewport; mobile captures use 390 × 844. They are not the supplied design references. The fixture has one company and one project, so screens without tasks or relationships show real empty states.

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
| Mobile navigation open | [Open screenshot](assets/company-workspace/overview-mobile-navigation.png) |

The local Company Tasks route loaded after the `companyOverview:listTasks` function was deployed to the isolated backend. Every captured route had zero horizontal page overflow. The first seven-route sweep had no console or page errors. A later recapture logged one 401 resource response during sign-in; it did not recur on a repeated run, and its cause remains unproved. These local checks do not prove that an existing signed-in session against the shared development deployment has recovered.

Recent activity uses a plain-language description for the supported project audit event. The Active people count is zero when no one has an open assignment. With no assigned tasks, the workload card stays compact; with no task creation or completion, the chart shows an empty-state message. On narrow screens, Company navigation starts compact and opens from a labeled button. The mobile menu closes with Escape. A 320–1600 px viewport sweep found no page overflow.

These checks do not prove every role, failure state, dialog, drawer, or shared-development session. The filtered audit query finds supported events beyond 100 newer internal events, but its scan cost with very large project histories has not been measured. The Company Workspace remains under review until those paths and data volumes are exercised.
