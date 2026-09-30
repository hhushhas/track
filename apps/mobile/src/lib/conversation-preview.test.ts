import { describe, expect, it } from 'vitest';

import { buildChannelPreview, buildThreadPreview } from './conversation-preview';

describe('conversation long-press previews', () => {
  it('previews a Channel with its Project, latest message, and source route', () => {
    expect(buildChannelPreview({
      channelName: 'Leadership',
      href: '/conversation?projectId=project-1&groupId=channel-1',
      lastMessage: '  Review is ready.  ',
      projectName: 'Mobile',
      unread: true,
      scope: { archived: false, groupId: 'channel-1', membershipId: 'member-1', projectId: 'project-1' },
    })).toEqual({
      channelName: 'Leadership',
      href: '/conversation?projectId=project-1&groupId=channel-1',
      kind: 'channel',
      messages: [{ label: 'Latest message', text: 'Review is ready.' }],
      projectName: 'Mobile',
      scope: { archived: false, groupId: 'channel-1', membershipId: 'member-1', projectId: 'project-1' },
      title: 'Leadership',
      unread: true,
    });
  });

  it('previews a Thread from its source message through its latest reply', () => {
    expect(buildThreadPreview({
      channelName: 'Leadership',
      href: '/thread?projectId=project-1&threadId=thread-1',
      latestReply: 'I will send the revised build.',
      projectName: 'Mobile',
      sourceMessage: 'Please review the release.',
      title: 'Delivery review',
      unread: false,
      scope: { archived: false, companyId: 'company-1', groupId: 'channel-1', membershipId: 'member-1', projectId: 'project-1', threadId: 'thread-1' },
    })).toMatchObject({
      kind: 'thread',
      scope: { groupId: 'channel-1', projectId: 'project-1', threadId: 'thread-1' },
      messages: [
        { label: 'Thread started from', text: 'Please review the release.' },
        { label: 'Latest reply', text: 'I will send the revised build.' },
      ],
      title: 'Delivery review',
    });
  });

  it('keeps the authorized Channel scope needed to render its live chat preview', () => {
    expect(buildChannelPreview({
      channelName: 'Leadership',
      href: '/conversation',
      lastMessage: 'Latest update',
      projectName: 'Mobile',
      unread: false,
      scope: { archived: true, companyId: 'company-1', groupId: 'channel-1', membershipId: 'member-1', projectId: 'project-1' },
    }).scope).toEqual({
      archived: true,
      companyId: 'company-1',
      groupId: 'channel-1',
      membershipId: 'member-1',
      projectId: 'project-1',
    });
  });

  it('does not repeat the source when the latest reply matches it', () => {
    expect(buildThreadPreview({
      channelName: 'Leadership',
      href: '/thread',
      latestReply: 'Same message',
      projectName: 'Mobile',
      sourceMessage: 'Same message',
      title: 'Delivery review',
      unread: false,
      scope: { archived: false, groupId: 'channel-1', membershipId: 'member-1', projectId: 'project-1', threadId: 'thread-1' },
    }).messages).toEqual([{ label: 'Thread started from', text: 'Same message' }]);
  });
});
