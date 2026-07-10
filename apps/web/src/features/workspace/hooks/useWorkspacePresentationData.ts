import { useQuery } from 'convex/react'
import { useMemo } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc } from '../../../../../../convex/_generated/dataModel'
import { buildComposerPlaceholder } from '#/features/workspace/lib/mentions'
import { buildChatSearchMatches } from '#/features/workspace/search/chat-search'
import { buildMessageCitations, buildWorkspaceThreadItems } from '#/features/workspace/search/chat-thread-data'
import { buildProjectSearchSections, getProjectSearchTotal } from '#/features/workspace/search/project-search-sections'
import type { useWorkspaceData } from '#/features/workspace/hooks/useWorkspaceData'

type WorkspaceData = ReturnType<typeof useWorkspaceData>

type PresentationDataOptions = Pick<
  WorkspaceData,
  | 'activeGroup'
  | 'activeProjectMembers'
  | 'groupAssistantStreams'
  | 'groupMessages'
  | 'projectSearchResults'
> & {
  activeChatMatchIndex: number
  chatSearchQuery: string
}

export function useWorkspacePresentationData({
  activeChatMatchIndex,
  activeGroup,
  activeProjectMembers,
  chatSearchQuery,
  groupAssistantStreams,
  groupMessages,
  projectSearchResults,
}: PresentationDataOptions) {
  const visibleMessages = useMemo(() => [...groupMessages].reverse(), [groupMessages])
  const threadItems = useMemo(
    () => buildWorkspaceThreadItems({ assistantStreams: groupAssistantStreams, messages: visibleMessages }),
    [groupAssistantStreams, visibleMessages],
  )
  const chatSearchTerm = chatSearchQuery.trim()
  const chatSearchMatches = useMemo(
    () => buildChatSearchMatches(threadItems, chatSearchTerm),
    [chatSearchTerm, threadItems],
  )
  const chatSearchMatchKeys = useMemo(
    () => new Set(chatSearchMatches.map((match) => match.key)),
    [chatSearchMatches],
  )
  const headerMembers = useMemo(
    () => activeProjectMembers.filter((item) => item.user).slice(0, 5),
    [activeProjectMembers],
  )
  const headerMemberAvatarUrls = useQuery(
    api.auth.getAvatarUrls,
    headerMembers.length
      ? { userIds: headerMembers.map((item) => (item.user as Doc<'users'>)._id) }
      : 'skip',
  )
  const headerMemberAvatarUrlById = useMemo(
    () => new Map((headerMemberAvatarUrls ?? []).flatMap((item) => item.url ? [[item.userId, item.url]] : [])),
    [headerMemberAvatarUrls],
  )
  const messageAuthorIds = useMemo(
    () => Array.from(new Set(visibleMessages.flatMap((item) => item.author ? [item.author._id] : []))),
    [visibleMessages],
  )
  const messageAuthorAvatarUrls = useQuery(
    api.auth.getAvatarUrls,
    messageAuthorIds.length ? { userIds: messageAuthorIds } : 'skip',
  )
  const messageAuthorAvatarUrlById = useMemo(
    () => new Map((messageAuthorAvatarUrls ?? []).flatMap((item) => item.url ? [[item.userId, item.url]] : [])),
    [messageAuthorAvatarUrls],
  )
  const hiddenHeaderMembers = useMemo(
    () => activeProjectMembers.filter((item) => item.user).slice(headerMembers.length),
    [activeProjectMembers, headerMembers.length],
  )
  const projectSearchSections = useMemo(
    () => buildProjectSearchSections(projectSearchResults),
    [projectSearchResults],
  )

  return {
    activeChatMatch: chatSearchMatches[activeChatMatchIndex] ?? null,
    chatSearchMatches,
    chatSearchMatchKeys,
    chatSearchTerm,
    composerPlaceholder: buildComposerPlaceholder({
      activeGroupName: activeGroup?.name,
      activeProjectMembers,
    }),
    extraHeaderMemberCount: Math.max(
      activeProjectMembers.filter((item) => item.user).length - headerMembers.length,
      0,
    ),
    headerMemberAvatarUrlById,
    headerMembers,
    hiddenHeaderMembers,
    latestThreadItemKey: threadItems.at(-1)?.key ?? null,
    messageAuthorAvatarUrlById,
    messageCitations: buildMessageCitations(visibleMessages),
    projectSearchSections,
    projectSearchTotal: getProjectSearchTotal(projectSearchSections),
    threadItems,
    visibleMessages,
  }
}
