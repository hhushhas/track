import { describe, expect, it } from 'vitest';

import {
  primaryDestinationForRoute,
  primaryTabGeometry,
  primaryTabIndexAtX,
  primaryTabRubberBand,
  primaryTabResetTarget,
} from './primary-navigation';

describe('primary tab route model', () => {
  it('maps each route group to one stable peer destination', () => {
    expect(['(home)', '(projects)', '(tasks)', '(search)'].map((route) => primaryDestinationForRoute(route).key))
      .toEqual(['home', 'projects', 'tasks', 'evidence']);
  });

  it('keeps a disabled Tasks destination visible while the release is gated', () => {
    expect(primaryDestinationForRoute('(tasks)', true)).toMatchObject({ key: 'tasks', disabled: true });
  });

  it('resets every primary Tasks press to global My Tasks', () => {
    expect(primaryTabResetTarget('tasks')).toEqual({ params: {}, screen: 'tasks' });
    expect(primaryTabResetTarget('projects')).toBeNull();
  });

  it('rejects an unregistered route instead of silently selecting the wrong tab', () => {
    expect(() => primaryDestinationForRoute('(unknown)')).toThrow('Unsupported primary tab route');
  });

  it('centers every selection pill on the same cell center as its tab content', () => {
    const geometry = primaryTabGeometry(352, 4, 2);
    const pillCenter = geometry.indicatorLeft + geometry.indicatorWidth / 2;

    expect(geometry).toEqual({ cellWidth: 88, indicatorLeft: 180, indicatorWidth: 80 });
    expect(pillCenter).toBe(220);
  });

  it('clamps drag release positions to a valid primary destination', () => {
    expect(primaryTabIndexAtX(-20, 352, 4)).toBe(0);
    expect(primaryTabIndexAtX(175, 352, 4)).toBe(1);
    expect(primaryTabIndexAtX(900, 352, 4)).toBe(3);
  });

  it('tracks inside the glass bar and resists overshoot equally on every edge', () => {
    expect(primaryTabRubberBand(30, 0, 100, 18)).toBe(30);
    expect(primaryTabRubberBand(-10, 0, 100, 18)).toBeCloseTo(-2.8);
    expect(primaryTabRubberBand(110, 0, 100, 18)).toBeCloseTo(102.8);
    expect(primaryTabRubberBand(-1_000, 0, 100, 18)).toBe(-18);
    expect(primaryTabRubberBand(1_000, 0, 100, 18)).toBe(118);
  });
});
