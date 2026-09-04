import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Bell, Columns3, Inbox, ListTodo, Plus, Settings2, UserRoundCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '#/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { useReleaseConfig } from '#/lib/release-config'
import { TaskAdminDialog } from './TaskAdminDialog'
import { TaskBoard } from './TaskBoard'
import { TaskCreateDialog } from './TaskCreateDialog'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { TaskInbox } from './TaskInbox'
import { taskIdentity, type TaskBoardView, type TaskView } from './task-types'
import { StateRing, TaskDenseRow } from './ui/TaskVisuals'

type TaskSearch = {
  actingCompanyId?: string
  projectMemberId?: string
  task?: string
  view?: 'inbox' | 'my' | 'all' | 'board'
  board?: string
  priority?: string
  due?: string
  state?: string
  label?: string
  archived?: boolean
}

const taskViews: Array<[NonNullable<TaskSearch['view']>, string, LucideIcon]> = [
  ['board', 'Boards', Columns3],
  ['my', 'My tasks', UserRoundCheck],
  ['all', 'All tasks', ListTodo],
  ['inbox', 'Inbox', Inbox],
]

export function TaskProjectPage({ projectId, search }: { projectId: string; search: TaskSearch }) {
  const release = useReleaseConfig()
  const navigate = useNavigate()
  const identity = useMemo(() => taskIdentity(search), [search])
  const project = projectId as Id<'projects'>
  const currentUser = useQuery(api.auth.getCurrentUser)
  const labels = useQuery(api.taskLabels.list, release.tasks ? { projectId: project, ...identity } : 'skip')
  const boards = useQuery(api.taskBoards.list, release.tasks ? { projectId: project, ...identity } : 'skip') as
    | Array<TaskBoardView>
    | undefined
  const eligibleAssignees = useQuery(
    api.tasks.listEligibleAssignees,
    release.tasks ? { projectId: project, ...identity } : 'skip',
  )
  const selectedBoard = boards?.find((item) => item.board._id === search.board) ??
    boards?.find((item) => item.board.isDefault) ?? boards?.[0]
  const currentProjectMemberId = identity.projectMemberId ?? eligibleAssignees?.find(
    (item) => item.user._id === currentUser?._id,
  )?.member._id
  const taskRows = useQuery(
    api.tasks.list,
    release.tasks && search.view !== 'inbox'
      ? {
          projectId: project,
          boardId: search.view === 'board' ? selectedBoard?.board._id : undefined,
          assigneeProjectMemberId: search.view === 'my' ? currentProjectMemberId : undefined,
          openOnly: search.view === 'my',
          priority: search.priority && search.priority !== 'all' ? search.priority as 'none' | 'urgent' | 'high' | 'medium' | 'low' : undefined,
          workflowStateId: search.state && search.state !== 'all' ? search.state as Id<'taskWorkflowStates'> : undefined,
          dueState: search.due && search.due !== 'all' ? search.due as 'none' | 'upcoming' | 'due_today' | 'overdue' : undefined,
          localDate: new Date().toLocaleDateString('en-CA'),
          labelId: search.label && search.label !== 'all' ? search.label as Id<'taskLabels'> : undefined,
          includeArchived: search.archived,
          ...identity,
        }
      : 'skip',
  ) as Array<TaskView> | undefined
  const [createOpen, setCreateOpen] = useState(false)
  const [createWorkflowStateId, setCreateWorkflowStateId] = useState<Id<'taskWorkflowStates'>>()
  const [adminOpen, setAdminOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const visibleTasks = taskRows ?? []
  const view = search.view ?? 'board'

  useEffect(() => {
    if (!search.board && selectedBoard && view === 'board') {
      void navigate({
        to: '/workspace/projects/$projectId/tasks',
        params: { projectId },
        search: { ...search, board: selectedBoard.board._id },
        replace: true,
      })
    }
  }, [navigate, projectId, search, search.board, selectedBoard, view])

  if (!release.tasks) {
    return <main className="task-page task-unavailable"><h1>Tasks are unavailable</h1><p>This Project keeps its conversation workflow while the task release is disabled.</p></main>
  }

  const conversationHref = identity.projectMemberId
    ? `/workspace/company-projects/${projectId}?companyId=${identity.actingCompanyId}&membershipId=${identity.projectMemberId}`
    : `/workspace/projects/${projectId}`
  const pageTitle = view === 'board'
    ? selectedBoard?.board.name ?? 'Board'
    : view === 'my'
      ? 'My tasks'
      : view === 'inbox'
        ? 'Suggestion inbox'
        : 'All tasks'

  return (
    <main className="task-page">
      <aside className="task-route-sidebar">
        <a className="task-route-brand" href="/workspace">
          <img alt="" height="21" src="/track-mark.svg" width="30" />
          <strong>Track</strong>
        </a>
        <a className="task-route-project" href={conversationHref}>
          <span className="task-route-project-glyph">P</span>
          <span><strong>Project workspace</strong><small>Conversation and work</small></span>
        </a>
        <span className="task-route-label">Work</span>
        <nav aria-label="Task views" className="task-view-tabs">
        {taskViews.map(([value, label, Icon]) => (
          <Button
            aria-current={view === value ? 'page' : undefined}
            className={view === value ? 'active' : ''}
            key={String(value)}
            onClick={() => void navigate({
              to: '/workspace/projects/$projectId/tasks', params: { projectId },
              search: { ...search, view: value },
            })}
            variant="ghost"
          >
            <Icon size={14} /> {label}
          </Button>
        ))}
        </nav>
        <a className="task-route-conversation" href={conversationHref}>← Project conversation</a>
      </aside>

      <section className="task-page-main">
        <header className="task-page-header">
          <div>
            <span className="task-eyebrow">Project work</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="task-header-actions">
            <Button onClick={() => { setCreateWorkflowStateId(undefined); setCreateOpen(true) }}><Plus size={14} /> New task</Button>
            <Button aria-label="Task settings" onClick={() => setAdminOpen(true)} variant="outline"><Settings2 size={14} /></Button>
            <TaskNotificationButton identity={identity} projectId={project} />
          </div>
        </header>

        {view === 'inbox' ? (
          <TaskInbox boards={boards ?? []} identity={identity} projectId={project} onAnnounce={setAnnouncement} />
        ) : (
          <section className="task-workspace">
          <div className="task-toolbar">
            {view === 'board' ? (
              <TaskFilterSelect
                ariaLabel="Board"
                className="task-board-select"
                display="value"
                label="Board"
                onChange={(value) => void navigate({
                  to: '/workspace/projects/$projectId/tasks', params: { projectId },
                  search: { ...search, board: value },
                })}
                options={(boards ?? []).map((item) => ({ label: item.board.name, value: item.board._id }))}
                value={selectedBoard?.board._id ?? ''}
              />
            ) : <strong>{view === 'my' ? 'Open work assigned to you' : 'Accessible Project work'}</strong>}
            <TaskFilterSelect
                ariaLabel="Filter by priority"
              label="Priority"
              onChange={(value) => void navigate({
                to: '/workspace/projects/$projectId/tasks', params: { projectId },
                search: { ...search, priority: value },
              })}
              options={['all', 'urgent', 'high', 'medium', 'low', 'none'].map((priority) => ({
                label: priority === 'all' ? 'All priorities' : priority,
                value: priority,
              }))}
              value={search.priority ?? 'all'}
            />
            <TaskFilterSelect ariaLabel="Filter by status" label="Status" onChange={(value) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, state: value } })} options={[{ label: 'All statuses', value: 'all' }, ...(boards ?? []).flatMap((item) => item.states).filter((state, index, states) => states.findIndex((candidate) => candidate._id === state._id) === index).map((state) => ({ label: state.name, value: state._id }))]} value={search.state ?? 'all'} />
            <TaskFilterSelect ariaLabel="Filter by due state" label="Due" onChange={(value) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, due: value } })} options={['all', 'overdue', 'due_today', 'upcoming', 'none'].map((due) => ({ label: due === 'all' ? 'All due dates' : due.replaceAll('_', ' '), value: due }))} value={search.due ?? 'all'} />
            <TaskFilterSelect ariaLabel="Filter by label" label="Label" onChange={(value) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, label: value } })} options={[{ label: 'All labels', value: 'all' }, ...(labels ?? []).map((label) => ({ label: label.name, value: label._id }))]} value={search.label ?? 'all'} />
            <label className="task-archive-filter"><input checked={Boolean(search.archived)} onChange={(event) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, archived: event.target.checked } })} type="checkbox" /> Archived</label>
          </div>
          {boards === undefined || taskRows === undefined ? <TaskLoading /> : !boards.length ? (
            <TaskEmpty title="No accessible boards" body="Create the first task to provision a standard board, or ask a task administrator to create one." />
          ) : view === 'board' && selectedBoard ? (
            <TaskBoard
              board={selectedBoard}
              identity={identity}
              onAnnounce={setAnnouncement}
              onCreate={(stateId) => { setCreateWorkflowStateId(stateId); setCreateOpen(true) }}
              onOpen={(publicKey) => void navigate({
                to: '/workspace/projects/$projectId/tasks', params: { projectId },
                search: { ...search, task: publicKey },
              })}
              tasks={visibleTasks}
            />
          ) : visibleTasks.length ? (
            <TaskGroupedList
              items={visibleTasks}
              omitAssignee={view === 'my'}
              onOpen={(publicKey) => void navigate({
                to: '/workspace/projects/$projectId/tasks', params: { projectId },
                search: { ...search, task: publicKey },
              })}
            />
          ) : <TaskEmpty title="No task matches" body="Change the current filters or create a task." />}
          </section>
        )}

        <p aria-live="polite" className="sr-only">{announcement}</p>
      </section>
      <TaskCreateDialog
        boards={boards ?? []}
        identity={identity}
        initialBoardId={selectedBoard?.board._id}
        initialWorkflowStateId={createWorkflowStateId}
        onCreated={(publicKey) => {
          setCreateOpen(false)
          setAnnouncement(`Created ${publicKey}`)
          void navigate({
            to: '/workspace/projects/$projectId/tasks', params: { projectId },
            search: { ...search, task: publicKey },
          })
        }}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setCreateWorkflowStateId(undefined)
        }}
        open={createOpen}
        projectId={project}
      />
      <TaskAdminDialog boards={boards ?? []} identity={identity} onOpenChange={setAdminOpen} open={adminOpen} projectId={project} />
      <TaskDetailDrawer
        identity={identity}
        onAnnounce={setAnnouncement}
        onOpenChange={(open) => {
          if (!open) void navigate({
            to: '/workspace/projects/$projectId/tasks', params: { projectId },
            search: { ...search, task: undefined },
          })
        }}
        projectId={project}
        taskKey={search.task}
      />
    </main>
  )
}

