import { describe, expect, it } from 'vitest'

import {
  canAdministerCompany,
  canTransitionCompany,
  canTransitionProjectCompany,
  companyProjectRoles,
  companyRoles,
  hasUnanimousApproval,
  isCompanyHandleAllowed,
  normalizeCompanyHandle,
  projectStatuses,
  resolveRelationshipStatus,
} from './company'
import { resolveProjectChannelCapabilities } from './project-policy'
import {
  isTaskDueDate,
  isTerminalTaskState,
  taskPriorities,
  taskStateCategories,
} from './tasks'
import { channelThreadFollowReasons, channelThreadStatuses } from './threads'

describe('foundation domain contracts', () => {
  it('publishes stable Company, task, and thread vocabulary', () => {
    expect(companyRoles).toEqual(['owner', 'admin', 'member'])
    expect(companyProjectRoles).toEqual(['manager', 'member'])
    expect(projectStatuses).toEqual(['proposed', 'active', 'archive_pending', 'archived'])
    expect(taskStateCategories).toEqual([
      'backlog',
      'unstarted',
      'started',
      'completed',
      'canceled',
    ])
    expect(taskPriorities).toEqual(['none', 'urgent', 'high', 'medium', 'low'])
    expect(channelThreadStatuses).toEqual(['active', 'archived'])
    expect(channelThreadFollowReasons).toEqual(['created', 'replied', 'mentioned', 'explicit'])
  })

  it('keeps date and terminal-state rules framework independent', () => {
    expect(isTerminalTaskState('completed')).toBe(true)
    expect(isTerminalTaskState('canceled')).toBe(true)
    expect(isTerminalTaskState('started')).toBe(false)
    expect(isTaskDueDate('2028-02-29')).toBe(true)
    expect(isTaskDueDate('2027-02-29')).toBe(false)
    expect(isTaskDueDate('2027-2-09')).toBe(false)
  })

  it('normalizes private Company handles and rejects reserved or malformed handles', () => {
    expect(normalizeCompanyHandle('  Q9  Labs ')).toBe('q9-labs')
    expect(isCompanyHandleAllowed('q9-labs')).toBe(true)
    expect(isCompanyHandleAllowed('support')).toBe(false)
    expect(isCompanyHandleAllowed('-broken')).toBe(false)
  })

  it('keeps lifecycle and unanimous approval rules deterministic', () => {
    expect(canAdministerCompany('admin')).toBe(true)
    expect(canAdministerCompany('member')).toBe(false)
    expect(canTransitionCompany('closed', 'active')).toBe(false)
    expect(canTransitionCompany('suspended', 'active')).toBe(true)
    expect(canTransitionProjectCompany('active', 'exited')).toBe(false)
    expect(canTransitionProjectCompany('exit_pending', 'exited')).toBe(true)
    expect(resolveRelationshipStatus(0)).toBe('closed')
    expect(resolveRelationshipStatus(1)).toBe('inactive')
    expect(resolveRelationshipStatus(3)).toBe('active')
    expect(hasUnanimousApproval(
      ['alpha', 'beta'],
      new Map([['alpha', 'approved'], ['beta', 'approved']]),
    )).toBe(true)
    expect(hasUnanimousApproval(
      ['alpha', 'beta'],
      new Map([['alpha', 'approved']]),
    )).toBe(false)
  })
})

describe('central Project and Channel policy contract', () => {
  it('preserves the legacy task matrix behind exact Channel membership', () => {
    expect(resolveProjectChannelCapabilities({
      accessProfile: 'legacy',
      accessMode: 'active',
      projectRole: 'staff',
      channelMember: false,
      channelActive: true,
      channelSteward: false,
    })).toMatchObject({
      canReadProject: true,
      canWriteProject: true,
      canManageProject: false,
      canReadChannel: false,
      taskCollaboration: 'full',
    })
  })

  it('requires exact Channel membership and stewardship for a company-model manager', () => {
    const withoutChannel = resolveProjectChannelCapabilities({
      accessProfile: 'company',
      accessMode: 'active',
      projectRole: 'manager',
      channelMember: false,
      channelActive: true,
      channelSteward: false,
    })
    const withChannel = resolveProjectChannelCapabilities({
      accessProfile: 'company',
      accessMode: 'active',
      projectRole: 'manager',
      channelMember: true,
      channelActive: true,
      channelSteward: false,
    })
    const withStewardship = resolveProjectChannelCapabilities({
      accessProfile: 'company',
      accessMode: 'active',
      projectRole: 'manager',
      channelMember: true,
      channelActive: true,
      channelSteward: true,
    })
    expect(withoutChannel.canManageProject).toBe(true)
    expect(withoutChannel.canReadChannel).toBe(false)
    expect(withoutChannel.canStewardChannel).toBe(false)
    expect(withChannel.canStewardChannel).toBe(false)
    expect(withStewardship.canStewardChannel).toBe(true)
  })

  it('makes an archive entitlement read-only without broadening its Channel set', () => {
    expect(resolveProjectChannelCapabilities({
      accessProfile: 'company',
      accessMode: 'archive',
      projectRole: 'manager',
      channelMember: true,
      channelActive: true,
      channelSteward: true,
    })).toMatchObject({
      canReadProject: true,
      canWriteProject: false,
      canManageProject: false,
      canReadChannel: true,
      canWriteChannel: false,
      canStewardChannel: false,
      taskCollaboration: 'read_only',
    })
  })

  it('keeps an archived Channel readable but blocks ordinary writes', () => {
    expect(resolveProjectChannelCapabilities({
      accessProfile: 'legacy',
      accessMode: 'active',
      projectRole: 'owner',
      channelMember: true,
      channelActive: false,
      channelSteward: true,
    })).toMatchObject({
      canReadChannel: true,
      canWriteChannel: false,
      canStewardChannel: true,
    })
  })
})
