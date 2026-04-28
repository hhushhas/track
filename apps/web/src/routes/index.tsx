import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  Bell,
  Bot,
  Check,
  Clock3,
  Download,
  FileText,
  MessageSquarePlus,
  Paperclip,
  Play,
  Plus,
  Send,
  Settings,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ReactNode } from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { parseMentions } from '@track/shared'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/')({ component: App })

const notificationModes = ['inherit', 'all', 'mentions', 'none'] as const

function App() {
  const session = authClient.useSession()
  const ensureCurrentUser = useMutation(api.auth.ensureCurrentUser)
  const ensureStarterProject = useMutation(api.projects.ensureStarter)
  const createProject = useMutation(api.projects.create)
  const createGroup = useMutation(api.groups.create)
  const createInvitation = useMutation(api.invitations.create)
  const acceptPendingInvitations = useMutation(api.invitations.acceptPendingForCurrentUser)
  const updateGroupAiReviewSettings = useMutation(api.groups.updateAiReviewSettings)
  const sendMessageMutation = useMutation(api.messages.send)
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl)
  const attachFileMutation = useMutation(api.messages.attachFile)
  const runReviewMutation = useMutation(api.ai.runReviewNow)
  const classifyDraftMutation = useMutation(api.records.classifyDraft)
  const updateRecordStatus = useMutation(api.records.updateStatus)
  const askTrackMutation = useMutation(api.assistant.ask)
  const setGlobalNotificationMode = useMutation(api.notifications.setGlobalMode)
  const setGroupNotificationMode = useMutation(api.notifications.setGroupMode)
  const requestExport = useMutation(api.exports.request)

  const [trackUserId, setTrackUserId] = useState<Id<'users'> | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<Id<'projects'> | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<Id<'groups'> | null>(null)
  const [latestExportId, setLatestExportId] = useState<Id<'exports'> | null>(null)
  const [composer, setComposer] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [uiError, setUiError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const trackUser = useQuery(api.auth.getCurrentUser)
  const projects = useQuery(
    api.projects.list,
    trackUserId ? { userId: trackUserId } : 'skip',
  )
  const groups = useQuery(
    api.groups.listVisible,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const messages = useQuery(
    api.messages.listDetailed,
    trackUserId && activeGroupId
      ? { userId: trackUserId, groupId: activeGroupId, limit: 80 }
      : 'skip',
  )
  const drafts = useQuery(
    api.records.listDrafts,
    trackUserId && activeProjectId && activeGroupId
      ? { userId: trackUserId, projectId: activeProjectId, groupId: activeGroupId }
      : 'skip',
  )
  const records = useQuery(
    api.records.listProjectRecords,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const latestReview = useQuery(
    api.ai.latestForGroup,
    trackUserId && activeGroupId ? { userId: trackUserId, groupId: activeGroupId } : 'skip',
  )
  const assistantStreams = useQuery(
    api.assistant.listForGroup,
    trackUserId && activeGroupId
      ? { userId: trackUserId, groupId: activeGroupId, limit: 20 }
      : 'skip',
  )
  const notificationSettings = useQuery(
    api.notifications.getSettings,
    trackUserId ? { userId: trackUserId } : 'skip',
  )
  const auditEvents = useQuery(
    api.audit.listProjectEvents,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId, limit: 30 }
      : 'skip',
  )
  const invitations = useQuery(
    api.invitations.listForProject,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const exports = useQuery(
    api.exports.list,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const exportDownloadUrl = useQuery(
    api.exports.getDownloadUrl,
    trackUserId && latestExportId ? { userId: trackUserId, exportId: latestExportId } : 'skip',
  )

  const projectItems = useMemo(
    () =>
      (projects ?? []) as Array<{
        project: Doc<'projects'>
        membership: Doc<'projectMembers'>
      }>,
    [projects],
  )
  const visibleGroups = useMemo(() => (groups ?? []) as Array<Doc<'groups'>>, [groups])
  const groupMessages = useMemo(
    () =>
      (messages ?? []) as Array<{
        message: Doc<'messages'>
        author: Doc<'users'> | null
        attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>
      }>,
    [messages],
  )
  const groupDrafts = useMemo(() => (drafts ?? []) as Array<Doc<'draftRecords'>>, [drafts])
  const projectRecords = useMemo(() => (records ?? []) as Array<Doc<'records'>>, [records])
  const groupAssistantStreams = useMemo(
    () => (assistantStreams ?? []) as Array<Doc<'assistantStreams'>>,
    [assistantStreams],
  )
  const projectAuditEvents = useMemo(
    () => (auditEvents ?? []) as Array<Doc<'auditEvents'>>,
    [auditEvents],
  )
  const projectInvitations = useMemo(
    () => (invitations ?? []) as Array<Doc<'invitations'>>,
    [invitations],
  )
  const projectExports = useMemo(() => (exports ?? []) as Array<Doc<'exports'>>, [exports])
  const groupNotificationSettings = useMemo(
    () => (notificationSettings?.groups ?? []) as Array<Doc<'groupNotificationSettings'>>,
    [notificationSettings?.groups],
  )
  const latestCompletedExport =
    projectExports.find((exportJob) => exportJob.status === 'completed') ?? null

  useEffect(() => {
    if (!session.data || trackUserId) return
    void ensureCurrentUser()
      .then(async (userId) => {
        setTrackUserId(userId)
        await acceptPendingInvitations({ userId })
      })
      .catch(setActionError)
  }, [acceptPendingInvitations, ensureCurrentUser, session.data, trackUserId])

  useEffect(() => {
    if (trackUser?._id && trackUser._id !== trackUserId) {
      setTrackUserId(trackUser._id)
    }
  }, [trackUser?._id, trackUserId])

  useEffect(() => {
    if (!trackUserId || projects === undefined || projectItems.length > 0) return
    void ensureStarterProject({ userId: trackUserId })
      .then((projectId) => setActiveProjectId(projectId))
      .catch(setActionError)
  }, [ensureStarterProject, projectItems.length, projects, trackUserId])

  useEffect(() => {
    if (!projectItems.length || activeProjectId) return
    setActiveProjectId(projectItems[0]?.project._id ?? null)
  }, [activeProjectId, projectItems])

  useEffect(() => {
    if (!visibleGroups.length) {
      setActiveGroupId(null)
      return
    }
    if (!activeGroupId || !visibleGroups.some((group) => group._id === activeGroupId)) {
      setActiveGroupId(visibleGroups[0]?._id ?? null)
    }
  }, [activeGroupId, visibleGroups])

  useEffect(() => {
    if (!latestCompletedExport || latestExportId) return
    setLatestExportId(latestCompletedExport._id)
  }, [latestCompletedExport, latestExportId])

  const activeProject = projectItems.find((item) => item.project._id === activeProjectId)
  const activeGroup = visibleGroups.find((group) => group._id === activeGroupId)
  const visibleMessages = useMemo(() => [...groupMessages].reverse(), [groupMessages])
  const pendingDrafts = useMemo(
    () => groupDrafts.filter((draft) => draft.status === 'pending'),
    [groupDrafts],
  )
  const groupNotificationMode =
    groupNotificationSettings.find((item) => item.groupId === activeGroupId)?.mode ?? 'inherit'
  const globalNotificationMode = notificationSettings?.global?.globalMode ?? 'mentions'

  if (session.isPending) return <TrackLoading label="Checking your session" />
  if (!session.data) return <Navigate to="/sign-in" />

  function setActionError(error: unknown) {
    setUiError(error instanceof Error ? error.message : 'Something went wrong')
  }

  async function withBusy(label: string, action: () => Promise<unknown>) {
    setBusyAction(label)
    setUiError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleCreateProject() {
    if (!trackUserId) return
    const name = window.prompt('Project name')
    if (!name?.trim()) return
    const clientLabel = window.prompt('Client/company label') ?? undefined
    await withBusy('create-project', async () => {
      const projectId = await createProject({
        userId: trackUserId,
        name: name.trim(),
        clientLabel: clientLabel?.trim() || undefined,
      })
      setActiveProjectId(projectId)
      setActiveGroupId(null)
    })
  }

  async function handleCreateGroup() {
    if (!trackUserId || !activeProjectId) return
    const name = window.prompt('Group name')
    if (!name?.trim()) return
    await withBusy('create-group', async () => {
      const groupId = await createGroup({
        userId: trackUserId,
        projectId: activeProjectId,
        name: name.trim(),
      })
      setActiveGroupId(groupId)
    })
  }

  async function handleInvite() {
    if (!trackUserId || !activeProjectId) return
    const email = window.prompt('Invite email')
    if (!email?.trim()) return
    const roleInput = window.prompt('Role: admin, staff, or client', 'staff') ?? 'staff'
    const role = roleInput.trim().toLowerCase()
    if (role !== 'admin' && role !== 'staff' && role !== 'client') {
      setUiError('Invite role must be admin, staff, or client.')
      return
    }
    const reviewer = window.confirm('Can this person approve/decline Track Draft Records?')
    const groupScoped = activeGroupId
      ? window.confirm(`Invite directly to ${activeGroup?.name ?? 'this Group'} only?`)
      : false

    await withBusy('invite', async () => {
      await createInvitation({
        projectId: activeProjectId,
        groupId: groupScoped && activeGroupId ? activeGroupId : undefined,
        invitedBy: trackUserId,
        email: email.trim(),
        role,
        canReviewAiRecords: reviewer,
      })
    })
  }

  async function handleSendMessage() {
    if (!trackUserId || !activeProjectId || !activeGroupId) return
    const body = composer.trim()
    if (!body) return
    setComposer('')
    await withBusy('send-message', async () => {
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body,
        mentions: [],
      })
      if (parseMentions(body).includes('track')) {
        await askTrackMutation({
          projectId: activeProjectId,
          groupId: activeGroupId,
          requesterId: trackUserId,
          promptMessageId: messageId,
          question: body,
        })
      }
    })
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !trackUserId || !activeProjectId || !activeGroupId) return
    await withBusy('attach-file', async () => {
      const uploadUrl = await generateUploadUrl({
        groupId: activeGroupId,
        userId: trackUserId,
      })
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!uploadResponse.ok) throw new Error('upload_failed')
      const { storageId } = (await uploadResponse.json()) as { storageId: Id<'_storage'> }
      const messageId = await sendMessageMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        authorId: trackUserId,
        body: composer.trim() || `Attached ${file.name}`,
        mentions: [],
      })
      await attachFileMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        messageId,
        userId: trackUserId,
        storageId,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      })
      setComposer('')
    })
  }

  async function handleRunReview() {
    if (!trackUserId || !activeProjectId || !activeGroupId) return
    await withBusy('run-review', async () => {
      await runReviewMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        reviewerId: trackUserId,
      })
    })
  }

  async function handleFrequencyChange() {
    if (!trackUserId || !activeProjectId || !activeGroupId || !activeGroup) return
    const current = activeGroup.aiReviewSettings?.frequencyMinutes ?? 30
    const input = window.prompt('AI review frequency in minutes', String(current))
    if (!input) return
    const frequencyMinutes = Number(input)
    if (!Number.isFinite(frequencyMinutes)) {
      setUiError('Frequency must be a number.')
      return
    }
    await withBusy('review-frequency', async () => {
      await updateGroupAiReviewSettings({
        projectId: activeProjectId,
        groupId: activeGroupId,
        userId: trackUserId,
        enabled: activeGroup.aiReviewSettings?.enabled ?? true,
        frequencyMinutes,
      })
    })
  }

  async function handleRecordStatus(
    recordId: Id<'records'>,
    status: 'open' | 'in_progress' | 'blocked' | 'done',
  ) {
    if (!trackUserId || !activeProjectId) return
    await withBusy(`record-status-${recordId}`, async () => {
      await updateRecordStatus({
        projectId: activeProjectId,
        recordId,
        actorId: trackUserId,
        status,
      })
    })
  }

  async function handleRequestExport(format: 'csv' | 'pdf') {
    if (!trackUserId || !activeProjectId) return
    await withBusy(`export-${format}`, async () => {
      const exportId = await requestExport({
        projectId: activeProjectId,
        userId: trackUserId,
        format,
        preset: format === 'pdf' ? 'full_audit_packet' : 'client_summary',
      })
      setLatestExportId(exportId)
    })
  }

  async function handleClassifyDraft(
    draftRecordId: Id<'draftRecords'>,
    classification: 'official_record' | 'billable_scope' | 'informational' | 'ignored',
  ) {
    if (!trackUserId || !activeProjectId || !activeGroupId) return
    await withBusy(`classify-${draftRecordId}`, async () => {
      await classifyDraftMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        draftRecordId,
        reviewerId: trackUserId,
        classification,
        status: classification === 'ignored' ? 'declined' : 'accepted',
      })
    })
  }

  async function handleNotificationMode(mode: (typeof notificationModes)[number]) {
    if (!trackUserId) return
    await withBusy('notifications', async () => {
      if (mode === 'inherit') {
        if (!activeGroupId) return
        await setGroupNotificationMode({ userId: trackUserId, groupId: activeGroupId, mode })
        return
      }
      if (activeGroupId) {
        await setGroupNotificationMode({ userId: trackUserId, groupId: activeGroupId, mode })
      } else {
        await setGlobalNotificationMode({ userId: trackUserId, mode })
      }
    })
  }

  return (
    <main className="track-app-shell">
      <aside className="track-nav">
        <div className="track-brand">
          <span className="track-brand-mark">T</span>
          <span>
            <span className="track-brand-name">Track</span>
            <span className="track-brand-sub">project memory</span>
          </span>
        </div>

        <NavSection
          actionLabel="Create project"
          icon={<Plus size={14} />}
          label="Projects"
          onAction={handleCreateProject}
        />
        <div className="track-nav-list">
          {projectItems.map((item) => (
            <button
              className={
                item.project._id === activeProjectId ? 'track-nav-item active' : 'track-nav-item'
              }
              key={item.project._id}
              onClick={() => {
                setActiveProjectId(item.project._id)
                setActiveGroupId(null)
              }}
              type="button"
            >
              <span className="track-nav-dot" />
              <span className="track-nav-copy">
                <span className="track-nav-title">{item.project.name}</span>
                <span className="track-nav-meta">{item.project.clientLabel ?? 'No client label'}</span>
              </span>
              <span className="track-nav-count">{item.membership.role}</span>
            </button>
          ))}
        </div>

        <NavSection
          actionLabel="Create group"
          icon={<MessageSquarePlus size={14} />}
          label="Groups"
          onAction={handleCreateGroup}
        />
        <div className="track-nav-list">
          {visibleGroups.map((group) => (
            <button
              className={group._id === activeGroupId ? 'track-nav-item active' : 'track-nav-item'}
              key={group._id}
              onClick={() => setActiveGroupId(group._id)}
              type="button"
            >
              <span className="track-nav-dot" />
              <span className="track-nav-copy">
                <span className="track-nav-title">{group.name}</span>
                <span className="track-nav-meta">{group.kind} · {group.aiReviewSettings?.frequencyMinutes ?? 30}m</span>
              </span>
            </button>
          ))}
        </div>

        <div className="track-nav-footer">
          <div className="track-avatar">{trackUser?.displayName?.slice(0, 2).toUpperCase() ?? 'T'}</div>
          <div className="track-nav-copy">
            <span className="track-nav-title">{trackUser?.displayName ?? 'Track User'}</span>
            <span className="track-nav-meta">{trackUser?.email ?? 'Signed in'}</span>
          </div>
        </div>
      </aside>

      <section className="track-workspace">
        <header className="track-thread-header">
          <div>
            <p className="mono-label m-0">
              {activeProject?.project.name ?? 'Project'} / {activeGroup?.name ?? 'Group'}
            </p>
            <h1>{activeGroup ? `${activeGroup.name} Conversation` : 'Select a Group'}</h1>
          </div>
          <div className="track-header-actions">
            <button
              className="track-button"
              disabled={!activeProjectId || busyAction === 'invite'}
              onClick={handleInvite}
              type="button"
            >
              <Users size={14} />
              Invite
            </button>
            <button
              className="track-button"
              disabled={!activeGroupId || busyAction === 'attach-file'}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Paperclip size={14} />
              Attach
            </button>
            <input
              className="track-file-input"
              onChange={(event) => void handleFileSelected(event)}
              ref={fileInputRef}
              type="file"
            />
            <button
              className="track-button track-button-accent"
              disabled={!activeGroupId || busyAction === 'run-review'}
              onClick={handleRunReview}
              type="button"
            >
              <Play size={14} />
              Run AI Review
            </button>
          </div>
        </header>

        {uiError ? <div className="track-error">{uiError}</div> : null}

        <div className="track-thread-scroll">
          <div className="track-thread">
            {activeGroup && visibleMessages.length === 0 ? (
              <div className="track-empty">
                <p className="mono-label m-0">Empty Group</p>
                <p>Only members of {activeGroup.name} can see this conversation. Send the first message to start the record.</p>
              </div>
            ) : null}

            {visibleMessages.map((message) => (
              <MessageRow key={message.message._id} item={message} />
            ))}

            {groupAssistantStreams.map((stream) => (
              <AssistantAnswer key={stream._id} stream={stream} />
            ))}

            {pendingDrafts.map((draft) => (
              <DraftRecordCard
                busy={busyAction === `classify-${draft._id}`}
                draft={draft}
                key={draft._id}
                onClassify={handleClassifyDraft}
              />
            ))}
          </div>
        </div>

        <div className="track-composer-wrap">
          <div className="track-composer">
            <textarea
              aria-label={`Message ${activeGroup?.name ?? 'Group'}`}
              disabled={!activeGroupId || busyAction === 'send-message'}
              onChange={(event) => setComposer(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSendMessage()
                }
              }}
              placeholder={`Message ${activeGroup?.name ?? 'a Group'} or ask @track...`}
              value={composer}
            />
            <div className="track-composer-bar">
              <button
                className="icon-button"
                disabled={!activeGroupId || busyAction === 'attach-file'}
                onClick={() => fileInputRef.current?.click()}
                title="Attach evidence"
                type="button"
              >
                <Paperclip size={15} />
              </button>
              <span className="track-composer-hint">Evidence stays tied to this Group.</span>
              <button
                className="track-button track-button-primary"
                disabled={!composer.trim() || !activeGroupId || busyAction === 'send-message'}
                onClick={handleSendMessage}
                type="button"
              >
                <Send size={14} />
                Send
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="track-rail">
        <section className="track-rail-section">
          <div className="track-rail-title">
            <span>
              <span className="track-rail-heading">AI Review</span>
              <span className="track-rail-sub">current Group</span>
            </span>
            <span className="track-pulse" />
          </div>
          <div className="track-review-status">
            <span>Last run</span>
            <strong>{latestReview?.finishedAt ? new Date(latestReview.finishedAt).toLocaleTimeString() : 'Never'}</strong>
          </div>
          <button
            className="track-setting-button"
            disabled={!activeGroupId || busyAction === 'review-frequency'}
            onClick={handleFrequencyChange}
            type="button"
          >
            Every {activeGroup?.aiReviewSettings?.frequencyMinutes ?? 30} minutes
          </button>
          <p className="track-muted">{latestReview?.summary ?? 'Run AI Review to propose Draft Records from this Group.'}</p>
        </section>

        <section className="track-count-grid">
          <Metric label="Drafts" value={pendingDrafts.length} />
          <Metric label="Records" value={records?.length ?? 0} />
          <Metric
            label="Billable"
            value={projectRecords.filter((record) => record.classification === 'billable_scope').length}
          />
          <Metric
            label="Open"
            value={projectRecords.filter((record) => record.status === 'open' || record.status === 'in_progress' || record.status === 'blocked').length}
          />
        </section>

        <section className="track-rail-section">
          <div className="track-rail-heading-row">
            <span className="track-rail-heading">Notifications</span>
            <Bell size={14} />
          </div>
          <p className="track-muted">Global: {globalNotificationMode}. Group: {groupNotificationMode}.</p>
          <div className="track-mode-grid">
            {notificationModes.map((mode) => (
              <button
                className={mode === groupNotificationMode ? 'track-chip active' : 'track-chip'}
                key={mode}
                onClick={() => void handleNotificationMode(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        <section className="track-rail-section">
          <div className="track-rail-heading-row">
            <span className="track-rail-heading">Project Record</span>
            <button
              className="icon-button"
              disabled={!activeProjectId || busyAction === 'export-pdf'}
              onClick={() => void handleRequestExport('pdf')}
              title="Generate audit PDF"
              type="button"
            >
              <Download size={14} />
            </button>
          </div>
          <div className="track-export-row">
            <button
              className="track-chip"
              disabled={!activeProjectId || busyAction === 'export-csv'}
              onClick={() => void handleRequestExport('csv')}
              type="button"
            >
              CSV
            </button>
            <button
              className="track-chip"
              disabled={!activeProjectId || busyAction === 'export-pdf'}
              onClick={() => void handleRequestExport('pdf')}
              type="button"
            >
              PDF
            </button>
            {exportDownloadUrl ? (
              <a className="track-export-link" href={exportDownloadUrl} rel="noreferrer" target="_blank">
                Download latest
              </a>
            ) : latestExportId ? (
              <span className="track-muted">Preparing export...</span>
            ) : null}
          </div>
          <div className="track-record-list">
            {projectRecords.slice(0, 8).map((record) => (
              <article className="track-record-item" key={record._id}>
                <div>
                  <span className="track-record-id">{record._id.slice(-6)}</span>
                  <span className={record.classification === 'billable_scope' ? 'track-badge success' : 'track-badge'}>
                    {record.classification}
                  </span>
                </div>
                <strong>{record.title}</strong>
                <p>{record.type} · {record.status}</p>
                <div className="track-record-actions">
                  {(['open', 'in_progress', 'blocked', 'done'] as const).map((status) => (
                    <button
                      className={record.status === status ? 'track-mini-button active' : 'track-mini-button'}
                      disabled={busyAction === `record-status-${record._id}`}
                      key={status}
                      onClick={() => void handleRecordStatus(record._id, status)}
                      type="button"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="track-rail-section">
          <div className="track-rail-heading-row">
            <span className="track-rail-heading">Invitations</span>
            <Upload size={14} />
          </div>
          <div className="track-audit-list">
            {projectInvitations.slice(0, 5).map((invite) => (
              <p key={invite._id}>
                <span>{invite.email}</span>
                <small>{invite.role} · {invite.status}</small>
              </p>
            ))}
            {projectInvitations.length === 0 ? <p className="track-muted">No invites yet.</p> : null}
          </div>
        </section>

        <section className="track-rail-section">
          <div className="track-rail-heading-row">
            <span className="track-rail-heading">Audit Trail</span>
            <Clock3 size={14} />
          </div>
          <div className="track-audit-list">
            {projectAuditEvents.slice(0, 8).map((event) => (
              <p key={event._id}>
                <span>{event.action}</span>
                <small>{new Date(event.createdAt).toLocaleTimeString()}</small>
              </p>
            ))}
          </div>
        </section>
      </aside>
    </main>
  )
}

function TrackLoading({ label }: { label: string }) {
  return (
    <main className="track-loading">
      <div className="track-surface rounded-md p-4 text-center">
        <p className="mono-label m-0">Track Access</p>
        <p className="m-0 mt-2 text-sm text-[var(--ink-3)]">{label}...</p>
      </div>
    </main>
  )
}

function NavSection({
  actionLabel,
  icon,
  label,
  onAction,
}: {
  actionLabel: string
  icon: ReactNode
  label: string
  onAction: () => void
}) {
  return (
    <div className="track-nav-section">
      <span>{label}</span>
      <button aria-label={actionLabel} className="track-nav-action" onClick={onAction} type="button">
        {icon}
      </button>
    </div>
  )
}

function MessageRow({
  item,
}: {
  item: {
    message: Doc<'messages'>
    author: Doc<'users'> | null
    attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>
  }
}) {
  const authorName = item.author?.displayName ?? 'Unknown Member'
  return (
    <article className="track-message-row">
      <div className="track-message-avatar">{authorName.slice(0, 2).toUpperCase()}</div>
      <div className="track-message-body">
        <div className="track-message-meta">
          <strong>{authorName}</strong>
          <span className="track-role-chip">{item.author?.email ?? 'member'}</span>
          <time>{new Date(item.message.createdAt).toLocaleTimeString()}</time>
        </div>
        <p>{item.message.body}</p>
        {item.attachments.length > 0 ? (
          <div className="track-attachment-list">
            {item.attachments.map(({ attachment, url }) =>
              url ? (
                <a href={url} key={attachment._id} rel="noreferrer" target="_blank">
                  <Paperclip size={13} />
                  {attachment.filename}
                </a>
              ) : (
                <span key={attachment._id}>
                  <Paperclip size={13} />
                  {attachment.filename}
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function AssistantAnswer({
  stream,
}: {
  stream: { answer: string; createdAt: number; evidence: Array<{ quote: string }> }
}) {
  return (
    <article className="track-assistant-row">
      <div className="track-message-avatar bot"><Bot size={14} /></div>
      <div className="track-assistant-body">
        <div className="track-message-meta">
          <strong>Track Assistant</strong>
          <span className="track-role-chip accent">evidence answer</span>
          <time>{new Date(stream.createdAt).toLocaleTimeString()}</time>
        </div>
        <p>{stream.answer}</p>
        {stream.evidence.length > 0 ? (
          <div className="track-evidence-note">
            Evidence: {stream.evidence.map((item) => item.quote).join(' · ')}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function DraftRecordCard({
  busy,
  draft,
  onClassify,
}: {
  busy: boolean
  draft: {
    _id: Id<'draftRecords'>
    type: string
    title: string
    description: string
    evidence: Array<{ quote: string }>
  }
  onClassify: (
    draftRecordId: Id<'draftRecords'>,
    classification: 'official_record' | 'billable_scope' | 'informational' | 'ignored',
  ) => Promise<void>
}) {
  return (
    <article className="track-draft-record">
      <header>
        <span className="track-draft-kicker">
          <Bot size={13} />
          Draft Record
        </span>
        <span className="track-record-id">{draft._id.slice(-6)}</span>
      </header>
      <div className="track-draft-content">
        <div className="track-draft-meta">
          <span className="track-badge accent">{draft.type}</span>
          <span className="track-badge">proposed open</span>
        </div>
        <h2>{draft.title}</h2>
        <p>{draft.description}</p>
        <div className="track-evidence-note">
          Evidence: {draft.evidence.map((item) => item.quote).join(' · ') || 'Source messages attached'}
        </div>
      </div>
      <footer>
        <button disabled={busy} onClick={() => void onClassify(draft._id, 'billable_scope')} type="button">
          <Check size={14} />
          Billable
        </button>
        <button disabled={busy} onClick={() => void onClassify(draft._id, 'official_record')} type="button">
          <FileText size={14} />
          Official
        </button>
        <button disabled={busy} onClick={() => void onClassify(draft._id, 'informational')} type="button">
          <Settings size={14} />
          Info
        </button>
        <button className="secondary" disabled={busy} onClick={() => void onClassify(draft._id, 'ignored')} type="button">
          <X size={14} />
          Ignore
        </button>
      </footer>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="track-count-cell">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
