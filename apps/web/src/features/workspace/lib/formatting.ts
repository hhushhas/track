const enumLabelOverrides: Record<string, string> = {
  all_followed: 'All Followed Work',
  due_today: 'Due Today',
  no_due_date: 'No Due Date',
  task_suggestion: 'Task Suggestion',
}

export function formatEnumLabel(value: string) {
  const normalized = value.trim().toLowerCase()
  if (enumLabelOverrides[normalized]) return enumLabelOverrides[normalized]
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}

export function formatRailLabel(value: string) {
  return formatEnumLabel(value)
}
