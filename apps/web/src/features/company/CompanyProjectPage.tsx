import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Menu, MessageSquareText, Paperclip, Plus, SlidersHorizontal } from "lucide-react";

import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { resolveReleaseConfig, useReleaseConfigProjection } from "#/lib/release-config";
import { ChannelTaskPanel, CreateTaskFromMessage, MessageInlineTasks } from "#/features/tasks/ConversationTaskActions";
import { ChannelThreadBrowser } from "#/features/threads/ChannelThreadBrowser";
import { threadHref } from "#/features/threads/thread-navigation";
import { ProjectEvidencePage } from "#/features/workspace/pages/ProjectEvidencePage";
import { AttachmentTypeIcon } from "#/features/workspace/attachment-ui";
import { resolveActiveCompanyProjectChannel } from "./company-project-channel-state";

type Props = {
  actingCompanyId: Id<"companies">;
  initialGroupId?: Id<"groups">;
  projectId: Id<"projects">;
  projectMemberId: Id<"projectMembers">;
  view?: "overview" | "channels" | "evidence" | "settings";
};

function projectRoleLabel(role: Doc<'projectMembers'>['role']) {
  if (role === 'manager') return 'Project manager'
  if (role === 'member') return 'Project member'
  if (role === 'owner') return 'Project owner'
  if (role === 'admin') return 'Project admin'
  if (role === 'staff') return 'Project staff'
  return 'Project client'
}

