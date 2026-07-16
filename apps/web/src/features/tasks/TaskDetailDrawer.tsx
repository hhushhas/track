import { useMutation, useQuery } from 'convex/react'
import { Archive, Check, Link2, MessageSquare, Plus, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '#/components/ui/sheet'
import { Textarea } from '#/components/ui/textarea'
import { MarkdownText } from '#/features/workspace/markdown'
import type { TaskIdentity, TaskView } from './task-types'
import { taskError } from './TaskCreateDialog'

type TaskDetail = TaskView & {
  comments: Array<{ _id: Id<'taskComments'>; authorProjectMemberId: Id<'projectMembers'>; body: string; createdAt: number; updatedAt: number; archivedAt?: number; revision: number }>
  activities: Array<{ _id: Id<'taskActivities'>; action: string; createdAt: number }>
  following: boolean
  capabilities: {
    canEdit: boolean
    canArchive: boolean
    canComment: boolean
    canChangeScope: boolean
  }
  restrictedEarlierContext: boolean
  currentProjectMemberId: Id<'projectMembers'>
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
  ) as TaskDetail | null | undefined
  const boardRows = useQuery(api.taskBoards.list, taskKey ? { projectId, ...identity } : 'skip')
  const assignees = useQuery(
    api.tasks.listEligibleAssignees,
    detail ? { projectId, groupId: detail.task.groupId, ...identity } : 'skip',
  )
  const tasks = useQuery(api.tasks.list, taskKey ? { projectId, ...identity } : 'skip') as Array<TaskView> | undefined
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
  const [draft, setDraft] = useState({ title: '', description: '', priority: 'none', dueDate: '', stateId: '', assigneeId: '' })
  const [comment, setComment] = useState('')
  const [mentionIds, setMentionIds] = useState<Array<Id<'projectMembers'>>>([])
  const [editingComment, setEditingComment] = useState<{ id: Id<'taskComments'>; body: string; revision: number }>()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [labelIds, setLabelIds] = useState<Array<Id<'taskLabels'>>>([])
  const [scopeBoardId, setScopeBoardId] = useState('')
  const [scopeConfirmed, setScopeConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!detail) return
    setDraft({
      title: detail.task.title,
      description: detail.task.description ?? '',
      priority: detail.task.priority,
      dueDate: detail.task.dueDate ?? '',
      stateId: detail.task.workflowStateId,
      assigneeId: detail.task.assigneeProjectMemberId ?? '',
    })
    setLabelIds(detail.labels.map((label) => label._id))
    setError('')
  }, [detail])

  const board = boardRows?.find((item) => item.board._id === detail?.task.boardId)
  const subtasks = tasks?.filter((item) => item.task.parentTaskId === detail?.task._id) ?? []

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!detail) return
    setSaving(true)
    setError('')
    try {
      await updateTask({
        taskId: detail.task._id,
        expectedRevision: detail.task.revision,
        title: draft.title,
        description: draft.description || null,
        priority: draft.priority as typeof detail.task.priority,
        dueDate: draft.dueDate || null,
        workflowStateId: draft.stateId as Id<'taskWorkflowStates'>,
        assigneeProjectMemberId: draft.assigneeId ? draft.assigneeId as Id<'projectMembers'> : null,
        confirmOpenSubtasks: true,
        ...identity,
      })
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
    if (!detail || !subtaskTitle.trim()) return
    try {
      await createTask({
        projectId,
        boardId: detail.task.boardId,
        parentTaskId: detail.task._id,
        title: subtaskTitle,
        priority: 'none',
        idempotencyKey: crypto.randomUUID(),
        ...identity,
      })
      setSubtaskTitle('')
      onAnnounce('Subtask created.')
    } catch (failure) {
      setError(taskError(failure))
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(taskKey)}>
      <SheetContent className="task-detail-sheet">
        {detail === undefined ? <div className="task-detail-loading">Loading task…</div> : detail === null ? (
          <div className="task-detail-unavailable"><h2>Task unavailable</h2><p>The task does not exist or this represented membership cannot access it.</p></div>
        ) : (
          <>
            <SheetHeader>
              <span className="task-card-key">{detail.task.publicKey}</span>
              <SheetTitle>{detail.task.title}</SheetTitle>
              <SheetDescription>{detail.board?.name ?? 'Archived board'} · {detail.state?.name ?? 'Unavailable status'}</SheetDescription>
            </SheetHeader>
            <div className="task-detail-body">
              <form className="task-form" onSubmit={(event) => void save(event)}>
                <label>Title<Input disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} /></label>
                <label>Description<Textarea disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description} /></label>
                <div className="task-form-grid">
                  <label>Status<NativeSelect disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, stateId: event.target.value })} value={draft.stateId}>
                    {board?.states.map((state) => <NativeSelectOption key={state._id} value={state._id}>{state.name} · {state.category}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label>Priority<NativeSelect disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, priority: event.target.value })} value={draft.priority}>
                    {['none', 'urgent', 'high', 'medium', 'low'].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label>Assignee<NativeSelect disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })} value={draft.assigneeId}>
                    <NativeSelectOption value="">Unassigned</NativeSelectOption>
                    {assignees?.map((item) => <NativeSelectOption key={item.member._id} value={item.member._id}>{item.user.displayName}{item.company ? ` · ${item.company.displayName}` : ''}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label>Due date<Input disabled={!detail.capabilities.canEdit} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} type="date" value={draft.dueDate} /></label>
                </div>
                {detail.capabilities.canEdit ? <Button disabled={saving} type="submit"><Check size={13} /> {saving ? 'Saving…' : 'Save changes'}</Button> : <p className="task-read-only">Read-only task history</p>}
              </form>

              {error ? <p className="task-form-error" role="alert">{error}</p> : null}
              <div className="task-detail-actions">
                <Button onClick={() => void setFollowing({ taskId: detail.task._id, enabled: !detail.following, ...identity })} variant="outline"><UserRound size={13} /> {detail.following ? 'Unfollow' : 'Follow'}</Button>
                {detail.capabilities.canArchive ? <Button onClick={() => void setArchived({ taskId: detail.task._id, archived: !detail.task.archivedAt, ...identity })} variant="outline"><Archive size={13} /> {detail.task.archivedAt ? 'Restore' : 'Archive'}</Button> : null}
              </div>

              <section className="task-detail-section"><h3>Labels</h3><div className="task-detail-actions">
                {labels?.map((label) => <Button key={label._id} onClick={() => setLabelIds((current) => current.includes(label._id) ? current.filter((id) => id !== label._id) : [...current, label._id])} size="sm" variant={labelIds.includes(label._id) ? 'default' : 'outline'}>{label.name}</Button>)}
                {detail.capabilities.canEdit ? <Button onClick={() => void setTaskLabels({ taskId: detail.task._id, labelIds, expectedRevision: detail.task.revision, ...identity })} size="sm" variant="outline">Apply labels</Button> : null}
              </div></section>

              {detail.capabilities.canChangeScope && !detail.task.parentTaskId ? <section className="task-detail-section"><h3>Change visibility scope</h3><p>Scope changes include this task and every subtask. Earlier evidence, comments, and activity keep their original access boundary.</p><NativeSelect aria-label="Destination scope board" onChange={(event) => { setScopeBoardId(event.target.value); setScopeConfirmed(false) }} value={scopeBoardId}><NativeSelectOption value="">Choose a board in another scope</NativeSelectOption>{boardRows?.filter((item) => item.board.groupId !== detail.task.groupId).map((item) => <NativeSelectOption key={item.board._id} value={item.board._id}>{item.board.name} · {item.board.groupId ? 'Channel scope' : 'Project scope'}</NativeSelectOption>)}</NativeSelect><label className="task-scope-confirm"><input checked={scopeConfirmed} onChange={(event) => setScopeConfirmed(event.target.checked)} type="checkbox" /> I confirm the audience change for task key, title, description, creator, assignee, priority, due date, labels, workflow state, and all subtask fields. Earlier restricted context will not be exposed.</label><Button disabled={!scopeBoardId || !scopeConfirmed} onClick={() => void changeScope({ taskId: detail.task._id, destinationBoardId: scopeBoardId as Id<'taskBoards'>, declassificationConfirmed: Boolean(detail.task.groupId), audienceReductionConfirmed: !detail.task.groupId, ...identity }).then(() => { setScopeBoardId(''); setScopeConfirmed(false); onAnnounce('Task scope changed.') })} variant="outline">Change task scope</Button></section> : null}

              <section className="task-detail-section"><h3>Subtasks</h3>
                {subtasks.map((item) => <div className="task-subtask" key={item.task._id}><span>{item.state?.name}</span><strong>{item.task.title}</strong></div>)}
                {detail.capabilities.canEdit && !detail.task.parentTaskId ? <form className="task-inline-form" onSubmit={(event) => void addSubtask(event)}><Input aria-label="Subtask title" onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add a subtask" value={subtaskTitle} /><Button disabled={!subtaskTitle.trim()} size="sm" type="submit"><Plus size={12} /> Add</Button></form> : null}
              </section>

              <section className="task-detail-section"><h3><Link2 size={14} /> Evidence</h3>
                {detail.references.length ? detail.references.map((reference) => <blockquote key={reference._id}>{reference.quote ?? 'Source unavailable'}<span>{reference.type.replaceAll('_', ' ')}</span></blockquote>) : <p>No linked evidence.</p>}
                {detail.restrictedEarlierContext ? <p className="task-restricted-context">Earlier context is restricted.</p> : null}
              </section>

              <section className="task-detail-section"><h3><MessageSquare size={14} /> Comments and activity</h3>
                <div className="task-activity-list">
                  {detail.comments.filter((item) => !item.archivedAt).map((item) => <article key={item._id}>{editingComment?.id === item._id ? <form className="task-inline-form" onSubmit={(event) => { event.preventDefault(); void editComment({ commentId: item._id, expectedRevision: editingComment.revision, body: editingComment.body, ...identity }).then(() => setEditingComment(undefined)) }}><Input onChange={(event) => setEditingComment({ ...editingComment, body: event.target.value })} value={editingComment.body} /><Button size="sm" type="submit">Save</Button></form> : <MarkdownText text={item.body} />}<time>{new Date(item.createdAt).toLocaleString()}{item.updatedAt > item.createdAt ? ' · edited' : ''}</time><div className="task-detail-actions">{item.authorProjectMemberId === detail.currentProjectMemberId ? <Button onClick={() => setEditingComment({ id: item._id, body: item.body, revision: item.revision })} size="sm" variant="ghost">Edit</Button> : null}{item.authorProjectMemberId === detail.currentProjectMemberId || detail.capabilities.canArchive ? <Button onClick={() => void archiveComment({ commentId: item._id, ...identity })} size="sm" variant="ghost">Archive</Button> : null}</div></article>)}
                  {detail.activities.map((item) => <p className="task-activity" key={item._id}>{item.action.replaceAll('_', ' ')} <time>{new Date(item.createdAt).toLocaleString()}</time></p>)}
                </div>
                {detail.capabilities.canComment ? <form className="task-comment-form" onSubmit={(event) => void addComment(event)}><Textarea aria-label="Task comment" onChange={(event) => setComment(event.target.value)} placeholder="Write a comment" value={comment} /><div className="task-detail-actions">{assignees?.map((item) => <Button key={item.member._id} onClick={() => setMentionIds((current) => current.includes(item.member._id) ? current.filter((id) => id !== item.member._id) : [...current, item.member._id])} size="sm" type="button" variant={mentionIds.includes(item.member._id) ? 'default' : 'outline'}>@{item.user.displayName}{item.company ? ` · ${item.company.displayName}` : ''}</Button>)}</div><Button disabled={!comment.trim()} type="submit">Comment</Button></form> : null}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
