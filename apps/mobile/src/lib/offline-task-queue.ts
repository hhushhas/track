import { platformStorage } from './platform-storage';
import type { Id } from '../../../../convex/_generated/dataModel';
import { appendUniqueOfflineTask, removeOfflineTaskByKey } from './offline-task-queue-core';
import type { OfflineTaskCreate, OfflineTaskItem } from './offline-task-queue-types';

export type { OfflineTaskCreate, OfflineTaskItem } from './offline-task-queue-types';

const storagePrefix = 'track.offline-task-queue';
const storageOperations = new Map<string, Promise<void>>();

function storageKey(userId: Id<'users'>) {
  return `${storagePrefix}.${userId}`;
}

async function readOfflineTasksRaw(userId: Id<'users'>) {
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

function serializeStorageOperation<T>(userId: Id<'users'>, operation: () => Promise<T>) {
  const key = storageKey(userId);
  const previous = storageOperations.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const tracked = current.then(() => undefined, () => undefined);
  storageOperations.set(key, tracked);
  void tracked.then(() => {
    if (storageOperations.get(key) === tracked) storageOperations.delete(key);
  });
  return current;
}

export async function readOfflineTasks(userId: Id<'users'>) {
  return serializeStorageOperation(userId, () => readOfflineTasksRaw(userId));
}

export async function enqueueOfflineTask(userId: Id<'users'>, task: OfflineTaskCreate) {
  await serializeStorageOperation(userId, async () => {
    const items = await readOfflineTasksRaw(userId);
    if (!items.some((item) => item.idempotencyKey === task.idempotencyKey)) {
      await writeOfflineTasks(userId, appendUniqueOfflineTask(items, { ...task, queuedAt: Date.now() }));
    }
  });
}

export async function removeOfflineTask(userId: Id<'users'>, idempotencyKey: string) {
  await serializeStorageOperation(userId, async () => {
    const items = await readOfflineTasksRaw(userId);
    await writeOfflineTasks(userId, removeOfflineTaskByKey(items, idempotencyKey));
  });
}

export async function markOfflineTaskFailed(userId: Id<'users'>, idempotencyKey: string, error: string) {
  await serializeStorageOperation(userId, async () => {
    const items = await readOfflineTasksRaw(userId);
    await writeOfflineTasks(userId, items.map((item) => item.idempotencyKey === idempotencyKey ? { ...item, lastError: error } : item));
  });
}

export async function clearOfflineTaskError(userId: Id<'users'>, idempotencyKey: string) {
  await serializeStorageOperation(userId, async () => {
    const items = await readOfflineTasksRaw(userId);
    await writeOfflineTasks(userId, items.map((item) => {
      if (item.idempotencyKey !== idempotencyKey) return item;
      const { lastError: _lastError, ...retryable } = item;
      return retryable;
    }));
  });
}
