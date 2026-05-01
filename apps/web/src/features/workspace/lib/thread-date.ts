export function getThreadDayKey(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function formatThreadDayLabel(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (getThreadDayKey(timestamp) === getThreadDayKey(today.getTime())) return 'Today'
  if (getThreadDayKey(timestamp) === getThreadDayKey(yesterday.getTime())) return 'Yesterday'

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}
