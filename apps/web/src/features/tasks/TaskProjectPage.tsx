import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { Bell, CalendarClock, CheckCircle2, CircleAlert, Columns3, Inbox, ListTodo, MessageCircle, Plus, Settings2, UserRoundCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import TrackLoader from '#/components/TrackLoader'
import { Button } from '#/components/ui/button'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '#/components/ui/popover'
import { CompanyProjectNavigation } from '#/features/company/CompanyProjectNavigation'
import { useReleaseConfigState } from '#/lib/release-config'
import { formatEnumLabel } from '#/features/workspace/lib/formatting'
import { TaskAdminDialog } from './TaskAdminDialog'
import { TaskBoard } from './TaskBoard'
import { TaskCreateDialog } from './TaskCreateDialog'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { TaskInbox } from './TaskInbox'
import { groupTaskListItems } from './task-list-groups'
import { formatDateInputValue, formatTaskTimestamp } from './task-date'
import { taskIdentity, type TaskListItem } from './task-types'
import { StateRing, TaskDenseRow } from './ui/TaskVisuals'
import './task-views.css'

type TaskSearch = {
  actingCompanyId?: string
  groupId?: string
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
  ['board', 'Board', Columns3],
  ['my', 'My tasks', UserRoundCheck],
  ['all', 'List', ListTodo],
  ['inbox', 'Suggestions', Inbox],
]

export function TaskProjectPage({ projectId, search }: { projectId: string; search: TaskSearch }) {
  const releaseState = useReleaseConfigState()
  const release = releaseState.config
  const navigate = useNavigate()
  const incompleteRepresentedContext = Boolean(search.actingCompanyId) !== Boolean(search.projectMemberId)
  const usesLegacyContext = !search.actingCompanyId && !search.projectMemberId
  const identity = useMemo(() => taskIdentity(search), [search])
  const project = projectId as Id<'projects'>
  const currentUser = useQuery(api.auth.getCurrentUser)
  const legacyProjects = useQuery(
    api.projects.list,
    release.tasks && usesLegacyContext && currentUser ? { userId: currentUser._id } : 'skip',
  )
  const labels = useQuery(api.taskLabels.list, release.tasks && !incompleteRepresentedContext ? { projectId: project, ...identity } : 'skip')
  const boards = useQuery(api.taskBoards.list, release.tasks && !incompleteRepresentedContext ? { projectId: project, ...identity } : 'skip')
  const eligibleAssignees = useQuery(
    api.tasks.listEligibleAssignees,
    release.tasks && !incompleteRepresentedContext ? { projectId: project, ...identity } : 'skip',
  )
  const selectedBoard = boards?.find((item) => item.board._id === search.board) ??
    boards?.find((item) => item.board.isDefault) ?? boards?.[0]
  const currentProjectMemberId = identity.projectMemberId ?? eligibleAssignees?.find(
    (item) => item.user._id === currentUser?._id,
  )?.member._id
  const taskPage = usePaginatedQuery(
    api.tasks.listPage,
    release.tasks && !incompleteRepresentedContext && search.view !== 'inbox'
      ? {
          projectId: project,
          boardId: search.view === 'board' ? selectedBoard?.board._id : undefined,
          assigneeProjectMemberId: search.view === 'my' ? currentProjectMemberId : undefined,
          openOnly: search.view === 'my',
          priority: search.priority && search.priority !== 'all' ? search.priority as 'none' | 'urgent' | 'high' | 'medium' | 'low' : undefined,
          workflowStateId: search.state && search.state !== 'all' ? search.state as Id<'taskWorkflowStates'> : undefined,
          dueState: search.due && search.due !== 'all' ? search.due as 'none' | 'upcoming' | 'due_today' | 'overdue' : undefined,
          localDate: formatDateInputValue(new Date()),
          labelId: search.label && search.label !== 'all' ? search.label as Id<'taskLabels'> : undefined,
          includeArchived: search.archived,
          ...identity,
        }
      : 'skip',
    { initialNumItems: 50 },
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [createWorkflowStateId, setCreateWorkflowStateId] = useState<Id<'taskWorkflowStates'>>()
  const [adminOpen, setAdminOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const visibleTasks = taskPage.results
  const view = search.view ?? 'board'
  const legacyProject = legacyProjects?.find((item) => item.project._id === project)
  const activeFilterCount = [search.priority, search.state, search.due, search.label]
    .filter((value) => value && value !== 'all').length + (search.archived ? 1 : 0)

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

  if (releaseState.status === 'loading') {
    return <TrackLoader label="Loading Project tasks" />
  }

  if (!release.tasks) {
    return <main className="task-page task-unavailable"><h1>Tasks are unavailable</h1><p>This Project keeps its conversation workflow while the task release is disabled.</p></main>
  }

  if (incompleteRepresentedContext) {
    return <main className="task-page task-unavailable"><h1>Project task context unavailable</h1><p>Return to the Company Project and open Tasks again to restore its represented membership.</p></main>
  }

  if (currentUser === null) {
    return <main className="task-page task-unavailable"><h1>Project unavailable</h1><p>Sign in to open this Project.</p></main>
  }

  if (
    currentUser === undefined ||
    labels === undefined ||
    boards === undefined ||
    eligibleAssignees === undefined ||
    (usesLegacyContext && legacyProjects === undefined) ||
    (view !== 'inbox' && taskPage.status === 'LoadingFirstPage')
  ) {
    return <TrackLoader label="Loading Project tasks" />
  }

  if (usesLegacyContext && !legacyProject) {
    return <main className="task-page task-unavailable"><h1>Project unavailable</h1><p>This Project does not exist or your membership cannot access it.</p></main>
  }

  const representedProject = identity.actingCompanyId && identity.projectMemberId ? {
    actingCompanyId: identity.actingCompanyId,
    project: {
      groupId: search.groupId,
      projectId: project,
      projectMemberId: identity.projectMemberId,
    },
  } : null
  const pageTitle = view === 'board'
    ? selectedBoard?.board.name ?? 'Board'
    : view === 'my'
      ? 'My tasks'
      : view === 'inbox'
        ? 'Suggestion inbox'
        : 'All tasks'

  const taskViewNavigation = <>
    <span className="task-route-label">Work</span>
    <nav aria-label="Task views" className="task-view-tabs">
      {taskViews.map(([value, label, Icon]) => (
        <Link
          aria-current={view === value ? 'page' : undefined}
          className={view === value ? 'active' : ''}
          key={String(value)}
          params={{ projectId }}
          search={{ ...search, view: value }}
          to="/workspace/projects/$projectId/tasks"
        >
          <Icon aria-hidden="true" size={14} /> {label}
        </Link>
      ))}
    </nav>
  </>

  return (
    <main className={representedProject ? 'task-page company-task-shell' : 'task-page'}>
      {representedProject ? (
        <CompanyProjectNavigation
          actingCompanyId={representedProject.actingCompanyId}
          activeArea="tasks"
          activeProject={representedProject.project}
          secondaryNavigation={taskViewNavigation}
          tasksEnabled={release.tasks}
        />
      ) : <aside className="task-route-sidebar">
        <Link className="task-route-brand" to="/workspace">
          <img alt="" height="21" src="/track-mark.svg" width="30" />
          <strong>Track</strong>
        </Link>
        {search.groupId ? (
          <Link className="task-route-project" params={{ groupId: search.groupId, projectId }} to="/workspace/projects/$projectId/groups/$groupId">
            <span aria-hidden="true" className="task-route-project-glyph">{legacyProject?.project.name.slice(0, 1).toUpperCase()}</span>
            <span><strong>{legacyProject?.project.name}</strong><small>Standalone Project · Conversation and work</small></span>
          </Link>
        ) : (
          <Link className="task-route-project" params={{ projectId }} to="/workspace/projects/$projectId">
            <span aria-hidden="true" className="task-route-project-glyph">{legacyProject?.project.name.slice(0, 1).toUpperCase()}</span>
            <span><strong>{legacyProject?.project.name}</strong><small>Standalone Project · Conversation and work</small></span>
          </Link>
        )}
        {taskViewNavigation}
        {search.groupId ? (
          <Link className="task-route-conversation" params={{ groupId: search.groupId, projectId }} to="/workspace/projects/$projectId/groups/$groupId">← Project conversation</Link>
        ) : (
          <Link className="task-route-conversation" params={{ projectId }} to="/workspace/projects/$projectId">← Project conversation</Link>
        )}
      </aside>}

      <section className="task-page-main">
        <header className="task-page-header">
          <div>
            <span className="task-eyebrow">Project work</span>
            <h1>Tasks</h1>
            <p className="task-page-context">{pageTitle}{view !== 'inbox' ? ` · ${visibleTasks.length} loaded` : ''}</p>
          </div>
          <div className="task-header-actions">
            <Button onClick={() => { setCreateWorkflowStateId(undefined); setCreateOpen(true) }}><Plus aria-hidden="true" size={14} /> New task</Button>
            <Button aria-label="Task settings" onClick={() => setAdminOpen(true)} variant="outline"><Settings2 aria-hidden="true" size={14} /></Button>
            <TaskNotificationButton groupId={search.groupId} identity={identity} projectId={project} />
          </div>
        </header>

        {view === 'inbox' ? (
          <TaskInbox boards={boards ?? []} identity={identity} projectId={project} onAnnounce={setAnnouncement} />
        ) : (
          <section className="task-workspace">
          <div aria-label="Task filters" className="task-toolbar" data-active-filter-count={activeFilterCount} role="group">
            {view === 'board' ? (
              <NativeSelect
                aria-label="Board"
                onChange={(event) => void navigate({
                  to: '/workspace/projects/$projectId/tasks', params: { projectId },
                  search: { ...search, board: event.target.value },
                })}
                value={selectedBoard?.board._id ?? ''}
              >
                {(boards ?? []).map((item) => <NativeSelectOption key={item.board._id} value={item.board._id}>{item.board.name}</NativeSelectOption>)}
              </NativeSelect>
            ) : <strong>{view === 'my' ? 'Open work assigned to you' : 'Accessible Project work'}</strong>}
            <NativeSelect
              aria-label="Filter by priority"
              onChange={(event) => void navigate({
                to: '/workspace/projects/$projectId/tasks', params: { projectId },
                search: { ...search, priority: event.target.value },
              })}
              value={search.priority ?? 'all'}
            >
              {['all', 'urgent', 'high', 'medium', 'low', 'none'].map((priority) =>
                <NativeSelectOption key={priority} value={priority}>{priority === 'all' ? 'All priorities' : `${priority[0]?.toUpperCase() ?? ''}${priority.slice(1)} priority`}</NativeSelectOption>)}
            </NativeSelect>
            <NativeSelect aria-label="Filter by status" onChange={(event) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, state: event.target.value } })} value={search.state ?? 'all'}>
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
              {(boards ?? []).flatMap((item) => item.states).filter((state, index, states) => states.findIndex((candidate) => candidate._id === state._id) === index).map((state) => <NativeSelectOption key={state._id} value={state._id}>{state.name}</NativeSelectOption>)}
            </NativeSelect>
            <NativeSelect aria-label="Filter by due state" onChange={(event) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, due: event.target.value } })} value={search.due ?? 'all'}>
              {['all', 'overdue', 'due_today', 'upcoming', 'none'].map((due) => <NativeSelectOption key={due} value={due}>{due === 'all' ? 'All due dates' : due === 'due_today' ? 'Due today' : due === 'none' ? 'No due date' : due === 'overdue' ? 'Overdue' : 'Upcoming'}</NativeSelectOption>)}
            </NativeSelect>
            <NativeSelect aria-label="Filter by label" onChange={(event) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, label: event.target.value } })} value={search.label ?? 'all'}>
              <NativeSelectOption value="all">All labels</NativeSelectOption>
              {labels?.map((label) => <NativeSelectOption key={label._id} value={label._id}>{label.name}</NativeSelectOption>)}
            </NativeSelect>
            <label className="task-archive-filter"><input checked={Boolean(search.archived)} onChange={(event) => void navigate({ to: '/workspace/projects/$projectId/tasks', params: { projectId }, search: { ...search, archived: event.target.checked } })} type="checkbox" /> Archived</label>
            {activeFilterCount ? <Button aria-label={`Clear ${activeFilterCount} active task filters`} className="task-filter-reset" onClick={() => void navigate({
              to: '/workspace/projects/$projectId/tasks',
              params: { projectId },
              search: { ...search, priority: undefined, state: undefined, due: undefined, label: undefined, archived: false },
            })} size="sm" variant="ghost">Clear {activeFilterCount}</Button> : null}
          </div>
          {taskPage.status === 'LoadingFirstPage' ? <TaskLoading /> : !boards.length ? (
            <TaskEmpty title="No accessible boards" body="Create the first task to provision the Project workflow." onAction={() => { setCreateWorkflowStateId(undefined); setCreateOpen(true) }} />
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
          ) : <TaskEmpty title="No task matches" body="Clear the current filters or create a task." onAction={() => { setCreateWorkflowStateId(undefined); setCreateOpen(true) }} />}
          {taskPage.status === 'CanLoadMore' || taskPage.status === 'LoadingMore' ? <div className="task-load-more"><Button disabled={taskPage.status === 'LoadingMore'} onClick={() => taskPage.loadMore(50)} variant="outline">{taskPage.status === 'LoadingMore' ? 'Loading more…' : 'Load more tasks'}</Button></div> : null}
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

