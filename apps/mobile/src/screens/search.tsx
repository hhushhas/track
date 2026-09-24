import { usePaginatedQuery, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { StandalonePrimaryNavigation } from '@/components/primary-navigation';
import {
  EvidenceAuditCard,
  type EvidenceAuditItem,
  EvidenceEndMarker,
  EvidenceProtocolIntro,
  EvidenceResultsHeader,
  EvidenceScopeCard,
} from '@/components/evidence-dashboard';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { OptionsSheet, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ScreenEntrance } from '@/components/screen-entrance';
import { ThemedView } from '@/components/themed-view';
import { MaxFontScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { channelHref } from '@/lib/company-navigation';
import { findProjectScope } from '@/lib/project-scope';
import { taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';

type ProjectRow = {
  project: { _id: Id<'projects'>; name: string };
  membership: Doc<'projectMembers'>;
};

type GroupRow = { group: { _id: Id<'groups'>; name: string } };

type EvidenceRow = {
  reference: Doc<'taskReferences'>;
  task: Doc<'tasks'>;
  group: { _id: Id<'groups'>; name: string; status?: string } | null;
  thread: { _id: Id<'channelThreads'>; name: string; status?: string } | null;
  creator: { _id: Id<'projectMembers'>; displayName: string } | null;
};

type SearchResult = {
  attachmentId?: Id<'attachments'>;
  contentType?: string;
  createdAt?: number;
  groupId?: Id<'groups'>;
  groupName?: string;
  id: string;
  kind: 'file' | 'message';
  messageId?: Id<'messages'>;
  preview: string;
  subtitle: string;
  threadId?: Id<'channelThreads'>;
  threadName?: string;
  title: string;
};

type ScopePicker = 'channel' | 'project' | null;
type EvidenceListRow = { type: 'evidence'; item: EvidenceRow } | { type: 'search'; item: SearchResult };

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export default function EvidenceScreen() {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.25;
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; companyId?: string; membershipId?: string; archive?: string }>();
  const { trackUserId } = useTrackUser();
  const { actingCompanyId } = useCompany();
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState<Id<'projects'> | null>(typeof params.projectId === 'string' ? params.projectId as Id<'projects'> : null);
  const [projectMembershipId, setProjectMembershipId] = useState<Id<'projectMembers'> | null>(typeof params.membershipId === 'string' ? params.membershipId as Id<'projectMembers'> : null);
  const [groupId, setGroupId] = useState<Id<'groups'> | null>(null);
  const [scopePicker, setScopePicker] = useState<ScopePicker>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const routeCompanyId = typeof params.companyId === 'string' ? params.companyId as Id<'companies'> : undefined;

  const projectPages = usePaginatedQuery(
    api.mobile.listProjects,
    trackUserId ? { userId: trackUserId, actingCompanyId: routeCompanyId ?? actingCompanyId ?? undefined } : 'skip',
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
        .sort((left, right) => right.createdAt - left.createdAt)
        .map((item) => ({ type: 'search' as const, item: item as SearchResult }));
    }
    return (evidence.results as EvidenceRow[])
      .filter((item) => !groupId || item.reference.groupId === groupId)
      .map((item) => ({ type: 'evidence' as const, item }));
  }, [evidence.results, groupId, search, searchTerm.length]);

  const normalizedRows = useMemo(() => rows?.map(normalizeRow), [rows]);
  const selectedGroup = groups?.find((row) => row.group._id === groupId);
  const companyName = selectedProject?.membership.companyDisplayNameSnapshot ?? undefined;
  const projectSections = useMemo(() => {
    const byCompany = new Map<string, ProjectRow[]>();
    for (const row of projects) {
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
    openTask(item);
  }

  function openSearchResult(item: SearchResult) {
    if (!selectedProject || !item.groupId) return;
    const project = selectedProject.project._id;
    router.push((item.threadId
      ? threadConversationHref(project, item.groupId, item.threadId, context, item.messageId)
      : channelHref(project, item.groupId, context, item.messageId)) as Href);
  }

  function openTask(item: EvidenceRow) {
    if (!selectedProject) return;
    router.push(taskDetailHref(selectedProject.project._id, item.task.publicKey, identity) as Href);
  }

  function openEvidenceCreate() {
    if (!selectedProject) {
      setScopePicker('project');
      return;
    }
    setCreateOpen(true);
  }

  function createTaskFromEvidence() {
    if (!selectedProject) return;
    setCreateOpen(false);
    router.push(taskListHref(selectedProject.project._id, identity, undefined, undefined, { create: true }) as Href);
  }

  function openChannelForEvidence() {
    const group = groups?.[0]?.group;
    if (!selectedProject || !group) {
      setCreateOpen(false);
      setScopePicker('channel');
      return;
    }
    setCreateOpen(false);
    router.push(channelHref(selectedProject.project._id, group._id, context) as Href);
  }

  return (
    <ThemedView style={[styles.screen, { backgroundColor: theme.homeBackground }]}>
      <Stack.Screen options={{
        title: 'Evidence',
        headerBackVisible: false,
        headerLargeTitle: false,
        headerTransparent: false,
      }} />
      <ConnectivityBanner style={styles.connection} />
      <ScreenEntrance style={styles.screenContent}><FlatList
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
        contentInsetAdjustmentBehavior="automatic"
        data={rows}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.type === 'evidence' ? `evidence:${row.item.reference._id}` : `search:${row.item.id}`}
        ListHeaderComponent={<View style={styles.header}>
          <EvidenceProtocolIntro />
          <View style={[styles.searchField, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
            <PlatformIcon color={theme.textSecondary} name="search" size={20} />
            <TextInput accessibilityLabel="Search evidence" autoCapitalize="none" autoCorrect={false} cursorColor={theme.accent} editable={Boolean(selectedProject)} maxLength={200} maxFontSizeMultiplier={MaxFontScale} multiline={false} numberOfLines={1} onChangeText={setQuery} placeholder={!selectedProject ? 'Choose a Project to search' : largeText ? 'Search evidence' : 'Try “launch decision” or “homepage.png”'} placeholderTextColor={theme.textTertiary} returnKeyType="search" selectionColor={theme.accent} selectionHandleColor={theme.accent} style={[styles.input, { color: theme.text }]} value={query} />
            {query ? <IconButton accessibilityLabel="Clear search" icon="close" onPress={() => setQuery('')} size={18} /> : null}
            {!selectedProject ? <Pressable accessibilityHint="Choose a Project before searching its evidence" accessibilityLabel="Choose a Project to search evidence" accessibilityRole="button" onPress={() => setScopePicker('project')} style={styles.searchGate} /> : null}
          </View>
          <EvidenceScopeCard channelCount={groups?.length ?? 0} channelName={selectedGroup?.group.name} companyName={companyName} onChannelPress={() => setScopePicker('channel')} onProjectPress={() => setScopePicker('project')} projectName={selectedProject?.project.name} />
          {selectedProject && normalizedRows !== undefined ? <EvidenceResultsHeader count={normalizedRows.length} searching={searchTerm.length >= 2} /> : null}
        </View>}
        ListEmptyComponent={projectPages.status === 'LoadingFirstPage' || (selectedProject && (searchTerm.length >= 2 ? search === undefined : evidence.status === 'LoadingFirstPage'))
          ? <SkeletonList count={3} label="Loading evidence" />
          : <EmptyState icon={selectedProject ? 'evidence' : 'project'} title={selectedProject ? searchTerm.length >= 2 ? 'No matching evidence' : 'No evidence yet' : 'No project selected'} body={selectedProject ? searchTerm.length >= 2 ? `No accessible messages or files match “${searchTerm}”.` : 'Messages and files linked to tasks will appear here with their source context.' : 'Select a Project above to view its permission-scoped evidence.'} />}
        ListFooterComponent={selectedProject && normalizedRows?.length && (searchTerm.length >= 2 || evidence.status === 'Exhausted') ? <EvidenceEndMarker companyName={companyName} /> : null}
        onEndReached={() => { if (searchTerm.length < 2 && evidence.status === 'CanLoadMore') evidence.loadMore(20); }}
        onEndReachedThreshold={0.35}
        renderItem={({ item: row, index }) => <EvidenceAuditCard item={normalizedRows?.[index] ?? normalizeRow(row)} onOpenSource={() => row.type === 'evidence' ? openEvidence(row.item) : openSearchResult(row.item)} onOpenTask={row.type === 'evidence' && row.item.reference.groupId && row.item.reference.messageId ? () => openTask(row.item) : undefined} />}
      /></ScreenEntrance>

      <OptionsSheet onClose={() => setScopePicker(null)} title={scopePicker === 'project' ? 'Choose Project' : 'Choose Channel'} visible={scopePicker !== null}>
        {scopePicker === 'project' ? projectSections.map((section) => <SheetSection key={section.title} title={section.title}>{section.data.map((row) => <SheetRow detail={row.membership.status === 'archived' ? 'Read-only archive' : undefined} icon="project" key={row.membership._id} label={row.project.name} onPress={() => { setProjectId(row.project._id); setProjectMembershipId(row.membership._id); setGroupId(null); setScopePicker(null); }} selected={row.membership._id === selectedProject?.membership._id} />)}</SheetSection>) : null}
        {scopePicker === 'project' && projectPages.status === 'CanLoadMore' ? <SheetSection><SheetRow icon="chevron-down" label="Load more Projects" onPress={() => projectPages.loadMore(50)} /></SheetSection> : null}
        {scopePicker === 'channel' ? <SheetSection>
          <SheetRow icon="channel" label="All accessible Channels" onPress={() => { setGroupId(null); setScopePicker(null); }} selected={!groupId} />
          {groups?.map((row) => <SheetRow icon="channel" key={row.group._id} label={row.group.name} onPress={() => { setGroupId(row.group._id); setScopePicker(null); }} selected={row.group._id === groupId} />)}
        </SheetSection> : null}
      </OptionsSheet>
      <OptionsSheet onClose={() => setCreateOpen(false)} title="Add evidence" visible={createOpen}>
        <SheetSection title={selectedProject?.project.name}>
          <SheetRow detail="Create a task inside this Project" icon="task" label="Create task from evidence" onPress={createTaskFromEvidence} />
          <SheetRow detail="Open a Channel composer for source files and context" icon="channel" label="Add data in a Channel" onPress={openChannelForEvidence} />
        </SheetSection>
        <SheetNote>Evidence stays scoped to its Project and Channel. Link it to a task from the task creation flow.</SheetNote>
      </OptionsSheet>
      <StandalonePrimaryNavigation onCreate={openEvidenceCreate} />
    </ThemedView>
  );
}

function normalizeRow(row: EvidenceListRow): EvidenceAuditItem {
  if (row.type === 'search') return {
    body: row.item.preview || row.item.subtitle,
    createdAt: row.item.createdAt,
    id: row.item.id,
    kind: row.item.kind === 'file' ? 'search_file' : 'search_message',
    location: row.item.subtitle || [row.item.groupName ? `#${row.item.groupName}` : undefined, row.item.threadName].filter(Boolean).join(' · ') || undefined,
    title: row.item.title,
  };
  return {
    actor: row.item.creator?.displayName ?? undefined,
    availability: row.item.reference.availability,
    body: row.item.reference.quote || row.item.task.title,
    createdAt: row.item.reference.createdAt,
    id: row.item.reference._id,
    kind: row.item.reference.type,
    location: [row.item.group ? `#${row.item.group.name}` : undefined, row.item.thread?.name].filter(Boolean).join(' · ') || undefined,
    opensTask: !(row.item.reference.groupId && row.item.reference.messageId),
    primary: row.item.reference.isPrimary,
    taskKey: row.item.task.publicKey,
    title: row.item.reference.sourceIdentifier || row.item.task.title,
  };
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  header: { gap: Spacing.four, paddingBottom: Spacing.two },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  input: { flex: 1, minHeight: TouchTarget, minWidth: 0, paddingVertical: Spacing.two },
  list: { gap: Spacing.three, padding: Spacing.four },
  searchField: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingLeft: Spacing.three },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
  searchGate: { ...StyleSheet.absoluteFillObject, borderRadius: Radius.medium },
});
