import { isTaskDueDate, isTaskTitle } from '@track/shared/tasks'

export type TaskDetectionMessage = Readonly<{
  id: string
  author: string
  body: string
  sequence: number
}>

export type TaskModelCandidate = Readonly<{
  title: string
  description?: string
  priority?: 'none' | 'urgent' | 'high' | 'medium' | 'low'
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

const priorities = new Set(['none', 'urgent', 'high', 'medium', 'low'])

export function parseTaskModelCandidates(
  raw: string,
  allowedMessageIds: ReadonlySet<string>,
): ReadonlyArray<TaskModelCandidate> {
  const normalized = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(normalized) as { candidates?: Array<Record<string, unknown>> }
  if (!Array.isArray(parsed.candidates)) throw new Error('task_model_output_invalid')
  const candidates: Array<TaskModelCandidate> = []
  for (const value of parsed.candidates.slice(0, 8)) {
    if (typeof value.title !== 'string' || !isTaskTitle(value.title)) continue
    if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) continue
    if (typeof value.groundingReason !== 'string' || !value.groundingReason.trim()) continue
    if (!Array.isArray(value.sourceMessageIds) || !value.sourceMessageIds.length) continue
    const sourceMessageIds = value.sourceMessageIds.filter(
      (id): id is string => typeof id === 'string' && allowedMessageIds.has(id),
    )
    if (!sourceMessageIds.length || sourceMessageIds.length !== value.sourceMessageIds.length) continue
    const dueDate = typeof value.dueDate === 'string' && isTaskDueDate(value.dueDate)
      ? value.dueDate : undefined
    const priority = typeof value.priority === 'string' && priorities.has(value.priority)
      ? value.priority as TaskModelCandidate['priority'] : undefined
    candidates.push({
      title: value.title.trim(),
      description: typeof value.description === 'string' ? value.description.slice(0, 20_000) : undefined,
      priority,
      dueDate,
      sourceMessageIds,
      confidence: value.confidence,
      groundingReason: value.groundingReason.slice(0, 500),
    })
  }
  return candidates
}

export function taskDetectionPrompt(messages: ReadonlyArray<TaskDetectionMessage>) {
  return [
    'Identify only explicit, grounded action items in this one Channel conversation.',
    'Return JSON only: {"candidates":[{"title":"...","description":"...","priority":"none|urgent|high|medium|low","dueDate":"YYYY-MM-DD","sourceMessageIds":["..."],"confidence":0.0,"groundingReason":"..."}]}.',
    'Do not invent owners, dates, or work. An empty candidates array is valid.',
    ...messages.map((message) => `[${message.id}] ${message.author}: ${message.body}`),
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
