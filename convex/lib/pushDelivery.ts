const MAX_LABEL_LENGTH = 80

export type ExpoFailureCategory =
  | 'device_not_registered'
  | 'invalid_credentials'
  | 'invalid_payload'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'network_error'
  | 'unknown_permanent'

export function safePushLabel(value: string | null | undefined, fallback: string) {
  const normalized = value?.replaceAll(/[\r\n\t]+/g, ' ').replaceAll(/\s+/g, ' ').trim()
  return (normalized || fallback).slice(0, MAX_LABEL_LENGTH)
}

export function messagePushCopy(input: {
  eventKind: string
  senderName: string
  groupName: string
  threadName?: string
  previewMode: 'context' | 'hidden'
}) {
  if (input.previewMode === 'hidden') {
    return { title: 'Track', body: input.eventKind === 'mention' ? 'You were mentioned' : 'New conversation activity' }
  }
  const sender = safePushLabel(input.senderName, 'A teammate')
  const location = safePushLabel(input.threadName || input.groupName, 'a Channel')
  if (input.eventKind === 'mention') return { title: 'Track', body: `${sender} mentioned you in ${location}` }
  if (input.eventKind === 'direct_reply') return { title: 'Track', body: `${sender} replied to you in ${location}` }
  if (input.eventKind === 'thread_reply') return { title: 'Track', body: `New reply from ${sender} in ${location}` }
  return { title: 'Track', body: `New message from ${sender} in ${location}` }
}

export function taskPushCopy(input: {
  eventKind: string
  projectName: string
  publicKey: string
  previewMode: 'context' | 'hidden'
}) {
  const event = input.eventKind.replaceAll('_', ' ')
  if (input.previewMode === 'hidden') return { title: 'Track', body: `New task ${event}` }
  const project = safePushLabel(input.projectName, 'a Project')
  const publicKey = safePushLabel(input.publicKey, 'task')
  const verb = input.eventKind === 'assignment'
    ? 'You were assigned'
    : input.eventKind === 'assignment_lost'
      ? 'Assignment changed for'
      : input.eventKind === 'mention'
        ? 'You were mentioned on'
        : input.eventKind === 'due_soon'
          ? 'Due soon'
          : input.eventKind === 'overdue'
            ? 'Overdue'
            : 'Task updated'
  return { title: 'Track', body: `${verb} ${publicKey} in ${project}` }
}

export function classifyExpoFailure(input: { error?: string; httpStatus?: number }): {
  category: ExpoFailureCategory
  permanent: boolean
} {
  if (input.error === 'DeviceNotRegistered') return { category: 'device_not_registered', permanent: true }
  if (input.error === 'InvalidCredentials') return { category: 'invalid_credentials', permanent: true }
  if (input.error === 'MessageTooBig' || input.error === 'MessageRateExceeded') {
    return input.error === 'MessageRateExceeded'
      ? { category: 'rate_limited', permanent: false }
      : { category: 'invalid_payload', permanent: true }
  }
  if (input.httpStatus === 429) return { category: 'rate_limited', permanent: false }
  if (input.httpStatus && input.httpStatus >= 500) return { category: 'provider_unavailable', permanent: false }
  if (input.httpStatus && input.httpStatus >= 400) return { category: 'invalid_payload', permanent: true }
  if (!input.httpStatus) return { category: 'network_error', permanent: false }
  return { category: 'unknown_permanent', permanent: true }
}

export function retryDelayMs(attemptNumber: number) {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attemptNumber - 1))
}
