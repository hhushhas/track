export type MyTaskCountSummary = {
  assignedCount: number;
  countPartial: boolean;
  dueCount: number;
};

type CountableMyTask = {
  hasMoreAssignedTasks?: boolean;
  project: { _id: unknown };
  state?: { category?: string } | null;
  task: { boardId: unknown; dueDate?: string };
};

/** Counts assigned tasks by Project and Board, with open due work through today. */
export function summarizeMyTaskCounts<T extends CountableMyTask>(items: readonly T[], today: string) {
  const byProject = new Map<string, MyTaskCountSummary>();
  const byBoard = new Map<string, MyTaskCountSummary>();

  for (const item of items) {
    const isDue = item.state?.category !== 'completed'
      && item.state?.category !== 'canceled'
      && Boolean(item.task.dueDate && item.task.dueDate <= today);
    addCount(byProject, String(item.project._id), item, isDue);
    addCount(byBoard, String(item.task.boardId), item, isDue);
  }

  return { byBoard, byProject };
}

function addCount<T extends CountableMyTask>(map: Map<string, MyTaskCountSummary>, key: string, item: T, isDue: boolean) {
  const summary = map.get(key) ?? { assignedCount: 0, countPartial: false, dueCount: 0 };
  summary.assignedCount += 1;
  summary.countPartial ||= Boolean(item.hasMoreAssignedTasks);
  if (isDue) summary.dueCount += 1;
  map.set(key, summary);
}
