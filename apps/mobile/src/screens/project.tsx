import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { useEffect } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { useReleaseConfig } from '@/lib/release-config';
import { projectChannelsHref, representedContextQuery } from '@/lib/company-navigation';
import { taskListHref } from '@/lib/task-navigation';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { projectRoleLabel } from '@/lib/role-label';
import { channelHref } from '@/lib/company-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import {
  attentionAction,
  attentionContext,
  attentionTitle,
  type MobileAttentionItem,
} from '@/lib/mobile-attention';

export default function ProjectOverviewScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const release = useReleaseConfig();
  const { trackUserId } = useTrackUser();
  const params = useLocalSearchParams<{ projectId?: string; companyId?: string; membershipId?: string; archive?: string }>();
  const projectId = typeof params.projectId === 'string' ? params.projectId as Id<'projects'> : undefined;
  // Global project navigation is route-owned. A previously represented Company
  // must never narrow an independent Project opened from the global list.
  const companyId = typeof params.companyId === 'string' ? params.companyId as Id<'companies'> : undefined;
  const membershipId = typeof params.membershipId === 'string' ? params.membershipId as Id<'projectMembers'> : undefined;
  const archived = params.archive === '1';
  const context = companyId && membershipId ? { archived, companyId, membershipId } : null;

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
  const tasks = useQuery(api.tasks.list, release.tasks && trackUserId && projectId && navigation?.available ? {
    projectId,
    actingCompanyId: companyId,
    projectMemberId: membershipId,
    openOnly: true,
  } : 'skip');
  const attentionPages = usePaginatedQuery(api.mobile.listAttention, trackUserId ? {
    userId: trackUserId,
    actingCompanyId: companyId,
  } : 'skip', { initialNumItems: 10 });
  const attention = attentionPages.results as MobileAttentionItem[];
  const { loadMore: loadMoreAttention, status: attentionStatus } = attentionPages;
  useEffect(() => {
    if (attentionStatus === 'CanLoadMore') loadMoreAttention(10);
  }, [attentionStatus, loadMoreAttention]);

  const project = navigation?.available && navigation.project && navigation.membership ? navigation : undefined;
  const projectName = project?.project.name ?? 'Project overview';
  const projectAttention = attention
    .filter((item) => item.projectId === projectId)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 3);
  const openTaskCount = tasks?.length ?? 0;
  const channelCount = groups?.length ?? 0;
  const unreadCount = groups?.reduce((count, group) => count + group.unreadCount, 0) ?? 0;
  const openTaskReferenceCount = tasks?.reduce((count, item) => count + item.references.length, 0) ?? 0;
  const projectCompany = project?.membership.companyDisplayNameSnapshot ?? 'Independent Project';
  const projectRole = projectRoleLabel(project?.membership.role);
  const loading = !projectId || navigation === undefined;

  function openTasks() {
    if (!projectId || !release.tasks) return;
    router.push(taskListHref(projectId, context));
  }

  function openChannels() {
    if (!projectId) return;
    router.push(projectChannelsHref(projectId, context));
  }

  function openEvidence() {
    if (!projectId) return;
    router.push(`/search?projectId=${encodeURIComponent(projectId)}${representedContextQuery(context)}`);
  }

  function openAttention(item: MobileAttentionItem) {
    const identity: MobileTaskIdentity | null = item.companyId && item.membershipId
      ? { companyId: item.companyId, membershipId: item.membershipId }
      : null;
    const represented = identity
      ? { companyId: identity.companyId, membershipId: identity.membershipId, archived: false }
      : null;
    if (item.kind === 'task') {
      router.push(taskDetailHref(item.projectId, item.taskKey, identity, {
        companyId: item.companyId,
        id: item.id,
        membershipId: item.membershipId,
      }));
      return;
    }
    if (item.kind === 'suggestion') {
      router.push(taskListHref(item.projectId, identity, 'inbox', item.id));
      return;
    }
    if (item.kind === 'invitation') {
      router.push(`/inbox?filter=invitations&invitationId=${encodeURIComponent(item.invitationId)}`);
      return;
    }
    router.push((item.threadId
      ? threadConversationHref(item.projectId, item.groupId, item.threadId, represented, item.messageId)
      : channelHref(item.projectId, item.groupId, represented, item.messageId)) as never);
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: projectName }} />
      <ConnectivityBanner style={styles.connection} />
      {loading ? <SkeletonList label="Loading Project" /> : navigation && !navigation.available ? (
        <View style={styles.centered}><EmptyState icon="shield-lock-outline" title="Project unavailable" body="This Project is not available for the represented membership." /></View>
      ) : projectId && project ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]} contentInsetAdjustmentBehavior="automatic">
          <View style={styles.heading}>
            <ThemedText numberOfLines={2} themeColor="textSecondary" type="captionBold">{projectCompany}</ThemedText>
            <ThemedText type="display">{projectName}</ThemedText>
            <View style={styles.contextRow}>
              <View style={[styles.roleBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="captionBold">{projectRole}</ThemedText>
              </View>
              {archived ? <ThemedText themeColor="textSecondary" type="captionBold">Read-only archive</ThemedText> : null}
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <ThemedText type="titleLarge">Continue working</ThemedText>
            <ThemedText themeColor="textSecondary" type="caption">Conversation leads; tasks keep the outcome moving.</ThemedText>
          </View>
          <View style={styles.actions}>
            <ProjectAction
              detail={`${channelCount} ${channelCount === 1 ? 'Channel' : 'Channels'} · ${unreadCount} unread`}
              icon="forum-outline"
              label="Channels"
              onPress={openChannels}
              primary
            />
            {release.tasks ? (
              <ProjectAction
                detail={`${openTaskCount} open ${openTaskCount === 1 ? 'task' : 'tasks'}`}
                icon="check-circle"
              label="Open board"
                onPress={openTasks}
              />
            ) : null}
            <ProjectAction
              detail={`${openTaskReferenceCount} linked ${openTaskReferenceCount === 1 ? 'reference' : 'references'}`}
              icon="link"
              label="Evidence"
              onPress={openEvidence}
            />
          </View>

          <View style={styles.sectionHeading}>
            <ThemedText type="title">Your attention</ThemedText>
            <ThemedText themeColor="textSecondary" type="caption">Only items that need a next action.</ThemedText>
          </View>
          {projectAttention.length > 0 ? projectAttention.map((item) => (
            <AttentionRow key={item.id} item={item} onPress={() => openAttention(item)} />
          )) : <View style={[styles.emptyRow, { borderColor: theme.hairline }]}>
            <PlatformIcon color={theme.success} name="check-circle" size={20} />
            <ThemedText themeColor="textSecondary" type="small">Nothing needs your attention here.</ThemedText>
          </View>}
        </ScrollView>
      ) : (
        <View style={styles.centered}><EmptyState icon="briefcase-outline" title="Choose a Project" body="Select a Project from Projects to see its work hub." /></View>
      )}
    </ThemedView>
  );
}

