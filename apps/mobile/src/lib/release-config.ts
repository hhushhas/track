import { useQuery } from 'convex/react';
import {
  defaultReleaseFeatureFlags,
  type ReleaseFeatureFlags,
} from '@track/shared/feature-flags';
import { api } from '../../../../convex/_generated/api';

export function resolveReleaseConfig(
  serverProjection: ReleaseFeatureFlags | null | undefined,
): ReleaseFeatureFlags {
  return serverProjection ?? defaultReleaseFeatureFlags;
}

export function useReleaseConfig() {
  return resolveReleaseConfig(useQuery(api.releaseConfig.getReleaseConfig));
}
