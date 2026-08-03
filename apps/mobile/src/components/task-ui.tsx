import type { TaskPriority, TaskStateCategory } from '@track/shared/tasks';
import { Pressable, StyleSheet, View } from 'react-native';

import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import {
  shortTaskKey,
  taskDueDisplay,
  taskPriorityGlyph,
  taskPriorityLabel,
  taskStateTone,
} from '@/lib/task-presentation';

/** Board cards are uniform so a dragged card maps cleanly onto a drop slot. */
export const BoardCardHeight = 126;

type Segment<T extends string> = { label: string; value: T };

export function TaskSegmentedControl<T extends string>({
  onChange,
  segments,
  value,
}: {
  onChange: (value: T) => void;
  segments: Array<Segment<T>>;
  value: T;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {segments.map((segment) => {
        const selected = value === segment.value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={segment.value}
            onPress={() => {
              hapticLight();
              onChange(segment.value);
            }}
            style={[styles.segment, selected && {
              backgroundColor: theme.backgroundElevated,
              borderColor: theme.hairline,
            }]}>
            <ThemedText themeColor={selected ? 'text' : 'textSecondary'} type="smallBold">
              {segment.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function statePalette(theme: ReturnType<typeof useTheme>, category?: TaskStateCategory) {
  const tone = taskStateTone(category);
  if (tone === 'success') return { background: theme.successSoft, foreground: theme.success };
  if (tone === 'active') return { background: theme.accentSoft, foreground: theme.accentStrong };
  if (tone === 'muted') return { background: theme.backgroundSelected, foreground: theme.textSecondary };
  return { background: theme.backgroundElement, foreground: theme.textSecondary };
}

/** State reads by shape as well as color, so the set stays legible without hue. */
function stateGlyph(category?: TaskStateCategory) {
  if (category === 'completed') return 'check-circle' as const;
  if (category === 'canceled') return 'close' as const;
  return 'circle-outline' as const;
}

export function TaskStatusPill({
  category,
  label,
  onPress,
}: {
  category?: TaskStateCategory;
  label: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const palette = statePalette(theme, category);
  const body = (
    <>
      {category === 'started' ? (
        <View style={[styles.pillDot, { backgroundColor: palette.foreground }]} />
      ) : (
        <PlatformIcon color={palette.foreground} name={stateGlyph(category)} size={13} />
      )}
      <ThemedText numberOfLines={1} style={[styles.pillLabel, { color: palette.foreground }]} type="captionBold">
        {label}
      </ThemedText>
      {onPress ? <PlatformIcon color={palette.foreground} name="selector" size={13} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.pill, { backgroundColor: palette.background }]}>{body}</View>;
  return (
    <Pressable
      accessibilityHint="Opens the move menu"
      accessibilityLabel={`Status: ${label}`}
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={[styles.pill, { backgroundColor: palette.background }]}>
      {body}
    </Pressable>
  );
}

export function TaskPriorityBadge({
  onPress,
  priority,
}: {
  onPress?: () => void;
  priority: TaskPriority;
}) {
  const theme = useTheme();
  if (priority === 'none' && !onPress) return null;
  const color = priority === 'urgent' ? theme.danger : priority === 'high' ? theme.warning : theme.textSecondary;
  const body = (
    <>
      <ThemedText style={[styles.priorityGlyph, { color }]} type="captionBold">
        {taskPriorityGlyph(priority)}
      </ThemedText>
      <ThemedText style={{ color }} type="caption">{taskPriorityLabel(priority)}</ThemedText>
    </>
  );
  if (!onPress) {
    return (
      <View accessibilityLabel={`${taskPriorityLabel(priority)} priority`} style={styles.priority}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityHint="Changes the priority"
      accessibilityLabel={`Priority: ${taskPriorityLabel(priority)}`}
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={styles.priority}>
      {body}
    </Pressable>
  );
}

export function TaskDueChip({
  category,
  dueDate,
  onPress,
}: {
  category?: TaskStateCategory;
  dueDate?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const due = taskDueDisplay(dueDate, undefined, category);
  if (!due && !onPress) return null;
  const color = due?.overdue ? theme.danger : theme.textSecondary;
  const body = (
    <>
      <PlatformIcon color={color} name={due?.overdue ? 'calendar-remove' : 'calendar'} size={14} />
      <ThemedText numberOfLines={1} style={{ color }} type={due?.overdue ? 'captionBold' : 'caption'}>
        {due?.label ?? 'Add due date'}
      </ThemedText>
    </>
  );
  if (!onPress) return <View style={styles.inlineMeta}>{body}</View>;
  return (
    <Pressable
      accessibilityHint="Changes the due date"
      accessibilityLabel={`Due date: ${due?.label ?? 'none'}`}
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={styles.inlineMeta}>
      {body}
    </Pressable>
  );
}

export function TaskCard({
  assignee,
  category,
  dueDate,
  evidence,
  onPress,
  onStatusPress,
  priority,
  publicKey,
  stateName,
  title,
  variant = 'list',
}: {
  assignee?: string;
  category?: TaskStateCategory;
  dueDate?: string;
  evidence?: boolean;
  onPress: () => void;
  onStatusPress?: () => void;
  priority: TaskPriority;
  publicKey: string;
  stateName: string;
  title: string;
  variant?: 'list' | 'board';
}) {
  const theme = useTheme();
  const board = variant === 'board';

  return (
    // The themed fill sits outside the pressable: Android folds a background
    // colour and a ripple into one layered drawable whose repaint never reaches
    // the view, so a card styled that way keeps the old theme until it is
    // touched.
    <View style={[styles.card, board && styles.boardCard, {
      backgroundColor: theme.backgroundElevated,
      borderColor: theme.hairline,
    }]}>
      <Pressable
        accessibilityHint="Opens the task"
        accessibilityLabel={`${title}, ${stateName}`}
        accessibilityRole="button"
        android_ripple={{ color: theme.backgroundSelected }}
        onPress={onPress}
        style={[styles.cardPressable, board && styles.boardCardPressable]}>
        <View style={styles.cardMeta}>
          <View style={styles.cardKey}>
            {evidence ? <View style={[styles.originDot, { borderColor: theme.accent }]} /> : null}
            <ThemedText themeColor="textTertiary" type="mono">{shortTaskKey(publicKey)}</ThemedText>
          </View>
          {board ? (
            <PlatformIcon color={theme.textTertiary} name="drag-handle" size={16} />
          ) : (
            <TaskPriorityBadge priority={priority} />
          )}
        </View>
        <ThemedText numberOfLines={2} style={styles.cardTitle} type="smallBold">{title}</ThemedText>
        <View style={styles.cardFooter}>
          <TaskStatusPill category={category} label={stateName} onPress={onStatusPress} />
          <View style={styles.cardTrailing}>
            {board ? <TaskPriorityBadge priority={priority} /> : null}
            <TaskDueChip category={category} dueDate={dueDate} />
            {assignee ? <ColoredAvatar label={assignee} seed={assignee} size={22} /> : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export function TaskStateBanner({
  action,
  icon,
  message,
  tone = 'neutral',
}: {
  action?: { label: string; onPress: () => void };
  icon: React.ComponentProps<typeof PlatformIcon>['name'];
  message: string;
  tone?: 'neutral' | 'danger' | 'offline';
}) {
  const theme = useTheme();
  const danger = tone === 'danger';
  const backgroundColor = danger
    ? theme.dangerSoft
    : tone === 'offline' ? theme.accentSoft : theme.backgroundElement;
  const foreground = danger ? theme.danger : tone === 'offline' ? theme.accentStrong : theme.text;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.banner, { backgroundColor }]}>
      <PlatformIcon color={foreground} name={icon} size={18} />
      <ThemedText style={[styles.bannerText, { color: foreground }]} type="label">{message}</ThemedText>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={action.onPress}>
          <ThemedText style={{ color: foreground, textDecorationLine: 'underline' }} type="smallBold">
            {action.label}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TaskCardSkeletons({ count = 3 }: { count?: number }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Loading tasks" style={styles.skeletonList}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.skeletonCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.skeletonKey, { backgroundColor: theme.skeleton }]} />
          <View style={[styles.skeletonTitle, { backgroundColor: theme.skeleton }]} />
          <View style={[styles.skeletonTitleShort, { backgroundColor: theme.skeleton }]} />
          <View style={styles.skeletonBottom}>
            <View style={[styles.skeletonPill, { backgroundColor: theme.skeleton }]} />
            <View style={[styles.skeletonAvatar, { backgroundColor: theme.skeleton }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function TaskAction({
  disabled,
  label,
  onPress,
  primary,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={[styles.action, {
        backgroundColor: primary ? theme.accent : theme.backgroundSelected,
        opacity: disabled ? 0.5 : 1,
      }]}>
      <ThemedText style={primary ? styles.actionPrimaryText : undefined} type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  actionPrimaryText: { color: Colors.light.text },
  banner: { alignItems: 'center', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  bannerText: { flex: 1 },
  boardCard: { height: BoardCardHeight },
  boardCardPressable: { flex: 1, justifyContent: 'space-between' },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardFooter: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  cardKey: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  cardMeta: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between', minHeight: 18 },
  cardPressable: { gap: Spacing.two, padding: Spacing.three },
  cardTitle: { flexShrink: 1 },
  cardTrailing: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: Spacing.two, justifyContent: 'flex-end' },
  inlineMeta: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: Spacing.one },
  originDot: { borderRadius: Radius.pill, borderWidth: 2, height: 8, width: 8 },
  pill: { alignItems: 'center', borderRadius: Radius.pill, flexDirection: 'row', gap: 5, maxWidth: 168, paddingHorizontal: Spacing.two, paddingVertical: 5 },
  pillDot: { borderRadius: Radius.pill, height: 8, width: 8 },
  pillLabel: { flexShrink: 1 },
  priority: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  priorityGlyph: { fontWeight: '800' },
  segment: { alignItems: 'center', borderColor: 'transparent', borderRadius: Radius.small, borderWidth: StyleSheet.hairlineWidth, flex: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: Spacing.two },
  segmented: { borderRadius: Radius.medium, flexDirection: 'row', padding: 3 },
  skeletonAvatar: { borderRadius: Radius.pill, height: 24, width: 24 },
  skeletonBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one },
  skeletonCard: { borderRadius: Radius.large, gap: Spacing.two, padding: Spacing.three },
  skeletonKey: { borderRadius: Radius.small, height: 9, width: 54 },
  skeletonList: { gap: Spacing.three },
  skeletonPill: { borderRadius: Radius.medium, height: 22, width: 84 },
  skeletonTitle: { borderRadius: Radius.small, height: 13, width: '84%' },
  skeletonTitleShort: { borderRadius: Radius.small, height: 13, width: '52%' },
});
