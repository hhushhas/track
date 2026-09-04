import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { PrimaryNavigation } from '@/components/primary-navigation';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { useReleaseConfig } from '@/lib/release-config';
import { projectChannelsHref } from '@/lib/company-navigation';
import { taskListHref } from '@/lib/task-navigation';

type ProjectRow = {
  project: Doc<'projects'>;
  membership: Doc<'projectMembers'>;
  groupCount: number;
  unreadCount: number;
};

type ProjectAttention = {
  id: string;
  kind: 'task' | 'message' | 'suggestion' | 'invitation';
  projectId: Id<'projects'>;
  projectName: string;
  taskTitle?: string;
  senderName?: string;
  title?: string;
  eventType: string;
};

export default function ProjectOverviewScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const release = useReleaseConfig();
  const { trackUserId } = useTrackUser();
  const { actingCompanyId } = useCompany();
  const params = useLocalSearchParams<{ projectId?: string; companyId?: string; membershipId?: string; archive?: string }>();
  const projectId = typeof params.projectId === 'string' ? params.projectId as Id<'projects'> : undefined;
  const companyId = typeof params.companyId === 'string' ? params.companyId as Id<'companies'> : actingCompanyId ?? undefined;
  const membershipId = typeof params.membershipId === 'string' ? params.membershipId as Id<'projectMembers'> : undefined;
  const archived = params.archive === '1';
  const context = companyId && membershipId ? { archived, companyId, membershipId } : null;

  const projects = useQuery(api.mobile.listProjects, trackUserId ? {
    userId: trackUserId,
    actingCompanyId: companyId,
  } : 'skip');
  const navigation = useQuery(api.mobile.resolveNavigation, trackUserId && projectId ? {
    userId: trackUserId,
    projectId,
    actingCompanyId: companyId,
    projectMemberId: membershipId,
  } : 'skip');
  const groups = useQuery(api.mobile.listGroups, trackUserId && projectId && navigation?.available ? {
    userId: trackUserId,
    projectId,
    actingCompanyId: companyId,
    projectMemberId: membershipId,
  } : 'skip');
  const boards = useQuery(api.taskBoards.list, release.tasks && trackUserId && projectId && navigation?.available ? {
    projectId,
    actingCompanyId: companyId,
    projectMemberId: membershipId,
  } : 'skip');
  const tasks = useQuery(api.tasks.list, release.tasks && trackUserId && projectId && navigation?.available ? {
    projectId,
    actingCompanyId: companyId,
    projectMemberId: membershipId,
    openOnly: true,
  } : 'skip');
  const attention = useQuery(api.mobile.listAttention, trackUserId ? {
    userId: trackUserId,
    actingCompanyId: companyId,
  } : 'skip') as ProjectAttention[] | undefined;

  const project = (projects as ProjectRow[] | undefined)?.find((row) => row.project._id === projectId);
  const projectName = project?.project.name ?? 'Project overview';
  const projectAttention = (attention ?? []).filter((item) => item.projectId === projectId).slice(0, 3);
  const openTaskCount = tasks?.length ?? 0;
  const channelCount = groups?.length ?? project?.groupCount ?? 0;
  const boardCount = boards?.length ?? 0;
  const loading = !projectId || projects === undefined || navigation === undefined;

  function openTasks() {
    if (!projectId || !release.tasks) return;
    router.push(taskListHref(projectId, context));
  }

  function openChannels() {
    if (!projectId) return;
    router.push(projectChannelsHref(projectId, context));
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: projectName }} />
      {loading ? <SkeletonList label="Loading Project" /> : navigation && !navigation.available ? (
        <View style={styles.centered}><EmptyState icon="shield-lock-outline" title="Project unavailable" body="This Project is not available for the represented membership." /></View>
      ) : projectId && project ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]} contentInsetAdjustmentBehavior="automatic">
          <View style={styles.heading}>
            <ThemedText type="display">{projectName}</ThemedText>
            <ThemedText themeColor="textSecondary" type="message">
              One place for the work and conversations that move this Project forward.
            </ThemedText>
          </View>

          <View style={styles.statsRow}>
            <Stat value={String(openTaskCount)} label="Open tasks" />
            <Stat value={String(channelCount)} label="Channels" />
            <Stat value={String(boardCount)} label="Boards" />
          </View>

          <View style={styles.actions}>
            {release.tasks ? <ProjectAction icon="check-circle" label="Open tasks" onPress={openTasks} /> : null}
            <ProjectAction icon="forum-outline" label="Open Channels" onPress={openChannels} />
          </View>

          <View style={styles.sectionHeading}>
            <ThemedText type="title">Your attention</ThemedText>
            <ThemedText themeColor="textSecondary" type="caption">Only items that need a next action.</ThemedText>
          </View>
          {projectAttention.length > 0 ? projectAttention.map((item) => (
            <AttentionRow key={item.id} item={item} />
          )) : <View style={[styles.emptyRow, { borderColor: theme.hairline }]}>
            <PlatformIcon color={theme.success} name="check-circle" size={20} />
            <ThemedText themeColor="textSecondary" type="small">Nothing needs your attention here.</ThemedText>
          </View>}
        </ScrollView>
      ) : (
        <View style={styles.centered}><EmptyState icon="briefcase-outline" title="Choose a Project" body="Select a Project from Projects to see its work hub." /></View>
      )}
      <PrimaryNavigation tasksHref={release.tasks && projectId ? taskListHref(projectId, context) : undefined} />
    </ThemedView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="titleLarge">{value}</ThemedText>
      <ThemedText themeColor="textSecondary" type="caption">{label}</ThemedText>
    </View>
  );
}

function ProjectAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={[styles.action, { borderColor: theme.hairline }]}>
      <PlatformIcon color={theme.accentStrong} name={icon} size={20} />
      <ThemedText type="smallBold">{label}</ThemedText>
      <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
    </Pressable>
  );
}

function AttentionRow({ item }: { item: ProjectAttention }) {
  const theme = useTheme();
  const title = item.kind === 'task'
    ? item.taskTitle ?? 'Task update'
    : item.kind === 'message'
      ? `${item.senderName ?? 'A teammate'} ${item.eventType === 'mention' ? 'mentioned you' : 'replied to you'}`
      : item.title ?? 'Project update';
  return (
    <View style={[styles.attentionRow, { borderColor: theme.hairline }]}>
      <View style={[styles.attentionDot, { backgroundColor: theme.accentStrong }]} />
      <View style={styles.attentionCopy}>
        <ThemedText numberOfLines={1} type="smallBold">{title}</ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{attentionCopy(item.eventType)}</ThemedText>
      </View>
    </View>
  );
}

function attentionCopy(eventType: string) {
  if (eventType === 'assignment') return 'Assigned to you';
  if (eventType === 'mention') return 'You were mentioned';
  if (eventType === 'overdue') return 'Overdue';
  if (eventType === 'due_soon') return 'Due soon';
  return 'Updated';
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  actions: { gap: Spacing.two },
  attentionCopy: { flex: 1, gap: 2, minWidth: 0 },
  attentionDot: { borderRadius: Radius.pill, height: 7, marginTop: 5, width: 7 },
  attentionRow: { alignItems: 'flex-start', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.two },
  centered: { flex: 1, justifyContent: 'center' },
  content: { gap: Spacing.four, padding: Spacing.three },
  emptyRow: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  heading: { gap: Spacing.one },
  screen: { flex: 1 },
  sectionHeading: { gap: Spacing.one, marginTop: Spacing.two },
  stat: { borderRadius: Radius.medium, flex: 1, gap: 2, padding: Spacing.three },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
});
