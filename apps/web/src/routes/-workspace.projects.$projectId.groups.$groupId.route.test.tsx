import { render, screen } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { GroupRouteLayout, Route as GroupRoute } from './workspace.projects.$projectId.groups.$groupId'

function RootRoute() {
  return <Outlet />
}

function ProjectRoute() {
  return <Outlet />
}

function ThreadRoute() {
  return <p>Company-scoped thread surface</p>
}

describe('legacy group route composition', () => {
  it('mounts a nested thread under the group layout without the legacy workspace page', async () => {
    expect(GroupRoute.options.component).toBe(GroupRouteLayout)

    const rootRoute = createRootRoute({ component: RootRoute })
    const projectRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/workspace/projects/$projectId',
      component: ProjectRoute,
    })
    const groupRoute = createRoute({
      getParentRoute: () => projectRoute,
      path: '/groups/$groupId',
      component: GroupRouteLayout,
    })
    const threadRoute = createRoute({
      getParentRoute: () => groupRoute,
      path: '/threads/$threadId',
      component: ThreadRoute,
    })
    const routeTree = rootRoute.addChildren([
      projectRoute.addChildren([groupRoute.addChildren([threadRoute])]),
    ])
    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/workspace/projects/project/groups/group/threads/thread'],
      }),
      routeTree,
    })

    await router.load()
    render(<RouterProvider router={router} />)

    expect(screen.getByText('Company-scoped thread surface')).toBeTruthy()
  })
})
