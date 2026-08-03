import { describe, expect, it } from 'vitest';

import {
  findTimezone,
  timezoneLocalTime,
  timezoneOffsetLabel,
  timezoneOffsetMinutes,
  TIMEZONES,
} from './timezones';

const REGIONAL_INDICATOR_A = 0x1f1e6;

function flagFor(countryCode: string) {
  return String.fromCodePoint(
    ...[...countryCode].map((letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 65),
  );
}

describe('TIMEZONES table', () => {
  it('carries every zone the platform reports', () => {
    expect(TIMEZONES.length).toBeGreaterThan(400);
  });

  it('has unique zone ids', () => {
    expect(new Set(TIMEZONES.map((zone) => zone.id)).size).toBe(TIMEZONES.length);
  });

  it('resolves every zone against Intl', () => {
    for (const zone of TIMEZONES) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone.id })).not.toThrow();
    }
  });

  it('derives each flag from its ISO 3166-1 alpha-2 country code', () => {
    for (const zone of TIMEZONES) {
      expect(zone.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(zone.flag).toBe(flagFor(zone.countryCode));
    }
  });

  it('labels a city for every zone without underscores', () => {
    for (const zone of TIMEZONES) {
      expect(zone.city.length).toBeGreaterThan(0);
      expect(zone.city).not.toContain('_');
      expect(zone.countryName.length).toBeGreaterThan(0);
    }
  });

  it('sorts by country name then city', () => {
    const sorted = [...TIMEZONES].sort(
      (a, b) =>
        a.countryName.localeCompare(b.countryName, 'en') || a.city.localeCompare(b.city, 'en'),
    );
    expect(TIMEZONES.map((zone) => zone.id)).toEqual(sorted.map((zone) => zone.id));
  });

  it('finds a zone by id and reports nothing for an unknown one', () => {
    expect(findTimezone('Europe/Oslo')?.countryCode).toBe('NO');
    expect(findTimezone('Nowhere/Nothing')).toBeUndefined();
  });
});

describe('timezone offsets', () => {
  const midJanuary = new Date('2026-01-15T12:00:00Z');
  const midJuly = new Date('2026-07-15T12:00:00Z');

  it('measures fixed offsets', () => {
    expect(timezoneOffsetMinutes('Asia/Kolkata', midJanuary)).toBe(330);
    expect(timezoneOffsetMinutes('Asia/Tokyo', midJanuary)).toBe(540);
    expect(timezoneOffsetMinutes('America/Cancun', midJanuary)).toBe(-300);
  });

  it('follows daylight saving changes', () => {
    expect(timezoneOffsetMinutes('Europe/Oslo', midJanuary)).toBe(60);
    expect(timezoneOffsetMinutes('Europe/Oslo', midJuly)).toBe(120);
  });

  it('handles the midnight hour rollover', () => {
    expect(timezoneOffsetMinutes('Pacific/Kiritimati', new Date('2026-01-15T10:00:00Z'))).toBe(840);
  });

  it('labels offsets with sign, half hours, and a bare UTC', () => {
    expect(timezoneOffsetLabel('Asia/Kolkata', midJanuary)).toBe('UTC+5:30');
    expect(timezoneOffsetLabel('Europe/Oslo', midJuly)).toBe('UTC+2');
    expect(timezoneOffsetLabel('America/Cancun', midJanuary)).toBe('UTC−5');
    expect(timezoneOffsetLabel('Africa/Abidjan', midJanuary)).toBe('UTC');
  });

  it('formats a local time for the zone', () => {
    expect(timezoneLocalTime('Europe/Oslo', midJanuary)).toMatch(/\d/);
  });
});
