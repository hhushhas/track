import { createDiagnosticCode, sanitizeDiagnosticEvent } from '@q9labsai/diagnostics'
import type { DiagnosticEvent } from '@q9labsai/diagnostics'
import { api } from '../../../../convex/_generated/api'

const journeyTraceId = typeof window === 'undefined' ? undefined : createDiagnosticCode()
const pending: DiagnosticEvent[] = []
let flushing = false
let timer: ReturnType<typeof setTimeout> | undefined
let authenticated = false
let authGeneration = 0

function isDiagnosticAuthenticated() {
  return authenticated
}

function eventId() {
  return crypto.randomUUID().replaceAll('-', '')
}

function spanId() {
  return createDiagnosticCode().slice(0, 16)
}

function safeErrorClass(error: unknown) {
  return error instanceof Error && /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/.test(error.name)
    ? error.name
    : 'Error'
}

export function serverRequestId(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return /\[Request ID: ([0-9a-f]{16,32})\]/.exec(message)?.[1]
}

function makeEvent(
  input: Omit<
    DiagnosticEvent,
    'version' | 'eventId' | 'spanId' | 'occurredAt' | 'source' | 'status' | 'level'
  > & {
    status?: DiagnosticEvent['status']
    level?: DiagnosticEvent['level']
  },
) {
  return sanitizeDiagnosticEvent({
    version: 1,
    eventId: eventId(),
    spanId: spanId(),
    occurredAt: Date.now(),
    source: 'browser',
    status: input.status ?? 'ok',
    level: input.level ?? 'info',
    ...input,
  })
}

function schedule(delay = 250) {
  if (timer || !authenticated || typeof window === 'undefined') return
  timer = setTimeout(() => {
    timer = undefined
    void flush()
  }, delay)
}

export function setDiagnosticAuthenticated(value: boolean) {
  if (authenticated !== value) authGeneration += 1
  authenticated = value
  if (!value && timer) {
    clearTimeout(timer)
    timer = undefined
  }
  if (value && pending.length) schedule(0)
}

async function flush() {
  if (flushing || !authenticated || !pending.length) return
  flushing = true
  const deliveryGeneration = authGeneration
  const batch = pending.slice(0, 20)
  try {
    const { convexClient } = await import('./convex-client')
    if (!isDiagnosticAuthenticated()) return
    const result = await convexClient.mutation(api.diagnostics.ingest, { events: batch })
    if ('rejected' in result) {
      if (result.rejected === 'unauthenticated') {
        if (authGeneration === deliveryGeneration) authenticated = false
        else schedule()
      } else schedule(30_000)
      return
    }
    pending.splice(0, batch.length)
    if (pending.length) schedule()
  } catch {
    schedule(30_000)
  } finally {
    flushing = false
  }
}

function enqueue(event: DiagnosticEvent) {
  if (pending.length === 100) pending.shift()
  pending.push(event)
  schedule()
}

export function captureNavigation(routeTemplate: string) {
  if (!journeyTraceId) return
  try {
    enqueue(
      makeEvent({
        traceId: journeyTraceId,
        journeyTraceId,
        kind: 'navigation',
        name: 'browser.navigation',
        attributes: { route_template: routeTemplate },
      }),
    )
  } catch {
    /* A malformed route template must not break navigation. */
  }
}

export function captureUnhandled(error: unknown) {
  if (!journeyTraceId) return
  try {
    enqueue(
      makeEvent({
        traceId: journeyTraceId,
        journeyTraceId,
        kind: 'error',
        name: 'browser.unhandled',
        status: 'error',
        level: 'error',
        errorClass: safeErrorClass(error),
      }),
    )
  } catch {
    /* Diagnostics is independent of the application. */
  }
}

export function captureConvexCall(
  functionName: string,
  operation: 'query' | 'mutation' | 'action',
  requestId: string | undefined,
  durationMs: number,
  failed: boolean,
) {
  if (!journeyTraceId || functionName === 'diagnostics:ingest') return
  try {
    enqueue(
      makeEvent({
        traceId: journeyTraceId,
        journeyTraceId,
        kind: 'request',
        name: 'browser.convex_request',
        status: failed ? 'error' : 'ok',
        level: failed ? 'warning' : 'info',
        durationMs,
        requestId,
        attributes: { function: functionName, operation_type: operation },
      }),
    )
  } catch {
    /* Diagnostics is independent of the application. */
  }
}

export async function reportRouteFailure(error: unknown): Promise<string | undefined> {
  if (!journeyTraceId || !authenticated) return undefined
  const traceId = createDiagnosticCode()
  try {
    const { convexClient } = await import('./convex-client')
    if (!isDiagnosticAuthenticated()) return undefined
    const message = error instanceof Error ? error.message : ''
    const operation = /\[CONVEX ([QMA])\(([a-zA-Z0-9_/-]+:[a-zA-Z0-9_]+)\)\]/.exec(message)
    const operationType =
      operation?.[1] === 'Q' ? 'query' : operation?.[1] === 'M' ? 'mutation' : 'action'
    const event = makeEvent({
      traceId,
      journeyTraceId,
      kind: 'error',
      name: 'browser.route_failure',
      status: 'error',
      level: 'error',
      errorClass: safeErrorClass(error),
      requestId: serverRequestId(error),
      attributes: operation ? { function: operation[2], operation_type: operationType } : undefined,
    })
    const result = await convexClient.mutation(api.diagnostics.ingest, { events: [event] })
    if ('rejected' in result) return undefined
    return traceId
  } catch {
    return undefined
  }
}

export function installUnhandledCapture() {
  if (typeof window === 'undefined') return () => {}
  const onError = (event: ErrorEvent) => captureUnhandled(event.error)
  const onRejection = (event: PromiseRejectionEvent) => captureUnhandled(event.reason)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
