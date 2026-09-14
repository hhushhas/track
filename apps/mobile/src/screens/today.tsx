import { usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import {
  HomeAttentionCard,
  HomeFilterChips,
  HomeGreeting,
  HomePulse,
  HomeQuickAction,
  HomeSectionHeading,
  HomeTaskCard,
  type HomeFilter,
} from '@/components/home-dashboard';
import { OptionsSheet, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedView } from '@/components/themed-view';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { Spacing } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { hapticLight } from '@/lib/haptics';
import { attentionMatchesHomeFilter, taskIsDueToday } from '@/lib/home-feed';
import { uniqueAttentionItems, type MobileAttentionItem } from '@/lib/mobile-attention';
import { channelHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';

type GlobalTask = FunctionReturnType<typeof api.mobile.listMyTasks>['page'][number];
type ProjectRow = NonNullable<FunctionReturnType<typeof api.mobile.listProjects>['page'][number]>;
const emptyFilterCopy: Record<HomeFilter, { body: string; title: string }> = {
  all: { title: 'You are clear', body: 'New mentions, discussions, suggestions, and assigned tasks will appear here.' },
  mentions: { title: 'No new mentions', body: 'Mentions and direct replies that need your attention will appear here.' },
  due: { title: 'Nothing due today', body: 'Tasks due today will appear here.' },
  assigned: { title: 'No assigned work', body: 'Open tasks assigned to you will appear here.' },
  suggestions: { title: 'No task suggestions', body: 'Conversation-based task suggestions will appear here.' },
};

export default function TodayScreen() {
  const bottomContentInset = useBottomTabContentInset();
  const safeArea = useSafeAreaInsets();
  const router = useRouter();
  const { actingCompany, actingCompanyId, companies } = useCompany();
  const { openProfileSheet, trackUserId } = useTrackUser();
  const [filter, setFilter] = useState<HomeFilter>('all');
  const [sheet, setSheet] = useState<'filter' | 'project' | null>(null);
  const profileStatus = useQuery(api.auth.getProfileStatus, trackUserId ? { userId: trackUserId } : 'skip');
  const attentionPages = usePaginatedQuery(api.mobile.listAttention, trackUserId
    ? { userId: trackUserId, actingCompanyId: actingCompanyId ?? undefined }
    : 'skip', { initialNumItems: 10 });
  const taskPages = usePaginatedQuery(api.mobile.listMyTasks, trackUserId
    ? { userId: trackUserId, actingCompanyId: actingCompanyId ?? undefined, openOnly: true }
    : 'skip', { initialNumItems: 10 });
  const projectPages = usePaginatedQuery(api.mobile.listProjects, trackUserId
    ? { userId: trackUserId, actingCompanyId: actingCompanyId ?? undefined }
    : 'skip', { initialNumItems: 20 });

  useEffect(() => {
    if (attentionPages.status === 'CanLoadMore') attentionPages.loadMore(10);
  }, [attentionPages.loadMore, attentionPages.status]);
  useEffect(() => {
    if (taskPages.status === 'CanLoadMore') taskPages.loadMore(10);
  }, [taskPages.loadMore, taskPages.status]);
  useEffect(() => {
    if (projectPages.status === 'CanLoadMore') projectPages.loadMore(20);
  }, [projectPages.loadMore, projectPages.status]);

  const attention = attentionPages.results as MobileAttentionItem[];
  const uniqueAttention = useMemo(() => uniqueAttentionItems(attention), [attention]);
  const myTasks = useMemo(() => [...taskPages.results as GlobalTask[]].sort((left, right) =>
    (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31') || right.task.updatedAt - left.task.updatedAt,
  ), [taskPages.results]);
  const projects = projectPages.results.filter((item): item is ProjectRow => Boolean(item && item.membership.status !== 'archived'));
  function feedFor(nextFilter: HomeFilter) {
    const attentionItems = uniqueAttention.filter((item) => attentionMatchesHomeFilter(item, nextFilter));
    const attentionTaskIds = new Set(attentionItems.flatMap((item) => item.kind === 'task' && item.taskId ? [item.taskId] : []));
    const taskItems = myTasks.filter((item) => !attentionTaskIds.has(item.task._id) && (
      nextFilter === 'all' || nextFilter === 'assigned' || (nextFilter === 'due' && taskIsDueToday(item.task.dueDate))
    ));
    return { attentionItems, taskItems };
  }
  const feeds = {
    all: feedFor('all'),
    mentions: feedFor('mentions'),
    due: feedFor('due'),
    assigned: feedFor('assigned'),
    suggestions: feedFor('suggestions'),
  };
  const counts = Object.fromEntries(Object.entries(feeds).map(([key, feed]) => [key, feed.attentionItems.length + feed.taskItems.length])) as Record<HomeFilter, number>;
  const { attentionItems: filteredAttention, taskItems: filteredTasks } = feeds[filter];
  const displayName = profileStatus?.user.displayName || 'Track member';
  const companyLabel = actingCompany?.company?.displayName ?? (companies?.length === 1 ? companies[0].company?.displayName : 'All Companies') ?? 'All Companies';
  const companyCount = actingCompanyId ? 1 : new Set(projects.map((item) => item.membership.companyId).filter(Boolean)).size || (projects.length ? 1 : 0);
  const loading = attentionPages.status === 'LoadingFirstPage' || taskPages.status === 'LoadingFirstPage' || projectPages.status === 'LoadingFirstPage';
  const filterOptions = [
    { key: 'all' as const, label: `All (${counts.all})`, count: counts.all },
    { key: 'mentions' as const, label: 'Mentions', count: counts.mentions },
    { key: 'due' as const, label: 'Due Today', count: counts.due },
    { key: 'assigned' as const, label: 'Assigned', count: counts.assigned },
    { key: 'suggestions' as const, label: 'Suggestions', count: counts.suggestions },
  ];

  function openAttention(item: MobileAttentionItem) {
    hapticLight();
    const identity: MobileTaskIdentity | null = item.companyId && item.membershipId ? { companyId: item.companyId, membershipId: item.membershipId } : null;
    const context: RepresentedProjectContext | null = identity ? { companyId: identity.companyId, membershipId: identity.membershipId, archived: false } : null;
    if (item.kind === 'task') return router.push(taskDetailHref(item.projectId, item.taskKey, identity, { companyId: item.companyId, id: item.id, membershipId: item.membershipId }));
    if (item.kind === 'suggestion') return router.push(taskListHref(item.projectId, identity, 'inbox', item.id));
    if (item.kind === 'invitation') return router.push(`/inbox?filter=invitations&invitationId=${encodeURIComponent(item.invitationId)}`);
    if (item.threadId) return router.push(threadConversationHref(item.projectId, item.groupId, item.threadId, context, item.messageId) as never);
    return router.push(channelHref(item.projectId, item.groupId, context, item.messageId) as never);
  }

  function openTask(item: GlobalTask) {
    hapticLight();
    const identity: MobileTaskIdentity | null = item.companyId ? { companyId: item.companyId, membershipId: item.projectMemberId } : null;
    router.push(taskDetailHref(item.project._id, item.task.publicKey, identity));
  }

  function createTaskIn(project: ProjectRow) {
    hapticLight();
    setSheet(null);
    const identity: MobileTaskIdentity | null = project.membership.companyId ? { companyId: project.membership.companyId, membershipId: project.membership._id } : null;
    router.push(`${taskListHref(project.project._id, identity)}&create=1` as never);
  }

  return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ headerShown: false }} />
    {loading ? <View style={[styles.loading, { paddingTop: safeArea.top + Spacing.two }]}><SkeletonList count={6} label="Loading your Home dashboard" /></View> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset, paddingTop: safeArea.top + Spacing.two }]} contentInsetAdjustmentBehavior="never">
      <HomeGreeting companyLabel={companyLabel} displayName={displayName} onProfile={openProfileSheet} />
      <ConnectivityBanner />
      <HomePulse attentionCount={uniqueAttention.length} companyCount={companyCount} dueTodayCount={myTasks.filter((item) => taskIsDueToday(item.task.dueDate)).length} mentionCount={counts.mentions} openTaskCount={myTasks.length} projectCount={projects.length} />
      <HomeFilterChips filters={filterOptions} onChange={(nextFilter) => { hapticLight(); setFilter(nextFilter); }} selected={filter} />
      <View style={styles.feed}>
        {filteredAttention.length ? <HomeSectionHeading icon="alert-circle" meta="Sorted by urgency" title="Requires Attention" /> : null}
        {filteredAttention.map((item) => <HomeAttentionCard item={item} key={`${item.kind}:${item.id}`} onPress={() => openAttention(item)} />)}
        {filteredTasks.length ? <HomeSectionHeading icon="check-circle" meta={`${filteredTasks.length} active`} title="My Open Tasks" /> : null}
        {filteredTasks.map((item) => <HomeTaskCard assigneeName={displayName} item={item} key={item.task._id} onPress={() => openTask(item)} />)}
        {!filteredAttention.length && !filteredTasks.length ? <EmptyState body={emptyFilterCopy[filter].body} icon="check-circle" title={emptyFilterCopy[filter].title} tone="success" /> : null}
        <HomeQuickAction onPress={() => setSheet('project')} />
      </View>
    </ScrollView>}
    <OptionsSheet onClose={() => setSheet(null)} title="Filter Home" visible={sheet === 'filter'}><SheetSection title="Show">{filterOptions.map((option) => <SheetRow icon={option.key === 'all' ? 'list' : option.key === 'mentions' ? 'message' : option.key === 'due' ? 'calendar-today' : option.key === 'assigned' ? 'person' : 'lightbulb-outline'} key={option.key} label={`${option.label}${option.key === 'all' ? '' : ` (${option.count})`}`} onPress={() => { setFilter(option.key); setSheet(null); }} selected={filter === option.key} />)}</SheetSection></OptionsSheet>
    <OptionsSheet onClose={() => setSheet(null)} title="Create task" visible={sheet === 'project'}>
      <SheetNote>Choose the Project that will own this task. The task form opens with that Project&apos;s board and permissions.</SheetNote>
      <SheetSection title="Project">{projects.map((project) => <SheetRow icon="project" key={project.membership._id} label={`${project.project.name}${project.membership.companyDisplayNameSnapshot ? ` \u00b7 ${project.membership.companyDisplayNameSnapshot}` : ''}`} onPress={() => createTaskIn(project)} />)}{!projects.length ? <SheetNote>No active Project is available. Create or join a Project first.</SheetNote> : null}</SheetSection>
    </OptionsSheet>
  </ThemedView>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, paddingHorizontal: Spacing.four, paddingTop: Spacing.one },
  feed: { gap: Spacing.two },
  loading: { flex: 1 },
  screen: { flex: 1 },
});
