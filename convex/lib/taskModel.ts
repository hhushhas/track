import { isTaskDueDate, isTaskTitle, taskPriorities, type TaskPriority } from '@track/shared/tasks'

export type TaskDetectionMessage = Readonly<{
  id: string
  author: string
  authorProjectMemberId?: string
  body: string
  sequence: number
}>

export type TaskModelCandidate = Readonly<{
  title: string
  description?: string
  priority?: TaskPriority
  assigneeProjectMemberId?: string
  dueDate?: string
  sourceMessageIds: ReadonlyArray<string>
  confidence: number
  groundingReason: string
}>

export type TaskModelResult = Readonly<{
  model: string
  candidates: ReadonlyArray<TaskModelCandidate>
}>

export interface TaskModelAdapter {
  detect(messages: ReadonlyArray<TaskDetectionMessage>): Promise<TaskModelResult>
}

export function parseTaskModelCandidates(
  raw: string,
  allowedMessageIds: ReadonlySet<string>,
): ReadonlyArray<TaskModelCandidate> {
  const normalized = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch (cause) {
    throw new Error('task_model_output_invalid', { cause })
  }
  if (!parsed || typeof parsed !== 'object' || !('candidates' in parsed) || !Array.isArray(parsed.candidates)) {
    throw new Error('task_model_output_invalid')
  }
  const rawCandidates: ReadonlyArray<unknown> = parsed.candidates
  const candidates: Array<TaskModelCandidate> = []
  for (const value of rawCandidates.slice(0, 8)) {
    if (!value || typeof value !== 'object') continue
    if (!('title' in value) || typeof value.title !== 'string' || !isTaskTitle(value.title)) continue
    if (!('confidence' in value) || typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) continue
    if (!('groundingReason' in value) || typeof value.groundingReason !== 'string' || !value.groundingReason.trim()) continue
    if (!('sourceMessageIds' in value) || !Array.isArray(value.sourceMessageIds) || !value.sourceMessageIds.length) continue
    const rawSourceIds: ReadonlyArray<unknown> = value.sourceMessageIds
    const sourceMessageIds = rawSourceIds.filter(
      // nosemgrep: q9.javascript.no-unvalidated-json-parse -- safe because the string guard precedes the scoped source-ID lookup.
      (id): id is string => typeof id === 'string' && allowedMessageIds.has(id),
    )
    // nosemgrep: q9.javascript.no-unvalidated-json-parse -- safe because every source ID was type-guarded and membership-checked above.
    if (!sourceMessageIds.length || sourceMessageIds.length !== rawSourceIds.length) continue
    const dueDate = 'dueDate' in value && typeof value.dueDate === 'string' && isTaskDueDate(value.dueDate)
      ? value.dueDate : undefined
    const priority = 'priority' in value ? taskPriorities.find((candidatePriority) => candidatePriority === value.priority) : undefined
    const assigneeProjectMemberId = 'assigneeProjectMemberId' in value && typeof value.assigneeProjectMemberId === 'string'
      ? value.assigneeProjectMemberId : undefined
    candidates.push({
      // nosemgrep: q9.javascript.no-unvalidated-json-parse -- safe because title is narrowed to a string and validated by isTaskTitle above.
      title: value.title.trim(),
      description: 'description' in value && typeof value.description === 'string' ? value.description.slice(0, 20_000) : undefined,
      priority,
      assigneeProjectMemberId,
      dueDate,
      sourceMessageIds,
      // nosemgrep: q9.javascript.no-unvalidated-json-parse -- safe because confidence was narrowed to a finite number in the inclusive range above.
      confidence: value.confidence,
      groundingReason: value.groundingReason.slice(0, 500),
    })
  }
  return candidates
}

export function taskDetectionPrompt(messages: ReadonlyArray<TaskDetectionMessage>) {
  return [
    'Identify only explicit, grounded action items in this one Channel conversation.',
    'Return JSON only: {"candidates":[{"title":"...","description":"...","assigneeProjectMemberId":"only when a supplied member id is explicitly assigned","priority":"none|urgent|high|medium|low","dueDate":"YYYY-MM-DD","sourceMessageIds":["..."],"confidence":0.0,"groundingReason":"..."}]}.',
    'Do not invent owners, dates, or work. An empty candidates array is valid.',
    ...messages.map((message) => `[${message.id}${message.authorProjectMemberId ? `; member=${message.authorProjectMemberId}` : ''}] ${message.author}: ${message.body}`),
  ].join('\n')
}

export function createDeterministicFakeTaskModel(
  result: TaskModelResult | Error,
): TaskModelAdapter {
  return {
    async detect() {
      if (result instanceof Error) throw result
      return structuredClone(result)
    },
  }
}
