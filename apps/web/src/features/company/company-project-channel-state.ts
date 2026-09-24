export function resolveActiveCompanyProjectChannel<T extends string>(
  currentChannelId: T | null,
  availableChannelIds: ReadonlyArray<T> | undefined,
): T | null {
  if (availableChannelIds === undefined) return currentChannelId
  if (currentChannelId && availableChannelIds.includes(currentChannelId)) return currentChannelId
  return availableChannelIds[0] ?? null
}
