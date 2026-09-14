import type { Doc } from '../../../../../convex/_generated/dataModel'

export type TaskListItemState = Pick<Doc<'taskWorkflowStates'>, 'category' | 'name'> & {
  boardName: string | null
}

type TaskStateCategory = TaskListItemState['category']

export type TaskListGroup<Item> = {
  category: TaskStateCategory
  items: Array<Item>
  key: string
  label: string
}

type PendingTaskListGroup<Item> = TaskListGroup<Item> & {
  boardNames: Set<string>
  normalizedName: string
}

const categoryLabels: { [Category in TaskStateCategory]: string } = {
  backlog: 'Backlog',
  canceled: 'Canceled',
  completed: 'Completed',
  started: 'Started',
  unstarted: 'Unstarted',
}

function normalizeStateName(name: string) {
  return name.trim().replaceAll(/\s+/g, ' ').normalize('NFKC').toLowerCase()
}

export function groupTaskListItems<Item>(
  items: ReadonlyArray<Item>,
  stateFor: (item: Item) => TaskListItemState | null,
): Array<TaskListGroup<Item>> {
  const groups = new Map<string, PendingTaskListGroup<Item>>()
  const categoriesByName = new Map<string, Set<TaskStateCategory>>()

  for (const item of items) {
    const state = stateFor(item)
    const normalizedName = state ? normalizeStateName(state.name) : ''
    const category = state?.category ?? 'backlog'
    const key = state ? `state:${normalizedName}:${category}` : 'unavailable'
    const current = groups.get(key) ?? {
      boardNames: new Set<string>(),
      category,
      items: [],
      key,
      label: state?.name.trim() || 'Unavailable state',
      normalizedName,
    }

    current.items.push(item)
    if (state?.boardName) current.boardNames.add(state.boardName)
    groups.set(key, current)

    if (state) {
      const categories = categoriesByName.get(normalizedName) ?? new Set<TaskStateCategory>()
      categories.add(category)
      categoriesByName.set(normalizedName, categories)
    }
  }

  return Array.from(groups.values(), (group) => {
    const ambiguousName = (categoriesByName.get(group.normalizedName)?.size ?? 0) > 1
    if (!ambiguousName) {
      return { category: group.category, items: group.items, key: group.key, label: group.label }
    }

    const boardLabel = group.boardNames.size ? Array.from(group.boardNames).join(', ') : 'Unavailable board'
    return {
      category: group.category,
      items: group.items,
      key: group.key,
      label: `${group.label} · ${boardLabel} · ${categoryLabels[group.category]}`,
    }
  })
}
