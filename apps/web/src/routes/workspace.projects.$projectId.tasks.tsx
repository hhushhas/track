import { createFileRoute } from '@tanstack/react-router'

import { TaskProjectPage } from '#/features/tasks/TaskProjectPage'

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

export const Route = createFileRoute('/workspace/projects/$projectId/tasks')({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    actingCompanyId: typeof search.actingCompanyId === 'string' ? search.actingCompanyId : undefined,
    projectMemberId: typeof search.projectMemberId === 'string' ? search.projectMemberId : undefined,
    task: typeof search.task === 'string' ? search.task : undefined,
    view: search.view === 'inbox' || search.view === 'my' || search.view === 'all' || search.view === 'board'
      ? search.view : 'board',
    board: typeof search.board === 'string' ? search.board : undefined,
    priority: typeof search.priority === 'string' ? search.priority : undefined,
    due: typeof search.due === 'string' ? search.due : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
    label: typeof search.label === 'string' ? search.label : undefined,
    archived: search.archived === true || search.archived === 'true',
  }),
  component: TaskRoute,
})

function TaskRoute() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch()
  return <TaskProjectPage projectId={projectId} search={search} />
}
