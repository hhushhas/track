import { useQuery } from 'convex/react'
import {
  type ReleaseFeatureFlags,
  unavailableReleaseFeatureFlags,
} from '@track/shared/feature-flags'
import { api } from '../../../../convex/_generated/api'

export function resolveReleaseConfig(
  serverProjection: ReleaseFeatureFlags | null | undefined,
): ReleaseFeatureFlags {
  return serverProjection ?? unavailableReleaseFeatureFlags
}

export function useReleaseConfig() {
  return resolveReleaseConfig(useQuery(api.releaseConfig.getReleaseConfig))
}
