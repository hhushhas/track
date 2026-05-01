import { useMutation } from 'convex/react'

import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import type { draftClassifications, draftStatuses } from '#/features/workspace/constants'

export function useWorkspaceRecordActions({
  activeGroupId,
  activeProjectId,
  onBusyChange,
  onClearError,
  onError,
  trackUserId,
}: {
  activeGroupId: Id<'groups'> | null
  activeProjectId: Id<'projects'> | null
  onBusyChange: (label: string | null) => void
  onClearError: () => void
  onError: (error: unknown) => void
  trackUserId: Id<'users'> | null
}) {
  const classifyDraftMutation = useMutation(api.records.classifyDraft)
  const updateRecordStatus = useMutation(api.records.updateStatus)

  async function withRecordBusy(label: string, action: () => Promise<void>) {
    onBusyChange(label)
    onClearError()
    try {
      await action()
    } catch (error) {
      onError(error)
    } finally {
      onBusyChange(null)
    }
  }

  async function handleRecordStatus(
    recordId: Id<'records'>,
    status: (typeof draftStatuses)[number],
  ) {
    if (!trackUserId || !activeProjectId) return
    await withRecordBusy(`record-status-${recordId}`, async () => {
      await updateRecordStatus({
        projectId: activeProjectId,
        recordId,
        actorId: trackUserId,
        status,
      })
    })
  }

  async function handleClassifyDraft(
    draftRecordId: Id<'draftRecords'>,
    classification: (typeof draftClassifications)[number],
    updates: { title: string; description: string; status: (typeof draftStatuses)[number] },
  ) {
    if (!trackUserId || !activeProjectId || !activeGroupId) return
    await withRecordBusy(`classify-${draftRecordId}`, async () => {
      await classifyDraftMutation({
        projectId: activeProjectId,
        groupId: activeGroupId,
        draftRecordId,
        reviewerId: trackUserId,
        classification,
        status: updates.status,
        title: updates.title,
        description: updates.description,
      })
    })
  }

  return {
    handleClassifyDraft,
    handleRecordStatus,
  }
}
