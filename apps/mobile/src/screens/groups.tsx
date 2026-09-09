import { FlatList, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { AdaptiveListRow } from '@/components/adaptive-list-row';
import { ActionButton } from '@/components/action-button';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { useTrackUser } from '@/contexts/track-user-context';
import { ColoredAvatar } from '@/components/colored-avatar';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { useReleaseConfig } from '@/lib/release-config';
import { taskListHref } from '@/lib/task-navigation';
import { usePushNotifications } from '@/lib/push-notifications';

type MobileGroup = {
  group: Doc<'groups'>;
  membership: Doc<'groupMembers'>;
  lastMessage: Doc<'messages'> | null;
  unreadCount: number;
};

export default function GroupsScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const release = useReleaseConfig();
  const { trackUserId } = useTrackUser();
  const push = usePushNotifications();
  const { projectId, companyId, membershipId, archive } = useLocalSearchParams<{ projectId: string; companyId?: string; membershipId?: string; archive?: string }>();

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
  const projectName = navigation?.available && navigation.project ? navigation.project.name : 'Channels';
  function navigate(item: MobileGroup) {
    hapticLight();
    router.push(channelHref(projectId as Id<'projects'>, item.group._id, companyId && membershipId ? {
      archived: archive === '1',
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
              icon="check-circle"
              onPress={() => router.push(taskListHref(projectId as Id<'projects'>, companyId && membershipId ? {
                archived: archive === '1',
                companyId: companyId as Id<'companies'>,
                membershipId: membershipId as Id<'projectMembers'>,
              } : null))}
            />
          ) : null,
        }}
      />
      <ConnectivityBanner style={styles.connection} />

      {navigation && !navigation.available ? <View style={styles.list}><EmptyState icon="shield-lock-outline" title="Project unavailable" body={navigationUnavailableCopy(Boolean(companyId))} /></View> : null}

      {!navigation || navigation.available && groups === undefined ? (
        <SkeletonList label="Loading Channels" />
      ) : navigation.available ? (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          data={groupItems}
          keyExtractor={(item) => item.group._id}
          renderItem={({ item }) => <GroupRow item={item} onPress={() => navigate(item)} />}
          ListHeaderComponent={(
            <View style={styles.listHeader}>
              {push.permissionState === 'not_determined' ? (
                <View style={[styles.notificationCard, { backgroundColor: theme.backgroundElement }]}>
                  <PlatformIcon color={theme.accent} name="bell-outline" size={24} />
                  <View style={styles.notificationCopy}>
                    <ThemedText type="title">Keep up with {projectName}</ThemedText>
                    <ThemedText themeColor="textSecondary" type="caption">
                      Get timely Project activity with full, context-only, or hidden previews you control.
                    </ThemedText>
                  </View>
                  <ActionButton disabled={push.syncing} label="Enable" loading={push.syncing} onPress={() => void push.requestPermission()} />
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState icon="forum-outline" title="No Channels visible" body="Only Channels explicitly granted to this represented membership appear here." />
          }
        />
      ) : null}
    </ThemedView>
  );
}

function GroupRow({ item, onPress }: { item: MobileGroup; onPress: () => void }) {
  const theme = useTheme();
  const archived = item.group.status === 'archived';
  return (
    <AdaptiveListRow
      accessibilityHint={archived ? 'Opens this read-only Channel archive' : 'Opens this Channel'}
      accessibilityLabel={`${item.group.name}. ${item.unreadCount ? `${item.unreadCount} unread. ` : ''}${archived ? 'Read-only archive.' : 'Open Channel.'}`}
      leading={<ColoredAvatar label={item.group.name} seed={item.group._id} shape="rounded" size={40} />}
      onPress={() => { hapticLight(); onPress(); }}
      subtitle={`${item.lastMessage?.body || 'No messages yet'}${archived ? ' · read-only' : ''}`}
      title={item.group.name}
      trailingBottom={archived ? <ThemedText themeColor="textSecondary" type="captionBold">Read-only</ThemedText> : null}
      trailingTop={item.unreadCount > 0 ? (
        <View
          accessibilityLabel={`${item.unreadCount} unread`}
          style={[styles.badge, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.badgeText} type="captionBold">
            {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
          </ThemedText>
        </View>
      ) : (
        <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  badge: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // The accent is the same yellow in both themes, so the badge ink is fixed
  // to the light-theme stone that clears AA against it (9.18:1).
  badgeText: {
    color: Colors.light.text,
  },
  list: {
    gap: Spacing.two,
    padding: Spacing.four,
    paddingTop: Spacing.two,
  },
  listHeader: { gap: Spacing.two },
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
  screen: {
    flex: 1,
  },
});
