import { query } from './_generated/server'
import type { ReleaseFeatureFlags } from '@track/shared/feature-flags'

export const releaseFeatureEnvironmentVariables = {
  companyModel: 'TRACK_COMPANY_MODEL_ENABLED',
  tasks: 'TRACK_TASKS_ENABLED',
  threads: 'TRACK_THREADS_ENABLED',
} as const

type ReleaseConfigEnvironment = Partial<
  Record<(typeof releaseFeatureEnvironmentVariables)[keyof typeof releaseFeatureEnvironmentVariables], string | undefined>
>

export function parseReleaseFeatureFlag(value: string | undefined) {
  return value === 'true'
}

export function readReleaseFeatureFlags(
  environment: ReleaseConfigEnvironment,
): ReleaseFeatureFlags {
  return {
    companyModel: parseReleaseFeatureFlag(environment.TRACK_COMPANY_MODEL_ENABLED),
    tasks: parseReleaseFeatureFlag(environment.TRACK_TASKS_ENABLED),
    threads: parseReleaseFeatureFlag(environment.TRACK_THREADS_ENABLED),
  }
}

export const getReleaseConfig = query({
  args: {},
  handler: () => readReleaseFeatureFlags(process.env),
})
