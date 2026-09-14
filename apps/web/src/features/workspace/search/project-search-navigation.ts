import type { Id } from '../../../../../../convex/_generated/dataModel'
import { threadHref } from '#/features/threads/thread-navigation'
import type { ProjectSearchResult } from './ProjectSearchDialog'

type SearchScope = {
  actingCompanyId?: Id<'companies'>
  projectId: Id<'projects'>
  projectMemberId?: Id<'projectMembers'>
}

export function projectSearchResultHref(result: ProjectSearchResult, scope: SearchScope) {
  const { actingCompanyId, projectId, projectMemberId } = scope
  const companyScope = actingCompanyId && projectMemberId
    ? { actingCompanyId, projectMemberId }
    : undefined

  if (result.kind === 'task' && result.taskKey) {
    const search = new URLSearchParams({ task: result.taskKey, view: 'all' })
    if (companyScope) {
      search.set('actingCompanyId', companyScope.actingCompanyId)
      search.set('projectMemberId', companyScope.projectMemberId)
    }
    return `/workspace/projects/${encodeURIComponent(projectId)}/tasks?${search}`
  }

  if (result.threadId && result.groupId) {
    return threadHref(
      projectId,
      result.groupId,
      result.threadId,
      companyScope,
      result.messageId,
    )
  }

  if (result.groupId) {
    if (companyScope) {
      const search = new URLSearchParams({
        companyId: companyScope.actingCompanyId,
        groupId: result.groupId,
        membershipId: companyScope.projectMemberId,
        view: 'channels',
      })
      const messageHash = result.messageId
        ? `#message-${encodeURIComponent(result.messageId)}`
        : ''
      return `/workspace/company-projects/${encodeURIComponent(projectId)}?${search}${messageHash}`
    }
    const messageHash = result.messageId
      ? `#message-${encodeURIComponent(result.messageId)}`
      : ''
    return `/workspace/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(result.groupId)}${messageHash}`
  }

  if (result.kind === 'person') {
    return companyScope
      ? '/workspace/company/?view=people'
      : `/workspace/projects/${encodeURIComponent(projectId)}/settings#people`
  }

  if (result.kind === 'project') {
    if (!companyScope) return `/workspace/projects/${encodeURIComponent(projectId)}`
    const search = new URLSearchParams({
      companyId: companyScope.actingCompanyId,
      membershipId: companyScope.projectMemberId,
      view: 'overview',
    })
    return `/workspace/company-projects/${encodeURIComponent(projectId)}?${search}`
  }

  return null
}

export function projectSearchDestinationCompanyId(
  result: ProjectSearchResult,
  scope: SearchScope,
) {
  return result.kind === 'person' && scope.actingCompanyId && scope.projectMemberId
    ? scope.actingCompanyId
    : undefined
}
