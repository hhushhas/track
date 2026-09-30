import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ColoredAvatar } from '@/components/colored-avatar';
import { EmptySurface, SectionHeader } from '@/components/company-project-carousel';
import type { HomeActivity, HomeStats, HomeTask } from '@/components/home-workspace-types';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { IconSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { relativeAttentionTime } from '@/lib/mobile-attention';
import { uniqueTaskViews } from '@/lib/unique-task-views';

type StatTone = 'accent' | 'danger' | 'progress' | 'purple' | 'success' | 'warning';

const STATUS_CARDS: Array<{ icon: IconName; key: keyof HomeStats; label: string; tone: StatTone }> = [
  { icon: 'calendar-today', key: 'dailyTasks', label: 'Due today', tone: 'purple' },
  { icon: 'play', key: 'inProgressTasks', label: 'In Progress', tone: 'progress' },
  { icon: 'check-circle', key: 'completedTasks', label: 'Completed', tone: 'success' },
  { icon: 'calendar-clock', key: 'upcomingTasks', label: 'Next up', tone: 'warning' },
];

export function TaskStatusSummary({ companyName, onPress, stats }: { companyName: string; onPress: (key: keyof HomeStats) => void; stats: HomeStats }) {
  return (
    <View style={styles.section}>
      <View style={styles.statusHeading}>
        <ThemedText type="titleLarge">Task status</ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold">{companyName}</ThemedText>
      </View>
      <View accessibilityLabel="Company task status" style={styles.statsGrid}>
        {[STATUS_CARDS.slice(0, 2), STATUS_CARDS.slice(2, 4)].map((row, rowIndex) => (
          <View key={`status-row-${rowIndex}`} style={styles.statsRow}>
            {row.map((card) => <TaskStatusCard card={card} count={stats[card.key]} key={card.key} onPress={() => onPress(card.key)} />)}
          </View>
        ))}
      </View>
    </View>
  );
}

function TaskStatusCard({ card, count, onPress }: { card: typeof STATUS_CARDS[number]; count: number; onPress: () => void }) {
  const theme = useTheme();
  const tones = {
    accent: { background: theme.accentSoft, foreground: theme.accentStrong },
    danger: { background: theme.dangerSoft, foreground: theme.danger },
    progress: { background: theme.workflowStartedSoft, foreground: theme.workflowStartedStrong },
    purple: { background: theme.workflowBacklogSoft, foreground: theme.workflowBacklogStrong },
    success: { background: theme.successSoft, foreground: theme.success },
    warning: { background: theme.backgroundElement, foreground: theme.warning },
  } as const;
  const tone = tones[card.tone];
  return (
    <Pressable
      accessibilityLabel={`${card.label}: ${count} tasks`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.statCard, { backgroundColor: tone.background, borderColor: theme.homeBorder, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.statIcon, { backgroundColor: theme.homeSurface }]}>
        <PlatformIcon color={tone.foreground} name={card.icon} size={IconSize.large} weight="semibold" />
      </View>
      <View style={styles.statCopy}>
        <ThemedText numberOfLines={1} style={{ color: tone.foreground }} type="label">{card.label}</ThemedText>
        <View style={styles.statValueRow}>
          <ThemedText style={[styles.statValue, { color: tone.foreground }]}>{count}</ThemedText>
          <ThemedText themeColor="textSecondary" type="caption">Tasks</ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

export function TodayTasksSection({ companyDueCount = 0, loading = false, onOpen, onRoute, onSeeAll, tasks }: {
  companyDueCount?: number;
  loading?: boolean;
  onOpen: (task: HomeTask) => void;
  onRoute: (task: HomeTask) => void;
  onSeeAll: () => void;
  tasks: HomeTask[];
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - Spacing.six, Math.max(240, width * 0.74));
  const visibleTasks = uniqueTaskViews(tasks);
  return (
    <View style={styles.section}>
      <SectionHeader label="Due today" onPress={onSeeAll} />
      {loading ? <SkeletonList count={2} label="Loading today's tasks" /> : visibleTasks.length ? (
        <ScrollView
          accessibilityLabel="Today’s tasks"
          contentContainerStyle={styles.taskCarouselContent}
          decelerationRate="fast"
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={cardWidth + Spacing.three}>
          {visibleTasks.map((task) => <TodayTaskCard cardWidth={cardWidth} key={task.task._id} onOpen={() => onOpen(task)} onRoute={() => onRoute(task)} task={task} />)}
        </ScrollView>
      ) : <EmptySurface copy={companyDueCount > 0
        ? `${companyDueCount} Company task${companyDueCount === 1 ? '' : 's'} are due today, but none are assigned to you.`
        : 'You have no tasks due today.'} />}
    </View>
  );
}

function TodayTaskCard({ cardWidth, onOpen, onRoute, task }: { cardWidth: number; onOpen: () => void; onRoute: () => void; task: HomeTask }) {
  const theme = useTheme();
  const assigneeLabel = task.assigneeName || 'Assigned to you';
  const statusColor = task.state?.category === 'completed'
    ? theme.success
    : task.state?.category === 'started'
      ? theme.workflowStartedStrong
      : task.task.priority === 'urgent'
        ? theme.danger
        : theme.accent;
  return (
    <Pressable
      accessibilityLabel={`${task.task.title}. ${task.state?.name ?? 'To do'}. ${formatTaskDate(task.task.dueDate)}.`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.taskCard, { backgroundColor: pressed ? theme.backgroundSelected : theme.homeSurface, borderColor: theme.homeBorder, width: cardWidth }]}>
      <View style={styles.taskTopRow}>
        <ThemedText numberOfLines={2} style={styles.taskTitle} type="title">{task.task.title}</ThemedText>
        <Pressable
          accessibilityLabel={`Open ${task.task.title} on its board`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={(event) => { event.stopPropagation(); onRoute(); }}
          style={({ pressed }) => [styles.routeButton, { borderColor: theme.homeBorder, opacity: pressed ? 0.6 : 1 }]}>
          <PlatformIcon color={theme.text} name="chevron-right" size={IconSize.medium} weight="semibold" />
        </Pressable>
      </View>
      <View style={styles.taskContextRow}>
        {task.group ? (
          <View style={[styles.channelPill, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <PlatformIcon color={theme.accentStrong} name="channel" size={IconSize.small} />
            <ThemedText numberOfLines={1} style={styles.channelPillText} themeColor="accentStrong" type="captionBold">#{task.group.name.replace(/^#/, '')}</ThemedText>
          </View>
        ) : <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{task.project.name}</ThemedText>}
        <View style={[styles.statusPill, { backgroundColor: taskStatusBackground(task, theme), borderColor: statusColor }]}>
          <ThemedText numberOfLines={1} style={{ color: statusColor }} type="captionBold">{task.state?.name ?? 'To do'}</ThemedText>
        </View>
      </View>
      <View style={styles.taskMetaRow}>
        <View style={styles.taskMetaItem}><PlatformIcon color={theme.textSecondary} name="calendar-today" size={IconSize.small} /><ThemedText themeColor="textSecondary" type="caption">{formatTaskDate(task.task.dueDate)}</ThemedText></View>
        <View style={styles.taskMetaItem}><PlatformIcon color={theme.textSecondary} name="message" size={IconSize.small} /><ThemedText themeColor="textSecondary" type="caption">{task.commentCount ?? 0}</ThemedText></View>
        <View style={styles.taskMetaItem}><PlatformIcon color={theme.textSecondary} name="person" size={IconSize.small} /><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{assigneeLabel}</ThemedText></View>
      </View>
    </Pressable>
  );
}

function formatTaskDate(value?: string) {
  if (!value) return 'No date';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function taskStatusBackground(task: HomeTask, theme: ReturnType<typeof useTheme>) {
  if (task.state?.category === 'completed') return theme.successSoft;
  if (task.state?.category === 'started') return theme.workflowStartedSoft;
  if (task.task.priority === 'urgent') return theme.dangerSoft;
  return theme.accentSoft;
}

export function RecentActivitySection({ activities, onOpen, onSeeAll }: {
  activities: HomeActivity[];
  onOpen: (activity: HomeActivity) => void;
  onSeeAll: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <SectionHeader label="Recent Activity" onPress={onSeeAll} />
      {activities.length ? (
        <View style={[styles.activitySurface, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
          {activities.slice(0, 4).map((activity, index) => (
            <View key={activity.id}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.hairline }]} /> : null}
              <Pressable
                accessibilityLabel={`${activity.actorName} ${activity.preview}. ${activity.projectName}. ${relativeAttentionTime(activity.createdAt)} ago.`}
                accessibilityRole="button"
                android_ripple={{ color: theme.backgroundSelected }}
                onPress={() => onOpen(activity)}
                style={({ pressed }) => [styles.activityRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}>
                <View style={styles.activityAvatarWrap}>
                  <ColoredAvatar label={activity.actorName} seed={activity.actorName} size={36} />
                  <View style={[styles.activityKind, { backgroundColor: activityTone(activity.kind, theme).background, borderColor: theme.homeSurface }]}>
                    <PlatformIcon color={activityTone(activity.kind, theme).foreground} name={activityIcon(activity.kind)} size={11} />
                  </View>
                </View>
                <View style={styles.activityCopy}>
                  <View style={styles.activityTitleRow}>
                    <ThemedText numberOfLines={1} style={styles.activityTitle} type="title">{activity.preview}</ThemedText>
                    <View style={[styles.activityType, { backgroundColor: activityTone(activity.kind, theme).background }]}>
                      <ThemedText style={{ color: activityTone(activity.kind, theme).foreground }} type="captionBold">{activityTypeLabel(activity.kind)}</ThemedText>
                    </View>
                  </View>
                  <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{activity.projectName} · {relativeAttentionTime(activity.createdAt)}</ThemedText>
                </View>
                <View style={[styles.activityAction, { borderColor: theme.homeBorder }]}>
                  <PlatformIcon color={theme.textSecondary} name="chevron-right" size={IconSize.small} />
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : <EmptySurface copy="No recent Company activity yet." />}
    </View>
  );
}

function activityIcon(kind: HomeActivity['kind']): IconName {
  if (kind === 'message') return 'message';
  if (kind === 'project') return 'project';
  return 'task';
}

function activityTypeLabel(kind: HomeActivity['kind']) {
  if (kind === 'message') return 'Conversation';
  if (kind === 'project') return 'Project';
  return 'Task';
}

function activityTone(kind: HomeActivity['kind'], theme: ReturnType<typeof useTheme>) {
  if (kind === 'message') return { background: theme.accentSoft, foreground: theme.accentStrong };
  if (kind === 'project') return { background: theme.workflowBacklogSoft, foreground: theme.workflowBacklogStrong };
  return { background: theme.successSoft, foreground: theme.workflowStartedStrong };
}

const styles = StyleSheet.create({
  activityAvatarWrap: { height: 40, position: 'relative', width: 40 },
  activityCopy: { flex: 1, gap: 2, minWidth: 0 },
  activityTitleRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, minWidth: 0 },
  activityTitle: { flex: 1 },
  activityKind: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: 2, bottom: -2, height: 18, justifyContent: 'center', position: 'absolute', right: -2, width: 18 },
  activityType: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  activityAction: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 30, justifyContent: 'center', width: 30 },
  activityRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 76, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  activitySurface: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  routeButton: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  section: { gap: Spacing.three },
  statCard: {
    alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth,
    flex: 1, flexDirection: 'row', gap: Spacing.two, minHeight: 96, minWidth: 0, padding: Spacing.three,
  },
  statCopy: { flex: 1, gap: 2, minWidth: 0 },
  statIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  statsGrid: { gap: Spacing.three },
  statsRow: { flexDirection: 'row', gap: Spacing.three },
  statValue: { fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '700', lineHeight: 31 },
  statValueRow: { alignItems: 'baseline', flexDirection: 'row', gap: Spacing.one },
  statusHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  taskCard: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, justifyContent: 'space-between', minHeight: 136, padding: Spacing.three },
  taskContextRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between', minWidth: 0 },
  taskTopRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between', minWidth: 0 },
  taskCarouselContent: { gap: Spacing.three, paddingRight: Spacing.four },
  taskMetaItem: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minWidth: 0 },
  taskMetaRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  taskTitle: { flex: 1, fontSize: 14, lineHeight: 19, minWidth: 0 },
  channelPill: { alignItems: 'center', alignSelf: 'flex-start', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, maxWidth: '100%', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  channelPillText: { flexShrink: 1 },
  statusPill: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexShrink: 0, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
});
