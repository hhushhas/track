import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { CompanyHomeHeader } from '@/components/company-home-header';
import { ProjectsSection } from '@/components/company-project-carousel';
import { TaskStatusSummary, TodayTasksSection } from '@/components/company-work-sections';
import { AttentionSection } from '@/components/home-dashboard';
import type { HomeProject, HomeStats, HomeTask } from '@/components/home-workspace-types';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { HomeLoading } from '@/components/home-dashboard';
import { OptionsSheet, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { usePrimaryNavigationVisibility } from '@/contexts/primary-navigation-visibility-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, projectOverviewHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { localDateKey, todayTaskPreview } from '@/lib/home-feed';
import { hapticLight } from '@/lib/haptics';
import { actionableHomeAttention, uniqueAttentionItems, type MobileAttentionItem } from '@/lib/mobile-attention';
import { taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';

type GlobalTask = FunctionReturnType<typeof api.mobile.listMyTasks>['page'][number];
type ProjectDirectoryRow = NonNullable<FunctionReturnType<typeof api.mobile.listProjects>['page'][number]>;

export default function TodayScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomContentInset = useBottomTabContentInset(Spacing.five);
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string }>();
  const { actingCompany, actingCompanyId, companies, companyModelEnabled, setActingCompanyId } = useCompany();
  const { trackUserId } = useTrackUser();
  const { setCreateContext, setHidden: setNavigationHidden } = usePrimaryNavigationVisibility();
  const lastScrollY = useRef(0);
  const [sheet, setSheet] = useState<'company' | 'project' | null>(null);

  useFocusEffect(useCallback(() => {
    setCreateContext(null);
    return () => setCreateContext(null);
  }, [setCreateContext]));

  const activeCompanies = useMemo(() => (companies ?? []).filter(({ company }) => company?.status === 'active'), [companies]);
  useEffect(() => {
    if (!actingCompanyId && activeCompanies[0]?.company?._id) setActingCompanyId(activeCompanies[0].company._id);
  }, [actingCompanyId, activeCompanies, setActingCompanyId]);
  useEffect(() => {
    if (params.create) setSheet('project');
  }, [params.create]);
  useEffect(() => () => setNavigationHidden(false), [setNavigationHidden]);

  const profile = useQuery(api.auth.getProfileStatus, trackUserId ? { userId: trackUserId } : 'skip');
  const overview = useQuery(api.companyOverview.get, actingCompanyId ? { companyId: actingCompanyId, days: 7 } : 'skip');
  const attentionPages = usePaginatedQuery(api.mobile.listAttention, trackUserId && actingCompanyId
    ? { actingCompanyId, userId: trackUserId }
    : 'skip', { initialNumItems: 50 });
  const taskPages = usePaginatedQuery(api.mobile.listMyTasks, trackUserId && actingCompanyId
    ? { actingCompanyId, userId: trackUserId }
    : 'skip', { initialNumItems: 50 });
  const projectPages = usePaginatedQuery(api.mobile.listProjects, trackUserId && actingCompanyId
    ? { actingCompanyId, userId: trackUserId }
    : 'skip', { initialNumItems: 50 });

  useEffect(() => {
    if (attentionPages.status === 'CanLoadMore') attentionPages.loadMore(50);
  }, [attentionPages.loadMore, attentionPages.status]);
  useEffect(() => {
    if (taskPages.status === 'CanLoadMore') taskPages.loadMore(50);
  }, [taskPages.loadMore, taskPages.status]);
  useEffect(() => {
    if (projectPages.status === 'CanLoadMore') projectPages.loadMore(50);
  }, [projectPages.loadMore, projectPages.status]);

  const companyName = actingCompany?.company?.displayName ?? overview?.company.name ?? 'Company';
  const displayName = profile?.user.displayName || 'Track member';
  const today = localDateKey(new Date(), profile?.user.timezone);
  const tasks = useMemo(() => (taskPages.results as GlobalTask[])
    .filter((task) => task.companyId === actingCompanyId), [actingCompanyId, taskPages.results]);
  const todayTasks = useMemo(() => todayTaskPreview(tasks, today, 4) as HomeTask[], [tasks, today]);
  const notificationCount = useMemo(() => actionableHomeAttention(uniqueAttentionItems(
    (attentionPages.results as MobileAttentionItem[]).filter((item) => item.companyId === actingCompanyId),
  ), Number.POSITIVE_INFINITY).length, [actingCompanyId, attentionPages.results]);
  const projectDirectory = useMemo(() => (projectPages.results as Array<ProjectDirectoryRow | null>)
    .filter((row): row is ProjectDirectoryRow => Boolean(row && row.membership.status === 'active')),
  [projectPages.results]);
  const projects = useMemo(() => (overview?.projects ?? []).flatMap((summary) => {
    const directory = projectDirectory.find((row) => row.project._id === summary.id);
    const resolvedCompanyId = summary.companyId ?? directory?.membership.companyId;
    const resolvedMembershipId = summary.membershipId ?? directory?.membership._id;
    if (!resolvedCompanyId || !resolvedMembershipId) return [];
    return [{
      ...summary,
      channelCount: summary.channelCount ?? 0,
      channels: summary.channels ?? [],
      companyId: resolvedCompanyId,
      companyName,
      members: summary.members ?? [],
      membershipId: resolvedMembershipId,
      role: summary.role ?? directory?.membership.role ?? 'member',
    } as HomeProject];
  }), [companyName, overview?.projects, projectDirectory]);
  const stats: HomeStats = {
    completedTasks: overview?.stats.completedTasks ?? 0,
    dailyTasks: overview?.stats.dailyTasks ?? 0,
    inProgressTasks: overview?.stats.inProgressTasks ?? 0,
    upcomingTasks: overview?.stats.upcomingTasks ?? 0,
  };
  const loading = Boolean(actingCompanyId) && (
    overview === undefined
    || taskPages.status === 'LoadingFirstPage'
    || attentionPages.status === 'LoadingFirstPage'
    || projectPages.status === 'LoadingFirstPage'
  );

  function projectContext(project: HomeProject): RepresentedProjectContext {
    return { archived: false, companyId: project.companyId, membershipId: project.membershipId };
  }

  function closeSheet() {
    setSheet(null);
    if (params.create) router.setParams({ create: undefined });
  }

  function switchCompany(companyId: Id<'companies'>) {
    hapticLight();
    setActingCompanyId(companyId);
    closeSheet();
  }

  function openProject(project: HomeProject) {
    hapticLight();
    router.push(projectOverviewHref(project.id, projectContext(project)));
  }

  function openTask(task: HomeTask) {
    hapticLight();
    const identity: MobileTaskIdentity | null = task.companyId
      ? { companyId: task.companyId, membershipId: task.projectMemberId }
      : null;
    router.push(taskDetailHref(task.project._id, task.task.publicKey, identity));
  }

  function routeTask(task: HomeTask) {
    hapticLight();
    const identity: MobileTaskIdentity | null = task.companyId
      ? { companyId: task.companyId, membershipId: task.projectMemberId }
      : null;
    router.push(taskListHref(task.project._id, identity, undefined, undefined, {
      boardId: task.board?._id,
      taskId: task.task._id,
    }));
  }

  function openAttention(item: MobileAttentionItem) {
    hapticLight();
    const identity: MobileTaskIdentity | null = item.companyId && item.membershipId
      ? { companyId: item.companyId, membershipId: item.membershipId }
      : null;
    const context: RepresentedProjectContext | null = identity
      ? { ...identity, archived: false }
      : null;
    if (item.kind === 'task') {
      router.push(taskDetailHref(item.projectId, item.taskKey, identity));
      return;
    }
    if (item.kind === 'suggestion') {
      router.push(taskListHref(item.projectId, identity, 'inbox', item.id));
      return;
    }
    if (item.kind === 'invitation') {
      router.push('/inbox?filter=invitations');
      return;
    }
    if (item.threadId) {
      router.push(threadConversationHref(item.projectId, item.groupId, item.threadId, context) as never);
      return;
    }
    router.push(channelHref(item.projectId, item.groupId, context) as never);
  }

  function createTaskIn(project: HomeProject) {
    closeSheet();
    router.push(`${taskListHref(project.id, { companyId: project.companyId, membershipId: project.membershipId })}&create=1` as never);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = nextY - lastScrollY.current;
    if (nextY < 16 || delta < -10) setNavigationHidden(false);
    else if (nextY > 56 && delta > 10) setNavigationHidden(true);
    lastScrollY.current = nextY;
  }

  return (
    <ThemedView style={[styles.screen, { backgroundColor: theme.homeBackground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset, paddingTop: insets.top + Spacing.three }]}
        contentInsetAdjustmentBehavior="never"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <CompanyHomeHeader
          companyName={companyName}
          companySeed={actingCompanyId ?? companyName}
          displayName={displayName}
          notificationCount={notificationCount}
          onCompany={() => setSheet('company')}
          onNotifications={() => router.push('/notifications')}
          onProfile={() => router.push('/profile')}
          profileSeed={trackUserId ?? displayName}
          timeZone={profile?.user.timezone}
        />
        <ConnectivityBanner />
        {!actingCompanyId && companies !== undefined ? (
          <SheetNote>Select a Company to load its Home workspace.</SheetNote>
        ) : loading ? <HomeLoading /> : overview ? (
          <View key={actingCompanyId} style={styles.sections}>
            <TaskStatusSummary onPress={() => router.push('/tasks')} stats={stats} />
            <ProjectsSection
              onChannel={(project, channel) => router.push(channelHref(project.id, channel.id, projectContext(project)) as never)}
              onOpen={openProject}
              onSeeAll={() => router.push('/projects')}
              projects={projects}
            />
            <TodayTasksSection companyDueCount={stats.dailyTasks} onOpen={openTask} onRoute={routeTask} onSeeAll={() => router.push('/tasks')} tasks={todayTasks} />
            <AttentionSection
              items={(attentionPages.results as MobileAttentionItem[])
                .filter((item) => item.companyId === actingCompanyId)
                .slice(0, 4)}
              onOpen={openAttention}
              onSeeAll={() => router.push('/inbox')}
            />
          </View>
        ) : null}
      </ScrollView>

      <OptionsSheet onClose={closeSheet} title="Switch Company" visible={sheet === 'company'}>
        <SheetNote>Every Home section refreshes together and remains within the selected Company.</SheetNote>
        <SheetSection title="Company workspace">
          {activeCompanies.map(({ company }) => company ? (
            <SheetRow icon="office-building" key={company._id} label={company.displayName} onPress={() => switchCompany(company._id)} selected={company._id === actingCompanyId} />
          ) : null)}
        </SheetSection>
        {!companyModelEnabled ? <SheetNote>Company switching is not enabled on this server.</SheetNote> : null}
      </OptionsSheet>

      <OptionsSheet onClose={closeSheet} title="Choose a Project" visible={sheet === 'project'}>
        <SheetNote>Select the Project first. The task will be created inside that Project.</SheetNote>
        <SheetSection title={`New task in ${companyName}`}>
          {projects.map((project) => <SheetRow detail="Create a task in this Project" icon="project" key={project.id} label={project.name} onPress={() => createTaskIn(project)} />)}
          {!projects.length ? <SheetNote>No active Project is available in this Company.</SheetNote> : null}
        </SheetSection>
      </OptionsSheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.five, paddingHorizontal: Spacing.four },
  screen: { flex: 1 },
  sections: { gap: Spacing.five },
});
