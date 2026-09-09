import { SectionList, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { useCompany } from '@/contexts/company-context';
import { ColoredAvatar } from '@/components/colored-avatar';
import { AdaptiveListRow } from '@/components/adaptive-list-row';
import { ActionButton } from '@/components/action-button';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { IconButton } from '@/components/icon-button';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/empty-state';
import { OptionsSheet, SheetInput, SheetSection } from '@/components/options-sheet';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { projectOverviewHref } from '@/lib/company-navigation';
import { projectRoleLabel } from '@/lib/role-label';

type MobileProject = {
  project: Doc<'projects'>;
  membership: Doc<'projectMembers'>;
  groupCount: number;
  unreadCount: number;
};

export default function ProjectsScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { trackUserId, openProfileSheet } = useTrackUser();
  const { actingCompanyId, actingCompany, companyModelEnabled } = useCompany();
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectClientLabel, setProjectClientLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createProject = useMutation(api.projects.create);
  const ensureStarter = useMutation(api.projects.ensureStarter);

  const projects = usePaginatedQuery(
    api.mobile.listProjects,
    trackUserId ? { userId: trackUserId } : 'skip',
    { initialNumItems: 50 },
  );
  const { loadMore: loadMoreProjects, status: projectPageStatus } = projects;
  const projectItems = projects.results.filter((project): project is MobileProject => project !== null);
  const lastContext = useQuery(api.mobile.getLastActiveContext, trackUserId ? { userId: trackUserId } : 'skip');
  const sections = useMemo(() => {
    const attention = projectItems.filter((item) => item.membership.status !== 'archived' && item.unreadCount > 0)
      .sort((left, right) => right.unreadCount - left.unreadCount)
      .slice(0, 3);
    const attentionIds = new Set(attention.map((item) => item.membership._id));
    const recent = lastContext?.projectId
      ? projectItems.filter((item) =>
          item.project._id === lastContext.projectId &&
          (!lastContext.projectMemberId || item.membership._id === lastContext.projectMemberId) &&
          (!lastContext.actingCompanyId || item.membership.companyId === lastContext.actingCompanyId) &&
          item.membership.status !== 'archived' &&
          !attentionIds.has(item.membership._id),
        )
      : [];
    const highlightedIds = new Set([...attentionIds, ...recent.map((item) => item.membership._id)]);
    const companyGroups = new Map<string, MobileProject[]>();
    for (const item of projectItems.filter((row) => row.membership.status !== 'archived' && !highlightedIds.has(row.membership._id))) {
      const company = item.membership.companyDisplayNameSnapshot ?? 'Independent Projects';
      companyGroups.set(company, [...(companyGroups.get(company) ?? []), item]);
    }
    const result: Array<{ title: string; subtitle?: string; data: MobileProject[] }> = [];
    if (attention.length) result.push({ title: 'Needs attention', subtitle: 'Unread work is prioritized; opening remains your choice.', data: attention });
    if (recent.length) result.push({ title: 'Continue working', subtitle: 'Your most recently opened Project.', data: recent });
    for (const [company, data] of companyGroups) result.push({ title: company, data });
    const archives = projectItems.filter((item) => item.membership.status === 'archived');
    if (archives.length) result.push({ title: 'Read-only archives', subtitle: 'Retained work from Companies you have left.', data: archives });
    return result;
  }, [lastContext?.actingCompanyId, lastContext?.projectId, lastContext?.projectMemberId, projectItems]);

  useEffect(() => {
    if (projectPageStatus === 'CanLoadMore') loadMoreProjects(50);
  }, [loadMoreProjects, projectPageStatus]);

  function openCreateProject() {
    hapticLight();
    setCreateOpen(true);
  }

  function closeCreateProject() {
    if (creating) return;
    setCreateOpen(false);
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
      setCreateError(
        error instanceof Error && error.message.includes('not_allowed_to_create_project')
          ? 'You do not have permission to create a Project for this identity.'
          : 'Please check the project details and try again.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function navigateToProject(item: MobileProject) {
    if (!trackUserId) return;

    if (projectItems.length === 0) {
      const projectId = await ensureStarter({ userId: trackUserId });
      router.push(projectOverviewHref(projectId, null));
    } else {
      router.push(projectOverviewHref(item.project._id, item.membership.companyId ? {
        archived: item.membership.status === 'archived',
        companyId: item.membership.companyId,
        membershipId: item.membership._id,
      } : null) as never);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Projects',
          headerLargeTitle: false,
          headerTransparent: false,
          headerRight: () => (
            <View style={styles.headerActions}>
              {companyModelEnabled ? <IconButton accessibilityLabel="Switch company and manage invitations" icon="office-building" onPress={() => router.push('/company')} /> : null}
              {!actingCompanyId ? (
                <IconButton accessibilityLabel="Create project" icon="plus" onPress={openCreateProject} />
              ) : null}
              <IconButton accessibilityLabel="Open account" icon="account-circle" onPress={openProfileSheet} />
            </View>
          ),
        }}
      />
      <ConnectivityBanner style={styles.connection} />

      {actingCompanyId ? (
        <View style={[styles.contextBanner, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="title">Representing {actingCompany?.company?.displayName}</ThemedText>
          <ThemedText themeColor="textSecondary" type="caption">
            Project actions use this Company identity.
          </ThemedText>
        </View>
      ) : null}

      {projects.status === 'LoadingFirstPage' ? (
        <SkeletonList label="Loading projects" />
      ) : (
        <SectionList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
          keyExtractor={(item) => item.membership._id}
          ListHeaderComponent={<View style={styles.listHeader}>
            <ThemedText type="display">Your Projects</ThemedText>
            <ThemedText themeColor="textSecondary">Resume important work or browse by Company. Notifications never change your active Project automatically.</ThemedText>
          </View>}
          renderSectionHeader={({ section }) => <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}><ThemedText type="titleLarge">{section.title}</ThemedText>{section.subtitle ? <ThemedText themeColor="textSecondary" type="caption">{section.subtitle}</ThemedText> : null}</View>}
          renderItem={({ item }) => (
            <ProjectRow item={item} onPress={() => void navigateToProject(item)} />
          )}
          onEndReached={() => { if (projects.status === 'CanLoadMore') projects.loadMore(50); }}
          onEndReachedThreshold={0.35}
          sections={sections}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                actionLabel={!actingCompanyId ? 'Create project' : undefined}
                icon="briefcase-outline"
                onAction={!actingCompanyId ? openCreateProject : undefined}
                title="No projects yet"
                body={actingCompanyId ? 'Accepted shared Projects and retained exit archives will appear here.' : 'Create a project to organize conversations and tasks.'}
              />
            </View>
          }
        />
      )}

      <OptionsSheet onClose={closeCreateProject} title="Create project" visible={createOpen}>
        <SheetSection>
          <View style={styles.createInputs}>
            <SheetInput label="Project name" maxLength={100} onChangeText={setProjectName} value={projectName} />
            <SheetInput label="Client label" maxLength={100} onChangeText={setProjectClientLabel} value={projectClientLabel} />
          </View>
        </SheetSection>
        {createError ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }} type="small">{createError}</ThemedText> : null}
        <ActionButton disabled={!projectName.trim()} label="Create project" loading={creating} onPress={() => void submitCreateProject()} />
      </OptionsSheet>

    </ThemedView>
  );
}

