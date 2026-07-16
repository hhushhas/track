export const releaseFeatureNames = ['companyModel', 'tasks', 'threads'] as const
export type ReleaseFeatureName = (typeof releaseFeatureNames)[number]

export type ReleaseFeatureFlags = Readonly<Record<ReleaseFeatureName, boolean>>

export const defaultReleaseFeatureFlags = Object.freeze({
  companyModel: false,
  tasks: false,
  threads: false,
}) satisfies ReleaseFeatureFlags

export const projectAccessProfiles = ['legacy', 'company'] as const
export type ProjectAccessProfile = (typeof projectAccessProfiles)[number]

export function resolveProjectAccessProfile(
  persistedProfile: ProjectAccessProfile | null | undefined,
): ProjectAccessProfile {
  return persistedProfile ?? 'legacy'
}
