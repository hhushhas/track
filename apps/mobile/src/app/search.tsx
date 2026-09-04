import { useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { PrimaryNavigation } from '@/components/primary-navigation';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { channelHref } from '@/lib/company-navigation';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';

type ProjectRow = {
  project: { _id: Id<'projects'>; name: string };
  membership: { _id: Id<'projectMembers'>; companyId?: Id<'companies'> };
};

type SearchResult = {
  createdAt?: number;
  groupId?: Id<'groups'>;
  groupName?: string;
  id: string;
  kind: 'file' | 'group' | 'message' | 'task' | 'thread';
  messageId?: Id<'messages'>;
  preview: string;
  subtitle: string;
  taskKey?: string;
  threadId?: Id<'channelThreads'>;
  title: string;
};

export default function SearchScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { trackUserId } = useTrackUser();
  const { actingCompanyId } = useCompany();
  const projects = useQuery(api.mobile.listProjects, trackUserId
    ? { userId: trackUserId, actingCompanyId: actingCompanyId ?? undefined }
    : 'skip') as ProjectRow[] | undefined;
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState<Id<'projects'> | null>(null);
  const selectedProject = useMemo(() => {
    const rows = projects ?? [];
    return rows.find((row) => row.project._id === projectId) ?? rows[0];
  }, [projectId, projects]);
  const identity: MobileTaskIdentity | null = selectedProject?.membership.companyId && selectedProject.membership._id
    ? { companyId: selectedProject.membership.companyId, membershipId: selectedProject.membership._id }
    : null;
  const searchTerm = query.trim();
  const results = useQuery(api.search.project, trackUserId && selectedProject && searchTerm.length >= 2
    ? {
        userId: trackUserId,
        projectId: selectedProject.project._id,
        actingCompanyId: identity?.companyId,
        projectMemberId: identity?.membershipId,
        filter: 'all',
        limit: 8,
        query: searchTerm,
      }
    : 'skip') as { files: SearchResult[]; groups: SearchResult[]; messages: SearchResult[]; tasks: SearchResult[]; threads: SearchResult[] } | undefined;
  const rows = useMemo(() => results ? [
    ...results.tasks,
    ...results.messages,
    ...results.threads,
    ...results.groups,
    ...results.files,
  ] : undefined, [results]);

  function openResult(item: SearchResult) {
    if (!selectedProject) return;
    const project = selectedProject.project._id;
    const context = identity ? { companyId: identity.companyId, membershipId: identity.membershipId, archived: false } : null;
    if (item.kind === 'task' && item.taskKey) {
      router.push(taskDetailHref(project, item.taskKey, identity));
    } else if ((item.kind === 'message' || item.kind === 'file') && item.groupId) {
      router.push(item.threadId
        ? threadConversationHref(project, item.groupId, item.threadId, context, item.messageId)
        : channelHref(project, item.groupId, context, item.messageId));
    } else if (item.kind === 'thread' && item.groupId && item.threadId) {
      router.push(threadConversationHref(project, item.groupId, item.threadId, context));
    } else if (item.kind === 'group' && item.groupId) {
      router.push(`/groups?projectId=${encodeURIComponent(project)}&groupId=${encodeURIComponent(item.groupId)}`);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Search', headerLargeTitle: Platform.OS === 'ios', headerTransparent: Platform.OS === 'ios', headerBlurEffect: 'systemMaterial' }} />
      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
        data={rows}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        ListHeaderComponent={<View style={styles.header}>
          <ThemedText type="display">Find anything</ThemedText>
          <ThemedText themeColor="textSecondary">Search accessible conversation, tasks, Channels, and evidence.</ThemedText>
          <TextInput
            accessibilityLabel="Search Track"
            autoFocus
            onChangeText={setQuery}
            placeholder="Search this Project"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { borderColor: theme.hairline, color: theme.text }]}
            value={query}
          />
          <FlatList
            contentContainerStyle={styles.projectPicker}
            data={projects ?? []}
            horizontal
            keyExtractor={(item) => item.project._id}
            renderItem={({ item }) => <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedProject?.project._id === item.project._id }}
              onPress={() => setProjectId(item.project._id)}
              style={[styles.projectChip, selectedProject?.project._id === item.project._id && { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText numberOfLines={1} type="captionBold">{item.project.name}</ThemedText>
            </Pressable>}
            showsHorizontalScrollIndicator={false}
          />
        </View>}
        ListEmptyComponent={projects === undefined || (searchTerm.length >= 2 && results === undefined)
          ? <SkeletonList count={3} label={searchTerm.length >= 2 ? 'Searching' : 'Loading Projects'} />
          : <EmptyState body={searchTerm.length < 2 ? 'Type at least two characters to search.' : `No results for “${searchTerm}”.`} icon="search" title={searchTerm.length < 2 ? 'Start with a search' : 'No results'} />}
        renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => openResult(item)} style={[styles.result, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.resultIcon, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name={item.kind === 'task' ? 'check-circle' : item.kind === 'group' ? 'forum-outline' : 'search'} size={19} /></View>
          <View style={styles.resultCopy}>
            <ThemedText numberOfLines={1} type="title">{item.title}</ThemedText>
            <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{item.subtitle || item.preview}</ThemedText>
          </View>
          <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
        </Pressable>}
      />
      <PrimaryNavigation />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  input: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  list: { gap: Spacing.two, padding: Spacing.three },
  projectChip: { borderRadius: Radius.pill, minHeight: TouchTarget, justifyContent: 'center', paddingHorizontal: Spacing.three },
  projectPicker: { gap: Spacing.one },
  result: { alignItems: 'center', borderRadius: Radius.large, flexDirection: 'row', gap: Spacing.three, minHeight: 76, padding: Spacing.three },
  resultCopy: { flex: 1, gap: 2, minWidth: 0 },
  resultIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  screen: { flex: 1 },
});
