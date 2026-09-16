import { describe, expect, it } from 'vitest';

import type { MobileAttentionItem } from '@/lib/mobile-attention';
import { attentionMatchesHomeFilter, taskIsDueToday } from './home-feed';

function message(eventType: 'mention' | 'direct_reply' | 'discussion') {
  return { kind: 'message', eventType } as MobileAttentionItem;
}

describe('Home feed', () => {
  it('keeps direct conversation events in the Mentions filter', () => {
    expect(attentionMatchesHomeFilter(message('mention'), 'mentions')).toBe(true);
    expect(attentionMatchesHomeFilter(message('direct_reply'), 'mentions')).toBe(true);
    expect(attentionMatchesHomeFilter(message('discussion'), 'mentions')).toBe(false);
  });

  it('does not treat reminder delivery dates as task due dates', () => {
    expect(attentionMatchesHomeFilter({ kind: 'task', eventType: 'due_soon' } as MobileAttentionItem, 'due')).toBe(false);
    expect(attentionMatchesHomeFilter({ kind: 'task', eventType: 'overdue' } as MobileAttentionItem, 'due')).toBe(false);
  });

  it('separates assigned and suggested work', () => {
    expect(attentionMatchesHomeFilter({ kind: 'task', eventType: 'assignment' } as MobileAttentionItem, 'assigned')).toBe(true);
    expect(attentionMatchesHomeFilter({ kind: 'suggestion' } as MobileAttentionItem, 'suggestions')).toBe(true);
  });

  it('compares task dates in the device calendar day', () => {
    const now = new Date(2026, 8, 12, 23, 30);
    expect(taskIsDueToday('2026-09-12', now)).toBe(true);
    expect(taskIsDueToday('2026-09-13', now)).toBe(false);
    expect(taskIsDueToday(undefined, now)).toBe(false);
  });
});
