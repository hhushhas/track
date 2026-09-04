import { describe, expect, it } from 'vitest';

import { appendUniqueOfflineTask, removeOfflineTaskByKey } from './offline-task-queue-core';
import type { OfflineTaskItem } from './offline-task-queue-types';

const task: OfflineTaskItem = {
  projectId: 'project_123' as never,
  title: 'Follow up',
  priority: 'none' as const,
  idempotencyKey: 'message-task:message_123',
  queuedAt: 1,
};

describe('offline task queue', () => {
  it('deduplicates a reviewed task and removes it after confirmed sync', async () => {
    const queued = appendUniqueOfflineTask(appendUniqueOfflineTask([], task), task);
    expect(queued).toHaveLength(1);
    expect(removeOfflineTaskByKey(queued, task.idempotencyKey)).toEqual([]);
  });
});
