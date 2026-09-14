import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  Hash,
  ListTodo,
  MessageSquareText,
  Settings2,
  UsersRound,
} from "lucide-react";

import type { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { CompanyThreadBrowser } from "#/features/threads/CompanyThreadBrowser";
import { getGroupAvatar } from "#/features/workspace/group-avatar";
import {
  getCompanyProjectConversationSearch,
  getCompanyProjectTaskSearch,
  type CompanyProjectLinkContext,
} from "./company-project-links";
import { CompanyProjectNavigation } from "./CompanyProjectNavigation";
import type { CompanyProjectChannel } from "./company-project-types";

import "./company-project-overview.css";

type SharedProjectItem = FunctionReturnType<
  typeof api.sharedProjects.listForActingCompany
>[number];

type ProjectMember = FunctionReturnType<
  typeof api.sharedProjects.listMembers
>[number];
type ProjectOverview = FunctionReturnType<typeof api.sharedProjects.getOverview>;

type Props = {
  actingCompanyId: Id<"companies">;
  actingCompanyName: string;
  channelItems: Array<CompanyProjectChannel>;
  currentUser: Doc<"users">;
  item: SharedProjectItem;
  projectId: Id<"projects">;
  projectMemberId: Id<"projectMembers">;
  projectMembers?: Array<ProjectMember>;
  projectOverview?: ProjectOverview;
  tasksEnabled: boolean;
  threadUnreadByChannel: ReadonlyMap<Id<"groups">, number>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatProjectStatus(status: SharedProjectItem["project"]["status"]) {
  if (status === "archived") return "Archived";
  if (status === "proposed") return "Proposed";
  return "Active";
}

export function CompanyProjectOverview({
  actingCompanyId,
  actingCompanyName,
  channelItems,
  currentUser,
  item,
  projectId,
  projectMemberId,
  projectMembers,
  projectOverview,
  tasksEnabled,
  threadUnreadByChannel,
}: Props) {
  const linkContext: CompanyProjectLinkContext = {
    actingCompanyId,
    projectId,
    projectMemberId,
  };
  const activeChannels = channelItems.filter(
    (channel) => channel.status !== "archived",
  );
  const unreadThreads = [...threadUnreadByChannel.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const latestChannel = activeChannels[0] ?? channelItems[0];
  const participatingCompanies = projectOverview?.companies.length
    ? projectOverview.companies.map((company) => ({
        id: company._id,
        name: company.displayName,
        role: company._id === item.owningCompany?._id ? "Project owner" : "Participant",
      }))
    : [item.owningCompany
        ? { id: item.owningCompany._id, name: item.owningCompany.displayName, role: "Project owner" }
        : { id: actingCompanyId, name: actingCompanyName, role: "Representing" }];

  return (
    <>
      <CompanyProjectNavigation
        actingCompanyId={actingCompanyId}
        activeArea="overview"
        activeProject={{ projectId, projectMemberId }}
        tasksEnabled={tasksEnabled}
        secondaryNavigation={
          channelItems.length ? (
            <nav aria-label="Project Channels">
              <span className="company-project-nav-label">Channels</span>
              <div className="company-project-nav-channel-list">
                {channelItems.map((channel) => {
                  const { Icon, tone } = getGroupAvatar(channel);
                  const unreadCount = threadUnreadByChannel.get(channel._id) ?? 0;
                  return (
                    <Link
                      aria-label={`Open ${channel.name} Channel`}
                      className="company-project-nav-channel"
                      key={channel._id}
                      params={{ projectId }}
                      search={getCompanyProjectConversationSearch({
                        ...linkContext,
                        groupId: channel._id,
                      })}
                      to="/workspace/company-projects/$projectId"
                    >
                      <span className={`company-project-nav-channel-icon ${tone}`}>
                        <Icon aria-hidden="true" size={14} />
                      </span>
                      {unreadCount > 0 ? (
                        <span
                          aria-label={`${unreadCount} unread threads`}
                          className="company-project-nav-count"
                        >
                          {unreadCount}
                        </span>
                      ) : null}
                      <span className="company-project-nav-copy">
                        <strong>{channel.name}</strong>
                        <small>{channel.status === "archived" ? "Archived Channel" : "Channel"}</small>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null
        }
      />

      <section className="company-project-overview">
        <div className="company-project-overview-inner">
          <nav aria-label="Breadcrumb" className="company-project-breadcrumb">
            <Link to="/workspace/company">Company workspace</Link>
            <span aria-hidden="true">/</span>
            <span>{item.project.name}</span>
          </nav>

          <header className="company-project-hero">
            <div className="company-project-hero-mark" aria-hidden="true">
              <FolderKanban size={22} strokeWidth={1.8} />
            </div>
            <div className="company-project-hero-copy">
              <span className={`company-project-status is-${item.project.status ?? "active"}`}>
                <i aria-hidden="true" />
                {formatProjectStatus(item.project.status)} Project
              </span>
              <h1>{item.project.name}</h1>
              <p>
                {item.project.description?.trim() ||
                  "Channels, tasks, threads, and Project context in one shared workspace."}
              </p>
            </div>
            <div className="company-project-hero-actions">
              {latestChannel ? (
                <Link
                  className="company-project-primary-action"
                  params={{ projectId }}
                  search={getCompanyProjectConversationSearch({
                    ...linkContext,
                    groupId: latestChannel._id,
                  })}
                  to="/workspace/company-projects/$projectId"
                >
                  Open conversation
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              ) : null}
              <Link
                className="company-project-quiet-action"
                params={{ projectId }}
                search={{
                  ...getCompanyProjectConversationSearch(linkContext),
                  context: "management" as const,
                }}
                to="/workspace/company-projects/$projectId"
              >
                <Settings2 aria-hidden="true" size={14} />
                Project settings
              </Link>
            </div>
          </header>

          <dl className="company-project-metrics" aria-label="Project summary">
            <div>
              <dt>Active Channels</dt>
              <dd>{activeChannels.length}</dd>
            </div>
            <div>
              <dt>Unread threads</dt>
              <dd>{unreadThreads}</dd>
            </div>
            <div>
              <dt>Your access</dt>
              <dd>{item.membership.role === "manager" ? "Manager" : "Member"}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{dateFormatter.format(item.project.updatedAt)}</dd>
            </div>
          </dl>

          <div className="company-project-overview-grid">
            <div className="company-project-overview-main">
              <section className="company-project-section company-project-brief">
                <header>
                  <div>
                    <span className="company-project-section-icon"><CheckCircle2 aria-hidden="true" size={16} /></span>
                    <div>
                      <h2>Project brief</h2>
                      <p>The current Project record and access boundary.</p>
                    </div>
                  </div>
                  <span className="company-project-section-state">{formatProjectStatus(item.project.status)}</span>
                </header>
                <div className="company-project-brief-body">
                  <p>{item.project.description?.trim() || "No Project brief has been added yet."}</p>
                  <dl>
                    <div>
                      <dt><Building2 aria-hidden="true" size={14} /> Owned by</dt>
                      <dd>{item.owningCompany?.displayName ?? "Ownership not confirmed"}</dd>
                    </div>
                    <div>
                      <dt><UsersRound aria-hidden="true" size={14} /> Members</dt>
                      <dd>{projectOverview ? `${projectOverview.memberCount}${projectOverview.memberCountTruncated ? "+" : ""} visible` : projectMembers ? `${projectMembers.length} visible` : "Based on your access"}</dd>
                    </div>
                    <div>
                      <dt><CalendarClock aria-hidden="true" size={14} /> Created</dt>
                      <dd>{dateFormatter.format(item.project.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="company-project-section company-project-channels">
                <header>
                  <div>
                    <span className="company-project-section-icon"><Hash aria-hidden="true" size={16} /></span>
                    <div>
                      <h2>Context Channels</h2>
                      <p>Open the conversation that owns the work context.</p>
                    </div>
                  </div>
                  <span className="company-project-section-count">{channelItems.length}</span>
                </header>
                {channelItems.length ? (
                  <ul>
                    {channelItems.map((channel) => {
                      const unreadCount = threadUnreadByChannel.get(channel._id) ?? 0;
                      return (
                        <li key={channel._id}>
                          <Link
                            params={{ projectId }}
                            search={getCompanyProjectConversationSearch({ ...linkContext, groupId: channel._id })}
                            to="/workspace/company-projects/$projectId"
                          >
                            <span className="company-project-channel-glyph"><Hash aria-hidden="true" size={15} /></span>
                            <span>
                              <strong>{channel.name}</strong>
                              <small>{channel.status === "archived" ? "Archived Channel" : "Open Channel"}</small>
                            </span>
                            {unreadCount ? <span className="is-unread">{unreadCount} unread</span> : <span>View</span>}
                            <ArrowRight aria-hidden="true" size={14} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="company-project-empty">No Channels are available in this Project.</p>
                )}
              </section>

              <section className="company-project-section company-project-participants">
                <header>
                  <div>
                    <span className="company-project-section-icon"><Building2 aria-hidden="true" size={16} /></span>
                    <div>
                      <h2>Participating Companies</h2>
                      <p>The Companies visible from your represented membership.</p>
                    </div>
                  </div>
                </header>
                <ul>
                  {participatingCompanies.map((company) => (
                    <li key={company.id}>
                      <span aria-hidden="true">{company.name.slice(0, 1).toUpperCase()}</span>
                      <div><strong>{company.name}</strong><small>{company.role}</small></div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="company-project-overview-aside" aria-label="Project shortcuts">
              <section>
                <span className="company-project-section-icon"><MessageSquareText aria-hidden="true" size={16} /></span>
                <h2>Continue the work</h2>
                <p>Conversation is the source of context. Tasks keep the next actions visible.</p>
                {latestChannel ? (
                  <Link
                    params={{ projectId }}
                    search={getCompanyProjectConversationSearch({ ...linkContext, groupId: latestChannel._id })}
                    to="/workspace/company-projects/$projectId"
                  >
                    <MessageSquareText aria-hidden="true" size={14} />
                    Latest conversation
                  </Link>
                ) : null}
                {tasksEnabled ? (
                  <Link
                    params={{ projectId }}
                    search={getCompanyProjectTaskSearch(linkContext)}
                    to="/workspace/projects/$projectId/tasks"
                  >
                    <ListTodo aria-hidden="true" size={14} />
                    Open task board
                  </Link>
                ) : null}
              </section>
            </aside>
          </div>
        </div>
      </section>

      <aside className="company-project-overview-threads" aria-label="Company thread rail">
        <header>
          <span className="company-eyebrow">Project context</span>
          <h2>Threads</h2>
          <p>All visible threads for the represented Company.</p>
        </header>
        <div>
          <CompanyThreadBrowser
            companyName={actingCompanyName}
            context={{ actingCompanyId, projectMemberId }}
            projectId={projectId}
            userId={currentUser._id}
          />
        </div>
      </aside>
    </>
  );
}
