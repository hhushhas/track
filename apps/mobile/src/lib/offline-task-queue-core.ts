import type { OfflineTaskItem } from './offline-task-queue-types';

export function appendUniqueOfflineTask(items: OfflineTaskItem[], task: OfflineTaskItem) {
  return items.some((item) => item.idempotencyKey === task.idempotencyKey) ? items : [...items, task];
}

export function removeOfflineTaskByKey(items: OfflineTaskItem[], idempotencyKey: string) {
  return items.filter((item) => item.idempotencyKey !== idempotencyKey);
}

