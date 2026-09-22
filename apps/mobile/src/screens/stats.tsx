import { useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import { ScreenEntrance } from '@/components/screen-entrance';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { StandalonePrimaryNavigation } from '@/components/primary-navigation';

type StatCardProps = { icon: 'task' | 'calendar-clock' | 'check-circle' | 'account-group'; label: string; value: number; detail: string; tone: 'accent' | 'danger' | 'success' | 'info' };

export default function StatsScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset(Spacing.six);
  const { actingCompany, actingCompanyId } = useCompany();
  const stats = useQuery(api.companyOverview.get, actingCompanyId ? { companyId: actingCompanyId, days: 7 } : 'skip');
  const companyName = actingCompany?.company?.displayName ?? 'All companies';

  return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ title: 'Stats', headerBackVisible: false }} />
    <ScreenEntrance style={styles.screenContent}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <ConnectivityBanner />
        <View style={styles.heading}>
          <ThemedText type="display">Company signal</ThemedText>
          <ThemedText themeColor="textSecondary">A permission-scoped view of {companyName} this week.</ThemedText>
        </View>
        {!actingCompanyId ? <View style={[styles.scopeNote, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}><PlatformIcon color={theme.accentStrong} name="office-building" size={18} /><ThemedText style={styles.flex} themeColor="textSecondary">Select a Company to see its stats. All companies is intentionally not aggregated for this view.</ThemedText></View> : stats === undefined ? <SkeletonList count={4} label="Loading Company stats" /> : (
          <>
            <View style={styles.grid}>
              <StatCard detail="open across Projects" icon="task" label="Open tasks" tone="accent" value={stats.stats.openTasks} />
              <StatCard detail="past their due date" icon="calendar-clock" label="Deadlines" tone="danger" value={stats.stats.overdueTasks} />
              <StatCard detail="completed this week" icon="check-circle" label="Momentum" tone="success" value={stats.stats.completedThisWeek} />
              <StatCard detail="active contributors" icon="account-group" label="Team activity" tone="info" value={stats.stats.activePeople} />
            </View>
            <View style={[styles.summary, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
              <View style={styles.summaryHeading}><ThemedText type="subtitle">Project health</ThemedText><ThemedText themeColor="textSecondary" type="caption">Last 7 days</ThemedText></View>
              {stats.projects.length ? stats.projects.map((project) => <View key={project.id} style={styles.projectRow}>
                <View style={styles.flex}><ThemedText numberOfLines={1} type="smallBold">{project.name}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{project.completedTasks} of {project.totalTasks} tasks complete</ThemedText></View>
                <ThemedText style={{ color: project.health === 'At risk' ? theme.danger : project.health === 'Completed' ? theme.success : theme.accentStrong }} type="captionBold">{project.health}</ThemedText>
              </View>) : <EmptyState icon="project" title="No active Projects" body="Projects you can access will appear here." />}
            </View>
            <View style={[styles.summary, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
              <View style={styles.summaryHeading}><ThemedText type="subtitle">Recent company activity</ThemedText><ThemedText themeColor="textSecondary" type="caption">Meaningful changes only</ThemedText></View>
              {stats.recentActivity.slice(0, 4).map((item) => <View key={item.id} style={styles.activityRow}><View style={[styles.activityIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.accentStrong} name={item.kind === 'task' ? 'task' : item.kind === 'message' ? 'message' : 'project'} size={17} /></View><View style={styles.flex}><ThemedText numberOfLines={1} type="smallBold">{item.title}</ThemedText><ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{item.preview}</ThemedText></View></View>)}
              {!stats.recentActivity.length ? <ThemedText themeColor="textSecondary">No meaningful activity yet.</ThemedText> : null}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenEntrance>
    <StandalonePrimaryNavigation active="home" />
  </ThemedView>;
}

function StatCard({ detail, icon, label, tone, value }: StatCardProps) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : tone === 'success' ? theme.success : tone === 'info' ? theme.info : theme.accentStrong;
  return <View accessibilityLabel={`${label}: ${value}. ${detail}`} style={[styles.card, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}><View style={[styles.cardIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={color} name={icon} size={19} /></View><ThemedText style={styles.cardValue} type="titleLarge">{value}</ThemedText><ThemedText type="smallBold">{label}</ThemedText><ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{detail}</ThemedText></View>;
}

const styles = StyleSheet.create({
  activityIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  activityRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 60 },
  card: { borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: Spacing.one, minWidth: 0, padding: Spacing.three },
  cardIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  cardValue: { fontVariant: ['tabular-nums'] },
  content: { gap: Spacing.five, padding: Spacing.four },
  flex: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  heading: { gap: Spacing.one },
  projectRow: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: 64, paddingVertical: Spacing.two },
  scopeNote: { alignItems: 'flex-start', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
  summary: { borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, padding: Spacing.four },
  summaryHeading: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
});