function TaskFilterSelect({ ariaLabel, className, display = 'label', label, onChange, options, value }: { ariaLabel: string; className?: string; display?: 'label' | 'value'; label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? label
  return <Select onValueChange={(next) => { if (next) onChange(next) }} value={value}>
    <SelectTrigger aria-label={ariaLabel} className={`task-filter-select ${className ?? ''}`} size="sm"><span className="task-filter-select-label">{display === 'value' ? selectedLabel : label}</span><SelectValue className="task-filter-select-value" /></SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false} className="task-filter-select-content">
      <SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup>
    </SelectContent>
  </Select>
}

function TaskNotificationButton({ identity, projectId }: { identity: ReturnType<typeof taskIdentity>; projectId: Id<'projects'> }) {
  const notifications = useQuery(api.taskNotifications.list, { projectId, ...identity })
  const preference = useQuery(api.taskNotifications.getPreference, { projectId, ...identity })
  const markRead = useMutation(api.taskNotifications.markRead)
  const markAllRead = useMutation(api.taskNotifications.markAllRead)
  const setPreference = useMutation(api.taskNotifications.setPreference)
  const unread = notifications?.filter((item) => !item.readAt).length ?? 0
  const identityQuery = identity.actingCompanyId && identity.projectMemberId
    ? `&actingCompanyId=${identity.actingCompanyId}&projectMemberId=${identity.projectMemberId}` : ''
  return <Popover><PopoverTrigger render={<Button aria-label={`${unread} unread task notifications`} variant="outline" />}><Bell size={14} />{unread ? <span>{unread}</span> : null}</PopoverTrigger><PopoverContent align="end" className="task-notification-feed">
    <PopoverHeader><PopoverTitle>Task notifications</PopoverTitle><PopoverDescription>Private to this Project membership.</PopoverDescription></PopoverHeader>
    <NativeSelect aria-label="Task push preference" onChange={(event) => void setPreference({ projectId, mode: event.target.value as 'important' | 'all_followed' | 'muted', ...identity })} value={preference ?? 'important'}>{['important', 'all_followed', 'muted'].map((mode) => <NativeSelectOption key={mode} value={mode}>{mode.replaceAll('_', ' ')}</NativeSelectOption>)}</NativeSelect>
    {unread ? <Button onClick={() => void markAllRead({ projectId, ...identity })} size="sm" variant="ghost">Mark all read</Button> : null}
    <div>{notifications?.map((item) => <a className={item.readAt ? '' : 'unread'} href={`/workspace/projects/${projectId}/tasks?view=all&task=${encodeURIComponent(String(item.payload?.publicKey ?? ''))}${identityQuery}`} key={item._id} onClick={() => void markRead({ notificationId: item._id, ...identity })}><strong>{item.eventType.replaceAll('_', ' ')}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></a>)}</div>
    {!notifications?.length ? <p>No task notifications.</p> : null}
  </PopoverContent></Popover>
}

