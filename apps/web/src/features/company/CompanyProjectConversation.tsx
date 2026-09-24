import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Hash, MessageSquareText, PanelRightClose, PanelRightOpen, Plus, Search, UsersRound } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { CompanyThreadBrowser } from "#/features/threads/CompanyThreadBrowser";
import type { ConversationComposerReply } from "#/features/workspace/components/ConversationComposer";
import { ScopedConversationComposer } from "#/features/workspace/components/ScopedConversationComposer";
import { CompanyConversationTimeline } from "#/features/workspace/components/CompanyConversationTimeline";
import { getGroupAvatar } from "#/features/workspace/group-avatar";
import type { GroupMessageItem } from "#/features/workspace/thread-items";
import { CompanyProjectNavigation } from "./CompanyProjectNavigation";
import { formatCompanyError } from "./company-errors";
import type { CompanyProjectContext } from "./company-project-context";
import type { CompanyProjectChannel } from "./company-project-types";
import type { CompanyProjectContextTab } from "./company-view-state";
import {
  ProjectSnapshotNotice,
  type ProjectSnapshotState,
} from "./ProjectSnapshotNotice";
import { ProjectMembersDialog } from "./ProjectMembersDialog";
import { ProjectSearchDialog, type ProjectSearchFilter, type ProjectSearchResult } from "../workspace/search/ProjectSearchDialog";
import { buildProjectSearchSections, getProjectSearchTotal } from "../workspace/search/project-search-sections";
import { projectSearchResultHref } from "../workspace/search/project-search-navigation";

import "./company-project.css";

type SharedProjectItem = FunctionReturnType<
  typeof api.sharedProjects.listForActingCompany
>[number];

type CompanyProjectConversationProps = {
  actingCompanyId: Id<"companies">;
  activeChannel: CompanyProjectChannel | undefined;
  activeChannelId: Id<"groups"> | null;
  contextManagement: ReactNode;
  contextManagementLabel: string;
  contextTab: CompanyProjectContextTab;
  channelItems: Array<CompanyProjectChannel>;
  channelName: string;
  currentUser: Doc<"users">;
  item: SharedProjectItem;
  messages: Array<GroupMessageItem> | undefined;
  messagePageStatus:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  notice: string | null;
  memberCount?: number;
  projectMembers?: Array<{
    membership: { _id: Id<"projectMembers">; role: string; status?: string };
    user: { _id: Id<"users">; displayName: string } | null;
  }>;
  projectId: Id<"projects">;
  projectMemberId: Id<"projectMembers">;
  readOnly: boolean;
  releaseConfig: {
    tasks: boolean;
    threads: boolean;
  };
  snapshotState: ProjectSnapshotState | null | undefined;
  targetMessageId?: Id<"messages">;
  replyToMessage: ConversationComposerReply | null;
  threadUnreadByChannel: ReadonlyMap<Id<"groups">, number>;
  busyAction: string | null;
  onChannelNameChange: (name: string) => void;
  onCreateChannel: () => Promise<unknown>;
  onDeleteMessage: (messageId: Id<"messages">) => Promise<boolean>;
  onForwardMessage: (input: {
    sourceMessageId: Id<"messages">;
    targetGroupId: Id<"groups">;
    body: string;
  }) => Promise<boolean>;
  onOpenGroup: (groupId: Id<"groups">) => void;
  onOpenMessageSource: (groupId: Id<"groups">, messageId: Id<"messages">) => void;
  onReplyMessage: (item: GroupMessageItem) => void;
  onReplyChange: (reply: ConversationComposerReply | null) => void;
  onBusyActionChange: (action: string | null) => void;
  onNotice: (notice: string | null) => void;
  onLoadMoreMessages: (count: number) => void;
  onContextTabChange: (tab: CompanyProjectContextTab) => void;
};

