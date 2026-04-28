export const notificationModes = ['inherit', 'all', 'mentions', 'none'] as const

export const draftClassifications = [
  'billable_scope',
  'non_billable_scope',
  'official_record',
  'informational',
  'ignored',
] as const

export const draftStatuses = ['open', 'in_progress', 'blocked', 'done'] as const