function ProjectAction({ detail, icon, label, onPress, primary = false }: { detail: string; icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={[styles.action, { backgroundColor: primary ? theme.accentSoft : theme.backgroundElement }]}>
      <View style={[styles.actionIcon, { backgroundColor: theme.backgroundElevated }]}>
        <PlatformIcon color={primary ? theme.accentStrong : theme.textSecondary} name={icon} size={21} />
      </View>
      <View style={styles.actionCopy}>
        <ThemedText type="title">{label}</ThemedText>
        <ThemedText themeColor="textSecondary" type="caption">{detail}</ThemedText>
      </View>
      <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
    </Pressable>
  );
}

function AttentionRow({ item, onPress }: { item: MobileAttentionItem; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityLabel={`${attentionTitle(item)}. ${attentionAction(item)}. ${attentionContext(item)}`} accessibilityRole="button" onPress={onPress} style={[styles.attentionRow, { borderColor: theme.hairline }]}>
      <View style={[styles.attentionDot, { backgroundColor: theme.accentStrong }]} />
      <View style={styles.attentionCopy}>
        <ThemedText numberOfLines={1} type="smallBold">{attentionTitle(item)}</ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{attentionAction(item)}</ThemedText>
      </View>
      <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  action: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, flexDirection: 'row', gap: Spacing.three, minHeight: 72, overflow: 'hidden', padding: Spacing.three },
  actionCopy: { flex: 1, gap: 2, minWidth: 0 },
  actionIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  actions: { gap: Spacing.two },
  attentionCopy: { flex: 1, gap: 2, minWidth: 0 },
  attentionDot: { borderRadius: Radius.pill, height: 7, marginTop: 5, width: 7 },
  attentionRow: { alignItems: 'flex-start', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.two },
  centered: { flex: 1, justifyContent: 'center' },
  content: { gap: Spacing.four, padding: Spacing.four },
  contextRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  emptyRow: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  heading: { gap: Spacing.one },
  roleBadge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  screen: { flex: 1 },
  sectionHeading: { gap: Spacing.one, marginTop: Spacing.two },
});
