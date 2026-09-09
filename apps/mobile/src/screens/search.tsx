import { usePaginatedQuery, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { AdaptiveListRow } from '@/components/adaptive-list-row';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { OptionsSheet, SheetFieldButton, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFontScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { channelHref } from '@/lib/company-navigation';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { findProjectScope } from '@/lib/project-scope';

type ProjectRow = {
  project: { _id: Id<'projects'>; name: string };
  membership: Doc<'projectMembers'>;
};

type GroupRow = {
  group: { _id: Id<'groups'>; name: string };
};

type EvidenceRow = {
  reference: Doc<'taskReferences'>;
  task: Doc<'tasks'>;
  group: { _id: Id<'groups'>; name: string; status?: string } | null;
  thread: { _id: Id<'channelThreads'>; name: string; status?: string } | null;
  creator: { _id: Id<'projectMembers'>; displayName: string } | null;
};

type SearchResult = {
  groupId?: Id<'groups'>;
  id: string;
  kind: 'file' | 'message';
  messageId?: Id<'messages'>;
  preview: string;
  subtitle: string;
  threadId?: Id<'channelThreads'>;
  title: string;
};

type ScopePicker = 'channel' | 'project' | null;
type EvidenceListRow = { type: 'evidence'; item: EvidenceRow } | { type: 'search'; item: SearchResult };

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export default function EvidenceScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; companyId?: string; membershipId?: string; archive?: string }>();
  const { trackUserId } = useTrackUser();
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState<Id<'projects'> | null>(
    typeof params.projectId === 'string' ? params.projectId as Id<'projects'> : null,
  );
  const [projectMembershipId, setProjectMembershipId] = useState<Id<'projectMembers'> | null>(
    typeof params.membershipId === 'string' ? params.membershipId as Id<'projectMembers'> : null,
  );
  const [groupId, setGroupId] = useState<Id<'groups'> | null>(null);
  const [scopePicker, setScopePicker] = useState<ScopePicker>(null);

  const projectPages = usePaginatedQuery(
    api.mobile.listProjects,
    trackUserId ? { userId: trackUserId } : 'skip',
    { initialNumItems: 50 },
  );
  const projects = projectPages.results.filter(isPresent);
  const selectedProject = findProjectScope(projects, projectId, projectMembershipId, params.companyId);
  const identity: MobileTaskIdentity | null = selectedProject?.membership.companyId ? {
    archived: selectedProject.membership.status === 'archived' || params.archive === '1',
    companyId: selectedProject.membership.companyId,
    membershipId: selectedProject.membership._id,
  } : null;
  const groups = useQuery(api.mobile.listGroups, trackUserId && selectedProject ? {
    userId: trackUserId,
    projectId: selectedProject.project._id,
    actingCompanyId: identity?.companyId,
    projectMemberId: identity?.membershipId,
  } : 'skip') as GroupRow[] | undefined;

  const evidence = usePaginatedQuery(
    api.evidence.listProjectPage,
    selectedProject ? {
      projectId: selectedProject.project._id,
      actingCompanyId: identity?.companyId,
      projectMemberId: identity?.membershipId,
    } : 'skip',
    { initialNumItems: 20 },
  );
  const searchTerm = query.trim();
  const search = useQuery(api.search.project, trackUserId && selectedProject && searchTerm.length >= 2 ? {
    userId: trackUserId,
    projectId: selectedProject.project._id,
    actingCompanyId: identity?.companyId,
    projectMemberId: identity?.membershipId,
    filter: 'all',
    limit: 10,
    query: searchTerm,
  } : 'skip');

  const rows = useMemo<EvidenceListRow[] | undefined>(() => {
    if (searchTerm.length >= 2) {
      if (!search) return undefined;
      return [...search.messages, ...search.files]
        .filter((item) => !groupId || item.groupId === groupId)
        .map((item) => ({ type: 'search' as const, item: item as SearchResult }));
    }
    return (evidence.results as EvidenceRow[])
      .filter((item) => !groupId || item.reference.groupId === groupId)
      .map((item) => ({ type: 'evidence' as const, item }));
  }, [evidence.results, groupId, search, searchTerm.length]);

  const selectedGroup = groups?.find((row) => row.group._id === groupId);
  const projectSections = useMemo(() => {
    const byCompany = new Map<string, ProjectRow[]>();
    for (const row of projects ?? []) {
      const company = row.membership.companyDisplayNameSnapshot ?? 'Independent Projects';
      byCompany.set(company, [...(byCompany.get(company) ?? []), row]);
    }
    return [...byCompany].map(([title, data]) => ({ title, data }));
  }, [projects]);
  const context = identity ? { ...identity, archived: Boolean(identity.archived) } : null;

  useEffect(() => {
    if (projectPages.status !== 'CanLoadMore') return;
    if (!projectId && projects.length > 0) return;
    if (selectedProject) return;
    projectPages.loadMore(50);
  }, [projectId, projectPages, projects.length, selectedProject]);

  function openEvidence(item: EvidenceRow) {
    if (!selectedProject) return;
    const project = selectedProject.project._id;
    if (item.reference.groupId && item.reference.messageId) {
      router.push((item.reference.channelThreadId
        ? threadConversationHref(project, item.reference.groupId, item.reference.channelThreadId, context, item.reference.messageId)
        : channelHref(project, item.reference.groupId, context, item.reference.messageId)) as Href);
      return;
    }
    router.push(taskDetailHref(project, item.task.publicKey, identity) as Href);
  }

  function openSearchResult(item: SearchResult) {
    if (!selectedProject || !item.groupId) return;
    const project = selectedProject.project._id;
    router.push((item.threadId
      ? threadConversationHref(project, item.groupId, item.threadId, context, item.messageId)
      : channelHref(project, item.groupId, context, item.messageId)) as Href);
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Evidence', headerLargeTitle: false, headerTransparent: false }} />
      <ConnectivityBanner style={styles.connection} />
      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
        data={rows}
        keyExtractor={(row) => row.type === 'evidence' ? `evidence:${row.item.reference._id}` : `search:${row.item.id}`}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ThemedText themeColor="textSecondary">Find the messages, files, and references that explain why work exists.</ThemedText>
            <View style={[styles.searchField, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
              <PlatformIcon color={theme.textSecondary} name="search" size={20} />
              <TextInput accessibilityLabel="Search evidence" autoCapitalize="none" autoCorrect={false} maxLength={200} maxFontSizeMultiplier={MaxFontScale} onChangeText={setQuery} placeholder="Search messages, files, and references" placeholderTextColor={theme.textTertiary} returnKeyType="search" selectionColor={theme.accent} style={[styles.input, { color: theme.text }]} value={query} />
              {query ? <IconButton accessibilityLabel="Clear search" icon="close" onPress={() => setQuery('')} size={18} /> : null}
            </View>
            <SheetFieldButton icon="briefcase-outline" label="Project" onPress={() => setScopePicker('project')} placeholder="Choose a Project" value={selectedProject ? `${selectedProject.membership.companyDisplayNameSnapshot ? `${selectedProject.membership.companyDisplayNameSnapshot} · ` : ''}${selectedProject.project.name}` : undefined} />
            {selectedProject ? <SheetFieldButton icon="forum-outline" label="Channel" onClear={groupId ? () => setGroupId(null) : undefined} onPress={() => setScopePicker('channel')} placeholder="All accessible Channels" value={selectedGroup?.group.name} /> : null}
          </View>
        )}
        ListEmptyComponent={projectPages.status === 'LoadingFirstPage' || (selectedProject && (searchTerm.length >= 2 ? search === undefined : evidence.status === 'LoadingFirstPage'))
          ? <SkeletonList count={3} label="Loading evidence" />
          : <EmptyState icon="file-document-outline" title={selectedProject ? searchTerm.length >= 2 ? 'No matching evidence' : 'No evidence yet' : 'Choose a Project'} body={selectedProject ? searchTerm.length >= 2 ? `No accessible messages or files match “${searchTerm}”.` : 'Messages and files linked to tasks will appear here with their source context.' : 'Evidence is permission-scoped. Choose a Project, then optionally narrow to one Channel.'} />}
        onEndReached={() => { if (searchTerm.length < 2 && evidence.status === 'CanLoadMore') evidence.loadMore(20); }}
        onEndReachedThreshold={0.35}
        renderItem={({ item: row }) => row.type === 'evidence'
          ? <EvidenceCard item={row.item} onPress={() => openEvidence(row.item)} />
          : <SearchCard item={row.item} onPress={() => openSearchResult(row.item)} />}
      />

      <OptionsSheet onClose={() => setScopePicker(null)} title={scopePicker === 'project' ? 'Choose Project' : 'Choose Channel'} visible={scopePicker !== null}>
        {scopePicker === 'project' ? projectSections.map((section) => (
          <SheetSection key={section.title} title={section.title}>
            {section.data.map((row) => <SheetRow detail={row.membership.status === 'archived' ? 'Read-only archive' : undefined} icon="briefcase-outline" key={row.membership._id} label={row.project.name} onPress={() => { setProjectId(row.project._id); setProjectMembershipId(row.membership._id); setGroupId(null); setScopePicker(null); }} selected={row.membership._id === selectedProject?.membership._id} />)}
          </SheetSection>
        )) : null}
        {scopePicker === 'project' && projectPages.status === 'CanLoadMore' ? (
          <SheetSection>
            <SheetRow icon="chevron-down" label="Load more Projects" onPress={() => projectPages.loadMore(50)} />
          </SheetSection>
        ) : null}
        {scopePicker === 'channel' ? <SheetSection>
          <SheetRow icon="forum-outline" label="All accessible Channels" onPress={() => { setGroupId(null); setScopePicker(null); }} selected={!groupId} />
          {groups?.map((row) => <SheetRow icon="forum-outline" key={row.group._id} label={row.group.name} onPress={() => { setGroupId(row.group._id); setScopePicker(null); }} selected={row.group._id === groupId} />)}
        </SheetSection> : null}
      </OptionsSheet>
    </ThemedView>
  );
}

