import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Id } from '../../../../../../convex/_generated/dataModel'
import { WorkspaceRail } from './WorkspaceRail'

const baseProps = {
  activeProjectId: 'project-id' as Id<'projects'>,
  busyAction: null,
  globalNotificationMode: 'all' as const,
  groupNotificationMode: 'all' as const,
  notificationPermission: 'default' as const,
  notificationStatus: null,
  references: [{ id: 'attachment-id', filename: 'launch.pdf', contentType: 'application/pdf', url: 'https://example.test/launch.pdf' }],
  members: [{ id: 'user-id', name: 'Ada Lovelace' }],
  projectName: 'Launch',
  channelName: 'Planning',
  onCollapse: vi.fn(),
  onEnableBrowserNotifications: vi.fn(),
  onExpand: vi.fn(),
  onNotificationMode: vi.fn(),
  onSendTestNotification: vi.fn(),
  onStartResize: vi.fn(),
}

afterEach(cleanup)

describe('WorkspaceRail', () => {
  it('keeps notification settings directly below the expand control when collapsed', () => {
    render(<WorkspaceRail {...baseProps} railCollapsed />)

    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Expand workspace details',
      'Notification settings',
    ])
  })

  it('renders privacy-safe references, members, and Project context already supplied by the workspace', () => {
    render(<WorkspaceRail {...baseProps} railCollapsed={false} />)

    expect(screen.getByRole('heading', { name: 'Pinned and recent references' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Members' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Project context' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /launch\.pdf/ }).getAttribute('href')).toBe('https://example.test/launch.pdf')
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('Launch · Planning')).toBeTruthy()
    expect(screen.queryByText('Invitations')).toBeNull()
    expect(screen.queryByText('Audit Trail')).toBeNull()
  })

  it('uses accurate empty states when no visible reference or member data is supplied', () => {
    render(<WorkspaceRail {...baseProps} references={[]} members={[]} railCollapsed={false} />)
    expect(screen.getByText('No recent references')).toBeTruthy()
    expect(screen.getByText('No members available')).toBeTruthy()
  })
})
