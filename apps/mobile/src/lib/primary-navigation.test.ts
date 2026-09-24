import { describe, expect, it } from 'vitest';

import {
  primaryDestinationForRoute,
  primaryDestinationIndexAtX,
  primaryNavigationHeight,
  primaryNavigationVisibleForPath,
  primaryTabGeometry,
  primaryTabIndexAtX,
  primaryTabRubberBand,
  primaryTabResetTarget,
} from './primary-navigation';

describe('primaryNavigationVisibleForPath', () => {
  it('keeps the app bar on peer and overview surfaces', () => {
    expect(primaryNavigationVisibleForPath('/projects')).toBe(true);
    expect(primaryNavigationVisibleForPath('/project')).toBe(true);
    expect(primaryNavigationVisibleForPath('/groups')).toBe(true);
    expect(primaryNavigationVisibleForPath('/search')).toBe(true);
  });

  it('gives focused work destinations the bottom edge', () => {
    expect(primaryNavigationVisibleForPath('/conversation')).toBe(false);
    expect(primaryNavigationVisibleForPath('/thread')).toBe(false);
    expect(primaryNavigationVisibleForPath('/task')).toBe(false);
    expect(primaryNavigationVisibleForPath('/task?tab=discussion')).toBe(false);
    expect(primaryNavigationVisibleForPath('/today')).toBe(true);
  });
});

describe('primaryNavigationHeight', () => {
  it('grows for accessibility text without changing the standard shell', () => {
    expect(primaryNavigationHeight(1, 76)).toBe(76);
    expect(primaryNavigationHeight(1.2, 76)).toBe(76);
    expect(primaryNavigationHeight(1.3, 76)).toBe(108);
    expect(primaryNavigationHeight(2, 76)).toBe(108);
  });
});

describe('primary tab route model', () => {
  it('maps each route group to one stable peer destination', () => {
    const destinations = ['(home)', '(inbox)', '(tasks)', '(team)']
      .map((route) => primaryDestinationForRoute(route));

    expect(destinations.map(({ key }) => key)).toEqual(['home', 'inbox', 'tasks', 'team']);
    expect(destinations.map(({ label }) => label)).toEqual(['Home', 'Inbox', 'My Tasks', 'Team']);
    expect(destinations.map(({ icon }) => icon)).toEqual(['home', 'email-outline', 'task', 'account-group']);
  });

  it('keeps a disabled Tasks destination visible while the release is gated', () => {
    expect(primaryDestinationForRoute('(tasks)', true)).toMatchObject({ key: 'tasks', disabled: true });
  });

  it('resets every primary Tasks press to global My Tasks', () => {
    expect(primaryTabResetTarget('tasks')).toEqual({ params: {}, screen: 'tasks' });
    expect(primaryTabResetTarget('team')).toBeNull();
  });

  it('rejects an unregistered route instead of silently selecting the wrong tab', () => {
    expect(() => primaryDestinationForRoute('(unknown)')).toThrow('Unsupported primary tab route');
    expect(() => primaryDestinationForRoute('(search)')).toThrow('Unsupported primary tab route');
  });

  it('centers every selection pill on the same cell center as its tab content', () => {
    const geometry = primaryTabGeometry(352, 4, 2);
    const pillCenter = geometry.indicatorLeft + geometry.indicatorWidth / 2;

    expect(geometry).toEqual({ cellWidth: 88, indicatorLeft: 198, indicatorWidth: 44 });
    expect(pillCenter).toBe(220);
  });

  it('clamps drag release positions to a valid primary destination', () => {
    expect(primaryTabIndexAtX(-20, 352, 4)).toBe(0);
    expect(primaryTabIndexAtX(175, 352, 4)).toBe(1);
    expect(primaryTabIndexAtX(900, 352, 4)).toBe(3);
  });

  it('skips the physical Create slot during a held tab drag', () => {
    expect(primaryDestinationIndexAtX(20, 350)).toBe(0);
    expect(primaryDestinationIndexAtX(110, 350)).toBe(1);
    expect(primaryDestinationIndexAtX(170, 350)).toBe(1);
    expect(primaryDestinationIndexAtX(180, 350)).toBe(2);
    expect(primaryDestinationIndexAtX(330, 350)).toBe(3);
  });

  it('tracks inside the glass bar and resists overshoot equally on every edge', () => {
    expect(primaryTabRubberBand(30, 0, 100, 18)).toBe(30);
    expect(primaryTabRubberBand(-10, 0, 100, 18)).toBeCloseTo(-2.8);
    expect(primaryTabRubberBand(110, 0, 100, 18)).toBeCloseTo(102.8);
    expect(primaryTabRubberBand(-1_000, 0, 100, 18)).toBe(-18);
    expect(primaryTabRubberBand(1_000, 0, 100, 18)).toBe(118);
  });
});
