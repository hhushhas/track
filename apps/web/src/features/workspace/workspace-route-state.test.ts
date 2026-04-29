import { describe, expect, it } from 'vitest'

import { findVisibleRouteGroupId } from './pages/WorkspacePage'

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
})
