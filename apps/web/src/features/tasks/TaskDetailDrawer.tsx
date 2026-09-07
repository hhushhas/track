import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Archive, Check, Link2, MessageSquare, Plus, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isTerminalTaskState, type TaskPriority } from '@track/shared/tasks'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '#/components/ui/sheet'
import { Textarea } from '#/components/ui/textarea'
import { MarkdownText } from '#/features/workspace/markdown'
import type { TaskIdentity } from './task-types'
import { taskError } from './TaskCreateDialog'
import {
  reconcileTaskDraft,
  taskDraftDirtyFields,
  taskDraftEquals,
  type TaskDraft,
  type TaskDraftField,
} from './task-edit-state'
import { PriorityGlyph, StateRing, TaskAvatar } from './ui/TaskVisuals'

type TaskDetail = NonNullable<FunctionReturnType<typeof api.tasks.getByKey>>
type TaskHistoryItem = FunctionReturnType<typeof api.tasks.listHistory>['page'][number]
type TaskComment = Extract<TaskHistoryItem, { body: string }>
type TaskActivity = Extract<TaskHistoryItem, { action: string }>

const emptyDraft: TaskDraft = {
  assigneeId: '',
  description: '',
  dueDate: '',
  priority: 'none',
  stateId: '',
  title: '',
}

function draftFromDetail(detail: TaskDetail): TaskDraft {
  return {
    assigneeId: detail.task.assigneeProjectMemberId ?? '',
    description: detail.task.description ?? '',
    dueDate: detail.task.dueDate ?? '',
    priority: detail.task.priority,
    stateId: detail.task.workflowStateId,
    title: detail.task.title,
  }
}

function sameIds(left: ReadonlyArray<Id<'taskLabels'>>, right: ReadonlyArray<Id<'taskLabels'>>) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

const priorities: ReadonlyArray<TaskPriority> = ['none', 'urgent', 'high', 'medium', 'low']

function taskPriorityFromInput(value: string): TaskPriority {
  return priorities.find((priority) => priority === value) ?? 'none'
}

