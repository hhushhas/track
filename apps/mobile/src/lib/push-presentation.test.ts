import { afterEach, describe, expect, it } from 'vitest';

import { setActivePushContext, shouldPresentPush } from './push-presentation';

afterEach(() => setActivePushContext(null));

describe('foreground push presentation', () => {
  it('suppresses only the exact active Channel, thread, and task', () => {
    setActivePushContext({ projectId: 'p', groupId: 'g' });
    expect(shouldPresentPush({ projectId: 'p', groupId: 'g' })).toBe(false);
    expect(shouldPresentPush({ projectId: 'p', groupId: 'other' })).toBe(true);

    setActivePushContext({ projectId: 'p', groupId: 'g', threadId: 't' });
    expect(shouldPresentPush({ projectId: 'p', groupId: 'g', threadId: 't' })).toBe(false);
    expect(shouldPresentPush({ projectId: 'p', groupId: 'g' })).toBe(true);

    setActivePushContext({ projectId: 'p', taskKey: 'T-1' });
    expect(shouldPresentPush({ projectId: 'p', taskKey: 'T-1' })).toBe(false);
    expect(shouldPresentPush({ projectId: 'p', taskKey: 'T-2' })).toBe(true);
  });
});
