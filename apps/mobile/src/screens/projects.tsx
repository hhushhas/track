import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ActionButton } from '@/components/action-button';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { OptionsSheet, SheetInput, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { ProjectAccountButton } from '@/components/project-overview-dashboard';
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
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, projectOverviewHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { hapticLight } from '@/lib/haptics';

export default function ProjectsScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { trackUserId, openProfileSheet } = useTrackUser();
  const { actingCompanyId, actingCompany, companyModelEnabled } = useCompany();
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedMembershipId, setExpandedMembershipId] = useState<Id<'projectMembers'> | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectClientLabel, setProjectClientLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const profileStatus = useQuery(api.auth.getProfileStatus, trackUserId ? { userId: trackUserId } : 'skip');
  const [createError, setCreateError] = useState<string | null>(null);

  const createProject = useMutation(api.projects.create);
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

  function openCreateProject() {
    hapticLight();
    setCreateOpen(true);
  }

  function closeCreateProject() {
    if (!creating) setCreateOpen(false);
  }

  async function submitCreateProject() {
    if (!trackUserId) return;
    const name = projectName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const projectId = await createProject({
        userId: trackUserId,
        name,
        clientLabel: projectClientLabel.trim() || undefined,
      });
      setProjectName('');
      setProjectClientLabel('');
      setCreateOpen(false);
      router.push(projectOverviewHref(projectId, null));
    } catch (error) {
      setCreateError(error instanceof Error && error.message.includes('not_allowed_to_create_project')
        ? 'You do not have permission to create a Project for this identity.'
        : 'Please check the Project details and try again.');
    } finally {
      setCreating(false);
    }
  }

  function openProject(item: DirectoryProject) {
    router.push(projectOverviewHref(item.project._id, projectIdentity(item)) as never);
  }

  function openChannel(project: DirectoryProject, channel: DirectoryChannel) {
    router.push(channelHref(project.project._id, channel.group._id, projectIdentity(project)) as never);
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
          {companyModelEnabled ? <IconButton accessibilityLabel="Switch Company" icon="office-building" onPress={() => router.push('/company')} /> : null}
          {!actingCompanyId ? <IconButton accessibilityLabel="Create Project" icon="plus" onPress={openCreateProject} /> : null}
          <ProjectAccountButton label={profileStatus?.user.displayName || profileStatus?.user.email || 'Track member'} onPress={openProfileSheet} seed={trackUserId ?? 'track-member'} />
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
              companyLabel={companyLabel}
              companyScoped={Boolean(actingCompanyId)}
              onPressCompany={() => router.push('/company')}
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
            actionLabel={!actingCompanyId ? 'Create Project' : undefined}
            body={actingCompanyId ? 'Accepted shared Projects and retained archives will appear here.' : 'Create a Project to organize conversations and tasks.'}
            icon="project"
            onAction={!actingCompanyId ? openCreateProject : undefined}
            title="No Projects yet"
          />}
          ListFooterComponent={!actingCompanyId && sortedProjects.length ? <Pressable accessibilityRole="button" onPress={openCreateProject} style={[styles.addProject, { backgroundColor: theme.text }]}>
            <PlatformIcon color={theme.background} name="plus" size={17} />
            <ThemedText style={{ color: theme.background }} type="title">Add Project</ThemedText>
          </Pressable> : null}
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

      <OptionsSheet onClose={closeCreateProject} title="Create Project" visible={createOpen}>
        <SheetSection>
          <View style={styles.createInputs}>
            <SheetInput label="Project name" maxLength={100} onChangeText={setProjectName} value={projectName} />
            <SheetInput label="Client label" maxLength={100} onChangeText={setProjectClientLabel} value={projectClientLabel} />
          </View>
        </SheetSection>
        {createError ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }} type="small">{createError}</ThemedText> : null}
        <ActionButton disabled={!projectName.trim()} label="Create Project" loading={creating} onPress={() => void submitCreateProject()} />
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
  addProject: { alignItems: 'center', alignSelf: 'center', borderRadius: Radius.large, flexDirection: 'row', gap: Spacing.two, justifyContent: 'center', marginTop: Spacing.five, minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  connection: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
  createInputs: { gap: Spacing.three, padding: Spacing.three },
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
