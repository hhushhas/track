import { describe, expect, it } from 'vitest'

import { filterVisibleProjectGroups, findVisibleRouteGroupId } from './lib/route-state'

describe('workspace route state', () => {
  it('accepts only group route params that belong to visible groups', () => {
    const visibleGroups = [
      { _id: 'jn7generalgroupid' },
      { _id: 'jn7internalgroupid' },
    ] as Parameters<typeof findVisibleRouteGroupId>[1]

    expect(findVisibleRouteGroupId('jn7internalgroupid', visibleGroups)).toBe(
      'jn7internalgroupid',
    )
    expect(findVisibleRouteGroupId('k575projectidfrombadurl', visibleGroups)).toBe(null)
    expect(findVisibleRouteGroupId(undefined, visibleGroups)).toBe(null)
  })

  it('drops stale groups from a previous project while switching projects', () => {
    const groups = [
      { _id: 'jn7generalgroupid', projectId: 'k170oldprojectid' },
      { _id: 'jn7newgeneralid', projectId: 'k170newprojectid' },
    ] as Parameters<typeof filterVisibleProjectGroups>[0]

    expect(filterVisibleProjectGroups(groups, 'k170newprojectid' as never)).toEqual([
      { _id: 'jn7newgeneralid', projectId: 'k170newprojectid' },
    ])
    expect(filterVisibleProjectGroups(groups, null)).toEqual([])
  })
})