function TaskNotificationButton({ groupId, identity, projectId }: { groupId?: string; identity: ReturnType<typeof taskIdentity>; projectId: Id<'projects'> }) {
  const notifications = useQuery(api.taskNotifications.list, { projectId, ...identity })
  const preference = useQuery(api.taskNotifications.getPreference, { projectId, ...identity })
  const markRead = useMutation(api.taskNotifications.markRead)
  const markAllRead = useMutation(api.taskNotifications.markAllRead)
  const setPreference = useMutation(api.taskNotifications.setPreference)
  const [eventFilter, setEventFilter] = useState('all')
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')
  const unread = notifications?.filter((item) => !item.readAt).length ?? 0
  const eventTypes = Array.from(new Set((notifications ?? []).map((item) => item.eventType))).sort()
  const visibleNotifications = (notifications ?? []).filter((item) =>
    (eventFilter === 'all' || item.eventType === eventFilter) &&
    (readFilter === 'all' || (readFilter === 'unread' ? !item.readAt : Boolean(item.readAt))),
  )
  return <div className="task-notification-actions"><Popover><PopoverTrigger render={<Button aria-label={`${unread} unread task notifications`} variant="outline" />}><Bell aria-hidden="true" size={14} />{unread ? <span>{unread}</span> : null}</PopoverTrigger><PopoverContent align="end" className="task-notification-feed">
    <PopoverHeader className="task-notification-header"><div><span className="task-notification-eyebrow">Task activity</span><PopoverTitle>Notifications</PopoverTitle><PopoverDescription>Updates for this Project membership.</PopoverDescription></div><Button disabled={!unread} onClick={() => void markAllRead({ projectId, ...identity })} size="sm" variant="ghost">Mark all read</Button></PopoverHeader>
    <div className="task-notification-controls">
      <NativeSelect aria-label="Task push preference" onChange={(event) => void setPreference({ projectId, mode: event.target.value as 'important' | 'all_followed' | 'muted', ...identity })} value={preference ?? 'important'}>{['important', 'all_followed', 'muted'].map((mode) => <NativeSelectOption key={mode} value={mode}>{formatEnumLabel(mode)}</NativeSelectOption>)}</NativeSelect>
      <NativeSelect aria-label="Notification type" onChange={(event) => setEventFilter(event.target.value)} value={eventFilter}><NativeSelectOption value="all">All types</NativeSelectOption>{eventTypes.map((eventType) => <NativeSelectOption key={eventType} value={eventType}>{formatEnumLabel(eventType)}</NativeSelectOption>)}</NativeSelect>
      <NativeSelect aria-label="Notification status" onChange={(event) => setReadFilter(event.target.value as typeof readFilter)} value={readFilter}><NativeSelectOption value="all">All statuses</NativeSelectOption><NativeSelectOption value="unread">Unread</NativeSelectOption><NativeSelectOption value="read">Read</NativeSelectOption></NativeSelect>
    </div>
    <div className="task-notification-list">{visibleNotifications.map((item) => <Link
      className={item.readAt ? 'task-notification-card' : 'task-notification-card unread'}
      key={item._id}
      onClick={() => void markRead({ notificationId: item._id, ...identity })}
      params={{ projectId }}
      search={{
        actingCompanyId: identity.actingCompanyId,
        groupId,
        projectMemberId: identity.projectMemberId,
        task: String(item.payload?.publicKey ?? ''),
        view: 'all',
      }}
      to="/workspace/projects/$projectId/tasks"
    ><span className={`task-notification-icon task-notification-icon-${notificationEventTone(item.eventType)}`}><NotificationEventIcon eventType={item.eventType} /></span><span className="task-notification-copy"><strong>{notificationEventLabel(item.eventType)}</strong><span>{item.payload?.publicKey ? `Task ${item.payload.publicKey}` : 'Project update'}</span><small>{formatTaskTimestamp(item.createdAt)} · {item.readAt ? 'Read' : 'Unread'}</small></span><span className="task-notification-view">View</span></Link>)}</div>
    {notifications === undefined ? <p className="task-notification-empty">Loading notifications…</p> : !notifications.length ? <p className="task-notification-empty">No task notifications yet.</p> : notifications.length !== visibleNotifications.length && !visibleNotifications.length ? <p className="task-notification-empty">No notifications match these filters.</p> : null}
  </PopoverContent></Popover></div>
}

