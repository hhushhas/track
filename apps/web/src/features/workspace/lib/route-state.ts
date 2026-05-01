import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'

export function filterVisibleProjectGroups(
  groups: Array<Doc<'groups'>>,
  activeProjectId: Id<'projects'> | null,
) {
  if (!activeProjectId) return []
  return groups.filter((group) => group.projectId === activeProjectId)
}

export function findVisibleRouteGroupId(
  routeGroupId: string | undefined,
  visibleGroups: Array<Pick<Doc<'groups'>, '_id'>>,
) {
  if (!routeGroupId) return null
  return visibleGroups.find((group) => group._id === routeGroupId)?._id ?? null
}
