export type OverviewTask = {
  category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  dueDate?: string
  stateName: string
}

export function isCompletedWorkflowState(state: Pick<OverviewTask, 'category' | 'stateName'> | undefined) {
  if (!state) return false
  const normalizedName = state.stateName.trim().toLocaleLowerCase()
  return state.category === 'completed' || normalizedName === 'done' || normalizedName === 'complete' || normalizedName === 'completed'
}

export function deriveProjectTaskMetrics(tasks: Array<OverviewTask>, today: string, dueThrough: string) {
  const completed = tasks.filter(isCompletedWorkflowState)
  const open = tasks.filter((task) => !isCompletedWorkflowState(task) && task.category !== 'canceled')
  const blocked = open.filter((task) => task.stateName.trim().toLocaleLowerCase() === 'blocked')
  const overdue = open.filter((task) => task.dueDate && task.dueDate < today)
  const dueThisWeek = open.filter((task) => task.dueDate && task.dueDate >= today && task.dueDate <= dueThrough)
  return {
    completion: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    total: tasks.length,
    completed: completed.length,
    open: open.length,
    blocked: blocked.length,
    overdue: overdue.length,
    dueThisWeek: dueThisWeek.length,
  }
}