function ProjectRow({ item, onPress }: { item: MobileProject; onPress: () => void }) {
  const theme = useTheme();
  const archived = item.membership.status === 'archived';
  const company = item.membership.companyDisplayNameSnapshot ?? 'Independent Project';
  const channels = `${item.groupCount} ${item.groupCount === 1 ? 'Channel' : 'Channels'}`;
  return (
    <AdaptiveListRow
      accessibilityHint={archived ? 'Opens this read-only Project archive' : 'Opens this Project'}
      accessibilityLabel={`${item.project.name}. ${projectRoleLabel(item.membership.role)}. ${channels}.${item.unreadCount ? ` ${item.unreadCount} unread.` : ''}${archived ? ' Read-only archive.' : ''}`}
      leading={<ColoredAvatar label={item.project.name} seed={item.project._id} shape="rounded" size={40} />}
      onPress={() => { hapticLight(); onPress(); }}
      subtitle={`${company} · ${projectRoleLabel(item.membership.role)} · ${channels}`}
      title={item.project.name}
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
  contextBanner: {
    gap: Spacing.one,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.large,
  },
  createInputs: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  list: {
    gap: Spacing.two,
    padding: Spacing.four,
    paddingTop: Spacing.two,
  },
  listHeader: { gap: Spacing.two },
  sectionHeader: { gap: 2, paddingBottom: Spacing.one, paddingTop: Spacing.three },
  screen: {
    flex: 1,
  },
});
