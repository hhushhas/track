import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useReleaseConfig } from "#/lib/release-config";
import { ChannelTaskPanel, CreateTaskFromMessage, MessageInlineTasks } from "#/features/tasks/ConversationTaskActions";
import { ChannelThreadBrowser } from "#/features/threads/ChannelThreadBrowser";
import { threadHref } from "#/features/threads/thread-navigation";

type Props = {
  actingCompanyId: Id<"companies">;
  initialGroupId?: Id<"groups">;
  projectId: Id<"projects">;
  projectMemberId: Id<"projectMembers">;
};

export function CompanyProjectPage({
  actingCompanyId,
  initialGroupId,
  projectId,
  projectMemberId,
}: Props) {
  const releaseConfig = useReleaseConfig();
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
  const exitStatus = useQuery(
    api.projectExit.getStatus,
    releaseConfig.companyModel
      ? { actingCompanyId, projectId, projectMemberId }
      : "skip",
  );
  const canReadChannels =
    exitStatus != null && exitStatus.status !== "exit_pending";
  const canManageActiveProject =
    exitStatus?.status === "active" &&
    item?.membership.role === "manager" &&
    item.membership.status === "active";
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
    api.companies.getAdministration,
    canManageActiveProject
      ? { companyId: actingCompanyId }
      : "skip",
  );
  const pendingProjectArchives = useQuery(
    api.projectArchives.listPending,
    canManageActiveProject
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
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
  const deleteMessage = useMutation(api.messages.remove);
  const requestProjectArchive = useMutation(api.projectArchives.request);
  const approveProjectArchive = useMutation(api.projectArchives.approve);
  const prepareExit = useMutation(api.projectExit.prepare);
  const retryExit = useMutation(api.projectExit.retrySnapshot);
  const retryExitCleanup = useMutation(api.projectExit.retryCleanup);
  const finalizeExit = useMutation(api.projectExit.finalize);
  const cancelExit = useMutation(api.projectExit.cancel);

  useEffect(() => {
    if (
      activeChannelId &&
      channels?.some(
        (entry) =>
          ("channel" in entry && entry.channel._id === activeChannelId) ||
          ("_id" in entry && entry._id === activeChannelId),
      )
    )
      return;
    const first = channels?.[0];
    setActiveChannelId(
      first
        ? "channel" in first
          ? first.channel._id
          : (first._id as Id<"groups">)
        : null,
    );
  }, [activeChannelId, channels]);
  useEffect(() => {
    if (!messages || typeof window === "undefined" || !window.location.hash.startsWith("#message-")) return;
    requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [messages]);

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
    item?.project.status === "archived" ||
    Boolean(activeChannel && activeChannel.status !== "active");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice("Saved.");
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
    );
    if (saved) setComposer("");
  }

  async function deleteAuthoredMessage(messageId: Id<"messages">) {
    if (!currentUser || !window.confirm("Delete this message? This can’t be undone.")) return;
    await run(() =>
      deleteMessage({
        actingCompanyId,
        actorId: currentUser._id,
        messageId,
        projectMemberId,
      }),
    );
  }

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
    <main aria-busy={busy} className="company-project-shell">
      <aside className="company-channel-sidebar">
        <Link to="/workspace/company">← Company hub</Link>
        <h1>{item.project.name}</h1>
        <span className="company-badge">
          {item.membership.companyDisplayNameSnapshot} · {item.membership.role}
        </span>
        {item.membership.status === "archived" ? (
          <p className="company-read-only">Read-only exit archive</p>
        ) : null}
        {releaseConfig.tasks ? (
          <Link
            params={{ projectId }}
            search={{
              actingCompanyId,
              projectMemberId,
              view: "board",
            }}
            to="/workspace/projects/$projectId/tasks"
          >
            Tasks
          </Link>
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
              onClick={() => setActiveChannelId(channel._id)}
              type="button"
            >
              # {channel.name}
              {channel.status === "archived" ? " · archived" : ""}
              {threadUnreadByChannel.get(channel._id)
                ? ` · ${threadUnreadByChannel.get(channel._id)} unread ${threadUnreadByChannel.get(channel._id) === 1 ? "thread" : "threads"}`
                : ""}
            </button>
          ))}
        </nav>
        {item.membership.role === "manager" &&
        item.membership.status === "active" ? (
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
              aria-label="New Channel name"
              onChange={(event) => setChannelName(event.target.value)}
              placeholder="New Channel"
              required
              value={channelName}
            />
            <Button type="submit">Create Channel</Button>
          </form>
        ) : null}
      </aside>

      <section className="company-conversation">
        <header>
          <div>
            <span className="company-eyebrow">Channel</span>
            <h2>{activeChannel?.name ?? "Select a Channel"}</h2>
          </div>
          {readOnly ? (
            <span className="company-read-only">Read only</span>
          ) : null}
        </header>
        {notice ? (
          <p aria-live="polite" className="company-notice">
            {notice}
          </p>
        ) : null}
        {activeChannel && releaseConfig.tasks ? <ChannelTaskPanel group={activeChannel} identity={{ actingCompanyId, projectMemberId }} /> : null}
        {releaseConfig.threads && activeChannelId && currentUser ? (
          <ChannelThreadBrowser
            context={{ actingCompanyId, projectMemberId }}
            groupId={activeChannelId}
            projectId={projectId}
            readOnly={readOnly}
            timelineMessages={messages ?? []}
            userId={currentUser._id}
          />
        ) : null}
        <div className="company-message-list" role="log">
          {messages === undefined && activeChannelId ? (
            <p>Loading messages…</p>
          ) : messages?.length === 0 ? (
            <p>No messages yet.</p>
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
                  <p>{detail.message.body || "Attachment message"}</p>
                  {!readOnly &&
                  (detail.message.authorProjectMemberId
                    ? detail.message.authorProjectMemberId === projectMemberId
                    : detail.message.authorId === currentUser?._id) ? (
                    <Button
                      disabled={busy}
                      onClick={() => void deleteAuthoredMessage(detail.message._id)}
                      variant="destructive"
                    >
                      Delete
                    </Button>
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
      </section>

      <aside className="company-project-admin">
        <h2>Project controls</h2>
        {projectMembers ? (
          <>
            <h3>Your Company members</h3>
            <ul>
              {projectMembers.map(({ membership, user }) => (
                <li key={membership._id}>
                  {user?.displayName} <span>{membership.role}</span>
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
            {companyMembers?.members
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
                  Add {user?.displayName ?? membership.userDisplayNameSnapshot}
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
        {item.membership.role === "manager" &&
        item.membership.status === "active" ? (
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
      </aside>
    </main>
  );
}
