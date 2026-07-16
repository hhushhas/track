import { describe, expect, it } from 'vitest'

import schema from './schema'

type ExportedTable = {
  tableName: string
  indexes: Array<{ indexDescriptor: string; fields: string[] }>
  searchIndexes: Array<{ indexDescriptor: string; searchField: string; filterFields: string[] }>
}

const exportedSchema = JSON.parse(schema.export()) as { tables: ExportedTable[] }
const tables = new Map(exportedSchema.tables.map((table) => [table.tableName, table]))

const companyTableNames = [
  'companies',
  'companyMembers',
  'companyInvitations',
  'relationships',
  'relationshipCompanies',
  'relationshipInvitations',
  'relationshipRemovalRequests',
  'relationshipRemovalApprovals',
  'projectCompanyInvitations',
  'projectCompanies',
  'projectArchiveRequests',
  'projectArchiveApprovals',
  'projectArchiveEntitlements',
  'projectArchiveSnapshots',
  'channelParticipationRequests',
] as const

const taskTableNames = [
  'taskBoards',
  'taskWorkflowStates',
  'tasks',
  'taskLabels',
  'taskLabelLinks',
  'taskReferences',
  'taskComments',
  'taskFollowers',
  'taskActivities',
  'taskSuggestions',
  'taskSuggestionReferences',
  'taskSuggestionHides',
  'taskDetectionSettings',
  'taskDetectionRuns',
  'taskNotificationSettings',
  'taskNotifications',
  'taskReminderJobs',
  'taskArchiveSnapshots',
  'taskExitSnapshotStaging',
] as const

const threadTableNames = [
  'channelThreads',
  'channelThreadFollowers',
  'channelThreadReadStates',
] as const

describe('combined foundation schema', () => {
  it('exports every additive Company, task, and thread table', () => {
    expect([...tables.keys()]).toEqual(expect.arrayContaining([
      ...companyTableNames,
      ...taskTableNames,
      ...threadTableNames,
    ]))
  })

  it.each([
    ['companies', 'by_handle'],
    ['companyMembers', 'by_company_user'],
    ['projectCompanies', 'by_project_company_term'],
    ['projectMembers', 'by_project_company_user_term'],
    ['groupMembers', 'by_group_project_member'],
    ['taskBoards', 'by_scope_default'],
    ['tasks', 'by_board_state_rank'],
    ['taskSuggestions', 'by_project_fingerprint'],
    ['channelThreads', 'by_group_idempotency'],
    ['channelThreadFollowers', 'by_thread_member'],
    ['messages', 'by_group_channel_sequence'],
  ] as const)('exports %s.%s', (tableName, indexName) => {
    const indexNames = tables.get(tableName)?.indexes.map((index) => index.indexDescriptor)
    expect(indexNames).toContain(indexName)
  })

  it('exports permission-filterable task, thread, and message search indexes', () => {
    expect(tables.get('tasks')?.searchIndexes).toContainEqual(expect.objectContaining({
      indexDescriptor: 'search_tasks',
      filterFields: ['projectId', 'groupId', 'archivedAt'],
    }))
    expect(tables.get('messages')?.searchIndexes).toContainEqual(expect.objectContaining({
      indexDescriptor: 'search_body_by_project',
      filterFields: ['projectId'],
    }))
    expect(tables.get('channelThreads')?.searchIndexes).toContainEqual(
      expect.objectContaining({
        indexDescriptor: 'search_name_by_project',
        filterFields: ['projectId', 'groupId', 'status'],
      }),
    )
  })
})
