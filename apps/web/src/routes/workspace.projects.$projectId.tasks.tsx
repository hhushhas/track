import { createFileRoute, Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { RouteRecoveryPage } from '#/components/RouteRecoveryPage'
import { TaskProjectPage } from '#/features/tasks/TaskProjectPage'

type TaskSearch = {
  actingCompanyId?: string
  groupId?: string
  projectMemberId?: string
  task?: string
  view?: 'inbox' | 'my' | 'list' | 'calendar' | 'board'
  board?: string
  priority?: string
  due?: string
  state?: string
  label?: string
  archived?: boolean
  q?: string
  assignee?: string
  month?: string
}

const convexFilterIdPattern = /^[a-z0-9]{20,64}$/i

function taskFilterId(value: unknown) {
  return typeof value === 'string' &&
    (value === 'all' || convexFilterIdPattern.test(value))
    ? value
    : undefined
}

export const Route = createFileRoute('/workspace/projects/$projectId/tasks')({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    actingCompanyId: typeof search.actingCompanyId === 'string' ? search.actingCompanyId : undefined,
    groupId: typeof search.groupId === 'string' ? search.groupId : undefined,
    projectMemberId: typeof search.projectMemberId === 'string' ? search.projectMemberId : undefined,
    task: typeof search.task === 'string' ? search.task : undefined,
    view: search.view === 'inbox' || search.view === 'my' || search.view === 'list' || search.view === 'calendar' || search.view === 'board'
      ? search.view : 'list',
    board: taskFilterId(search.board),
    priority:
      search.priority === 'all' ||
      search.priority === 'none' ||
      search.priority === 'urgent' ||
      search.priority === 'high' ||
      search.priority === 'medium' ||
      search.priority === 'low'
        ? search.priority
        : undefined,
    due:
      search.due === 'all' ||
      search.due === 'none' ||
      search.due === 'upcoming' ||
      search.due === 'due_today' ||
      search.due === 'overdue'
        ? search.due
        : undefined,
    state: taskFilterId(search.state),
    label: taskFilterId(search.label),
    archived: search.archived === true || search.archived === 'true',
    q: typeof search.q === 'string' ? search.q.slice(0, 120) : undefined,
    assignee: taskFilterId(search.assignee),
    month:
      typeof search.month === 'string' &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month)
        ? search.month
        : undefined,
  }),
  component: TaskRoute,
  errorComponent: TaskRouteError,
})

function TaskRoute() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch()
  return <TaskProjectPage projectId={projectId} search={search} />
}

function TaskRouteError(props: ErrorComponentProps) {
  const message = props.error instanceof Error ? props.error.message : String(props.error)
  if (!message.includes('project_unavailable') && !message.includes('membership')) {
    return <RouteRecoveryPage {...props} />
  }

  return <main className="task-page task-unavailable" role="main">
    <section aria-labelledby="task-permission-title">
      <p>Project access</p>
      <h1 id="task-permission-title">Tasks are unavailable</h1>
      <p>This Project membership cannot access these tasks. Return to an available Project or ask a Project manager to review your access.</p>
      <Link to="/workspace">Open workspace</Link>
    </section>
  </main>
}
