import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { WorkspaceRail } from './WorkspaceRail'

const releaseFlags = vi.hoisted(() => ({ tasks: true, threads: true }))

vi.mock('#/lib/release-config', () => ({
  useReleaseConfig: () => releaseFlags,
}))

const baseProps = {
  activeGroup: undefined,
  activeProjectId: 'project-id' as Id<'projects'>,
  busyAction: null,
  globalNotificationMode: 'all' as const,
  groupNotificationMode: 'all' as const,
  notificationPermission: 'default' as const,
  notificationStatus: null,
  onCollapse: vi.fn(),
  onEnableBrowserNotifications: vi.fn(),
  onExpand: vi.fn(),
  onNotificationMode: vi.fn(),
  onSendTestNotification: vi.fn(),
  onStartResize: vi.fn(),
  userId: 'user-id' as Id<'users'>,
  visibleMessages: [],
}

afterEach(() => {
  cleanup()
  releaseFlags.tasks = true
  releaseFlags.threads = true
})

describe('WorkspaceRail', () => {
  it('keeps notification settings directly below the expand control when collapsed', () => {
    render(<WorkspaceRail {...baseProps} railCollapsed />)

    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Expand workspace details',
      'Notification settings',
    ])
  })

  it('does not render invitation emails or audit history when expanded', () => {
    render(<WorkspaceRail {...baseProps} railCollapsed={false} />)

    expect(screen.getByText('Recent references')).toBeTruthy()
    expect(screen.queryByText('Invitations')).toBeNull()
    expect(screen.queryByText('Audit Trail')).toBeNull()
  })

  it('keeps task and thread rail content behind its release flags', () => {
    releaseFlags.tasks = false
    releaseFlags.threads = false

    render(<WorkspaceRail
      {...baseProps}
      activeGroup={{ _id: 'group-id', status: 'active' } as Doc<'groups'>}
      railCollapsed={false}
    />)

    expect(screen.queryByText('Open tasks')).toBeNull()
    expect(screen.queryByText('Threads')).toBeNull()
  })
})
