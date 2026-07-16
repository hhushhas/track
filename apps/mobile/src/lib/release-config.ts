import { useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import {
  defaultReleaseFeatureFlags,
  type ReleaseFeatureFlags,
} from '@track/shared/feature-flags';

const releaseConfigQuery = makeFunctionReference<
  'query',
  Record<string, never>,
  ReleaseFeatureFlags
>('releaseConfig:getReleaseConfig');

export function resolveReleaseConfig(
  serverProjection: ReleaseFeatureFlags | null | undefined,
): ReleaseFeatureFlags {
  return serverProjection ?? defaultReleaseFeatureFlags;
}

export function useReleaseConfig() {
  return resolveReleaseConfig(useQuery(releaseConfigQuery));
}
