import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { OptionsSheet, SheetInput, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import {
  ProjectDirectoryCard,
  WorkspaceOverview,
  type DirectoryChannel,
  type DirectoryProject,
} from '@/components/projects-directory';
import { SkeletonList } from '@/components/skeleton-row';
import { ScreenEntrance } from '@/components/screen-entrance';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { usePrimaryNavigationVisibility } from '@/contexts/primary-navigation-visibility-context';
import { Spacing } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, projectOverviewHref, type RepresentedProjectContext } from '@/lib/company-navigation';

export default function ProjectsScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { trackUserId } = useTrackUser();
  const { setCreateContext } = usePrimaryNavigationVisibility();
  const params = useLocalSearchParams<{ create?: string }>();
  const { actingCompanyId, actingCompany, companies, companyModelEnabled, setActingCompanyId } = useCompany();
  const [companySheetOpen, setCompanySheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientLabel, setClientLabel] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedMembershipId, setExpandedMembershipId] = useState<Id<'projectMembers'> | null>(null);

  useFocusEffect(useCallback(() => {
    setCreateContext(null);
    return () => setCreateContext(null);
  }, [setCreateContext]));
  const createProject = useMutation(api.projects.create);

  useEffect(() => {
    if (params.create) {
      setCreateOpen(true);
    }
  }, [params.create]);

  const projects = usePaginatedQuery(
    api.mobile.listProjects,
    trackUserId ? { userId: trackUserId, actingCompanyId: actingCompanyId ?? undefined } : 'skip',
    { initialNumItems: 50 },
  );
  const lastContext = useQuery(api.mobile.getLastActiveContext, trackUserId ? { userId: trackUserId } : 'skip');
  const projectItems = useMemo(
    () => projects.results.filter((project): project is DirectoryProject => project !== null),
    [projects.results],
  );
  const sortedProjects = useMemo(() => [...projectItems].sort((left, right) => {
    const archiveOrder = Number(left.membership.status === 'archived') - Number(right.membership.status === 'archived');
    if (archiveOrder !== 0) return archiveOrder;
    const leftIsRecent = isLastContext(left, lastContext);
    const rightIsRecent = isLastContext(right, lastContext);
    if (leftIsRecent !== rightIsRecent) return leftIsRecent ? -1 : 1;
    if (left.unreadCount !== right.unreadCount) return right.unreadCount - left.unreadCount;
    return left.project.name.localeCompare(right.project.name);
  }), [lastContext, projectItems]);
  const expandedProject = sortedProjects.find((item) => item.membership._id === expandedMembershipId);
  const expandedIdentity = expandedProject ? projectIdentity(expandedProject) : null;
  const expandedChannels = usePaginatedQuery(
    api.mobile.listGroupsPage,
    trackUserId && expandedProject && expandedProject.membership.status !== 'archived' ? {
      userId: trackUserId,
      projectId: expandedProject.project._id,
      actingCompanyId: expandedIdentity?.companyId,
      projectMemberId: expandedIdentity?.membershipId,
    } : 'skip',
    { initialNumItems: 20 },
  );

  useEffect(() => {
    if (projects.status === 'CanLoadMore') projects.loadMore(50);
  }, [projects.loadMore, projects.status]);

  useEffect(() => {
    if (expandedMembershipId && !sortedProjects.some((item) => item.membership._id === expandedMembershipId)) {
      setExpandedMembershipId(null);
    }
  }, [expandedMembershipId, sortedProjects]);

  useEffect(() => {
    if (expandedChannels.status === 'CanLoadMore') expandedChannels.loadMore(20);
  }, [expandedChannels.loadMore, expandedChannels.status]);

  function openProject(item: DirectoryProject) {
    router.push(projectOverviewHref(item.project._id, projectIdentity(item)) as never);
  }

  function openChannel(project: DirectoryProject, channel: DirectoryChannel) {
    router.push(channelHref(project.project._id, channel.group._id, projectIdentity(project)) as never);
  }

  async function submitProject() {
    if (!trackUserId || !projectName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await createProject({ userId: trackUserId, name: projectName.trim(), clientLabel: clientLabel.trim() || undefined });
      setProjectName('');
      setClientLabel('');
      setCreateOpen(false);
    } catch (failure) {
      setCreateError(failure instanceof Error ? failure.message : 'Project creation failed. Try again.');
    } finally {
      setCreating(false);
    }
  }

  function closeCreateSheet() {
    setCreateOpen(false);
    if (params.create) router.setParams({ create: undefined });
  }

  const companyLabel = actingCompany?.company?.displayName ?? 'All Companies';
  const activeProjects = sortedProjects.filter((item) => item.membership.status !== 'archived');
  const visibleChannels = activeProjects.reduce((sum, item) => sum + item.groupCount, 0);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: 'Projects',
        headerLargeTitle: false,
        headerTransparent: false,
        headerRight: () => <View style={styles.headerActions}>
          {companyModelEnabled ? <IconButton accessibilityLabel="Switch Company" icon="office-building" onPress={() => setCompanySheetOpen(true)} /> : null}
        </View>,
      }} />
      <ConnectivityBanner style={styles.connection} />

      {projects.status === 'LoadingFirstPage' ? <ScreenEntrance style={styles.screenContent}><SkeletonList label="Loading Projects" /></ScreenEntrance> : (
        <ScreenEntrance style={styles.screenContent}><FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          data={sortedProjects}
          keyExtractor={(item) => item.membership._id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={<View style={styles.listHeader}>
            <WorkspaceOverview
              activeProjects={activeProjects.length}
              canSwitchCompany={Boolean(companyModelEnabled && (companies?.filter(({ company }) => company?.status === 'active').length ?? 0) > 1)}
              companyLabel={companyLabel}
              companyScoped={Boolean(actingCompanyId)}
              onPressCompany={() => setCompanySheetOpen(true)}
              visibleChannels={visibleChannels}
            />
            <View style={styles.directoryHeading}>
              <View style={styles.directoryTitle}>
                <PlatformIcon color={theme.accentStrong} name="project" size={17} />
                <ThemedText style={styles.directoryTitleText} type="title">Projects & Channels</ThemedText>
              </View>
            </View>
          </View>}
          ListEmptyComponent={<EmptyState
            body={actingCompanyId ? 'Accepted shared Projects and retained archives will appear here.' : 'Projects created on the web will appear here. Choose a Company to browse its shared work.'}
            icon="project"
            title="No Projects yet"
          />}
          ListFooterComponent={null}
          onEndReached={() => { if (projects.status === 'CanLoadMore') projects.loadMore(50); }}
          onEndReachedThreshold={0.35}
          renderItem={({ item }) => <ProjectDirectoryCard
            channels={item.membership._id === expandedMembershipId ? expandedChannels.results : []}
            expanded={item.membership._id === expandedMembershipId}
            item={item}
            loadingChannels={item.membership._id === expandedMembershipId && expandedChannels.status === 'LoadingFirstPage'}
            onOpenChannel={(channel) => openChannel(item, channel)}
            onOpenProject={() => openProject(item)}
            onToggle={() => setExpandedMembershipId((current) => current === item.membership._id ? null : item.membership._id)}
          />}
        /></ScreenEntrance>
      )}

      <OptionsSheet onClose={() => setCompanySheetOpen(false)} title="Switch Company" visible={companySheetOpen}>
        <SheetSection title="Workspace scope">
          <SheetRow icon="office-building" label="All Companies" onPress={() => { setActingCompanyId(null); setCompanySheetOpen(false); }} selected={!actingCompanyId} />
          {(companies ?? []).filter(({ company }) => company?.status === 'active').map(({ company }) => company ? (
            <SheetRow icon="office-building" key={company._id} label={company.displayName} onPress={() => { setActingCompanyId(company._id); setCompanySheetOpen(false); }} selected={company._id === actingCompanyId} />
          ) : null)}
        </SheetSection>
      </OptionsSheet>

      <OptionsSheet onClose={closeCreateSheet} title="New Project" visible={createOpen}>
        <SheetNote>Create a Project to keep its Channels, tasks, and evidence together.</SheetNote>
        <SheetInput label="Project name" maxLength={120} onChangeText={setProjectName} placeholder="e.g. Website launch" value={projectName} />
        <SheetInput label="Client label" maxLength={120} onChangeText={setClientLabel} placeholder="Optional" value={clientLabel} />
        {createError ? <SheetNote>{createError}</SheetNote> : null}
        <Pressable
          accessibilityRole="button"
          disabled={creating || !projectName.trim()}
          onPress={() => void submitProject()}
          style={[styles.createProjectButton, { backgroundColor: theme.accent, opacity: creating || !projectName.trim() ? 0.45 : 1 }]}
        >
          <ThemedText style={{ color: theme.background }} type="title">{creating ? 'Creating…' : 'Create Project'}</ThemedText>
        </Pressable>
      </OptionsSheet>

    </ThemedView>
  );
}

function projectIdentity(item: DirectoryProject): RepresentedProjectContext | null {
  return item.membership.companyId ? {
    archived: item.membership.status === 'archived',
    companyId: item.membership.companyId,
    membershipId: item.membership._id,
  } : null;
}

function isLastContext(item: DirectoryProject, context: { projectId?: Id<'projects'>; projectMemberId?: Id<'projectMembers'>; actingCompanyId?: Id<'companies'> } | null | undefined) {
  return Boolean(context?.projectId === item.project._id
    && (!context.projectMemberId || context.projectMemberId === item.membership._id)
    && (!context.actingCompanyId || context.actingCompanyId === item.membership.companyId));
}

const styles = StyleSheet.create({
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  createProjectButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 12, justifyContent: 'center', minHeight: 48, paddingHorizontal: Spacing.four },
  directoryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.five },
  directoryTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  directoryTitleText: { fontSize: 16, lineHeight: 22 },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  list: { padding: Spacing.four, paddingTop: Spacing.two },
  listHeader: { marginBottom: Spacing.three },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
  separator: { height: Spacing.three },
});
