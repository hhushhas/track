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
  contextLabel,
  description,
  dueDate,
  evidence,
  focused = false,
  onLongPress,
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
  contextLabel?: string;
  description?: string;
  dueDate?: string;
  evidence?: boolean;
  focused?: boolean;
  onLongPress?: () => void;
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

  if (!board) {
    const context = [shortTaskKey(publicKey), contextLabel, priority !== 'none' ? taskPriorityLabel(priority) : null]
      .filter(Boolean)
      .join(' · ');
    const due = taskDueDisplay(dueDate, undefined, category);
    return (
      <View style={[styles.listRow, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
        <View style={styles.listRowContent}>
          <Pressable
            accessibilityHint="Opens the task"
            accessibilityLabel={`${title}. ${context}. ${stateName}${due ? `. ${due.label}` : ''}`}
            accessibilityRole="button"
            android_ripple={{ color: theme.backgroundSelected }}
            onPress={onPress}
            style={({ pressed }) => [styles.listRowPressable, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.listLeading, { backgroundColor: theme.backgroundSelected }]}>
              {assignee && assignee !== 'You'
                ? <ColoredAvatar label={assignee} seed={assignee} size={32} />
                : <PlatformIcon color={theme.textSecondary} name="check-circle" size={19} />}
            </View>
            <View style={styles.listCopy}>
              <ThemedText numberOfLines={2} style={styles.cardTitle} type="title">{title}</ThemedText>
              <View style={styles.listContext}>
                {evidence ? <View accessibilityLabel="Has evidence" style={[styles.originDot, { borderColor: theme.accent }]} /> : null}
                <ThemedText numberOfLines={1} style={styles.listContextText} themeColor="textSecondary" type="caption">
                  {context}
                </ThemedText>
              </View>
            </View>
          </Pressable>
          <View style={styles.listTrailing}>
            <View style={styles.listTrailingLine}>
              <TaskDueChip category={category} dueDate={dueDate} />
            </View>
            <View style={styles.listTrailingLine}>
              <TaskStatusPill category={category} label={stateName} onPress={onStatusPress} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    // The themed fill sits outside the pressable: Android folds a background
    // colour and a ripple into one layered drawable whose repaint never reaches
    // the view, so a card styled that way keeps the old theme until it is
    // touched.
    <View style={[styles.card, board && styles.boardCard, {
      backgroundColor: theme.backgroundElevated,
      borderColor: theme.hairline,
      }]}>
      {focused ? (
        <View style={[styles.focusedTask, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name="star" size={13} />
          <ThemedText themeColor="accentStrong" type="captionBold">Opened task</ThemedText>
        </View>
      ) : null}
      <View style={styles.boardMeta}>
        <View style={styles.cardKey}>
          <ThemedText themeColor="textSecondary" type="mono">{shortTaskKey(publicKey)}</ThemedText>
          {evidence ? <View accessibilityLabel="Has evidence" style={[styles.originDot, { borderColor: theme.accent }]} /> : null}
        </View>
        <TaskStatusPill category={category} label={stateName} onPress={onStatusPress} />
      </View>
      <Pressable
        accessibilityHint={onLongPress ? 'Opens the task. Touch and hold to move it.' : 'Opens the task'}
        accessibilityLabel={`${focused ? 'Opened task. ' : ''}${title}, ${stateName}`}
        accessibilityRole="button"
        android_ripple={{ color: theme.backgroundSelected }}
        delayLongPress={350}
        onLongPress={onLongPress ? () => { hapticLight(); onLongPress(); } : undefined}
        onPress={onPress}
        style={[styles.cardPressable, board && styles.boardCardPressable]}>
        <View style={styles.titleRow}>
          {board ? <PlatformIcon color={theme.text} name="check-box-outline" size={17} /> : null}
          <ThemedText numberOfLines={2} style={styles.cardTitle} type="smallBold">{title}</ThemedText>
        </View>
        {!board && contextLabel ? (
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
            {contextLabel}
          </ThemedText>
        ) : null}
        {board && description ? (
          <ThemedText numberOfLines={1} style={styles.cardDescription} themeColor="textSecondary" type="caption">
            {description}
          </ThemedText>
        ) : null}
        <View style={styles.cardFooter}>
          {board ? (
            <View style={styles.boardAssignee}>
              {assignee ? <ColoredAvatar label={assignee} seed={assignee} size={24} /> : null}
              <TaskDueChip category={category} dueDate={dueDate} />
            </View>
          ) : <TaskStatusPill category={category} label={stateName} onPress={onStatusPress} />}
          <View style={styles.cardTrailing}>
            {board ? <TaskPriorityBadge priority={priority} /> : null}
            {!board ? <TaskDueChip category={category} dueDate={dueDate} /> : null}
            {!board && assignee ? <ColoredAvatar label={assignee} seed={assignee} size={22} /> : null}
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
  tone?: 'neutral' | 'danger' | 'offline' | 'success';
}) {
  const theme = useTheme();
  const danger = tone === 'danger';
  const success = tone === 'success';
  const backgroundColor = success
    ? theme.successSoft
    : danger
    ? theme.dangerSoft
    : tone === 'offline' ? theme.accentSoft : theme.backgroundElement;
  const foreground = success ? theme.success : danger ? theme.danger : tone === 'offline' ? theme.accentStrong : theme.text;
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
  action: { alignItems: 'center', alignSelf: 'stretch', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  actionPrimaryText: { color: Colors.light.text },
  banner: { alignItems: 'center', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  bannerText: { flex: 1 },
  boardCard: { minHeight: 0 },
  boardCardPressable: { justifyContent: 'space-between' },
  boardMeta: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between', minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  card: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardFooter: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  cardKey: { alignItems: 'center', flex: 1, flexDirection: 'row', flexShrink: 1, gap: Spacing.one, minWidth: 0 },
  cardPressable: { gap: Spacing.two, padding: Spacing.three },
  cardTitle: { flexShrink: 1 },
  cardDescription: { flexShrink: 1 },
  boardAssignee: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, minWidth: 0 },
  cardTrailing: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: Spacing.two, justifyContent: 'flex-end' },
  focusedTask: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: Radius.pill, flexDirection: 'row', gap: 3, marginHorizontal: Spacing.three, marginTop: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  inlineMeta: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: Spacing.one },
  listContext: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minWidth: 0 },
  listContextText: { flexShrink: 1 },
  listCopy: { flex: 1, gap: 3, minWidth: 0 },
  listLeading: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  listRow: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  listRowContent: { alignItems: 'stretch', flexDirection: 'row', minHeight: 72 },
  listRowPressable: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.three, minWidth: 0, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  listTrailing: { alignItems: 'flex-end', gap: 3, justifyContent: 'center', maxWidth: 116, minHeight: TouchTarget, minWidth: 88, paddingRight: Spacing.three, paddingVertical: Spacing.two },
  listTrailingLine: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 18, maxWidth: '100%' },
  originDot: { borderRadius: Radius.pill, borderWidth: 2, height: 8, width: 8 },
  pill: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, flexDirection: 'row', gap: 5, maxWidth: 168, paddingHorizontal: Spacing.two, paddingVertical: 5 },
  pillDot: { borderRadius: Radius.pill, height: 8, width: 8 },
  pillLabel: { flexShrink: 1 },
  priority: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  priorityGlyph: { fontWeight: '800' },
  segment: { alignItems: 'center', borderColor: 'transparent', borderRadius: Radius.small, borderWidth: StyleSheet.hairlineWidth, flex: 1, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.two },
  segmented: { borderRadius: Radius.medium, flexDirection: 'row', padding: 3 },
  skeletonAvatar: { borderRadius: Radius.pill, height: 24, width: 24 },
  skeletonBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one },
  skeletonCard: { borderRadius: Radius.large, gap: Spacing.two, padding: Spacing.three },
  skeletonKey: { borderRadius: Radius.small, height: 9, width: 54 },
  skeletonList: { gap: Spacing.three },
  skeletonPill: { borderRadius: Radius.medium, height: 22, width: 84 },
  skeletonTitle: { borderRadius: Radius.small, height: 13, width: '84%' },
  skeletonTitleShort: { borderRadius: Radius.small, height: 13, width: '52%' },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
});
