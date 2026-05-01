import type { Doc } from '../../../../../../convex/_generated/dataModel'

export type ProjectRecordFilter = 'all' | 'open' | 'billable' | 'blocked' | 'done'

export function filterProjectRecords(
  records: Array<Doc<'records'>>,
  filter: ProjectRecordFilter,
  searchQuery: string,
) {
  const query = searchQuery.trim().toLowerCase()
  return records.filter((record) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'open' &&
        (record.status === 'open' || record.status === 'in_progress')) ||
      (filter === 'billable' && record.classification === 'billable_scope') ||
      (filter === 'blocked' && record.status === 'blocked') ||
      (filter === 'done' && record.status === 'done')
    if (!matchesFilter) return false
    if (!query) return true
    return [
      record.title,
      record.description,
      record.type,
      record.classification,
      record.status,
    ].some((value) => value.toLowerCase().includes(query))
  })
}
