import { useQuery } from 'convex/react'
import {
  type ReleaseFeatureFlags,
  type ReleaseFeatureProjection,
  unavailableReleaseFeatureFlags,
} from '@track/shared/feature-flags'
import { api } from '../../../../convex/_generated/api'

export type ReleaseConfigState =
  | { status: 'loading'; config: ReleaseFeatureFlags }
  | { status: 'ready'; config: ReleaseFeatureFlags }

export function resolveReleaseConfig(
  serverProjection: ReleaseFeatureProjection | null | undefined,
): ReleaseFeatureFlags {
  return serverProjection
    ? { ...serverProjection, projectSnapshots: serverProjection.projectSnapshots === true }
    : unavailableReleaseFeatureFlags
}

export function resolveReleaseConfigState(
  serverProjection: ReleaseFeatureProjection | null | undefined,
): ReleaseConfigState {
  if (serverProjection === undefined) {
    return { status: 'loading', config: unavailableReleaseFeatureFlags }
  }
  return { status: 'ready', config: resolveReleaseConfig(serverProjection) }
}

export function useReleaseConfigState() {
  return resolveReleaseConfigState(useQuery(api.releaseConfig.getReleaseConfig))
}

export function useReleaseConfig() {
  return useReleaseConfigState().config
}

export function useReleaseConfigProjection() {
  return useQuery(api.releaseConfig.getReleaseConfig)
}
