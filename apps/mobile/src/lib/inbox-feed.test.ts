import { describe, expect, it } from 'vitest';

import { sortInboxItems } from './inbox-feed';

describe('sortInboxItems', () => {
  it('keeps the feed newest first so date headings remain grouped', () => {
    const sorted = sortInboxItems([
      { createdAt: 300, eventType: 'assignment', kind: 'task', id: 'new-task' },
      { createdAt: 100, eventType: 'mention', kind: 'message', id: 'old-mention' },
      { createdAt: 200, eventType: 'direct_reply', kind: 'message', id: 'reply' },
    ]);

    expect(sorted.map(({ id }) => id)).toEqual(['new-task', 'reply', 'old-mention']);
  });

  it('uses message urgency to break equal-time ties and pins a routed invitation', () => {
    const items = [
      { createdAt: 100, eventType: 'assignment', kind: 'task', id: 'task' },
      { createdAt: 100, eventType: 'mention', kind: 'message', id: 'mention' },
      { createdAt: 50, eventType: 'company_invitation', kind: 'invitation', id: 'invitation' },
    ];

    expect(sortInboxItems(items).map(({ id }) => id)).toEqual(['mention', 'task', 'invitation']);
    expect(sortInboxItems(items, ({ id }) => id === 'invitation').map(({ id }) => id)).toEqual(['invitation', 'mention', 'task']);
  });
});
