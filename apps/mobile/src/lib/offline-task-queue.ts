import { platformStorage } from './platform-storage';
import type { Id } from '../../../../convex/_generated/dataModel';
import { appendUniqueOfflineTask, removeOfflineTaskByKey } from './offline-task-queue-core';
import type { OfflineTaskCreate, OfflineTaskItem } from './offline-task-queue-types';

export type { OfflineTaskCreate, OfflineTaskItem } from './offline-task-queue-types';

const storagePrefix = 'track.offline-task-queue';

function storageKey(userId: Id<'users'>) {
  return `${storagePrefix}.${userId}`;
}

export async function readOfflineTasks(userId: Id<'users'>) {
  const raw = await platformStorage.getItemAsync(storageKey(userId));
  if (!raw) return [] as OfflineTaskItem[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as OfflineTaskItem[] : [];
  } catch {
    return [] as OfflineTaskItem[];
  }
}

async function writeOfflineTasks(userId: Id<'users'>, items: OfflineTaskItem[]) {
  if (items.length === 0) {
    await platformStorage.deleteItemAsync(storageKey(userId));
    return;
  }
  await platformStorage.setItemAsync(storageKey(userId), JSON.stringify(items));
}

export async function enqueueOfflineTask(userId: Id<'users'>, task: OfflineTaskCreate) {
  const items = await readOfflineTasks(userId);
  if (!items.some((item) => item.idempotencyKey === task.idempotencyKey)) {
    await writeOfflineTasks(userId, appendUniqueOfflineTask(items, { ...task, queuedAt: Date.now() }));
  }
}

export async function removeOfflineTask(userId: Id<'users'>, idempotencyKey: string) {
  const items = await readOfflineTasks(userId);
  await writeOfflineTasks(userId, removeOfflineTaskByKey(items, idempotencyKey));
}

export async function markOfflineTaskFailed(userId: Id<'users'>, idempotencyKey: string, error: string) {
  const items = await readOfflineTasks(userId);
  await writeOfflineTasks(userId, items.map((item) => item.idempotencyKey === idempotencyKey ? { ...item, lastError: error } : item));
}

export async function clearOfflineTaskError(userId: Id<'users'>, idempotencyKey: string) {
  const items = await readOfflineTasks(userId);
  await writeOfflineTasks(userId, items.map((item) => {
    if (item.idempotencyKey !== idempotencyKey) return item;
    const { lastError: _lastError, ...retryable } = item;
    return retryable;
  }));
}
