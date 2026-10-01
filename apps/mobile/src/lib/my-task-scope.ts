type MyTaskProjectItem = { project: { _id: unknown } };

/** Keeps every My Tasks surface on the same explicitly selected Project scope. */
export function scopeMyTaskItems<T extends MyTaskProjectItem>(items: readonly T[], projectId: string | null) {
  return projectId ? items.filter((item) => String(item.project._id) === projectId) : [...items];
}
