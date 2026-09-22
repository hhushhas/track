import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { usePaginatedQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { RecentUpdateRow, type HomeUpdate } from '@/components/home-dashboard';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { channelHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { recentHomeUpdates, uniqueAttentionItems, type MobileAttentionItem } from '@/lib/mobile-attention';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';

export default function UpdatesScreen() {
  const router = useRouter();
  const bottomInset = useBottomTabContentInset();
  const { actingCompanyId } = useCompany();
  const { trackUserId } = useTrackUser();
  const updates = usePaginatedQuery(api.mobile.listAttention, trackUserId ? {
    userId: trackUserId,
    actingCompanyId: actingCompanyId ?? undefined,
  } : 'skip', { initialNumItems: 50 });
  const items = useMemo(() => recentHomeUpdates(uniqueAttentionItems((updates.results as MobileAttentionItem[])
    .filter((item) => !actingCompanyId || item.companyId === actingCompanyId))) as HomeUpdate[], [actingCompanyId, updates.results]);

  function open(item: HomeUpdate) {
    const companyId = item.companyId as Id<'companies'> | undefined;
    const membershipId = item.membershipId as Id<'projectMembers'>;
    const projectId = item.projectId as Id<'projects'>;
    const identity: MobileTaskIdentity | null = companyId ? { companyId, membershipId } : null;
    const context: RepresentedProjectContext | null = identity ? { ...identity, archived: false } : null;
    if (item.kind === 'task' && item.taskKey) return router.push(taskDetailHref(projectId, item.taskKey, identity));
    if (item.kind === 'message' && item.groupId && item.messageId) {
      const groupId = item.groupId as Id<'groups'>;
      const messageId = item.messageId as Id<'messages'>;
      if (item.threadId) return router.push(threadConversationHref(projectId, groupId, item.threadId as Id<'channelThreads'>, context, messageId) as never);
      return router.push(channelHref(projectId, groupId, context, messageId) as never);
    }
  }

  return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ title: 'Recent updates' }} />
    <ConnectivityBanner style={styles.connection} message="You’re offline. Showing saved updates when available." />
    {updates.status === 'LoadingFirstPage' ? <View style={styles.loading}><SkeletonList count={5} label="Loading recent updates" /></View> : (
      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
        data={items}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        ListEmptyComponent={<EmptyState body="Replies, assignments, and important task changes will appear here." icon="clock-outline" title="No important updates yet" />}
        onEndReached={() => { if (updates.status === 'CanLoadMore') updates.loadMore(50); }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => <RecentUpdateRow item={item} onPress={() => open(item)} />}
      />
    )}
  </ThemedView>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  loading: { padding: Spacing.four },
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  screen: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
});
