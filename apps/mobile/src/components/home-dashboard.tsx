import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getHomeGreeting } from '@/lib/home-greeting';
import { attentionContext, attentionTitle, relativeAttentionTime, type MobileAttentionItem } from '@/lib/mobile-attention';
import { taskPriorityLabel } from '@/lib/task-presentation';

export type HomeTask = {
  companyId?: string;
  companyName?: string;
  projectMemberId: string;
  project: { _id: string; name: string };
  state?: { category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'; name: string } | null;
  task: {
    _id: string;
    dueDate?: string;
    priority: 'none' | 'urgent' | 'high' | 'medium' | 'low';
    publicKey: string;
    title: string;
    updatedAt: number;
  };
};

export type HomeUpdate = {
  action: string;
  actorName: string;
  companyId?: string;
  companyName?: string;
  createdAt: number;
  groupId?: string;
  groupName?: string;
  id: string;
  kind: 'message' | 'task';
  membershipId: string;
  messageId?: string;
  preview: string;
  projectId: string;
  projectName: string;
  taskKey?: string;
  threadId?: string;
  title: string;
};

export type HomeStat = {
  detail: string;
  icon: IconName;
  label: string;
  tone: 'accent' | 'danger' | 'success' | 'info';
  value: number;
  onPress: () => void;
};

export function HomeHeader({
  companyLabel,
  displayName,
  notificationCount,
  onCompany,
  onNotifications,
  onProfile,
  profileSeed,
  timeZone,
}: {
  companyLabel: string;
  displayName: string;
  notificationCount: number;
  onCompany: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  profileSeed: string;
  timeZone?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(refresh);
  }, []);
  const firstName = displayName.trim().split(/\s+/)[0] || 'there';

  return (
    <View style={styles.header}>
      <View style={styles.headerBar}>
        <Pressable
          accessibilityHint="Opens the Company selector"
          accessibilityLabel={`Current scope: ${companyLabel}`}
          accessibilityRole="button"
          android_ripple={{ color: theme.backgroundSelected }}
          onPress={onCompany}
          style={({ pressed }) => [styles.companyButton, { opacity: pressed ? 0.68 : 1 }]}
        >
          <View style={[styles.companyIcon, { backgroundColor: theme.backgroundElevated }]}>
            <PlatformIcon color={theme.text} name="office-building" size={25} weight="medium" />
          </View>
          <View style={styles.companyCopy}>
            <View style={styles.companyNameLine}>
              <ThemedText numberOfLines={1} style={styles.companyName} type="subtitle">{companyLabel}</ThemedText>
              <PlatformIcon color={theme.textSecondary} name="chevron-down" size={16} weight="medium" />
            </View>
            <ThemedText numberOfLines={1} themeColor="textSecondary" type="label">Company workspace</ThemedText>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel={notificationCount ? `${notificationCount} notifications in ${companyLabel}` : `No notifications in ${companyLabel}`}
            accessibilityRole="button"
            onPress={onNotifications}
            style={({ pressed }) => [styles.headerIconButton, { borderColor: theme.homeBorder, opacity: pressed ? 0.65 : 1 }]}
          >
            <PlatformIcon color={theme.textSecondary} name="bell-outline" size={23} />
            {notificationCount > 0 ? (
              <View style={[styles.notificationBadge, { backgroundColor: theme.accent, borderColor: theme.homeBackground }]}>
                <ThemedText style={[styles.notificationBadgeText, { color: theme.background }]} type="captionBold">{notificationCount > 99 ? '99+' : notificationCount}</ThemedText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityLabel="Open account"
            accessibilityRole="button"
            onPress={onProfile}
            style={({ pressed }) => [styles.profileButton, { borderColor: theme.homeBorder, opacity: pressed ? 0.65 : 1 }]}
          >
            <ColoredAvatar label={displayName} seed={profileSeed} size={40} />
          </Pressable>
        </View>
      </View>
      <View style={styles.greeting}>
        <ThemedText adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.greetingTitle, width < 370 && styles.greetingTitleSmall]}>
          {getHomeGreeting(now, timeZone)}, {firstName}
        </ThemedText>
        <ThemedText style={styles.greetingSupport} themeColor="textSecondary">Here&apos;s what needs your attention today.</ThemedText>
      </View>
    </View>
  );
}

