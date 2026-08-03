import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useThemeOverride } from '@/contexts/theme-override-context';
import { SheetFieldButton } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import {
  localTaskDate,
  parseTaskDate,
  taskDateFromOffset,
  taskDueDisplay,
} from '@/lib/task-presentation';

type Props = {
  autoOpen?: boolean;
  disabled?: boolean;
  label?: string;
  onChange: (value: string | null) => void;
  value?: string | null;
};

const quickChoices = [
  { icon: 'calendar-today', label: 'Today', offset: 0 },
  { icon: 'calendar-clock', label: 'Tomorrow', offset: 1 },
  { icon: 'calendar', label: 'Next week', offset: 7 },
] as const;

/**
 * A due-date control. The value stays the `YYYY-MM-DD` string the backend
 * validates; the reader only ever sees a human date.
 */
export function DateField({ autoOpen, disabled, label = 'Due date', onChange, value }: Props) {
  const theme = useTheme();
  const { theme: scheme } = useThemeOverride();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [pickerVisible, setPickerVisible] = useState(false);
  const display = taskDueDisplay(value);
  const selected = (value ? parseTaskDate(value) : null) ?? new Date();

  function commit(next: string | null) {
    hapticLight();
    onChange(next);
  }

  function pick(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios') setPickerVisible(false);
    if (event.type === 'dismissed' || !date) return;
    commit(localTaskDate(date));
  }

  return (
    <View style={styles.wrap}>
      <SheetFieldButton
        icon="calendar"
        label={label}
        onClear={value ? () => commit(null) : undefined}
        onPress={() => setOpen((current) => !current)}
        placeholder="No due date"
        value={display?.label}
      />
      {open && !disabled ? (
        <View style={styles.panel}>
          <View style={styles.chips}>
            {quickChoices.map((choice) => {
              const target = taskDateFromOffset(choice.offset);
              const active = value === target;
              return (
                <Pressable
                  accessibilityLabel={`${choice.label} due date`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={choice.label}
                  onPress={() => commit(target)}
                  style={[styles.chip, {
                    backgroundColor: active ? theme.accentSoft : theme.backgroundElement,
                    borderColor: active ? theme.accent : theme.hairline,
                  }]}>
                  <PlatformIcon
                    color={active ? theme.accentStrong : theme.textSecondary}
                    name={choice.icon}
                    size={16}
                  />
                  <ThemedText themeColor={active ? 'accentStrong' : 'text'} type="label">
                    {choice.label}
                  </ThemedText>
                </Pressable>
              );
            })}
            {value ? (
              <Pressable
                accessibilityLabel="Clear due date"
                accessibilityRole="button"
                onPress={() => commit(null)}
                style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
                <PlatformIcon color={theme.textSecondary} name="calendar-remove" size={16} />
                <ThemedText type="label">Clear</ThemedText>
              </Pressable>
            ) : null}
          </View>
          {Platform.OS === 'ios' ? (
            <View style={[styles.calendar, { backgroundColor: theme.backgroundElement }]}>
              <DateTimePicker
                accentColor={theme.accent}
                display="inline"
                mode="date"
                onChange={pick}
                themeVariant={scheme}
                value={selected}
              />
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Choose a date"
              accessibilityRole="button"
              android_ripple={{ color: theme.backgroundSelected }}
              onPress={() => {
                hapticLight();
                setPickerVisible(true);
              }}
              style={[styles.picker, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
              <PlatformIcon color={theme.textSecondary} name="calendar" size={19} />
              <ThemedText type="small">Choose a date…</ThemedText>
            </Pressable>
          )}
          {pickerVisible && Platform.OS !== 'ios' ? (
            <DateTimePicker display="default" mode="date" onChange={pick} value={selected} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { borderRadius: Radius.large, overflow: 'hidden', paddingHorizontal: Spacing.two },
  chip: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  panel: { gap: Spacing.three, paddingTop: Spacing.one },
  picker: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  wrap: { gap: Spacing.two },
});
