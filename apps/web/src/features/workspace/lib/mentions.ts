import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { getGroupAvatar } from '#/features/workspace/group-avatar'
import { getAvatarTone, getMentionHandle } from '#/features/workspace/identity'

export type WorkspaceProjectMember = {
  membership: Doc<'projectMembers'>
  user: Doc<'users'> | null
}

export type WorkspaceMentionOption =
  | {
      id: 'track'
      kind: 'assistant'
      label: string
      sublabel: string
      handle: string
      tone: string
    }
  | {
      id: Id<'groups'>
      kind: 'group'
      label: string
      sublabel: string
      handle: string
      tone: string
    }
  | {
      id: Id<'users'>
      kind: 'member'
      label: string
      sublabel: string
      handle: string
      tone: string
    }

export type WorkspaceMentionSection = {
  label: string
  options: Array<WorkspaceMentionOption>
}

export function buildWorkspaceMentionOptions(
  activeProjectMembers: Array<WorkspaceProjectMember>,
  visibleGroups: Array<Doc<'groups'>>,
): Array<WorkspaceMentionOption> {
  const members = activeProjectMembers
    .filter((item) => item.user)
    .map((item) => {
      const user = item.user as Doc<'users'>
      return {
        id: user._id,
        kind: 'member' as const,
        label: user.displayName,
        sublabel: item.membership.role,
        handle: getMentionHandle(user.displayName) || getMentionHandle(user.email),
        tone: getAvatarTone(user.email),
      }
    })
  const reservedHandles = new Set(['track', ...members.map((member) => member.handle)])
  const groupMentions = visibleGroups
    .map((group) => ({
      id: group._id,
      kind: 'group' as const,
      label: group.name,
      sublabel: 'group',
      handle: getMentionHandle(group.name),
      tone: getGroupAvatar(group).tone,
    }))
    .filter((group) => group.handle && !reservedHandles.has(group.handle))

  return [
    {
      id: 'track',
      kind: 'assistant',
      label: 'Track Assistant',
      sublabel: 'ai review',
      handle: 'track',
      tone: 'bot',
    },
    ...groupMentions,
    ...members,
  ]
}

export function buildMentionGroups(
  activeProjectMembers: Array<WorkspaceProjectMember>,
  visibleGroups: Array<Doc<'groups'>>,
) {
  const groupsByHandle = new Map<string, Doc<'groups'>>()
  const reservedHandles = new Set([
    'track',
    ...activeProjectMembers
      .filter((item) => item.user)
      .map((item) => {
        const user = item.user as Doc<'users'>
        return getMentionHandle(user.displayName) || getMentionHandle(user.email)
      }),
  ])
  for (const group of visibleGroups) {
    const handle = getMentionHandle(group.name)
    if (handle && !reservedHandles.has(handle)) groupsByHandle.set(handle, group)
  }
  return groupsByHandle
}

export function filterMentionOptions(
  mentionOptions: Array<WorkspaceMentionOption>,
  query: string,
) {
  const matchesQuery = (option: WorkspaceMentionOption) =>
    option.handle.includes(query) ||
    option.label.toLowerCase().includes(query) ||
    option.sublabel.toLowerCase().includes(query)
  const assistantOptions = mentionOptions
    .filter((option) => option.kind === 'assistant')
    .filter(matchesQuery)
  const groupOptions = mentionOptions
    .filter((option) => option.kind === 'group')
    .filter(matchesQuery)
    .slice(0, 4)
  const memberOptions = mentionOptions
    .filter((option) => option.kind === 'member')
    .filter(matchesQuery)
    .slice(0, 4)
  return [...assistantOptions, ...groupOptions, ...memberOptions].slice(0, 9)
}

export function buildMentionSections(
  mentionOptions: Array<WorkspaceMentionOption>,
): Array<WorkspaceMentionSection> {
  return [
    {
      label: 'Groups',
      options: mentionOptions.filter((option) => option.kind === 'group'),
    },
    {
      label: 'People',
      options: mentionOptions.filter((option) => option.kind === 'member'),
    },
    {
      label: 'Assistant',
      options: mentionOptions.filter((option) => option.kind === 'assistant'),
    },
  ].filter((section) => section.options.length > 0)
}

export function buildComposerPlaceholder({
  activeGroupName,
  activeProjectMembers,
}: {
  activeGroupName: string | undefined
  activeProjectMembers: Array<WorkspaceProjectMember>
}) {
  const composerPeople = activeProjectMembers
    .filter((item) => item.user)
    .slice(0, 3)
    .map((item) => item.user?.displayName.split(' ')[0])
    .filter(Boolean)
  return composerPeople.length > 0
    ? `Write to the project - ${composerPeople.join(', ')}${activeProjectMembers.length > composerPeople.length ? ` and ${activeProjectMembers.length - composerPeople.length} others` : ''}`
    : `Message ${activeGroupName ?? 'the project'} or ask @track...`
}
