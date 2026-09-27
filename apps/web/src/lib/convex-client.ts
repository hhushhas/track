import { ConvexReactClient } from 'convex/react'
import type { MutationOptions } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type {
  ArgsAndOptions,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from 'convex/server'
import { captureConvexCall } from './browser-diagnostics'

const runtimeEnv = typeof process === 'undefined' ? undefined : process.env
const convexUrl = import.meta.env.PROD
  ? (import.meta.env.VITE_CONVEX_URL_PROD ?? runtimeEnv?.VITE_CONVEX_URL_PROD)
  : (import.meta.env.VITE_CONVEX_URL ?? runtimeEnv?.VITE_CONVEX_URL ?? runtimeEnv?.CONVEX_URL)

if (typeof convexUrl !== 'string' || !convexUrl) {
  throw new Error(
    import.meta.env.PROD ? 'VITE_CONVEX_URL_PROD is required' : 'VITE_CONVEX_URL is required',
  )
}

class TracedConvexClient extends ConvexReactClient {
  async mutation<Mutation extends FunctionReference<'mutation'>>(
    mutation: Mutation,
    ...args: ArgsAndOptions<Mutation, MutationOptions<FunctionArgs<Mutation>>>
  ): Promise<FunctionReturnType<Mutation>> {
    const started = performance.now()
    const requestId = crypto.randomUUID().replaceAll('-', '')
    let failed = false
    try {
      // oxlint-disable-next-line typescript/no-unsafe-return -- safe because Convex's typed function reference determines the return type.
      return await super.mutation(mutation, ...args)
    } catch (error) {
      failed = true
      throw error
    } finally {
      captureConvexCall(
        getFunctionName(mutation),
        'mutation',
        requestId,
        performance.now() - started,
        failed,
      )
    }
  }

  async action<Action extends FunctionReference<'action'>>(
    action: Action,
    ...args: OptionalRestArgs<Action>
  ): Promise<FunctionReturnType<Action>> {
    const started = performance.now()
    const requestId = crypto.randomUUID().replaceAll('-', '')
    let failed = false
    try {
      // oxlint-disable-next-line typescript/no-unsafe-return -- safe because Convex's typed function reference determines the return type.
      return await super.action(action, ...args)
    } catch (error) {
      failed = true
      throw error
    } finally {
      captureConvexCall(
        getFunctionName(action),
        'action',
        requestId,
        performance.now() - started,
        failed,
      )
    }
  }

  async query<Query extends FunctionReference<'query'>>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ): Promise<FunctionReturnType<Query>> {
    const started = performance.now()
    const requestId = crypto.randomUUID().replaceAll('-', '')
    let failed = false
    try {
      // oxlint-disable-next-line typescript/no-unsafe-return -- safe because Convex's typed function reference determines the return type.
      return await super.query(query, ...args)
    } catch (error) {
      failed = true
      throw error
    } finally {
      captureConvexCall(
        getFunctionName(query),
        'query',
        requestId,
        performance.now() - started,
        failed,
      )
    }
  }
}

export const convexClient = new TracedConvexClient(convexUrl)