export function AttentionSection({ items, onOpen, onSeeAll }: { items: MobileAttentionItem[]; onOpen: (item: MobileAttentionItem) => void; onSeeAll: () => void }) {
  return (
    <HomeSection title="Needs your attention">
      <GroupedSurface>
        {items.length ? items.map((item, index) => (
          <View key={`${item.kind}:${item.id}`}>
            {index > 0 ? <Divider /> : null}
            <AttentionRow item={item} onPress={() => onOpen(item)} />
          </View>
        )) : <CompactState icon="check-circle" message="You're all clear for now." />}
        <Divider />
        <FooterLink label="See all" onPress={onSeeAll} />
      </GroupedSurface>
    </HomeSection>
  );
}

function AttentionRow({ item, onPress }: { item: MobileAttentionItem; onPress: () => void }) {
  const theme = useTheme();
  const personDriven = item.kind === 'message';
  const overdue = item.kind === 'task' && item.eventType === 'overdue';
  const action = personDriven ? 'Reply' : overdue ? 'Overdue' : item.kind === 'invitation' || item.kind === 'suggestion' ? 'Review' : 'View';
  const icon: IconName = item.kind === 'task' ? 'file-document-outline' : item.kind === 'suggestion' ? 'lightbulb-outline' : 'office-building';
  return (
    <Pressable
      accessibilityLabel={`${attentionTitle(item)}. ${attentionContext(item)}. ${action}`}
      accessibilityRole="button"
      android_ripple={{ color: theme.backgroundSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}
    >
      {personDriven ? <ColoredAvatar label={item.senderName} seed={String(item.id)} size={42} /> : (
        <View style={[styles.semanticIcon, { borderColor: theme.homeBorder }]}><PlatformIcon color={overdue ? theme.danger : theme.textSecondary} name={icon} size={22} /></View>
      )}
      <View style={styles.rowCopy}>
        <ThemedText numberOfLines={2} style={styles.rowTitle} type="smallBold">{attentionTitle(item)}</ThemedText>
        <View style={styles.attentionContextRow}>
          {item.kind !== 'invitation' && item.companyName ? <View style={[styles.companyPill, { backgroundColor: theme.navigationSelectionGlass, borderColor: theme.homeBorder }]}><ThemedText numberOfLines={1} themeColor="accentStrong" type="captionBold">{item.companyName}</ThemedText></View> : null}
          <ThemedText numberOfLines={1} style={styles.attentionContextText} themeColor="textSecondary" type="caption">{attentionMetadata(item)}</ThemedText>
        </View>
      </View>
      <View style={[styles.rowAction, { backgroundColor: overdue ? theme.dangerSoft : theme.accentSoft }]}>
        <ThemedText style={{ color: overdue ? theme.danger : theme.accentStrong }} type="label">{action}</ThemedText>
      </View>
      <PlatformIcon color={theme.textSecondary} name="chevron-right" size={17} />
    </Pressable>
  );
}

function attentionMetadata(item: MobileAttentionItem) {
  if (item.kind === 'message') return `${item.projectName}  ·  #${item.groupName}`;
  if (item.kind === 'invitation') return item.companyName;
  return item.projectName;
}

export function CommittedWorkCard({ completed, dueToday, onPress, overdue, percent, total }: { completed: number; dueToday: number; onPress: () => void; overdue: number; percent: number; total: number }) {
  const theme = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 370 || fontScale > 1.25;
  return (
    <HomeSection title="My committed work">
      <Pressable
        accessibilityLabel={total ? `${completed} of ${total} complete, ${percent} percent. ${dueToday} due today, ${overdue} overdue. View breakdown.` : 'No committed tasks right now. View tasks.'}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.committedCard, stacked && styles.committedCardStacked, { backgroundColor: pressed ? theme.backgroundSelected : theme.homeSurface, borderColor: theme.homeBorder }]}
      >
        {total ? <>
          <View style={styles.committedCopy}>
            <ThemedText style={styles.committedTitle} type="titleLarge">{completed} of {total} complete</ThemedText>
            <View style={styles.committedMeta}>
              <ThemedText themeColor="textSecondary">{dueToday} due today</ThemedText>
              <ThemedText themeColor="textSecondary">·</ThemedText>
              <ThemedText style={{ color: overdue ? theme.danger : theme.textSecondary }}>{overdue} overdue</ThemedText>
            </View>
          </View>
          <View style={styles.progressColumn}>
            <View style={styles.progressLine}>
              <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}><View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${percent}%` }]} /></View>
              <ThemedText style={styles.progressPercent} type="subtitle">{percent}%</ThemedText>
            </View>
            <View style={styles.breakdownLink}><ThemedText themeColor="textSecondary">View breakdown</ThemedText><PlatformIcon color={theme.textSecondary} name="chevron-right" size={16} /></View>
          </View>
        </> : <View style={styles.zeroStateRow}><ThemedText themeColor="textSecondary">No committed tasks right now.</ThemedText><View style={styles.breakdownLink}><ThemedText themeColor="textSecondary">View tasks</ThemedText><PlatformIcon color={theme.textSecondary} name="chevron-right" size={16} /></View></View>}
      </Pressable>
    </HomeSection>
  );
}

export function HomeStatsSection({ stats }: { stats: HomeStat[] }) {
  return <HomeSection title="At a glance"><View style={styles.statsGrid}>{stats.slice(0, 4).map((stat) => <HomeStatCard key={stat.label} stat={stat} />)}</View></HomeSection>;
}

function HomeStatCard({ stat }: { stat: HomeStat }) {
  const theme = useTheme();
  const color = stat.tone === 'danger' ? theme.danger : stat.tone === 'success' ? theme.success : stat.tone === 'info' ? theme.info : theme.accentStrong;
  return <Pressable accessibilityLabel={`${stat.label}: ${stat.value}. ${stat.detail}`} accessibilityRole="button" onPress={stat.onPress} style={({ pressed }) => [styles.statCard, { backgroundColor: pressed ? theme.backgroundSelected : theme.homeSurface, borderColor: theme.homeBorder }]}>
    <View style={[styles.statIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={color} name={stat.icon} size={19} /></View>
    <ThemedText style={styles.statValue} type="titleLarge">{stat.value}</ThemedText>
    <ThemedText numberOfLines={1} type="smallBold">{stat.label}</ThemedText>
    <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{stat.detail}</ThemedText>
  </Pressable>;
}

export function TodaySection({ items, onOpen, onSeeAll, today }: { items: HomeTask[]; onOpen: (item: HomeTask) => void; onSeeAll: () => void; today: string }) {
  return <HomeSection title="Today"><GroupedSurface>
    {items.length ? items.map((item, index) => <View key={item.task._id}>{index > 0 ? <Divider /> : null}<TodayTaskRow item={item} onPress={() => onOpen(item)} today={today} /></View>) : <CompactState icon="calendar-today" message="Nothing due today." />}
    <Divider /><FooterLink label={items.length ? 'See all tasks' : 'View upcoming tasks'} onPress={onSeeAll} />
  </GroupedSurface></HomeSection>;
}

function TodayTaskRow({ item, onPress, today }: { item: HomeTask; onPress: () => void; today: string }) {
  const theme = useTheme();
  const overdue = Boolean(item.task.dueDate && item.task.dueDate < today);
  const priority = taskPriorityLabel(item.task.priority);
  const priorityColor = item.task.priority === 'urgent' || item.task.priority === 'high'
    ? theme.danger
    : item.task.priority === 'medium'
      ? theme.accentStrong
      : theme.textSecondary;
  return <Pressable accessibilityLabel={`${item.task.title}. ${priority} priority. ${overdue ? 'Overdue' : 'Due today'}. Open task.`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}>
    <View style={[styles.taskControl, { borderColor: overdue ? theme.danger : theme.textSecondary }]} />
    <View style={styles.rowCopy}><ThemedText numberOfLines={1} style={styles.rowTitle} type="smallBold">{item.task.title}</ThemedText><View style={styles.taskMetadata}><ThemedText style={{ color: priorityColor }}>{priority}</ThemedText><ThemedText themeColor="textSecondary">·</ThemedText><ThemedText style={{ color: overdue ? theme.danger : theme.textSecondary }}>{overdue ? 'Overdue' : 'Today'}</ThemedText></View></View>
    <PlatformIcon color={theme.textSecondary} name="chevron-right" size={19} />
  </Pressable>;
}

export function RecentUpdatesSection({ items, onOpen, onSeeAll }: { items: HomeUpdate[]; onOpen: (item: HomeUpdate) => void; onSeeAll: () => void }) {
  return <HomeSection title="Recent updates"><GroupedSurface>
    {items.length ? items.map((item, index) => <View key={`${item.kind}:${item.id}`}>{index > 0 ? <Divider /> : null}<RecentUpdateRow item={item} onPress={() => onOpen(item)} /></View>) : <CompactState icon="clock-outline" message="No important updates yet." />}
    <Divider /><FooterLink label="View all updates" onPress={onSeeAll} />
  </GroupedSurface></HomeSection>;
}

export function RecentUpdateRow({ item, onPress }: { item: HomeUpdate; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel={`${item.title}. ${item.preview}. ${relativeAttentionTime(item.createdAt)} ago.`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}>
    {item.kind === 'message' ? <ColoredAvatar label={item.actorName} seed={`${item.actorName}:${item.id}`} size={40} /> : <View style={[styles.updateIcon, { backgroundColor: theme.successSoft }]}><PlatformIcon color={theme.success} name="check-circle" size={22} /></View>}
    <View style={styles.rowCopy}><ThemedText numberOfLines={1} style={styles.rowTitle} type="smallBold">{item.title}</ThemedText><ThemedText numberOfLines={1} themeColor="textSecondary">{item.preview}</ThemedText></View>
    <ThemedText numberOfLines={1} themeColor="textSecondary">{relativeAttentionTime(item.createdAt)} ago</ThemedText>
    <PlatformIcon color={theme.textSecondary} name="chevron-right" size={17} />
  </Pressable>;
}

export function HomeLoading() {
  const theme = useTheme();
  return <View accessibilityLabel="Loading Home" accessibilityRole="progressbar" style={styles.loading}>
    {[3, 1, 2, 2].map((rows, section) => <View key={section} style={styles.loadingSection}><View style={[styles.skeletonHeading, { backgroundColor: theme.skeleton }]} /><View style={[styles.loadingSurface, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>{Array.from({ length: rows }).map((_, row) => <View key={row} style={styles.skeletonRow}><View style={[styles.skeletonCircle, { backgroundColor: theme.skeleton }]} /><View style={styles.skeletonCopy}><View style={[styles.skeletonLine, { backgroundColor: theme.skeleton }]} /><View style={[styles.skeletonLineShort, { backgroundColor: theme.skeleton }]} /></View></View>)}</View></View>)}
  </View>;
}

export function HomeModuleError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const theme = useTheme();
  return <View accessibilityRole="alert" style={[styles.errorState, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}><ThemedText themeColor="textSecondary">Unable to load {label}.</ThemedText><Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><ThemedText themeColor="accentStrong" type="label">Retry</ThemedText></Pressable></View>;
}

function HomeSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <View style={styles.section}><ThemedText accessibilityRole="header" style={styles.sectionTitle} type="titleLarge">{title}</ThemedText>{children}</View>;
}

function GroupedSurface({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.groupedSurface, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>{children}</View>;
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.homeBorder }]} />;
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.footerLink, { opacity: pressed ? 0.62 : 1 }]}><ThemedText themeColor="textSecondary">{label}</ThemedText><PlatformIcon color={theme.textSecondary} name="chevron-right" size={16} /></Pressable>;
}

function CompactState({ icon, message }: { icon: IconName; message: string }) {
  const theme = useTheme();
  return <View style={styles.compactState}><PlatformIcon color={theme.success} name={icon} size={20} /><ThemedText themeColor="textSecondary">{message}</ThemedText></View>;
}

const styles = StyleSheet.create({
  attentionContextRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, minWidth: 0 },
  attentionContextText: { flex: 1, minWidth: 0 },
  breakdownLink: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget },
  committedCard: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.four, justifyContent: 'space-between', minHeight: 124, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  committedCardStacked: { alignItems: 'stretch', flexDirection: 'column' },
  committedCopy: { flex: 1, gap: Spacing.one, minWidth: 0 },
  committedMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  committedTitle: { fontVariant: ['tabular-nums'] },
  compactState: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 72, paddingHorizontal: Spacing.four },
  companyButton: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.three, minHeight: 56, minWidth: 0 },
  companyCopy: { flex: 1, gap: 1, minWidth: 0 },
  companyIcon: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, height: 52, justifyContent: 'center', width: 52 },
  companyPill: { borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, maxWidth: 112, minHeight: 24, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  companyName: { flexShrink: 1 },
  companyNameLine: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, minWidth: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.four },
  errorState: { alignItems: 'center', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 72, paddingHorizontal: Spacing.four },
  footerLink: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end', minHeight: 52, paddingHorizontal: Spacing.four },
  greeting: { gap: Spacing.one },
  greetingSupport: { fontSize: 16, lineHeight: 22 },
  greetingTitle: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
  greetingTitleSmall: { fontSize: 28, lineHeight: 34 },
  groupedSurface: { borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { gap: Spacing.five },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  headerBar: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  headerIconButton: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 48, justifyContent: 'center', width: 48 },
  listRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 88, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  loading: { gap: Spacing.five },
  loadingSection: { gap: Spacing.two },
  loadingSurface: { borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  notificationBadge: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: 2, justifyContent: 'center', minHeight: 20, minWidth: 20, paddingHorizontal: 4, position: 'absolute', right: -4, top: -4 },
  notificationBadgeText: { fontSize: 10, lineHeight: 14 },
  profileButton: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 48, justifyContent: 'center', width: 48 },
  progressColumn: { flex: 1.05, minWidth: 0 },
  progressFill: { borderRadius: Radius.pill, bottom: 0, left: 0, position: 'absolute', top: 0 },
  progressLine: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  progressPercent: { fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
  progressTrack: { borderRadius: Radius.pill, flex: 1, height: 9, overflow: 'hidden' },
  retry: { alignItems: 'center', justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  rowAction: { alignItems: 'center', borderRadius: Radius.large, justifyContent: 'center', minHeight: 40, minWidth: 64, paddingHorizontal: Spacing.two },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 15.5, lineHeight: 21 },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 21, lineHeight: 27 },
  statCard: { borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, flexBasis: '47%', flexGrow: 1, gap: Spacing.one, minHeight: 132, minWidth: 132, padding: Spacing.three },
  statIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  statValue: { fontVariant: ['tabular-nums'] },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  semanticIcon: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 42, justifyContent: 'center', width: 42 },
  skeletonCircle: { borderRadius: Radius.pill, height: 40, width: 40 },
  skeletonCopy: { flex: 1, gap: Spacing.two },
  skeletonHeading: { borderRadius: Radius.small, height: 22, width: 176 },
  skeletonLine: { borderRadius: Radius.small, height: 14, width: '70%' },
  skeletonLineShort: { borderRadius: Radius.small, height: 12, width: '44%' },
  skeletonRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 76, paddingHorizontal: Spacing.four },
  taskControl: { borderRadius: Radius.pill, borderWidth: 2, height: 28, width: 28 },
  taskMetadata: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  updateIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  zeroStateRow: { flex: 1, gap: Spacing.two },
});