function TaskLoading() {
  return <div aria-label="Loading tasks" className="task-loading"><span /><span /><span /></div>
}

function notificationEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    assignment: 'Task assigned',
    assignment_lost: 'Assignment changed',
    comment: 'New task comment',
    due_soon: 'Due date approaching',
    mention: 'Mentioned in task',
    overdue: 'Task overdue',
    task_changed: 'Task updated',
    task_suggestion: 'Task suggestion',
    thread_activity: 'Thread activity',
  }
  return labels[eventType] ?? formatEnumLabel(eventType)
}

function notificationEventTone(eventType: string) {
  if (eventType === 'overdue' || eventType === 'assignment_lost') return 'alert'
  if (eventType === 'due_soon') return 'warning'
  if (eventType === 'comment' || eventType === 'mention' || eventType === 'thread_activity') return 'message'
  return 'success'
}

function NotificationEventIcon({ eventType }: { eventType: string }) {
  if (eventType === 'overdue' || eventType === 'assignment_lost') return <CircleAlert aria-hidden="true" size={14} />
  if (eventType === 'due_soon') return <CalendarClock aria-hidden="true" size={14} />
  if (eventType === 'comment' || eventType === 'mention' || eventType === 'thread_activity') return <MessageCircle aria-hidden="true" size={14} />
  return <CheckCircle2 aria-hidden="true" size={14} />
}

function TaskEmpty({ title, body, onAction }: { title: string; body: string; onAction?: () => void }) {
  return <div className="task-empty"><span className="task-empty-icon"><ListTodo aria-hidden="true" size={20} /></span><h2>{title}</h2><p>{body}</p>{onAction ? <Button onClick={onAction} size="sm"><Plus aria-hidden="true" size={13} /> Create task</Button> : null}</div>
}

function TaskGroupedList({ items, omitAssignee, onOpen }: { items: Array<TaskListItem>; omitAssignee: boolean; onOpen: (publicKey: string) => void }) {
  const groups = groupTaskListItems(items, (item) => item.state ? {
    boardName: item.board?.name ?? null,
    category: item.state.category,
    name: item.state.name,
  } : null)

  return <div className="task-dense-list">{groups.map((group) => (
    <section className="task-list-group" key={group.key}>
      <header><StateRing category={group.category} /><h2>{group.label}</h2><span>{group.items.length}</span></header>
      {group.items.map((item) => <TaskDenseRow item={item} key={item.task._id} omitAssignee={omitAssignee} onOpen={() => onOpen(item.task.publicKey)} />)}
    </section>
  ))}</div>
}
