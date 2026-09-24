import type { CompanyProjectRole, ProjectStatus } from './company'
import type { ProjectRole as LegacyProjectRole } from './domain'
import type { ProjectAccessProfile } from './feature-flags'

export const projectAccessModes = ['active', 'archive'] as const
export type ProjectAccessMode = (typeof projectAccessModes)[number]

type PolicyScope = {
  accessMode: ProjectAccessMode
  channelMember: boolean
  channelActive?: boolean
  channelSteward?: boolean
  projectStatus?: ProjectStatus
}

export type ProjectChannelPolicyInput =
  | (PolicyScope & {
      accessProfile: 'legacy'
      projectRole: LegacyProjectRole
    })
  | (PolicyScope & {
      accessProfile: 'company'
      projectRole: CompanyProjectRole
    })

export type ProjectChannelCapabilities = Readonly<{
  accessProfile: ProjectAccessProfile
  accessMode: ProjectAccessMode
  canReadProject: boolean
  canWriteProject: boolean
  canManageProject: boolean
  canReadChannel: boolean
  canWriteChannel: boolean
  canStewardChannel: boolean
  taskCollaboration: 'admin' | 'full' | 'scoped' | 'read_only'
}>

export function resolveProjectChannelCapabilities(
  input: ProjectChannelPolicyInput,
): ProjectChannelCapabilities {
  const projectStatus = input.projectStatus ?? 'active'
  const collaborationWritable = input.accessMode === 'active' && projectStatus === 'active'
  const managementWritable = input.accessMode === 'active' &&
    (projectStatus === 'active' || projectStatus === 'proposed')
  const manager =
    input.accessProfile === 'legacy'
      ? input.projectRole === 'owner' || input.projectRole === 'admin'
      : input.projectRole === 'manager'
  const channelActive = input.channelActive ?? true
  const authorizedSteward =
    input.accessProfile === 'legacy' ? manager : input.channelSteward === true

  let taskCollaboration: ProjectChannelCapabilities['taskCollaboration'] = 'scoped'
  if (!collaborationWritable) {
    taskCollaboration = 'read_only'
  } else if (manager) {
    taskCollaboration = 'admin'
  } else if (input.accessProfile === 'legacy' && input.projectRole === 'staff') {
    taskCollaboration = 'full'
  }

  return {
    accessProfile: input.accessProfile,
    accessMode: input.accessMode,
    canReadProject: true,
    canWriteProject: collaborationWritable,
    canManageProject: managementWritable && manager,
    canReadChannel: input.channelMember,
    canWriteChannel: collaborationWritable && input.channelMember && channelActive,
    canStewardChannel: collaborationWritable && input.channelMember && authorizedSteward,
    taskCollaboration,
  }
}