export function CompanyProjectConversation({
  actingCompanyId,
  activeChannel,
  activeChannelId,
  contextManagement,
  contextManagementLabel,
  contextTab,
  channelItems,
  channelName,
  currentUser,
  item,
  messages,
  messagePageStatus,
  notice,
  memberCount,
  projectMembers,
  projectId,
  projectMemberId,
  readOnly,
  releaseConfig,
  replyToMessage,
  snapshotState,
  targetMessageId,
  threadUnreadByChannel,
  busyAction,
  onChannelNameChange,
  onCreateChannel,
  onDeleteMessage,
  onForwardMessage,
  onOpenGroup,
  onOpenMessageSource,
  onReplyMessage,
  onReplyChange,
  onBusyActionChange,
  onNotice,
  onLoadMoreMessages,
  onContextTabChange,
}: CompanyProjectConversationProps) {
  const [contextRailCollapsed, setContextRailCollapsed] = useState(false);
  const [channelCreationPending, setChannelCreationPending] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectSearchFilter, setProjectSearchFilter] = useState<ProjectSearchFilter>("messages");
  const [debouncedProjectSearchQuery, setDebouncedProjectSearchQuery] = useState("");
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const contextToggleRef = useRef<HTMLButtonElement | null>(null);
  const threadSearchInputId = `project-conversation-thread-search-${projectId}`;
  const creatingChannel = channelCreationPending || busyAction === "create-channel";
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedProjectSearchQuery(projectSearchQuery), 180);
    return () => window.clearTimeout(timeout);
  }, [projectSearchQuery]);
  const projectSearchResults = useQuery(
    api.search.project,
    projectSearchOpen && currentUser && debouncedProjectSearchQuery.trim().length >= 2
      ? {
          actingCompanyId,
          filter: projectSearchFilter,
          limit: 8,
          projectId,
          projectMemberId,
          query: debouncedProjectSearchQuery,
          userId: currentUser._id,
        }
      : "skip",
  );
  const projectSearchSections = buildProjectSearchSections(projectSearchResults);
  async function submitChannelCreation() {
    if (channelCreationPending) return;
    setChannelCreationPending(true);
    try {
      await onCreateChannel();
    } catch (error: unknown) {
      onNotice(formatCompanyError(error));
    } finally {
      setChannelCreationPending(false);
    }
  }
  function setContextRailState(collapsed: boolean) {
    setContextRailCollapsed(collapsed);
    requestAnimationFrame(() => contextToggleRef.current?.focus());
  }
  function openContext(tab: CompanyProjectContextTab, focusTargetId?: string) {
    setContextRailCollapsed(false);
    onContextTabChange(tab);
    if (focusTargetId) {
      requestAnimationFrame(() => {
        document.getElementById(focusTargetId)?.scrollIntoView({ block: "nearest" });
        document.getElementById(focusTargetId)?.focus({ preventScroll: true });
      });
    }
  }
  function openProjectSearchResult(result: ProjectSearchResult) {
    const href = projectSearchResultHref(result, {
      actingCompanyId,
      projectId,
      projectMemberId,
    });
    if (!href) return;
    setProjectSearchOpen(false);
    window.location.assign(href);
  }
  const contextTabs: Array<{
    key: CompanyProjectContextTab;
    label: string;
    hint: string;
  }> = [
    ...(releaseConfig.threads ? [{ key: "threads" as const, label: "Threads", hint: "Focused discussion" }] : []),
    { key: "management", label: contextManagementLabel, hint: "Project members and access" },
  ];
  const defaultContextTab: CompanyProjectContextTab = releaseConfig.threads ? "threads" : "management";
  const activeContextTab = contextTabs.some((tab) => tab.key === contextTab)
    ? contextTab
    : defaultContextTab;
  const context: CompanyProjectContext = {
    actingCompanyId,
    projectId,
    projectMemberId,
    groupId: activeChannelId ?? undefined,
  };

  return (
    <>
      <CompanyProjectNavigation
        actingCompanyId={actingCompanyId}
        activeArea="conversation"
        activeProject={context}
        tasksEnabled={releaseConfig.tasks}
        secondaryNavigation={
          <>
            {item.membership.status === "archived" ? (
              <p className="company-read-only">Read-only exit archive</p>
            ) : null}
            <nav aria-label="Channels">
              <span className="company-project-nav-label">Channels</span>
              <div className="company-project-nav-channel-list">
                {channelItems.map((channel) => {
                  const { Icon, tone } = getGroupAvatar(channel);
                  const unreadCount = threadUnreadByChannel.get(channel._id) ?? 0;
                  return (
                    <button
                      aria-current={
                        channel._id === activeChannelId ? "page" : undefined
                      }
                      className={
                        channel._id === activeChannelId
                          ? "company-project-nav-channel active"
                          : "company-project-nav-channel"
                      }
                      key={channel._id}
                      onClick={() => onOpenGroup(channel._id)}
                      type="button"
                    >
                      <span
                        className={`company-project-nav-channel-icon ${tone}`}
                      >
                        <Icon aria-hidden="true" size={14} />
                      </span>
                      {unreadCount > 0 ? (
                        <span
                          aria-label={`${unreadCount} unread threads`}
                          className="company-project-nav-count"
                          title={`${unreadCount} unread threads`}
                        >
                          {unreadCount}
                        </span>
                      ) : null}
                      <span className="company-project-nav-copy">
                        <strong>{channel.name}</strong>
                        <small>
                          {channel.status === "archived"
                            ? "Archived Channel"
                            : "Channel"}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
            {item.membership.role === "manager" &&
            item.membership.status === "active" ? (
              <form
                className="company-project-nav-channel-create"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitChannelCreation();
                }}
              >
                <Input
                  aria-label="New Channel name"
                  autoComplete="off"
                  disabled={creatingChannel}
                  name="channelName"
                  onChange={(event) => onChannelNameChange(event.target.value)}
                  placeholder="For example, Product launch…"
                  required
                  value={channelName}
                />
                <Button disabled={creatingChannel} type="submit">
                  <Plus aria-hidden="true" size={13} />
                  {creatingChannel ? "Creating…" : "Create Channel"}
                </Button>
              </form>
            ) : null}
          </>
        }
      />

      <section className="company-conversation">
        <ProjectSnapshotNotice state={snapshotState} />
        <header>
          <div className="company-conversation-title">
            <span className="company-channel-mark">
              <Hash aria-hidden="true" size={14} />
            </span>
            <div>
              <span className="company-eyebrow">{item.project.name} / Channel</span>
              <h1>{activeChannel ? `#${activeChannel.name}` : "Select a Channel"}</h1>
              <p>{item.project.description || "Project conversation and shared context."}</p>
            </div>
          </div>
          <div className="company-conversation-actions">
            {readOnly ? <span className="company-read-only">Read only</span> : null}
            <Button aria-label="Search project messages" onClick={() => setProjectSearchOpen(true)} ref={searchButtonRef} size="sm" type="button" variant="outline"><Search aria-hidden="true" size={14} /><span>Search</span></Button>
            <Button aria-label="Open Project members and access" onClick={() => setMembersDialogOpen(true)} size="sm" type="button" variant="outline"><UsersRound aria-hidden="true" size={14} /><span>Members{memberCount === undefined ? "" : ` ${memberCount}`}</span></Button>
          </div>
        </header>
        {notice ? (
          <p aria-live="polite" className="company-notice">
            {notice}
          </p>
        ) : null}
        <div className="company-message-scroll track-thread-scroll" role="log">
          {activeChannel ? (
            <CompanyConversationTimeline
              actorId={currentUser._id}
              busyAction={busyAction}
              context={{ actingCompanyId, projectMemberId }}
              group={activeChannel}
              messagePageStatus={messagePageStatus}
              messages={messages}
              onDeleteMessage={onDeleteMessage}
              onForwardMessage={onForwardMessage}
              onOpenGroup={onOpenGroup}
              onOpenMessageSource={onOpenMessageSource}
              onReplyMessage={onReplyMessage}
              onLoadMoreMessages={onLoadMoreMessages}
              readOnly={readOnly}
              targetMessageId={targetMessageId}
              visibleGroups={channelItems}
            />
          ) : (
            <div className="company-message-state">Select a Channel.</div>
          )}
        </div>
        {activeChannel && !readOnly ? (
          <ScopedConversationComposer
            actorId={currentUser._id}
            className="company-project-composer-wrap"
            context={{ actingCompanyId, projectMemberId }}
            group={activeChannel}
            onBusyChange={(action) => {
              onBusyActionChange(action);
              if (action) onNotice(null);
            }}
            onError={(error) => onNotice(formatCompanyError(error))}
            onReplyChange={onReplyChange}
            placeholder={`Message #${activeChannel.name}. Type @ to tag someone`}
            projectId={projectId}
            replyTo={replyToMessage}
            visibleGroups={channelItems}
          />
        ) : null}
      </section>
      <ProjectMembersDialog members={projectMembers ?? []} onManageAccess={() => openContext("management")} onOpenChange={setMembersDialogOpen} open={membersDialogOpen} projectName={item.project.name} />
      <ProjectSearchDialog
        filter={projectSearchFilter}
        loading={projectSearchOpen && debouncedProjectSearchQuery.trim().length >= 2 && projectSearchResults === undefined}
        onClose={() => setProjectSearchOpen(false)}
        onFilterChange={setProjectSearchFilter}
        onOpenResult={openProjectSearchResult}
        onQueryChange={setProjectSearchQuery}
        open={projectSearchOpen}
        projectName={item.project.name}
        query={projectSearchQuery}
        returnFocusRef={searchButtonRef}
        sections={projectSearchSections}
        total={getProjectSearchTotal(projectSearchSections)}
        updating={projectSearchQuery !== debouncedProjectSearchQuery}
      />
      <aside
        aria-label="Project context"
        className={contextRailCollapsed ? "company-project-context-rail is-collapsed" : "company-project-context-rail"}
      >
        {contextRailCollapsed ? (
          <button
            aria-controls="company-context-panel"
            aria-expanded={false}
            aria-label="Open Project context"
            className="company-project-context-expand"
            onClick={() => setContextRailState(false)}
            ref={contextToggleRef}
            title="Open Project context"
            type="button"
          >
            <PanelRightOpen aria-hidden="true" size={16} />
          </button>
        ) : (
          <>
            <header className="company-project-context-heading">
              <div>
                <span className="company-eyebrow">Project context</span>
                <h2>{activeChannel ? `#${activeChannel.name}` : item.project.name}</h2>
              </div>
              <button
                aria-controls="company-context-panel"
                aria-expanded={true}
                aria-label="Collapse Project context"
                className="company-project-context-collapse"
                onClick={() => setContextRailState(true)}
                ref={contextToggleRef}
                title="Collapse Project context"
                type="button"
              >
                <PanelRightClose aria-hidden="true" size={15} />
              </button>
              <p>Review visible threads and Project members without leaving the Channel.</p>
            </header>
        <nav aria-label="Project context sections" aria-orientation="horizontal" className="company-project-context-tabs" role="tablist">
          {contextTabs.map((tab) => (
            <button
              aria-controls="company-context-panel"
              aria-selected={activeContextTab === tab.key}
              className={activeContextTab === tab.key ? "active" : ""}
              id={`company-context-tab-${tab.key}`}
              key={tab.key}
              onClick={() => onContextTabChange(tab.key)}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const currentIndex = contextTabs.findIndex((candidate) => candidate.key === tab.key);
                const nextIndex = event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? contextTabs.length - 1
                    : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + contextTabs.length) % contextTabs.length;
                const nextTab = contextTabs[nextIndex];
                if (nextTab) {
                  onContextTabChange(nextTab.key);
                  document.getElementById(`company-context-tab-${nextTab.key}`)?.focus();
                }
              }}
              role="tab"
              tabIndex={activeContextTab === tab.key ? 0 : -1}
              title={tab.hint}
              type="button"
            >
              {tab.key === "threads" ? <MessageSquareText aria-hidden="true" size={14} /> : null}
              {tab.key === "management" ? <UsersRound aria-hidden="true" size={14} /> : null}
              <strong>{tab.label}</strong>
            </button>
          ))}
        </nav>
        <section
          aria-labelledby={`company-context-tab-${activeContextTab}`}
          className="company-project-context-panel"
          id="company-context-panel"
          role="tabpanel"
        >
          {activeContextTab === "threads" && releaseConfig.threads ? (
            <CompanyThreadBrowser
              activeChannel={activeChannel}
              companyName={item.membership.companyDisplayNameSnapshot ?? item.project.clientLabel ?? undefined}
              context={{ actingCompanyId, projectMemberId }}
              projectId={projectId}
              readOnly={readOnly}
              searchInputId={threadSearchInputId}
              userId={currentUser._id}
            />
          ) : null}
          {activeContextTab === "management" ? contextManagement : null}
        </section>
          </>
        )}
      </aside>
    </>
  );
}