function TaskLoading() {
  return <div aria-label="Loading tasks" className="task-loading"><span /><span /><span /></div>
}

function TaskEmpty({ title, body }: { title: string; body: string }) {
  return <div className="task-empty"><ListTodo aria-hidden="true" size={26} /><h2>{title}</h2><p>{body}</p></div>
}

function TaskGroupedList({ items, omitAssignee, onOpen }: { items: Array<TaskView>; omitAssignee: boolean; onOpen: (publicKey: string) => void }) {
  const groups = Array.from(items.reduce((result, item) => {
    const key = item.state?._id ?? 'unavailable'
    const current = result.get(key) ?? { state: item.state, items: [] as Array<TaskView> }
    current.items.push(item)
    result.set(key, current)
    return result
  }, new Map<string, { state: TaskView['state']; items: Array<TaskView> }>()).values())

  return <div className="task-dense-list">{groups.map((group) => (
    <section className="task-list-group" key={group.state?._id ?? 'unavailable'}>
      <header><StateRing category={group.state?.category ?? 'backlog'} /><h2>{group.state?.name ?? 'Unavailable state'}</h2><span>{group.items.length}</span></header>
      {group.items.map((item) => <TaskDenseRow item={item} key={item.task._id} omitAssignee={omitAssignee} onOpen={() => onOpen(item.task.publicKey)} />)}
    </section>
  ))}</div>
}
