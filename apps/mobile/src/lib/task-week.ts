export type WeekTask = {
  task: { dueDate?: string; priority?: string };
  state?: { category?: string } | null;
};

export function weekDateKeys(today: string) {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = new Date(date);
    weekday.setUTCDate(date.getUTCDate() + index);
    return weekday.toISOString().slice(0, 10);
  });
}

export function tasksForWeekDay<T extends WeekTask>(tasks: readonly T[], date: string) {
  return tasks.filter((item) => item.task.dueDate === date && item.state?.category !== 'canceled');
}

/** Returns urgent tasks inside the displayed week, optionally narrowed to one day. */
export function tasksForMyTaskWeek<T extends WeekTask>(
  tasks: readonly T[],
  weekDates: readonly string[],
  selectedDate: string | null = null,
) {
  if (selectedDate && !weekDates.includes(selectedDate)) return [];
  const allowedDates = new Set(selectedDate ? [selectedDate] : weekDates);
  return tasks.filter((item) =>
    Boolean(item.task.dueDate && allowedDates.has(item.task.dueDate))
    && item.task.priority === 'urgent'
    && item.state?.category !== 'completed'
    && item.state?.category !== 'canceled',
  );
}
