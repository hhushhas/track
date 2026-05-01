import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import type { StepUpMethod } from '#/features/workspace/components/StepUpVerificationDialog'

type StepUpAction = 'export_project_record'
type ExportFormat = 'csv' | 'pdf'

export function useProjectRecordExport({
  activeProjectId,
  currentTrackUser,
  trackUserId,
  onError,
}: {
  activeProjectId: Id<'projects'> | null
  currentTrackUser: Doc<'users'> | null | undefined
  trackUserId: Id<'users'> | null
  onError: (error: unknown) => void
}) {
  const requestExport = useMutation(api.exports.request)
  const verifyStepUpTotp = useMutation(api.auth.verifyStepUpTotp)
  const [latestExportId, setLatestExportId] = useState<Id<'exports'> | null>(null)
  const [stepUpDialogOpen, setStepUpDialogOpen] = useState(false)
  const [stepUpAction, setStepUpAction] = useState<StepUpAction | null>(null)
  const [stepUpCode, setStepUpCode] = useState('')
  const [stepUpMethod, setStepUpMethod] = useState<StepUpMethod>('totp')
  const [stepUpMessage, setStepUpMessage] = useState('')
  const [pendingExportFormat, setPendingExportFormat] = useState<ExportFormat | null>(null)
  const [exportBusyAction, setExportBusyAction] = useState<string | null>(null)

  const exports = useQuery(
    api.exports.list,
    trackUserId && activeProjectId
      ? { userId: trackUserId, projectId: activeProjectId }
      : 'skip',
  )
  const exportDownloadUrl = useQuery(
    api.exports.getDownloadUrl,
    trackUserId && latestExportId ? { userId: trackUserId, exportId: latestExportId } : 'skip',
  )
  const exportStepUpFresh = useQuery(
    api.auth.hasFreshStepUp,
    trackUserId ? { userId: trackUserId, action: 'export_project_record' } : 'skip',
  )

  const projectExports = useMemo(() => (exports ?? []) as Array<Doc<'exports'>>, [exports])
  const latestCompletedExport =
    projectExports.find((exportJob) => exportJob.status === 'completed') ?? null

  useEffect(() => {
    if (!latestCompletedExport || latestExportId) return
    setLatestExportId(latestCompletedExport._id)
  }, [latestCompletedExport, latestExportId])

  async function withExportBusy(label: string, action: () => Promise<void>) {
    setExportBusyAction(label)
    try {
      await action()
    } catch (error) {
      onError(error)
    } finally {
      setExportBusyAction(null)
    }
  }

  function openStepUpDialog(format: ExportFormat) {
    setPendingExportFormat(format)
    setStepUpAction('export_project_record')
    setStepUpCode('')
    setStepUpMethod('totp')
    setStepUpMessage('')
    setStepUpDialogOpen(true)
  }

  async function requestProjectExport(format: ExportFormat) {
    if (!trackUserId || !activeProjectId) return
    const exportId = await requestExport({
      projectId: activeProjectId,
      userId: trackUserId,
      format,
      preset: format === 'pdf' ? 'full_audit_packet' : 'client_summary',
    })
    setLatestExportId(exportId)
  }

  async function performRequestExport(format: ExportFormat) {
    await withExportBusy(`export-${format}`, async () => {
      await requestProjectExport(format)
    })
  }

  async function handleRequestExport(format: ExportFormat) {
    if (!trackUserId || !activeProjectId) return
    if (currentTrackUser?.twoFactorEnabled && !exportStepUpFresh) {
      openStepUpDialog(format)
      return
    }
    setExportBusyAction(`export-${format}`)
    try {
      await requestProjectExport(format)
    } catch (error) {
      if (error instanceof Error && error.message.includes('step_up_required')) {
        openStepUpDialog(format)
      } else {
        onError(error)
      }
    } finally {
      setExportBusyAction(null)
    }
  }

  async function handleVerifyStepUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackUserId || !stepUpAction) return
    if (!stepUpCode.trim()) {
      setStepUpMessage('Enter an authenticator or backup code.')
      return
    }

    await withExportBusy('step-up', async () => {
      try {
        await verifyStepUpTotp({
          userId: trackUserId,
          action: stepUpAction,
          code: stepUpCode.trim(),
          method: stepUpMethod,
        })
        const exportFormat = pendingExportFormat
        closeStepUpDialog()
        if (exportFormat) await performRequestExport(exportFormat)
      } catch (error) {
        setStepUpMessage(error instanceof Error ? error.message : 'Invalid verification code.')
      }
    })
  }

  function closeStepUpDialog() {
    setStepUpDialogOpen(false)
    setPendingExportFormat(null)
    setStepUpAction(null)
    setStepUpMessage('')
  }

  return {
    exportBusyAction,
    exportDownloadUrl,
    handleRequestExport,
    latestExportId,
    stepUpDialogOpen,
    stepUpDialogProps: {
      busy: exportBusyAction === 'step-up',
      code: stepUpCode,
      message: stepUpMessage,
      method: stepUpMethod,
      onCancel: closeStepUpDialog,
      onCodeChange: setStepUpCode,
      onMethodChange: setStepUpMethod,
      onSubmit: handleVerifyStepUp,
    },
  }
}
