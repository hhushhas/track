import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { ColoredAvatar } from '@/components/colored-avatar';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonRow } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';

type MobileGroup = {
  group: Doc<'groups'>;
  membership: Doc<'groupMembers'>;
  lastMessage: Doc<'messages'> | null;
  unreadCount: number;
};

export default function GroupsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { trackUserId } = useTrackUser();
  const { projectId, companyId, membershipId, archive } = useLocalSearchParams<{ projectId: string; companyId?: string; membershipId?: string; archive?: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const projects = useQuery(
    api.mobile.listProjects,
    trackUserId ? { userId: trackUserId, actingCompanyId: companyId as Id<'companies'> | undefined } : 'skip',
  );
  const navigation = useQuery(api.mobile.resolveNavigation, trackUserId && projectId ? {
    userId: trackUserId,
    projectId: projectId as Id<'projects'>,
    actingCompanyId: companyId as Id<'companies'> | undefined,
    projectMemberId: membershipId as Id<'projectMembers'> | undefined,
  } : 'skip');
  const groups = useQuery(
    api.mobile.listGroups,
    trackUserId && projectId && navigation?.available ? {
      userId: trackUserId,
      projectId: projectId as Id<'projects'>,
      actingCompanyId: companyId as Id<'companies'> | undefined,
      projectMemberId: membershipId as Id<'projectMembers'> | undefined,
    } : 'skip',
  );

  const groupItems = (groups ?? []) as MobileGroup[];
  const projectName = (projects as { project: Doc<'projects'> }[] | undefined)
    ?.find((p) => p.project._id === projectId)?.project.name ?? 'Channels';

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  function navigate(item: MobileGroup) {
    hapticLight();
    router.push(channelHref(projectId as Id<'projects'>, item.group._id, companyId && membershipId ? {
      archived: archive === '1',
      companyId: companyId as Id<'companies'>,
      membershipId: membershipId as Id<'projectMembers'>,
    } : null));
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: projectName,
          headerLargeTitle: Platform.OS === 'ios',
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect: 'systemMaterial',
        }}
      />

      {navigation && !navigation.available ? <View style={styles.list}><EmptyState icon="shield-lock-outline" title="Project unavailable" body={navigationUnavailableCopy(Boolean(companyId))} /></View> : null}

      {!navigation || navigation.available && groups === undefined ? (
        <View style={styles.list}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : navigation.available ? (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          data={groupItems}
          keyExtractor={(item) => item.group._id}
          renderItem={({ item }) => <GroupRow item={item} onPress={() => navigate(item)} />}
          ListEmptyComponent={
            <EmptyState icon="forum-outline" title="No Channels visible" body="Only Channels explicitly granted to this represented membership appear here." />
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
          }
        />
      ) : null}
    </ThemedView>
  );
}

function GroupRow({ item, onPress }: { item: MobileGroup; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      android_ripple={{ color: theme.backgroundSelected }}
      hitSlop={4}
      onPress={() => { hapticLight(); onPress(); }}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ColoredAvatar label={item.group.name} seed={item.group._id} shape="rounded" size={44} />
      <View style={styles.rowBody}>
        <ThemedText type="smallBold">{item.group.name}</ThemedText>
        <ThemedText numberOfLines={1} style={{ color: theme.textSecondary }} type="code">
          {item.lastMessage?.body || 'No messages yet'}
          {item.group.status === 'archived' ? ' · read-only archive' : ''}
        </ThemedText>
      </View>
      {item.unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.badgeText}>
            {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
          </ThemedText>
        </View>
      ) : (
        <PlatformIcon color={theme.hairline} name="chevron-right" size={18} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 12,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#1b1917',
    fontFamily: 'ui-monospace',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  list: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingTop: Spacing.two,
  },
  row: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 64,
    overflow: 'hidden',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  screen: {
    flex: 1,
  },
});
