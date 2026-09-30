type TaskView = { task: { _id: string } };

/** Keeps the first server record for a task so joined or paginated results
 * cannot render the same task twice in one collection. */
export function uniqueTaskViews<T extends TaskView>(items: readonly T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.task._id)) return false;
    seen.add(item.task._id);
    return true;
  });
}
