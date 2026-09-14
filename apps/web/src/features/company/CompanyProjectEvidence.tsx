import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { CompanyThreadBrowser } from "#/features/threads/CompanyThreadBrowser";
import { ProjectEvidencePage } from "#/features/workspace/pages/ProjectEvidencePage";
import { CompanyProjectNavigation } from "./CompanyProjectNavigation";
import type { CompanyProjectChannel } from "./company-project-types";
import "./company-project-overview.css";

export function CompanyProjectEvidence(props: {
  actingCompanyId: Id<"companies">; actingCompanyName: string;
  channelItems: Array<CompanyProjectChannel>; currentUser: Doc<"users">;
  projectId: Id<"projects">; projectMemberId: Id<"projectMembers">; projectName: string; tasksEnabled: boolean;
}) {
  const { actingCompanyId, actingCompanyName, channelItems, currentUser, projectId, projectMemberId, projectName, tasksEnabled } = props;
  const firstLiveGroup = channelItems.find(
    (channel): channel is Doc<"groups"> => "_creationTime" in channel,
  );
  return <>
    <CompanyProjectNavigation actingCompanyId={actingCompanyId} activeArea="evidence" activeProject={{ projectId, projectMemberId }} tasksEnabled={tasksEnabled} />
    <section className="company-project-evidence-surface">
      <ProjectEvidencePage actorId={currentUser._id} actingCompanyId={actingCompanyId} firstGroup={firstLiveGroup} projectId={projectId} projectMemberId={projectMemberId} projectName={projectName} />
    </section>
    <aside className="company-project-overview-threads" aria-label="Company thread rail">
      <header><span className="company-eyebrow">Project context</span><h2>Threads</h2><p>Visible threads across this Project.</p></header>
      <div><CompanyThreadBrowser companyName={actingCompanyName} context={{ actingCompanyId, projectMemberId }} projectId={projectId} userId={currentUser._id} /></div>
    </aside>
  </>;
}