export function TaskDetailDrawer({
  identity,
  onAnnounce,
  onOpenChange,
  projectId,
  taskKey,
}: {
  identity: TaskIdentity
  onAnnounce: (message: string) => void
  onOpenChange: (open: boolean) => void
  projectId: Id<'projects'>
  taskKey?: string
}) {
  const detail = useQuery(
    api.tasks.getByKey,
    taskKey ? { projectId, publicKey: taskKey, ...identity } : 'skip',
  )
  const boardRows = useQuery(api.taskBoards.list, taskKey ? { projectId, ...identity } : 'skip')
  const assignees = useQuery(
    api.tasks.listEligibleAssignees,
    detail ? { projectId, groupId: detail.task.groupId, ...identity } : 'skip',
  )
  const childPage = usePaginatedQuery(
    api.tasks.listChildren,
    detail ? { parentTaskId: detail.task._id, includeArchived: Boolean(detail.task.archivedAt), ...identity } : 'skip',
    { initialNumItems: 50 },
  )
  const commentPage = usePaginatedQuery(
    api.tasks.listHistory,
    detail ? { taskId: detail.task._id, kind: 'comments', ...identity } : 'skip',
    { initialNumItems: 50 },
  )
  const activityPage = usePaginatedQuery(
    api.tasks.listHistory,
    detail ? { taskId: detail.task._id, kind: 'activities', ...identity } : 'skip',
    { initialNumItems: 50 },
  )
  const referencePage = usePaginatedQuery(
    api.tasks.listReferences,
    detail ? { taskId: detail.task._id, ...identity } : 'skip',
    { initialNumItems: 50 },
  )
  const labels = useQuery(api.taskLabels.list, taskKey ? { projectId, ...identity } : 'skip')
  const updateTask = useMutation(api.tasks.update)
  const createTask = useMutation(api.tasks.create)
  const createComment = useMutation(api.taskComments.create)
  const editComment = useMutation(api.taskComments.edit)
  const archiveComment = useMutation(api.taskComments.archive)
  const setFollowing = useMutation(api.tasks.setFollowing)
  const setArchived = useMutation(api.tasks.setArchived)
  const setTaskLabels = useMutation(api.taskLabels.setTaskLabels)
  const changeScope = useMutation(api.tasks.changeScope)
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft)
  const [comment, setComment] = useState('')
  const [mentionIds, setMentionIds] = useState<Array<Id<'projectMembers'>>>([])
  const [editingComment, setEditingComment] = useState<{ id: Id<'taskComments'>; body: string; revision: number }>()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [labelIds, setLabelIds] = useState<Array<Id<'taskLabels'>>>([])
  const [scopeBoardId, setScopeBoardId] = useState('')
  const [scopeConfirmed, setScopeConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [conflictFields, setConflictFields] = useState<ReadonlyArray<TaskDraftField>>([])
  const [labelConflict, setLabelConflict] = useState(false)
  const [subtaskSaving, setSubtaskSaving] = useState(false)
  const identityKey = [
    String(projectId),
    taskKey ?? '',
    identity.actingCompanyId ? String(identity.actingCompanyId) : '',
    identity.projectMemberId ? String(identity.projectMemberId) : '',
  ].join(':')
  const draftIdentityRef = useRef<string | null>(null)
  const baselineRef = useRef<TaskDraft>(emptyDraft)
  const serverDraftRef = useRef<TaskDraft>(emptyDraft)
  const baseRevisionRef = useRef<number | null>(null)
  const baselineLabelIdsRef = useRef<Array<Id<'taskLabels'>>>([])
  const serverLabelIdsRef = useRef<Array<Id<'taskLabels'>>>([])
  const subtaskIntentRef = useRef(crypto.randomUUID())
  const subtaskPendingRef = useRef(false)

  useEffect(() => {
    if (!taskKey) {
      draftIdentityRef.current = null
      baseRevisionRef.current = null
      baselineRef.current = emptyDraft
      serverDraftRef.current = emptyDraft
      baselineLabelIdsRef.current = []
      serverLabelIdsRef.current = []
      // This effect reconciles remote task snapshots into the local draft; the
      // synchronous reset is required when the drawer identity changes so a
      // stale conflict cannot leak into the next task.
      // eslint-disable-next-line react/set-state-in-effect -- intentional because drawer identity reset must synchronously clear stale conflict state
      setConflictFields([])
      setLabelConflict(false)
      return
    }
    if (!detail) return

    const nextDraft = draftFromDetail(detail)
    const nextLabelIds = detail.labels.flatMap((label) => label ? [label._id] : [])
    if (draftIdentityRef.current !== identityKey || baseRevisionRef.current === null) {
      draftIdentityRef.current = identityKey
      baselineRef.current = nextDraft
      serverDraftRef.current = nextDraft
      baseRevisionRef.current = detail.task.revision
      baselineLabelIdsRef.current = nextLabelIds
      serverLabelIdsRef.current = nextLabelIds
      if (!taskDraftEquals(draft, nextDraft)) setDraft(nextDraft)
      if (!sameIds(labelIds, nextLabelIds)) setLabelIds(nextLabelIds)
      setConflictFields([])
      setLabelConflict(false)
      setError('')
      return
    }

    const reconciliation = reconcileTaskDraft({
      baseline: baselineRef.current,
      draft,
      nextServer: nextDraft,
      previousServer: serverDraftRef.current,
    })
    serverDraftRef.current = nextDraft
    baselineRef.current = reconciliation.baseline
    if (!taskDraftEquals(draft, reconciliation.draft)) setDraft(reconciliation.draft)

    const labelsDirty = !sameIds(labelIds, baselineLabelIdsRef.current)
    const labelsChanged = !sameIds(serverLabelIdsRef.current, nextLabelIds)
    if (!labelsDirty) {
      baselineLabelIdsRef.current = nextLabelIds
      if (!sameIds(labelIds, nextLabelIds)) setLabelIds(nextLabelIds)
    } else if (labelsChanged) {
      setLabelConflict(true)
    }
    serverLabelIdsRef.current = nextLabelIds

    if (reconciliation.conflictFields.length) setConflictFields(reconciliation.conflictFields)
    if (!reconciliation.conflictFields.length && !labelsDirty &&
      taskDraftDirtyFields(reconciliation.draft, reconciliation.baseline).length === 0) {
      baseRevisionRef.current = detail.task.revision
    }
  }, [detail, draft, identityKey, labelIds, taskKey])

  const board = boardRows?.find((item) => item.board._id === detail?.task.boardId)
  const subtasks = childPage.results.map((item) => ({
    ...item,
    terminal: item.state ? isTerminalTaskState(item.state.category) : false,
  }))
  const comments = commentPage.results.filter((item): item is TaskComment => 'body' in item)
  const activities = activityPage.results.filter((item): item is TaskActivity => 'action' in item)
  const references = referencePage.results
  const selectedState = board?.states.find((state) => state._id === draft.stateId) ?? detail?.state
  const selectedAssignee = draft.assigneeId
    ? assignees?.find((item) => item.member._id === draft.assigneeId)?.member
      ?? (detail?.assignee?._id === draft.assigneeId ? detail.assignee : null)
    : null

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!detail || !draft.stateId || conflictFields.length || labelConflict) return
    setSaving(true)
    setError('')
    try {
      const nextRevision = await updateTask({
        taskId: detail.task._id,
        expectedRevision: baseRevisionRef.current ?? detail.task.revision,
        title: draft.title,
        description: draft.description || null,
        priority: draft.priority,
        dueDate: draft.dueDate || null,
        workflowStateId: draft.stateId,
        assigneeProjectMemberId: draft.assigneeId || null,
        confirmOpenSubtasks: true,
        ...identity,
      })
      baselineRef.current = draft
      serverDraftRef.current = draft
      baseRevisionRef.current = nextRevision
      setConflictFields([])
      setLabelConflict(false)
      onAnnounce(`${detail.task.publicKey} saved.`)
    } catch (failure) {
      setError(taskError(failure))
    } finally {
      setSaving(false)
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault()
    if (!detail || !comment.trim()) return
    try {
      await createComment({
        taskId: detail.task._id,
        body: comment,
        mentionedProjectMemberIds: mentionIds,
        idempotencyKey: crypto.randomUUID(),
        ...identity,
      })
      setComment('')
      setMentionIds([])
      onAnnounce('Comment added.')
    } catch (failure) {
      setError(taskError(failure))
    }
  }

  async function addSubtask(event: FormEvent) {
    event.preventDefault()
    if (!detail || !subtaskTitle.trim() || subtaskPendingRef.current) return
    subtaskPendingRef.current = true
    setSubtaskSaving(true)
    try {
      await createTask({
        projectId,
        boardId: detail.task.boardId,
        parentTaskId: detail.task._id,
        title: subtaskTitle,
        priority: 'none',
        idempotencyKey: subtaskIntentRef.current,
        ...identity,
      })
      setSubtaskTitle('')
      subtaskIntentRef.current = crypto.randomUUID()
      onAnnounce('Subtask created.')
    } catch (failure) {
      setError(taskError(failure))
    } finally {
      subtaskPendingRef.current = false
      setSubtaskSaving(false)
    }
  }

  async function applyLabels() {
    if (!detail || conflictFields.length || labelConflict) return
    setSaving(true)
    setError('')
    try {
      const nextRevision = await setTaskLabels({
        taskId: detail.task._id,
        labelIds,
        expectedRevision: baseRevisionRef.current ?? detail.task.revision,
        ...identity,
      })
      baselineLabelIdsRef.current = labelIds
      serverLabelIdsRef.current = labelIds
      baseRevisionRef.current = nextRevision
      setLabelConflict(false)
      onAnnounce(`${detail.task.publicKey} labels saved.`)
    } catch (failure) {
      setError(taskError(failure))
    } finally {
      setSaving(false)
    }
  }

  function reviewConflict() {
    if (!detail) return
    const nextDraft = draftFromDetail(detail)
    const nextLabelIds = detail.labels.flatMap((label) => label ? [label._id] : [])
    setDraft(nextDraft)
    setLabelIds(nextLabelIds)
    baselineRef.current = nextDraft
    serverDraftRef.current = nextDraft
    baseRevisionRef.current = detail.task.revision
    baselineLabelIdsRef.current = nextLabelIds
    serverLabelIdsRef.current = nextLabelIds
    setConflictFields([])
    setLabelConflict(false)
    setError('')
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(taskKey)}>
      <SheetContent className="task-detail-sheet">
        {detail === undefined ? <div className="task-detail-loading">Loading task…</div> : detail === null ? (
          <div className="task-detail-unavailable"><h2>Task unavailable</h2><p>The task does not exist or this represented membership cannot access it.</p></div>
        ) : (
          <>
            <SheetHeader>
              <div className="task-detail-topline">
                <StateRing category={selectedState?.category ?? 'backlog'} />
                <span>{detail.task.publicKey} · {detail.board?.name ?? 'Archived board'}</span>
              </div>
              <SheetTitle className="sr-only">{detail.task.title}</SheetTitle>
              <SheetDescription className="sr-only">{detail.state?.name ?? 'Unavailable status'}</SheetDescription>
            </SheetHeader>
            <div className="task-detail-body">
              <form className="task-detail-editor" onSubmit={(event) => void save(event)}>
                <Textarea aria-label="Task title" className="task-detail-title-input task-detail-title-textarea" dir="auto" disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, title: event.target.value })} rows={2} value={draft.title} />
                <Textarea aria-label="Task description" className="task-detail-description" disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add a description…" value={draft.description} />
                <div className="task-property-row">
                  <label className="task-property-control"><StateRing category={selectedState?.category ?? 'backlog'} size="dense" /><span className="sr-only">Status</span><NativeSelect disabled={!detail.capabilities.canEdit} onChange={(event) => { const stateId = board?.states.find((state) => state._id === event.target.value)?._id; if (stateId) setDraft({ ...draft, stateId }) }} value={draft.stateId}>
                    {board?.states.map((state) => <NativeSelectOption key={state._id} value={state._id}>{state.name} · {state.category}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label className="task-property-control"><PriorityGlyph priority={draft.priority} /><span className="sr-only">Priority</span><NativeSelect disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, priority: taskPriorityFromInput(event.target.value) })} value={draft.priority}>
                    {['none', 'urgent', 'high', 'medium', 'low'].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label className="task-property-control"><TaskAvatar member={selectedAssignee} /><span className="sr-only">Assignee</span><NativeSelect disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, assigneeId: assignees?.find((item) => item.member._id === event.target.value)?.member._id ?? '' })} value={draft.assigneeId}>
                    <NativeSelectOption value="">Unassigned</NativeSelectOption>
                    {assignees?.map((item) => <NativeSelectOption key={item.member._id} value={item.member._id}>{item.user.displayName}{item.company ? ` · ${item.company.displayName}` : ''}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label className="task-property-control"><span className="sr-only">Due date</span><Input disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} type="date" value={draft.dueDate} /></label>
                </div>
                {detail.capabilities.canEdit ? <Button className="task-save-button" disabled={saving || conflictFields.length > 0 || labelConflict} size="sm" type="submit"><Check size={13} /> {saving ? 'Saving…' : 'Save changes'}</Button> : <p className="task-read-only">Read-only task history</p>}
              </form>

              {conflictFields.length || labelConflict ? <div className="task-form-error" role="alert"><strong>This task changed while you were editing.</strong><span>Review the latest values before saving your local changes.</span><Button onClick={reviewConflict} size="sm" variant="outline">Review latest</Button></div> : null}
              {error ? <p className="task-form-error" role="alert">{error}</p> : null}
              <div className="task-detail-actions">
                <Button onClick={() => void setFollowing({ taskId: detail.task._id, enabled: !detail.following, ...identity })} variant="outline"><UserRound size={13} /> {detail.following ? 'Unfollow' : 'Follow'}</Button>
                {detail.capabilities.canArchive ? <Button onClick={() => void setArchived({ taskId: detail.task._id, archived: !detail.task.archivedAt, ...identity })} variant="outline"><Archive size={13} /> {detail.task.archivedAt ? 'Restore' : 'Archive'}</Button> : null}
              </div>

              <section className="task-detail-section"><h3>Labels</h3><div className="task-detail-actions">
                {labels?.map((label) => <Button key={label._id} onClick={() => setLabelIds((current) => current.includes(label._id) ? current.filter((id) => id !== label._id) : [...current, label._id])} size="sm" variant={labelIds.includes(label._id) ? 'default' : 'outline'}>{label.name}</Button>)}
                {detail.capabilities.canEdit ? <Button disabled={saving || conflictFields.length > 0 || labelConflict} onClick={() => void applyLabels()} size="sm" variant="outline">Apply labels</Button> : null}
              </div></section>

              {detail.capabilities.canChangeScope && !detail.task.parentTaskId ? <section className="task-detail-section"><h3>Change visibility scope</h3><p>Scope changes include this task and every subtask. Earlier evidence, comments, and activity keep their original access boundary.</p><NativeSelect aria-label="Destination scope board" onChange={(event) => { setScopeBoardId(event.target.value); setScopeConfirmed(false) }} value={scopeBoardId}><NativeSelectOption value="">Choose a board in another scope</NativeSelectOption>{boardRows?.filter((item) => item.board.groupId !== detail.task.groupId).map((item) => <NativeSelectOption key={item.board._id} value={item.board._id}>{item.board.name} · {item.board.groupId ? 'Channel scope' : 'Project scope'}</NativeSelectOption>)}</NativeSelect><label className="task-scope-confirm"><input checked={scopeConfirmed} onChange={(event) => setScopeConfirmed(event.target.checked)} type="checkbox" /> I confirm the audience change for task key, title, description, creator, assignee, priority, due date, labels, workflow state, and all subtask fields. Earlier restricted context will not be exposed.</label><Button disabled={!scopeBoardId || !scopeConfirmed} onClick={() => void changeScope({ taskId: detail.task._id, destinationBoardId: scopeBoardId as Id<'taskBoards'>, declassificationConfirmed: Boolean(detail.task.groupId), audienceReductionConfirmed: !detail.task.groupId, ...identity }).then(() => { setScopeBoardId(''); setScopeConfirmed(false); onAnnounce('Task scope changed.') })} variant="outline">Change task scope</Button></section> : null}

              <section className="task-detail-section"><h3><span>Subtasks</span><small>{subtasks.filter((item) => item.terminal).length}/{subtasks.length}</small></h3>
                {subtasks.map((item) => <div className={`task-subtask${item.terminal ? ' terminal' : ''}`} key={item.task._id}><StateRing category={item.state?.category ?? 'backlog'} size="subtask" /><strong>{item.task.title}</strong><span>{item.state?.name}</span></div>)}
                {childPage.status === 'CanLoadMore' || childPage.status === 'LoadingMore' ? <Button disabled={childPage.status === 'LoadingMore'} onClick={() => childPage.loadMore(50)} size="sm" variant="outline">{childPage.status === 'LoadingMore' ? 'Loading more subtasks…' : 'Load more subtasks'}</Button> : null}
                {detail.capabilities.canEdit && !detail.task.parentTaskId ? <form className="task-inline-form" onSubmit={(event) => void addSubtask(event)}><Input aria-label="Subtask title" onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add a subtask" value={subtaskTitle} /><Button disabled={subtaskSaving || !subtaskTitle.trim()} size="sm" type="submit"><Plus size={12} /> {subtaskSaving ? 'Adding…' : 'Add'}</Button></form> : null}
              </section>

              <section className="task-detail-section"><h3><Link2 size={14} /> Evidence</h3>
                {references.length ? references.map((reference) => <div className="task-origin-evidence" key={reference._id}><svg aria-hidden="true" className="task-origin-track" viewBox="0 0 18 72"><path d="M15 2C4 10 4 24 9 34s5 24-6 36" /></svg><blockquote>{reference.quote ?? 'Source unavailable'}<span>{reference.channelThreadId ? 'thread' : reference.type.replaceAll('_', ' ')}</span></blockquote></div>) : referencePage.status === 'LoadingFirstPage' ? <p className="task-empty-note">Loading evidence…</p> : <p className="task-empty-note">No linked evidence.</p>}
                {referencePage.status === 'CanLoadMore' || referencePage.status === 'LoadingMore' ? <Button disabled={referencePage.status === 'LoadingMore'} onClick={() => referencePage.loadMore(50)} size="sm" variant="outline">{referencePage.status === 'LoadingMore' ? 'Loading more evidence…' : 'Load more evidence'}</Button> : null}
                {detail.restrictedEarlierContext ? <p className="task-restricted-context">Earlier context is restricted.</p> : null}
              </section>

              <section className="task-detail-section"><h3><MessageSquare size={14} /> Comments and activity</h3>
                <div className="task-activity-list">
                  {comments.filter((item) => !item.archivedAt).map((item) => {
                    const author = assignees?.find((candidate) => candidate.member._id === item.authorProjectMemberId)
                    return <article className="task-comment" key={item._id}><TaskAvatar member={author?.member ?? null} /><div className="task-comment-copy"><div className="task-comment-meta"><strong>{author?.user.displayName ?? 'Project member'}</strong><time>{new Date(item.createdAt).toLocaleString()}{item.updatedAt > item.createdAt ? ' · edited' : ''}</time></div>{editingComment?.id === item._id ? <form className="task-inline-form" onSubmit={(event) => { event.preventDefault(); void editComment({ commentId: item._id, expectedRevision: editingComment.revision, body: editingComment.body, ...identity }).then(() => setEditingComment(undefined)) }}><Input onChange={(event) => setEditingComment({ ...editingComment, body: event.target.value })} value={editingComment.body} /><Button size="sm" type="submit">Save</Button></form> : <MarkdownText text={item.body} />}<div className="task-detail-actions">{item.authorProjectMemberId === detail.currentProjectMemberId ? <Button onClick={() => setEditingComment({ id: item._id, body: item.body, revision: item.revision })} size="sm" variant="ghost">Edit</Button> : null}{item.authorProjectMemberId === detail.currentProjectMemberId || detail.capabilities.canArchive ? <Button onClick={() => void archiveComment({ commentId: item._id, ...identity })} size="sm" variant="ghost">Archive</Button> : null}</div></div></article>
                  })}
                  {activities.map((item) => <p className="task-activity" key={item._id}><StateRing category="completed" size="dense" /><span>{item.action.replaceAll('_', ' ')}</span><time>{new Date(item.createdAt).toLocaleString()}</time></p>)}
                </div>
                {commentPage.status === 'LoadingFirstPage' || activityPage.status === 'LoadingFirstPage' ? <p className="task-empty-note">Loading history…</p> : null}
                {commentPage.status === 'CanLoadMore' || commentPage.status === 'LoadingMore' ? <Button disabled={commentPage.status === 'LoadingMore'} onClick={() => commentPage.loadMore(50)} size="sm" variant="outline">{commentPage.status === 'LoadingMore' ? 'Loading more comments…' : 'Load more comments'}</Button> : null}
                {activityPage.status === 'CanLoadMore' || activityPage.status === 'LoadingMore' ? <Button disabled={activityPage.status === 'LoadingMore'} onClick={() => activityPage.loadMore(50)} size="sm" variant="outline">{activityPage.status === 'LoadingMore' ? 'Loading more activity…' : 'Load more activity'}</Button> : null}
                {detail.capabilities.canComment ? <form className="task-comment-form" onSubmit={(event) => void addComment(event)}><Textarea aria-label="Task comment" onChange={(event) => setComment(event.target.value)} placeholder="Write a comment" value={comment} /><div className="task-detail-actions">{assignees?.map((item) => <Button key={item.member._id} onClick={() => setMentionIds((current) => current.includes(item.member._id) ? current.filter((id) => id !== item.member._id) : [...current, item.member._id])} size="sm" type="button" variant={mentionIds.includes(item.member._id) ? 'default' : 'outline'}>@{item.user.displayName}{item.company ? ` · ${item.company.displayName}` : ''}</Button>)}</div><Button disabled={!comment.trim()} type="submit">Comment</Button></form> : null}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
