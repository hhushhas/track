import { ConvexReactClient } from 'convex/react'
import type { MutationOptions, Watch, WatchQueryOptions } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type {
  ArgsAndOptions,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from 'convex/server'
import { captureConvexCall, serverRequestId } from './browser-diagnostics'

const runtimeEnv = typeof process === 'undefined' ? undefined : process.env
const convexUrl = import.meta.env.PROD
  ? (import.meta.env.VITE_CONVEX_URL_PROD ?? runtimeEnv?.VITE_CONVEX_URL_PROD)
  : (import.meta.env.VITE_CONVEX_URL ?? runtimeEnv?.VITE_CONVEX_URL ?? runtimeEnv?.CONVEX_URL)

if (typeof convexUrl !== 'string' || !convexUrl) {
  throw new Error(
    import.meta.env.PROD ? 'VITE_CONVEX_URL_PROD is required' : 'VITE_CONVEX_URL is required',
  )
}

const reportedErrors = new WeakSet<Error>()
const reportedRequestIds = new Set<string>()

function reportCall(
  functionName: string,
  operation: 'query' | 'mutation' | 'action',
  started: number,
  failed: boolean,
  error: unknown,
) {
  const requestId = serverRequestId(error)
  if (failed && requestId) {
    if (reportedRequestIds.has(requestId)) return
  }
  if (failed && error instanceof Error) {
    if (reportedErrors.has(error)) return
    reportedErrors.add(error)
  }
  if (failed && requestId) {
    if (reportedRequestIds.size >= 500) reportedRequestIds.clear()
    reportedRequestIds.add(requestId)
  }
  captureConvexCall(functionName, operation, requestId, performance.now() - started, failed)
}

class TracedConvexClient extends ConvexReactClient {
  watchQuery<Query extends FunctionReference<'query'>>(
    query: Query,
    ...argsAndOptions: ArgsAndOptions<Query, WatchQueryOptions>
  ): Watch<FunctionReturnType<Query>> {
    const watch = super.watchQuery(query, ...argsAndOptions)
    const started = performance.now()
    return {
      ...watch,
      localQueryResult: () => {
        try {
          // oxlint-disable-next-line typescript/no-unsafe-return -- Convex's typed Watch determines the query result type.
          return watch.localQueryResult()
        } catch (error) {
          reportCall(getFunctionName(query), 'query', started, true, error)
          throw error
        }
      },
    }
  }

  async mutation<Mutation extends FunctionReference<'mutation'>>(
    mutation: Mutation,
    ...args: ArgsAndOptions<Mutation, MutationOptions<FunctionArgs<Mutation>>>
  ): Promise<FunctionReturnType<Mutation>> {
    const started = performance.now()
    let failed = false
    let failure: unknown
    try {
      // oxlint-disable-next-line typescript/no-unsafe-return -- safe because Convex's typed function reference determines the return type.
      return await super.mutation(mutation, ...args)
    } catch (error) {
      failed = true
      failure = error
      throw error
    } finally {
      reportCall(getFunctionName(mutation), 'mutation', started, failed, failure)
    }
  }

  async action<Action extends FunctionReference<'action'>>(
    action: Action,
    ...args: OptionalRestArgs<Action>
  ): Promise<FunctionReturnType<Action>> {
    const started = performance.now()
    let failed = false
    let failure: unknown
    try {
      // oxlint-disable-next-line typescript/no-unsafe-return -- safe because Convex's typed function reference determines the return type.
      return await super.action(action, ...args)
    } catch (error) {
      failed = true
      failure = error
      throw error
    } finally {
      reportCall(getFunctionName(action), 'action', started, failed, failure)
    }
  }

  async query<Query extends FunctionReference<'query'>>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ): Promise<FunctionReturnType<Query>> {
    const started = performance.now()
    let failed = false
    let failure: unknown
    try {
      // oxlint-disable-next-line typescript/no-unsafe-return -- safe because Convex's typed function reference determines the return type.
      return await super.query(query, ...args)
    } catch (error) {
      failed = true
      failure = error
      throw error
    } finally {
      reportCall(getFunctionName(query), 'query', started, failed, failure)
    }
  }
}

export const convexClient = new TracedConvexClient(convexUrl)
