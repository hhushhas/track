import type { TaskActivityAction, TaskPriority, TaskStateCategory } from '@track/shared/tasks';

export function taskPriorityLabel(priority: TaskPriority) {
  if (priority === 'none') return 'No priority';
  return priority[0].toUpperCase() + priority.slice(1);
}

export function taskPriorityGlyph(priority: TaskPriority) {
  if (priority === 'urgent') return '!!!';
  if (priority === 'high') return '!!';
  if (priority === 'medium') return '!';
  if (priority === 'low') return '↓';
  return '—';
}

export function taskStateTone(category?: TaskStateCategory) {
  if (category === 'completed') return 'success';
  if (category === 'canceled') return 'muted';
  if (category === 'started') return 'active';
  if (category === 'backlog') return 'muted';
  return 'neutral';
}

export function localTaskDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function taskDueLabel(
  dueDate?: string,
  today = localTaskDate(),
  category?: TaskStateCategory,
) {
  if (!dueDate) return null;
  if (dueDate === today) return 'Due today';
  if (dueDate < today && category !== 'completed' && category !== 'canceled') {
    return `Overdue · ${formatTaskDate(dueDate)}`;
  }
  return `Due ${formatTaskDate(dueDate)}`;
}

export function formatTaskDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function taskLabelColor(token: string, fallback: string) {
  if (/^#[0-9a-f]{3,8}$/i.test(token) || token.startsWith('rgb')) return token;
  const colors: Record<string, string> = {
    amber: '#d97706',
    blue: '#2563eb',
    green: '#16a34a',
    red: '#dc2626',
    violet: '#7c3aed',
  };
  return colors[token] ?? fallback;
}

const activityLabels: Record<TaskActivityAction, string> = {
  archived: 'Archived this task',
  assignee_changed: 'Changed the assignee',
  board_changed: 'Moved this task to another board',
  commented: 'Added a comment',
  created: 'Created this task',
  description_changed: 'Updated the description',
  due_date_changed: 'Changed the due date',
  labels_changed: 'Updated the labels',
  priority_changed: 'Changed the priority',
  restored: 'Restored this task',
  scope_changed: 'Changed the task scope',
  state_changed: 'Changed the status',
  title_changed: 'Renamed this task',
};

export function taskActivityLabel(action: TaskActivityAction) {
  return activityLabels[action] ?? action.replaceAll('_', ' ');
}
