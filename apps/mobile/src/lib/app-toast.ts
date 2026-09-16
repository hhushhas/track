import type { IconName } from '@/components/platform-icon';

export type AppToastTone = 'success' | 'error' | 'info';

export type AppToastInput = {
  durationMs?: number;
  icon?: IconName;
  message?: string;
  title: string;
  tone?: AppToastTone;
};

export type AppToastItem = Required<Pick<AppToastInput, 'title' | 'tone'>> &
  Omit<AppToastInput, 'title' | 'tone'> & {
    id: number;
  };

const maximumVisibleQueue = 3;

export function enqueueToast(queue: AppToastItem[], next: AppToastItem) {
  if (queue.some((toast) => toast.title === next.title && toast.message === next.message)) return queue;
  if (queue.length < maximumVisibleQueue) return [...queue, next];
  return [queue[0], ...queue.slice(-(maximumVisibleQueue - 2)), next];
}

export function toastDuration({ durationMs, message }: AppToastInput) {
  if (durationMs !== undefined) return Math.min(8_000, Math.max(2_000, durationMs));
  return message && message.length > 72 ? 4_800 : 3_600;
}
