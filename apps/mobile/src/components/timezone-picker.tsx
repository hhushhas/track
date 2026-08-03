import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { OptionsSheet, SheetSearchList, type SearchListItem } from '@/components/options-sheet';
import { ThemedText } from '@/components/themed-text';
import {
  deviceTimezone,
  findTimezone,
  timezoneLocalTime,
  timezoneOffsetLabel,
  TIMEZONES,
  type Timezone,
} from '@/lib/timezones';

type Props = {
  onClose: () => void;
  onSelect: (timezone: string) => void;
  value: string;
  visible: boolean;
};

function flagNode(flag: string) {
  return <ThemedText style={styles.flag}>{flag}</ThemedText>;
}

/**
 * The offset and local clock cost an `Intl.DateTimeFormat` pass per zone, so
 * they are deferred: the sheet resolves them only for the rows it draws.
 */
function toItem(zone: Timezone, now: Date): SearchListItem {
  return {
    detail: () => `${zone.countryName} · ${timezoneOffsetLabel(zone.id, now)} · ${timezoneLocalTime(zone.id, now)}`,
    key: zone.id,
    label: zone.city,
    leading: flagNode(zone.flag),
    searchText: `${zone.city} ${zone.countryName} ${zone.countryCode} ${zone.id}`,
  };
}

/** A zone the table does not carry, so an already-saved value stays visible. */
function unknownZoneItem(id: string, now: Date): SearchListItem {
  return {
    detail: () => `${timezoneOffsetLabel(id, now)} · ${timezoneLocalTime(id, now)}`,
    key: id,
    label: id.split('/').at(-1)?.replaceAll('_', ' ') ?? id,
    leading: flagNode('🌐'),
    searchText: id,
  };
}

/**
 * Searchable IANA timezone picker. The saved value stays the plain zone id, so
 * the profile mutation contract is unchanged.
 */
export function TimezonePicker({ onClose, onSelect, value, visible }: Props) {
  const items = useMemo(() => {
    if (!visible) return [];
    const now = new Date();
    const device = deviceTimezone();
    // Pin the device zone and the saved zone: they cover almost every choice.
    const pinnedIds = [...new Set([device, value])].filter(Boolean);
    const pinned = pinnedIds.map((id) => {
      const zone = findTimezone(id);
      return zone ? toItem(zone, now) : unknownZoneItem(id, now);
    });
    const rest = TIMEZONES.filter((zone) => !pinnedIds.includes(zone.id)).map((zone) =>
      toItem(zone, now),
    );
    return [...pinned, ...rest];
  }, [value, visible]);

  return (
    <OptionsSheet onClose={onClose} title="Timezone" visible={visible}>
      <SheetSearchList
        emptyLabel="No timezone matches that search"
        items={items}
        onSelect={onSelect}
        placeholder="Search city, country, or zone"
        selectedKey={value}
      />
    </OptionsSheet>
  );
}

const styles = StyleSheet.create({
  flag: {
    fontSize: 22,
    lineHeight: 26,
    width: 28,
  },
});
