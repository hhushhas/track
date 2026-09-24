# Company Workspace review

The screenshots below show the running web app at 1600 × 900 in dark mode, using a disposable local Convex fixture. They are not the supplied design references. The fixture has one company and one new project, so screens with no tasks or relationships show real empty states.

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

The local Company Tasks route loaded after the `companyOverview:listTasks` function was deployed to the isolated backend. Every captured route had zero horizontal page overflow, and the browser reported zero console or page errors during this capture. This does not prove that an existing signed-in session against the shared development deployment has recovered.

The visual review still shows work to do. Recent activity exposes the raw `company_project.created` event name, the empty workload and chart cards use more height than their content needs, and the mobile navigation takes a large part of the first screen. The screenshots show the current behavior so the team can review these gaps without treating fixture data as production data.