function EvidenceCard({ item, onPress }: { item: EvidenceRow; onPress: () => void }) {
  const theme = useTheme();
  const kind = item.reference.attachmentId ? 'File' : 'Reference';
  const context = [item.group?.name, item.thread?.name, item.creator?.displayName]
    .filter(Boolean)
    .join(' · ') || 'Project evidence';
  return (
    <AdaptiveListRow
      accessibilityHint="Opens the exact evidence source"
      accessibilityLabel={`${kind}. ${item.reference.quote || item.task.title}. ${context}. Linked to ${item.task.publicKey}`}
      leading={(
        <View style={[styles.cardIcon, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name={item.reference.attachmentId ? 'file-document-outline' : 'link'} size={19} />
        </View>
      )}
      onPress={onPress}
      subtitle={context}
      title={item.reference.quote || item.task.title}
      trailingBottom={<ThemedText numberOfLines={1} themeColor="textSecondary" type="mono">{item.task.publicKey}</ThemedText>}
      trailingTop={<ThemedText themeColor="accentStrong" type="captionBold">{kind}</ThemedText>}
    />
  );
}

function SearchCard({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const theme = useTheme();
  const kind = item.kind === 'file' ? 'File' : 'Message';
  return (
    <AdaptiveListRow
      accessibilityHint="Opens the exact search result"
      accessibilityLabel={`${kind}. ${item.title}. ${item.subtitle || item.preview}`}
      leading={(
        <View style={[styles.cardIcon, { backgroundColor: theme.backgroundSelected }]}>
          <PlatformIcon color={theme.textSecondary} name={item.kind === 'file' ? 'file-document-outline' : 'forum-outline'} size={19} />
        </View>
      )}
      onPress={onPress}
      subtitle={item.subtitle || item.preview}
      title={item.title}
      trailingBottom={<PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />}
      trailingTop={<ThemedText themeColor="textSecondary" type="captionBold">{kind}</ThemedText>}
    />
  );
}
const styles = StyleSheet.create({
  cardIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  header: { gap: Spacing.three, paddingBottom: Spacing.one },
  input: { flex: 1, minHeight: TouchTarget, minWidth: 0, paddingVertical: Spacing.two },
  list: { gap: Spacing.two, padding: Spacing.four },
  searchField: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingLeft: Spacing.three },
  screen: { flex: 1 },
});
