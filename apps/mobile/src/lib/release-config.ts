import { useQuery } from 'convex/react';
import {
  type ReleaseFeatureFlags,
  type ReleaseFeatureProjection,
  unavailableReleaseFeatureFlags,
} from '@track/shared/feature-flags';
import { api } from '../../../../convex/_generated/api';

export function resolveReleaseConfig(
  serverProjection: ReleaseFeatureProjection | null | undefined,
): ReleaseFeatureFlags {
  return serverProjection
    ? { ...serverProjection, projectSnapshots: serverProjection.projectSnapshots === true }
    : unavailableReleaseFeatureFlags;
}

export function useReleaseConfig() {
  return resolveReleaseConfig(useQuery(api.releaseConfig.getReleaseConfig));
}
