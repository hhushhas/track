import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useCallback, useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { usePrimaryNavigationVisibility } from '@/contexts/primary-navigation-visibility-context';
import { ColoredAvatar } from '@/components/colored-avatar';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { useReleaseConfig } from '@/lib/release-config';
import { taskListHref } from '@/lib/task-navigation';
import { usePushNotifications } from '@/lib/push-notifications';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';

type MobileGroup = FunctionReturnType<typeof api.mobile.listGroupsPage>['page'][number];

export default function GroupsScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const release = useReleaseConfig();
  const { trackUserId } = useTrackUser();
  const push = usePushNotifications();
  const { setCreateContext } = usePrimaryNavigationVisibility();
  const { projectId, companyId, membershipId, archive } = useLocalSearchParams<{ projectId: string; companyId?: string; membershipId?: string; archive?: string }>();
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(useCallback(() => {
    if (!projectId) {
      setCreateContext(null);
      return undefined;
    }
    setCreateContext({ archive: archive === '1', companyId, membershipId, projectId, scope: 'project' });
    return () => setCreateContext(null);
  }, [archive, companyId, membershipId, projectId, setCreateContext]));

  const projectsPage = usePaginatedQuery(
    api.mobile.listProjects,
    trackUserId ? { userId: trackUserId, actingCompanyId: companyId as Id<'companies'> | undefined } : 'skip',
    { initialNumItems: 100 },
  );
  const navigation = useQuery(api.mobile.resolveNavigation, trackUserId && projectId ? {
    userId: trackUserId,
    projectId: projectId as Id<'projects'>,
    actingCompanyId: companyId as Id<'companies'> | undefined,
    projectMemberId: membershipId as Id<'projectMembers'> | undefined,
  } : 'skip');
  const { results: groups, status: groupsStatus, loadMore: loadMoreGroups } = usePaginatedQuery(
    api.mobile.listGroupsPage,
    trackUserId && projectId && navigation?.available ? {
      userId: trackUserId,
      projectId: projectId as Id<'projects'>,
      actingCompanyId: companyId as Id<'companies'> | undefined,
      projectMemberId: membershipId as Id<'projectMembers'> | undefined,
    } : 'skip',
    { initialNumItems: 50 },
  );

  const projectName = projectsPage.results.find((p) => p.project._id === projectId)?.project.name ?? 'Channels';
  const readOnlyArchive = archive === '1' || navigation?.archived === true;
  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return groups;
    return groups.filter((item) => `${item.group.name} ${item.lastMessage?.body ?? ''}`.toLocaleLowerCase().includes(query));
  }, [groups, searchQuery]);

  function navigate(item: MobileGroup) {
    hapticLight();
    router.push(channelHref(projectId as Id<'projects'>, item.group._id, companyId && membershipId ? {
      archived: readOnlyArchive || item.group.status === 'archived',
      companyId: companyId as Id<'companies'>,
      membershipId: membershipId as Id<'projectMembers'>,
    } : null) as never);
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: projectName,
          headerLargeTitle: false,
          headerTransparent: false,
          headerRight: () => release.tasks ? (
            <IconButton
              accessibilityLabel="Open tasks"
              appearance="plain"
              icon="task"
              onPress={() => router.push(taskListHref(projectId as Id<'projects'>, companyId && membershipId ? {
                archived: readOnlyArchive,
                companyId: companyId as Id<'companies'>,
                membershipId: membershipId as Id<'projectMembers'>,
              } : null))}
            />
          ) : null,
        }}
      />

      <ConnectivityBanner style={styles.connection} message="You’re offline. Cached Channels stay available when possible." />
      {navigation && !navigation.available ? <View style={styles.list}><EmptyState icon="shield-lock-outline" title="Project unavailable" body={navigationUnavailableCopy(Boolean(companyId))} /></View> : null}

      {!navigation || navigation.available && groupsStatus === 'LoadingFirstPage' ? (
        <SkeletonList label="Loading Channels" />
      ) : navigation.available ? (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          data={visibleGroups}
          keyExtractor={(item) => item.group._id}
          renderItem={({ item }) => <GroupRow archived={readOnlyArchive || item.group.status === 'archived'} item={item} onPress={() => navigate(item)} />}
          ListHeaderComponent={<>
            <View style={[styles.contextCard, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
              <View style={[styles.contextIcon, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name="channel" size={20} /></View>
              <View style={styles.notificationCopy}><ThemedText themeColor="textSecondary" type="captionBold">PROJECT CHANNELS</ThemedText><ThemedText type="titleLarge">{projectName}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{groups.length} visible {groups.length === 1 ? 'Channel' : 'Channels'}{readOnlyArchive ? ' · read-only archive' : ''}</ThemedText></View>
            </View>
            <View style={[styles.searchWrap, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
              <PlatformIcon color={theme.textTertiary} name="search" size={18} />
              <TextInput accessibilityLabel="Search project Channels" autoCapitalize="none" autoCorrect={false} maxLength={120} onChangeText={setSearchQuery} placeholder="Search Channels" placeholderTextColor={theme.textTertiary} style={[styles.searchInput, { color: theme.text }]} value={searchQuery} />
            </View>
            {push.permissionState === 'not_determined' ? (
              <View style={[styles.notificationCard, { backgroundColor: theme.backgroundElement }]}>
                <PlatformIcon color={theme.accent} name="bell-outline" size={24} />
                <View style={styles.notificationCopy}>
                  <ThemedText type="title">Keep up with {projectName}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="caption">Get timely Project activity with full, context-only, or hidden previews you control.</ThemedText>
                </View>
                <Pressable accessibilityRole="button" disabled={push.syncing} onPress={() => void push.requestPermission()} style={[styles.enableButton, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                  <ThemedText style={{ color: theme.background }} type="title">Enable</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </>}
          ListFooterComponent={groupsStatus === 'CanLoadMore' || groupsStatus === 'LoadingMore' ? (
            <Pressable
              accessibilityRole="button"
              disabled={groupsStatus === 'LoadingMore'}
              onPress={() => loadMoreGroups(50)}
              style={styles.loadMore}>
              <ThemedText type="smallBold">
                {groupsStatus === 'LoadingMore' ? 'Loading more Channels…' : 'Load more Channels'}
              </ThemedText>
            </Pressable>
          ) : null}
          ListEmptyComponent={
            <EmptyState icon="channel" title={searchQuery.trim() ? 'No matching Channels' : 'No Channels visible'} body={searchQuery.trim() ? 'Try a different Channel name or message.' : 'Only Channels explicitly granted to this represented membership appear here.'} />
          }
        />
      ) : null}
    </ThemedView>
  );
}

function GroupRow({ archived, item, onPress }: { archived: boolean; item: MobileGroup; onPress: () => void }) {
  const theme = useTheme();
  return (
    // See projects.tsx: a themed fill and a ripple on the same pressable share
    // one Android drawable that never repaints on a theme change.
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityHint={archived ? 'Opens this read-only Channel archive' : 'Opens this Channel'}
        accessibilityLabel={`${item.group.name}.${item.unreadCount ? ` ${item.unreadCount} unread.` : ''}${archived ? ' Read-only archive.' : ''}`}
        accessibilityRole="button"
        android_ripple={{ color: theme.backgroundSelected }}
        hitSlop={4}
        onPress={() => { hapticLight(); onPress(); }}
        style={styles.rowPressable}>
        <ColoredAvatar label={item.group.name} seed={item.group._id} shape="rounded" size={44} />
        <View style={styles.rowBody}>
          <ThemedText numberOfLines={1} type="title">{item.group.name}</ThemedText>
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
            {item.lastMessage?.body || 'No messages yet'}
            {archived ? ' · read-only archive' : ''}
          </ThemedText>
        </View>
        {item.unreadCount > 0 ? (
          <View
            accessibilityLabel={`${item.unreadCount} unread`}
            style={[styles.badge, { backgroundColor: theme.accent }]}>
            <ThemedText style={{ color: theme.background }} type="captionBold">
              {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
            </ThemedText>
          </View>
        ) : (
          <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  connection: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  enableButton: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    justifyContent: 'center',
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  contextCard: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, marginBottom: Spacing.two, padding: Spacing.three },
  contextIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 44, justifyContent: 'center', width: 44 },
  list: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingTop: Spacing.two,
  },
  loadMore: {
    alignItems: 'center',
    minHeight: TouchTarget,
    justifyContent: 'center',
    padding: Spacing.two,
  },
  notificationCard: {
    alignItems: 'center',
    borderRadius: Radius.large,
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.three,
  },
  notificationCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  searchInput: { flex: 1, fontSize: 15, lineHeight: 21, minHeight: TouchTarget, paddingVertical: Spacing.two },
  searchWrap: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  headerButton: {
    alignItems: 'center',
    height: TouchTarget,
    justifyContent: 'center',
    width: TouchTarget,
  },
  row: {
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  screen: {
    flex: 1,
  },
});