export function CompanyProjectPage({
  actingCompanyId,
  initialGroupId,
  projectId,
  projectMemberId,
  view = "channels",
}: Props) {
  const navigate = useNavigate();
  const releaseConfigProjection = useReleaseConfigProjection();
  const releaseConfig = resolveReleaseConfig(releaseConfigProjection);
  const currentUser = useQuery(api.auth.getCurrentUser);
  const projects = useQuery(
    api.sharedProjects.listForActingCompany,
    releaseConfig.companyModel ? { actingCompanyId } : "skip",
  );
  const item = projects?.find(
    (candidate) =>
      candidate.project._id === projectId &&
      candidate.membership._id === projectMemberId,
  );
  const overview = useQuery(
    api.sharedProjects.getOverview,
    releaseConfig.companyModel && item
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const exitStatus = useQuery(
    api.projectExit.getStatus,
    releaseConfig.companyModel && item
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const canReadChannels =
    exitStatus != null && exitStatus.status !== "exit_pending";
  const isActiveProjectManager =
    exitStatus?.status === "active" &&
    item?.membership.role === "manager" &&
    item.membership.status === "active";
  const canManageActiveProject =
    isActiveProjectManager &&
    (item.project.status === "active" || item.project.status === "proposed");
  const channels = useQuery(
    api.channels.list,
    canReadChannels
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const projectMembers = useQuery(
    api.sharedProjects.listMembers,
    canManageActiveProject
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const companyMembers = useQuery(
    api.sharedProjects.listEligibleCompanyMembers,
    canManageActiveProject
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const pendingProjectArchives = useQuery(
    api.projectArchives.listPending,
    isActiveProjectManager
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const channelParticipationInvitations = useQuery(
    api.channels.listParticipationInvitations,
    canManageActiveProject
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const [activeChannelId, setActiveChannelId] = useState<Id<"groups"> | null>(
    initialGroupId ?? null,
  );
  const [composer, setComposer] = useState("");
  const [channelName, setChannelName] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<Id<"messages"> | null>(null);
  const [editingMessageBody, setEditingMessageBody] = useState("");
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<Id<"messages"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [channelDrawerOpen, setChannelDrawerOpen] = useState(false);
  const [controlsDrawerOpen, setControlsDrawerOpen] = useState(false);
  const channelDrawerTriggerRef = useRef<HTMLButtonElement>(null);
  const controlsDrawerTriggerRef = useRef<HTMLButtonElement>(null);
  const channelDrawerRef = useRef<HTMLElement>(null);
  const controlsDrawerRef = useRef<HTMLElement>(null);
  const messages = useQuery(
    api.messages.listDetailed,
    activeChannelId && currentUser
      ? {
          actingCompanyId,
          groupId: activeChannelId,
          limit: 80,
          projectMemberId,
          userId: currentUser._id,
        }
      : "skip",
  );
  const threadUnread = useQuery(
    api.channelThreads.listGroupUnread,
    releaseConfig.threads && currentUser && canReadChannels
      ? {
          actingCompanyId,
          projectId,
          projectMemberId,
          userId: currentUser._id,
        }
      : "skip",
  );
  const threadUnreadByChannel = useMemo(
    () => new Map((threadUnread ?? []).map((entry) => [entry.groupId, entry.unreadCount])),
    [threadUnread],
  );
  const createChannel = useMutation(api.channels.create);
  const addProjectMember = useMutation(api.sharedProjects.addMember);
  const updateProjectMember = useMutation(api.sharedProjects.updateMember);
  const requestChannelParticipation = useMutation(
    api.channels.requestParticipation,
  );
  const decideChannelParticipation = useMutation(
    api.channels.decideParticipation,
  );
  const requestChannelArchive = useMutation(api.channels.requestArchive);
  const approveChannelArchive = useMutation(api.channels.approveArchive);
  const cancelChannelArchive = useMutation(api.channels.cancelArchive);
  const sendMessage = useMutation(api.messages.send);
  const editMessage = useMutation(api.messages.edit);
  const deleteMessage = useMutation(api.messages.remove);
  const requestProjectArchive = useMutation(api.projectArchives.request);
  const approveProjectArchive = useMutation(api.projectArchives.approve);
  const prepareExit = useMutation(api.projectExit.prepare);
  const retryExit = useMutation(api.projectExit.retrySnapshot);
  const retryExitCleanup = useMutation(api.projectExit.retryCleanup);
  const finalizeExit = useMutation(api.projectExit.finalize);
  const cancelExit = useMutation(api.projectExit.cancel);

  useEffect(() => {
    const nextChannelId = resolveActiveCompanyProjectChannel(
      activeChannelId,
      channels?.map((entry) =>
        "channel" in entry ? entry.channel._id : (entry._id as Id<"groups">),
      ),
    );
    if (nextChannelId !== activeChannelId) setActiveChannelId(nextChannelId);
  }, [activeChannelId, channels]);
  useEffect(() => {
    if (!messages || typeof window === "undefined" || !window.location.hash.startsWith("#message-")) return;
    requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [messages]);
  useEffect(() => {
    if (!channelDrawerOpen && !controlsDrawerOpen) return;
    const mobileViewport = window.matchMedia("(max-width: 820px)");
    if (!mobileViewport.matches) {
      setChannelDrawerOpen(false);
      setControlsDrawerOpen(false);
      return;
    }
    const drawer = channelDrawerOpen ? channelDrawerRef.current : controlsDrawerRef.current;
    const trigger = channelDrawerOpen ? channelDrawerTriggerRef.current : controlsDrawerTriggerRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    drawer?.querySelector<HTMLElement>(focusableSelector)?.focus();
    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setChannelDrawerOpen(false);
        setControlsDrawerOpen(false);
        trigger?.focus();
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function handleViewportChange(event: MediaQueryListEvent) {
      if (!event.matches) {
        setChannelDrawerOpen(false);
        setControlsDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", handleDrawerKeyDown);
    mobileViewport.addEventListener("change", handleViewportChange);
    return () => {
      window.removeEventListener("keydown", handleDrawerKeyDown);
      mobileViewport.removeEventListener("change", handleViewportChange);
      if (mobileViewport.matches) {
        trigger?.focus();
      } else {
        requestAnimationFrame(() => {
          const visibleDesktopTarget = document.querySelector<HTMLElement>(
            '.company-project-view-nav [aria-current="page"], .company-project-view-nav a',
          );
          visibleDesktopTarget?.focus();
        });
      }
    };
  }, [channelDrawerOpen, controlsDrawerOpen]);

  const channelItems = useMemo(
    () =>
      (channels ?? []).map((entry) =>
        "channel" in entry ? entry.channel : entry,
      ),
    [channels],
  );
  const activeChannel = channelItems.find(
    (channel) => channel._id === activeChannelId,
  );
  const activeChannelEntry = channels?.find(
    (entry) =>
      ("channel" in entry ? entry.channel._id : entry._id) === activeChannelId,
  );
  const isChannelSteward = Boolean(
    activeChannelEntry &&
    "membership" in activeChannelEntry &&
    activeChannelEntry.membership.isSteward,
  );
  const participationOptions = useQuery(
    api.channels.getParticipationOptions,
    activeChannelId &&
      isChannelSteward &&
      exitStatus?.status === "active" &&
      activeChannel?.status === "active"
      ? {
          actingCompanyId,
          groupId: activeChannelId,
          projectId,
          projectMemberId,
        }
      : "skip",
  );
  const pendingChannelArchives = useQuery(
    api.channels.listPendingArchive,
    activeChannelId && isChannelSteward
      ? {
          actingCompanyId,
          groupId: activeChannelId,
          projectId,
          projectMemberId,
        }
      : "skip",
  );
  const readOnly =
    item?.membership.status === "archived" ||
    item?.project.status !== "active" ||
    Boolean(activeChannel && activeChannel.status !== "active");
  const showProjectRail = view === "channels" || (view === "settings" && canManageActiveProject);
  const recentReferences = useMemo(
    () => (messages ?? []).flatMap((detail) => detail.attachments.map(({ attachment, url }) => ({
      attachment,
      author: detail.author?.displayName ?? "Unknown member",
      createdAt: detail.message.createdAt,
      url,
    }))).slice(0, 4),
    [messages],
  );

  async function run(
    action: () => Promise<unknown>,
    { successNotice = "Saved." }: { successNotice?: string | null } = {},
  ) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (successNotice) setNotice(successNotice);
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message.replaceAll("_", " ")
          : "The action failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeChannelId || !currentUser || !composer.trim()) return;
    const saved = await run(() =>
      sendMessage({
        actingCompanyId,
        authorId: currentUser._id,
        body: composer.trim(),
        groupId: activeChannelId,
        projectId,
        projectMemberId,
      }),
      { successNotice: null },
    );
    if (saved) setComposer("");
  }

  async function deleteAuthoredMessage(messageId: Id<"messages">) {
    if (!currentUser) return;
    const deleted = await run(() =>
      deleteMessage({
        actingCompanyId,
        actorId: currentUser._id,
        messageId,
        projectMemberId,
      }),
    );
    if (deleted) setPendingDeleteMessageId(null);
  }

  function beginEditingMessage(messageId: Id<"messages">, currentBody: string) {
    setPendingDeleteMessageId(null);
    setEditingMessageId(messageId);
    setEditingMessageBody(currentBody);
  }

  async function saveEditedMessage(messageId: Id<"messages">) {
    if (!currentUser) return;
    const saved = await run(() => editMessage({
      actingCompanyId,
      actorId: currentUser._id,
      body: editingMessageBody,
      messageId,
      projectMemberId,
    }));
    if (saved) {
      setEditingMessageId(null);
      setEditingMessageBody("");
    }
  }

  if (releaseConfigProjection === undefined)
    return (
      <main className="company-hub">
        <section className="track-guided-empty" role="status">
          <h1>Loading project…</h1>
          <p>Checking your company and project access.</p>
        </section>
      </main>
    );

  if (!releaseConfig.companyModel)
    return (
      <main className="company-hub">
        <h1>Company Project unavailable</h1>
        <p>This capability is currently disabled by the server release configuration.</p>
        <Link to="/workspace">Return to Projects</Link>
      </main>
    );

  if (projects === undefined)
    return (
      <main className="company-hub">
        <p>Loading Project…</p>
      </main>
    );
  if (!item)
    return (
      <main className="company-hub">
        <h1>Project unavailable</h1>
        <p>This represented membership is no longer authorized.</p>
        <Link to="/workspace/company">Return to Company hub</Link>
      </main>
    );

  return (
    <main aria-busy={busy} className={`company-project-shell${showProjectRail ? "" : " company-project-shell-no-rail"}`}>
      <div aria-label="Mobile project navigation" className="company-project-mobile-bar">
        <Button aria-controls="company-channel-drawer" aria-expanded={channelDrawerOpen} onClick={() => setChannelDrawerOpen(true)} ref={channelDrawerTriggerRef} type="button" variant="outline">
          <Menu aria-hidden="true" size={16} /> Channel menu
        </Button>
        <strong>{item.project.name}</strong>
        {showProjectRail ? <Button aria-controls="company-controls-drawer" aria-expanded={controlsDrawerOpen} onClick={() => setControlsDrawerOpen(true)} ref={controlsDrawerTriggerRef} type="button" variant="outline">
          <SlidersHorizontal aria-hidden="true" size={16} /> Project controls
        </Button> : <span aria-hidden="true" />}
      </div>
      {channelDrawerOpen || controlsDrawerOpen ? (
        <button
          aria-label="Close project drawer"
          className="company-project-drawer-backdrop"
          onClick={() => {
            setChannelDrawerOpen(false);
            setControlsDrawerOpen(false);
          }}
          type="button"
        />
      ) : null}
      <aside aria-label={channelDrawerOpen ? "Channel menu" : "Project navigation"} aria-modal={channelDrawerOpen || undefined} className={`company-channel-sidebar${channelDrawerOpen ? " drawer-open" : ""}`} id="company-channel-drawer" ref={channelDrawerRef} role={channelDrawerOpen ? "dialog" : undefined}>
        <Button className="company-drawer-close" onClick={() => setChannelDrawerOpen(false)} type="button" variant="outline">Close menu</Button>
        <Link to="/workspace/company">← Back to company</Link>
        <h1>{item.project.name}</h1>
        <span className="company-badge">
          {item.membership.companyDisplayNameSnapshot} · {projectRoleLabel(item.membership.role)}
        </span>
        {item.membership.status === "archived" ? (
          <p className="company-read-only">Read-only exit archive</p>
        ) : null}
        <nav aria-label="Channels">
          <h2>Channels</h2>
          {channelItems.map((channel) => (
            <button
              aria-current={
                channel._id === activeChannelId ? "page" : undefined
              }
              className={channel._id === activeChannelId ? "active" : ""}
              key={channel._id}
              onClick={() => {
                setActiveChannelId(channel._id);
                setChannelDrawerOpen(false);
                void navigate({
                  params: { projectId },
                  replace: view === "channels",
                  search: { companyId: actingCompanyId, groupId: channel._id, membershipId: projectMemberId, view: "channels" },
                  to: "/workspace/company-projects/$projectId",
                });
              }}
              type="button"
            >
              #{channel.name}
              {channel.status === "archived" ? " · archived" : ""}
              {threadUnreadByChannel.get(channel._id)
                ? ` · ${threadUnreadByChannel.get(channel._id)} unread ${threadUnreadByChannel.get(channel._id) === 1 ? "thread" : "threads"}`
                : ""}
            </button>
          ))}
        </nav>
        <nav aria-label="Project views" className="company-project-view-nav">
          <Link
            aria-current={view === "overview" ? "page" : undefined}
            params={{ projectId }}
            search={{ companyId: actingCompanyId, groupId: activeChannelId ?? "", membershipId: projectMemberId, view: "overview" }}
            to="/workspace/company-projects/$projectId"
          >Overview</Link>
          {releaseConfig.tasks ? <>
            <Link params={{ projectId }} search={{ actingCompanyId, projectMemberId, view: "board" }} to="/workspace/projects/$projectId/tasks">Board</Link>
            <Link params={{ projectId }} search={{ actingCompanyId, projectMemberId, view: "all" }} to="/workspace/projects/$projectId/tasks">List</Link>
          </> : null}
          <Link
            aria-current={view === "channels" ? "page" : undefined}
            params={{ projectId }}
            search={{ companyId: actingCompanyId, groupId: activeChannelId ?? "", membershipId: projectMemberId, view: "channels" }}
            to="/workspace/company-projects/$projectId"
          >Channels</Link>
          <Link
            aria-current={view === "evidence" ? "page" : undefined}
            params={{ projectId }}
            search={{ companyId: actingCompanyId, groupId: activeChannelId ?? "", membershipId: projectMemberId, view: "evidence" }}
            to="/workspace/company-projects/$projectId"
          >Evidence</Link>
          <Link
            aria-current={view === "settings" ? "page" : undefined}
            params={{ projectId }}
            search={{ companyId: actingCompanyId, groupId: activeChannelId ?? "", membershipId: projectMemberId, view: "settings" }}
            to="/workspace/company-projects/$projectId"
          >Settings</Link>
        </nav>
        {canManageActiveProject ? (
          <details className="company-channel-create">
            <summary><Plus aria-hidden="true" size={13} /> New channel</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await createChannel({
                    actingCompanyId,
                    name: channelName,
                    ownCompanyMemberIds: [],
                    projectId,
                    projectMemberId,
                  });
                  setChannelName("");
                });
              }}
            >
              <Input
                aria-label="New channel name"
                onChange={(event) => setChannelName(event.target.value)}
                placeholder="Channel name"
                required
                value={channelName}
              />
              <Button type="submit">Create channel</Button>
            </form>
          </details>
        ) : null}
      </aside>

      <section className={`company-conversation company-conversation-${view}`}>
        {notice ? (
          <p aria-live="polite" className="company-notice">
            {notice}
          </p>
        ) : null}
        {view === "overview" ? (
          <div className="track-project-overview">
            <header className="track-project-overview-hero">
              <div>
                <p className="mono-label">Project overview</p>
                <h2>{item.project.name}</h2>
                <p>{item.project.description?.trim() || "No description has been added yet."}</p>
              </div>
              <div className="track-project-overview-actions">
                <span className="track-status-stamp"><i aria-hidden="true" />{item.project.status.replaceAll("_", " ")}</span>
                <Link
                  className="track-inline-action"
                  params={{ projectId }}
                  search={{ companyId: actingCompanyId, groupId: activeChannelId ?? "", membershipId: projectMemberId, view: "channels" }}
                  to="/workspace/company-projects/$projectId"
                >Open channels</Link>
              </div>
            </header>
            <section aria-label="Project summary" className="track-project-summary-grid">
              <article><span><strong>{overview ? `${overview.memberCount}${overview.memberCountTruncated ? "+" : ""}` : "—"}</strong><small>Members</small></span></article>
              <article><span><strong>{channelItems.length}</strong><small>Channels</small></span></article>
              <article><span><strong>{projectRoleLabel(item.membership.role)}</strong><small>Your role</small></span></article>
            </section>
            <section className="track-overview-section">
              <div className="track-section-heading"><div><h3>Project manager</h3><p>The people responsible for project administration.</p></div></div>
              <p>{overview?.managers.map((manager) => manager.displayName).join(", ") || "No active project manager is available."}{overview?.managersTruncated ? " and others" : ""}</p>
            </section>
            <section className="track-overview-section">
              <div className="track-section-heading"><div><h3>Participating companies</h3><p>Companies currently represented in this project.</p></div></div>
              <p>{overview?.companies.map((company) => company.displayName).join(", ") || item.membership.companyDisplayNameSnapshot}{overview?.participantsTruncated ? " and others" : ""}</p>
            </section>
            <section className="track-overview-section">
              <div className="track-section-heading"><div><h3>Recent activity</h3><p>The latest recorded project change.</p></div></div>
              <time dateTime={new Date(item.project.updatedAt).toISOString()}>{new Date(item.project.updatedAt).toLocaleString()}</time>
            </section>
          </div>
        ) : view === "evidence" ? (
          <ProjectEvidencePage
            actingCompanyId={actingCompanyId}
            firstGroup={channelItems[0]}
            projectId={projectId}
            projectMemberId={projectMemberId}
          />
        ) : view === "settings" ? (
          <div className="track-settings-page">
            <header className="track-page-intro"><p className="mono-label">Project settings</p><h2>Settings</h2><p>{canManageActiveProject ? "Manage project details, membership, access, channels, evidence, notifications, and archive actions." : "Review your project access and the settings that apply to this membership."}</p></header>
            <nav aria-label="Project settings sections" className="track-settings-nav">
              <a href="#general">General</a>{canManageActiveProject ? <a href="#members">Members</a> : null}<a href="#access">Access</a><a href="#channels">Channels</a><a href="#evidence">Evidence</a><a href="#notifications">Notifications</a>{canManageActiveProject ? <a href="#danger-zone">Danger zone</a> : null}
            </nav>
            <section className="track-settings-panel">
              <div className="track-settings-section" id="general"><span className="mono-label">General</span><h3>Project details</h3><p>{item.project.description?.trim() || "No project description has been added."}</p></div>
              {canManageActiveProject ? <div className="track-settings-section" id="members"><span className="mono-label">Members</span><h3>Project membership</h3><p>Project roles and membership are managed independently from company membership.</p></div> : null}
              <div className="track-settings-section" id="access"><span className="mono-label">Project access</span><h3>Access and roles</h3><p>Companies, project members, roles, channel access, pending access, and archived access remain separate.</p></div>
              <div className="track-settings-section" id="channels"><span className="mono-label">Channels</span><h3>Channel access</h3><p>Channel membership inherits this project’s access boundary.</p></div>
              <div className="track-settings-section" id="evidence"><span className="mono-label">Evidence</span><h3>Evidence access</h3><p>Evidence remains scoped to its source project, channel, message, and thread.</p></div>
              <div className="track-settings-section" id="notifications"><span className="mono-label">Notifications</span><h3>Notification preferences</h3><p>Project notification controls are kept separate from access management.</p></div>
              {canManageActiveProject ? <div className="track-settings-section track-danger-zone" id="danger-zone"><span className="mono-label">Danger zone</span><h3>Archive and company exit</h3><p>Archive-specific actions are available in Project controls to authorized managers.</p></div> : null}
            </section>
          </div>
        ) : (
          <>
        <header>
          <div>
            <span className="company-eyebrow">Channel</span>
            <h2>{activeChannel?.name ?? "Select a Channel"}</h2>
          </div>
          {readOnly ? (
            <span className="company-read-only">Read only</span>
          ) : null}
        </header>
        {activeChannelId && !releaseConfig.threads ? (
          <section className="track-feature-unavailable" role="status">
            <strong>Threads are unavailable</strong>
            <span>This project feature is disabled for the current environment.</span>
          </section>
        ) : null}
        <div className="company-message-list" role="log">
          {messages === undefined && activeChannelId ? (
            <p>Loading messages…</p>
          ) : messages?.length === 0 ? (
            <div className="company-message-empty">
              <span aria-hidden="true"><MessageSquareText size={18} /></span>
              <strong>No messages yet</strong>
              <p>Start the conversation below. New tasks and evidence can stay linked to what is discussed here.</p>
            </div>
          ) : (
            messages
              ?.slice()
              .reverse()
              .map((detail) => (
                <article id={`message-${detail.message._id}`} key={detail.message._id} tabIndex={-1}>
                  <div>
                    <strong>
                      {detail.author?.displayName ?? "Unknown member"}
                    </strong>
                    {detail.authorCompany ? (
                      <span className="company-badge">
                        {detail.authorCompany.displayName}
                      </span>
                    ) : null}
                    <time>
                      {new Date(detail.message.createdAt).toLocaleString()}
                    </time>
                  </div>
                  {editingMessageId === detail.message._id ? (
                    <form
                      className="company-message-edit"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEditedMessage(detail.message._id);
                      }}
                    >
                      <label className="sr-only" htmlFor={`edit-message-${detail.message._id}`}>Edit message</label>
                      <Input
                        autoFocus
                        id={`edit-message-${detail.message._id}`}
                        onChange={(event) => setEditingMessageBody(event.target.value)}
                        value={editingMessageBody}
                      />
                      <Button disabled={busy || !editingMessageBody.trim()} type="submit">Save</Button>
                      <Button
                        disabled={busy}
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditingMessageBody("");
                        }}
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : <p>{detail.message.body || "Attachment message"}</p>}
                  {!readOnly &&
                  (detail.message.authorProjectMemberId
                    ? detail.message.authorProjectMemberId === projectMemberId
                    : detail.message.authorId === currentUser?._id) ? (
                    <div className="company-message-actions">
                      <Button disabled={busy} onClick={() => beginEditingMessage(detail.message._id, detail.message.body)} variant="outline">Edit</Button>
                      {pendingDeleteMessageId === detail.message._id ? <>
                        <span role="status">Delete this message?</span>
                        <Button disabled={busy} onClick={() => void deleteAuthoredMessage(detail.message._id)} variant="destructive">Confirm delete</Button>
                        <Button disabled={busy} onClick={() => setPendingDeleteMessageId(null)} variant="outline">Cancel</Button>
                      </> : (
                        <Button disabled={busy} onClick={() => setPendingDeleteMessageId(detail.message._id)} variant="destructive">Delete</Button>
                      )}
                    </div>
                  ) : null}
                  {releaseConfig.tasks && !readOnly ? (
                    <CreateTaskFromMessage
                      identity={{ actingCompanyId, projectMemberId }}
                      message={detail.message}
                    />
                  ) : null}
                  {releaseConfig.tasks ? (
                    <MessageInlineTasks
                      identity={{ actingCompanyId, projectMemberId }}
                      message={detail.message}
                    />
                  ) : null}
                  {releaseConfig.threads && detail.channelThread ? (
                    <a href={threadHref(projectId, activeChannelId!, detail.channelThread.threadId, {
                      actingCompanyId,
                      projectMemberId,
                    })}>
                      {detail.channelThread.name} · {detail.channelThread.replyCount} replies
                    </a>
                  ) : null}
                </article>
              ))
          )}
        </div>
        {activeChannelId && !readOnly ? (
          <form
            className="company-composer"
            onSubmit={(event) => void submitMessage(event)}
          >
            <label className="sr-only" htmlFor="company-message">
              Message
            </label>
            <Input
              id="company-message"
              onChange={(event) => setComposer(event.target.value)}
              placeholder={`Message #${activeChannel?.name ?? "Channel"}`}
              value={composer}
            />
            <Button disabled={!composer.trim()} type="submit">
              Send
            </Button>
          </form>
        ) : null}
          </>
        )}
      </section>

      {showProjectRail ? <aside aria-label="Project controls" aria-modal={controlsDrawerOpen || undefined} className={`company-project-admin${controlsDrawerOpen ? " drawer-open" : ""}`} id="company-controls-drawer" ref={controlsDrawerRef} role={controlsDrawerOpen ? "dialog" : undefined}>
        <Button className="company-drawer-close" onClick={() => setControlsDrawerOpen(false)} type="button" variant="outline">Close controls</Button>
        <h2>{view === "settings" ? "Project administration" : "Project context"}</h2>
        {view === "channels" && activeChannel ? (
          <section aria-labelledby="company-references-heading" className="company-project-references">
            <header>
              <div><h3 id="company-references-heading">Recent references</h3><p>Files shared in #{activeChannel.name}</p></div>
              {recentReferences.length ? <span>{recentReferences.length}</span> : null}
            </header>
            {recentReferences.length ? (
              <ul>
                {recentReferences.map(({ attachment, author, createdAt, url }) => {
                  const sharedAt = new Date(createdAt);
                  const content = <>
                    <span className="company-project-reference-icon"><AttachmentTypeIcon contentType={attachment.contentType} filename={attachment.filename} /></span>
                    <span className="company-project-reference-copy"><strong title={attachment.filename}>{attachment.filename}</strong><small><span>{author}</span><span aria-hidden="true">·</span><time dateTime={sharedAt.toISOString()}>{sharedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></small></span>
                    {url ? <ArrowUpRight aria-hidden="true" size={14} /> : null}
                  </>;
                  return <li key={attachment._id}>{url ? <a aria-label={`Open ${attachment.filename} in a new tab`} href={url} rel="noreferrer" target="_blank">{content}</a> : <span>{content}</span>}</li>;
                })}
              </ul>
            ) : (
              <div className="company-project-references-empty" role="status"><span><Paperclip aria-hidden="true" size={15} /></span><div><strong>No references yet</strong><p>Files shared in this channel will appear here.</p></div></div>
            )}
          </section>
        ) : null}
        {view === "channels" && activeChannel && releaseConfig.tasks ? (
          <ChannelTaskPanel group={activeChannel} identity={{ actingCompanyId, projectMemberId }} variant="rail" />
        ) : null}
        {view === "channels" && releaseConfig.threads && activeChannelId && currentUser ? (
          <ChannelThreadBrowser
            context={{ actingCompanyId, projectMemberId }}
            groupId={activeChannelId}
            projectId={projectId}
            readOnly={readOnly}
            timelineMessages={messages ?? []}
            userId={currentUser._id}
            variant="rail"
          />
        ) : null}
        {view === "settings" ? <>
        {projectMembers ? (
          <>
            <h3>Your Company members</h3>
            <ul>
              {projectMembers.map(({ membership, user }) => (
                <li key={membership._id}>
                  {user?.displayName} <span>{projectRoleLabel(membership.role)}</span>
                  {membership._id !== projectMemberId ? (
                    <Button
                      onClick={() =>
                        void run(() =>
                          updateProjectMember({
                            actingCompanyId,
                            projectId,
                            projectMemberId,
                            targetProjectMemberId: membership._id,
                            status:
                              membership.status === "active"
                                ? "suspended"
                                : "active",
                          }),
                        )
                      }
                      variant="outline"
                    >
                      {membership.status === "active"
                        ? "Suspend"
                        : "Reactivate"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <h3>Add your Company members</h3>
            {(companyMembers ?? [])
              .filter(
                ({ membership }) =>
                  membership.status === "active" &&
                  !projectMembers.some(
                    (row) => row.membership.userId === membership.userId,
                  ),
              )
              .map(({ membership, user }) => (
                <Button
                  key={membership._id}
                  onClick={() =>
                    void run(() =>
                      addProjectMember({
                        actingCompanyId,
                        projectId,
                        projectMemberId,
                        role: "member",
                        userId: membership.userId,
                      }),
                    )
                  }
                  variant="outline"
                >
                  Add {user?.displayName ?? "Company member"}
                </Button>
              ))}
          </>
        ) : null}
        {channelParticipationInvitations?.map((request) => (
          <div className="company-admin-card" key={request._id}>
            <strong>Channel participation requested</strong>
            <p>
              The requesting Company selected{" "}
              {request.selectedProjectMemberIds.length} member(s).
            </p>
            <Button
              onClick={() =>
                void run(() =>
                  decideChannelParticipation({
                    actingCompanyId,
                    decision: "accept",
                    groupId: request.groupId,
                    projectId,
                    projectMemberId,
                    requestId: request._id,
                    selectedProjectMemberIds: request.selectedProjectMemberIds,
                  }),
                )
              }
            >
              Accept for Company
            </Button>
            <Button
              onClick={() =>
                void run(() =>
                  decideChannelParticipation({
                    actingCompanyId,
                    decision: "decline",
                    groupId: request.groupId,
                    projectId,
                    projectMemberId,
                    requestId: request._id,
                    selectedProjectMemberIds: [],
                  }),
                )
              }
              variant="outline"
            >
              Decline
            </Button>
          </div>
        ))}
        {participationOptions?.map((option) => (
          <div className="company-admin-card" key={option.projectCompany._id}>
            <strong>
              Add {option.company?.displayName} to #{activeChannel?.name}
            </strong>
            <p>
              {option.members.length} Project member(s) will be selected for
              their manager to confirm.
            </p>
            <Button
              onClick={() =>
                void run(() =>
                  requestChannelParticipation({
                    actingCompanyId,
                    groupId: activeChannelId!,
                    idempotencyKey: crypto.randomUUID(),
                    projectId,
                    projectMemberId,
                    selectedProjectMemberIds: option.members.map(
                      ({ membership }) => membership._id,
                    ),
                    targetProjectCompanyId: option.projectCompany._id,
                  }),
                )
              }
              variant="outline"
            >
              Request participation
            </Button>
          </div>
        ))}
        {pendingChannelArchives?.map((request) => (
          <div className="company-admin-card" key={request._id}>
            <strong>
              {request.operation === "archive"
                ? "Channel archive"
                : "Channel restore"}{" "}
              requested
            </strong>
            <Button
              onClick={() =>
                void run(() =>
                  approveChannelArchive({
                    actingCompanyId,
                    groupId: request.groupId,
                    projectId,
                    projectMemberId,
                    requestId: request._id,
                  }),
                )
              }
            >
              Approve for Company
            </Button>
            <Button
              onClick={() =>
                void run(() =>
                  cancelChannelArchive({
                    actingCompanyId,
                    groupId: request.groupId,
                    projectId,
                    projectMemberId,
                    requestId: request._id,
                  }),
                )
              }
              variant="outline"
            >
              Cancel request
            </Button>
          </div>
        ))}
        {activeChannelId &&
        isChannelSteward &&
        activeChannel?.kind !== "general" &&
        (activeChannel.status === "active" ||
          activeChannel.status === "archived") &&
        !pendingChannelArchives?.length ? (
          <Button
            onClick={() =>
              void run(async () => {
                const requestId = await requestChannelArchive({
                  actingCompanyId,
                  groupId: activeChannelId,
                  idempotencyKey: crypto.randomUUID(),
                  operation:
                    activeChannel.status === "archived" ? "restore" : "archive",
                  projectId,
                  projectMemberId,
                });
                await approveChannelArchive({
                  actingCompanyId,
                  groupId: activeChannelId,
                  projectId,
                  projectMemberId,
                  requestId,
                });
              })
            }
            variant="outline"
          >
            Request Channel{" "}
            {activeChannel.status === "archived" ? "restore" : "archive"}
          </Button>
        ) : null}
        {pendingProjectArchives?.map((request) => (
          <div className="company-admin-card" key={request._id}>
            <strong>
              {request.operation === "archive" ? "Archive" : "Restore"} approval
              requested
            </strong>
            <Button
              onClick={() =>
                void run(() =>
                  approveProjectArchive({
                    actingCompanyId,
                    projectId,
                    projectMemberId,
                    requestId: request._id,
                  }),
                )
              }
            >
              Approve for Company
            </Button>
          </div>
        ))}
        {isActiveProjectManager &&
        (item.project.status === "active" ||
          item.project.status === "archived") ? (
          <Button
            onClick={() =>
              void run(async () => {
                const requestId = await requestProjectArchive({
                  actingCompanyId,
                  idempotencyKey: crypto.randomUUID(),
                  operation:
                    item.project.status === "archived" ? "restore" : "archive",
                  projectId,
                  projectMemberId,
                });
                await approveProjectArchive({
                  actingCompanyId,
                  projectId,
                  projectMemberId,
                  requestId,
                });
              })
            }
            variant="outline"
          >
            Request Project{" "}
            {item.project.status === "archived" ? "restore" : "archive"}
          </Button>
        ) : null}
        {item.project.origin === "shared" &&
        item.membership.status === "active" &&
        exitStatus?.status === "active" ? (
          <Button
            onClick={() =>
              void run(() => prepareExit({ actingCompanyId, projectId }))
            }
            variant="destructive"
          >
            Start Company exit
          </Button>
        ) : null}
        {exitStatus?.status === "active" &&
        exitStatus.snapshotError?.startsWith("snapshot_cleanup") ? (
          <div className="company-admin-card">
            <strong>Exit snapshot cleanup needs attention</strong>
            <p>{exitStatus.snapshotError}</p>
            <Button
              onClick={() =>
                void run(() => retryExitCleanup({ actingCompanyId, projectId }))
              }
              variant="outline"
            >
              Retry cleanup
            </Button>
          </div>
        ) : null}
        {exitStatus?.status === "exit_pending" ? (
          <div className="company-admin-card">
            <strong>Company exit prepared</strong>
            <p>Snapshot: {exitStatus.snapshotStatus ?? "pending"}</p>
            {exitStatus.snapshotError ? (
              <p>{exitStatus.snapshotError}</p>
            ) : null}
            <Button
              disabled={exitStatus.snapshotStatus !== "verified"}
              onClick={() =>
                void run(() => finalizeExit({ actingCompanyId, projectId }))
              }
            >
              Finalize exit
            </Button>
            <Button
              onClick={() =>
                void run(() => retryExit({ actingCompanyId, projectId }))
              }
              variant="outline"
            >
              Retry snapshot
            </Button>
            <Button
              onClick={() =>
                void run(() => cancelExit({ actingCompanyId, projectId }))
              }
              variant="outline"
            >
              Cancel safely
            </Button>
          </div>
        ) : null}
        </> : null}
      </aside> : null}
    </main>
  );
}
