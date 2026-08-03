import { describe, expect, it } from 'vitest';

import {
  formatTaskDate,
  formatTaskDateLong,
  localTaskDate,
  shortTaskKey,
  taskDateFromOffset,
  taskDueDisplay,
  taskActivityLabel,
  taskDueLabel,
  taskLabelColor,
  taskPriorityGlyph,
  taskPriorityLabel,
  taskStateTone,
} from './task-presentation';

describe('task presentation', () => {
  it('formats priority and state metadata', () => {
    expect(taskPriorityLabel('urgent')).toBe('Urgent');
    expect(taskPriorityLabel('none')).toBe('No priority');
    expect(taskPriorityGlyph('high')).toBe('!!');
    expect(taskStateTone('completed')).toBe('success');
    expect(taskStateTone('started')).toBe('active');
  });

  it('describes due dates relative to the supplied local date', () => {
    expect(localTaskDate(new Date(2026, 6, 30, 23, 30))).toBe('2026-07-30');
    expect(taskDueLabel(undefined, '2026-07-30')).toBeNull();
    expect(taskDueLabel('2026-07-30', '2026-07-30')).toBe('Due today');
    expect(taskDueLabel('2026-07-29', '2026-07-30')).toContain('Overdue');
    expect(taskDueLabel('2026-07-29', '2026-07-30', 'completed')).toMatch(/^Due /);
    expect(taskDueLabel('2026-07-29', '2026-07-30', 'canceled')).not.toContain('Overdue');
    expect(formatTaskDate('not-a-date')).toBe('not-a-date');
  });

  it('shows due dates in human words instead of stored strings', () => {
    expect(taskDueDisplay(undefined, '2026-07-30')).toBeNull();
    expect(taskDueDisplay('2026-07-30', '2026-07-30')?.label).toBe('Today');
    expect(taskDueDisplay('2026-07-31', '2026-07-30')?.label).toBe('Tomorrow');
    expect(taskDueDisplay('2026-07-28', '2026-07-30')).toEqual({
      label: 'Overdue · 2 days',
      overdue: true,
    });
    expect(taskDueDisplay('2026-07-29', '2026-07-30')?.label).toBe('Overdue · 1 day');
    expect(taskDueDisplay('2026-07-29', '2026-07-30', 'completed')?.overdue).toBe(false);
    expect(taskDueDisplay('2026-08-07', '2026-07-30')?.label).toBe(formatTaskDateLong('2026-08-07'));
    expect(formatTaskDateLong('not-a-date')).toBe('not-a-date');
  });

  it('derives quick due dates from an offset', () => {
    const from = new Date(2026, 6, 30);
    expect(taskDateFromOffset(0, from)).toBe('2026-07-30');
    expect(taskDateFromOffset(1, from)).toBe('2026-07-31');
    expect(taskDateFromOffset(7, from)).toBe('2026-08-06');
  });

  it('uses human activity descriptions', () => {
    expect(taskActivityLabel('state_changed')).toBe('Changed the status');
    expect(taskActivityLabel('created')).toBe('Created this task');
  });

  it('resolves stored label tokens to native colors', () => {
    expect(taskLabelColor('blue', '#000')).toBe('#2563eb');
    expect(taskLabelColor('#abc', '#000')).toBe('#abc');
    expect(taskLabelColor('unknown', '#000')).toBe('#000');
  });

  it('shortens public task keys but keeps short ones whole', () => {
    expect(shortTaskKey('T-AYWHR69F')).toBe('T-AYW…');
    expect(shortTaskKey('T-AB')).toBe('T-AB');
    expect(shortTaskKey('AYWHR69F')).toBe('AYW…');
  });
});
