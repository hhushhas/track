import { FlatList, Linking, Platform, Pressable, RefreshControl, StyleSheet, View, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonRow } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/empty-state';
import { OptionsSheet, SheetInput, SheetSection, SheetRow } from '@/components/options-sheet';
import { Spacing, TouchTarget } from '@/constants/theme';
import { hapticLight, hapticDestructive } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

type MobileProject = {
  project: Doc<'projects'>;
  membership: Doc<'projectMembers'>;
  groupCount: number;
  unreadCount: number;
};

export default function ProjectsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { trackUserId, signOut, openProfileSheet } = useTrackUser();
  const { themeOverride, setThemeOverride } = useThemeOverride();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectClientLabel, setProjectClientLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const createProject = useMutation(api.projects.create);
  const ensureStarter = useMutation(api.projects.ensureStarter);
  const requestAccountDeletion = useMutation(api.auth.requestAccountDeletion);

  const projects = useQuery(api.mobile.listProjects, trackUserId ? { userId: trackUserId } : 'skip');
  const projectItems = (projects ?? []) as MobileProject[];

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  function openTools() {
    hapticLight();
    setToolsOpen(true);
  }

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
    try {
      const projectId = await createProject({
        userId: trackUserId,
        name,
        clientLabel: projectClientLabel.trim() || undefined,
      });
      setProjectName('');
      setProjectClientLabel('');
      setCreateOpen(false);
      router.push(`/groups?projectId=${projectId}`);
    } catch (error) {
      Alert.alert(
        'Project not created',
        error instanceof Error && error.message === 'not_allowed_to_create_project'
          ? 'Only project owners and admins can create another project.'
          : 'Please check the project details and try again.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function navigateToProject(item: MobileProject) {
    hapticLight();
    if (!trackUserId) return;

    if (projectItems.length === 0) {
      const projectId = await ensureStarter({ userId: trackUserId });
      router.push(`/groups?projectId=${projectId}`);
    } else {
      router.push(`/groups?projectId=${item.project._id}`);
    }
  }

  function confirmDeletion() {
    if (!trackUserId) return;
    hapticDestructive();
    Alert.alert(
      'Delete account',
      'Track will remove your profile and disable notifications. Shared project evidence is retained for project integrity.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteAccount();
          },
        },
      ],
    );
  }

  async function deleteAccount() {
    if (!trackUserId || deletingAccount) return;
    setDeletingAccount(true);
    try {
      await requestAccountDeletion({ userId: trackUserId });
      await signOut();
    } catch {
      Alert.alert('Delete account failed', 'Please try again in a moment.');
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Projects',
          headerLargeTitle: Platform.OS === 'ios',
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect: 'systemMaterial',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Create project"
                android_ripple={{ color: theme.backgroundSelected, borderless: true }}
                hitSlop={8}
                onPress={openCreateProject}
                style={styles.headerButton}>
                <PlatformIcon color={theme.text} name="plus" size={22} />
              </Pressable>
              <Pressable
                accessibilityLabel="Account and settings"
                android_ripple={{ color: theme.backgroundSelected, borderless: true }}
                hitSlop={8}
                onPress={openTools}
                style={styles.headerButton}>
                <PlatformIcon color={theme.text} name="dots-horizontal" size={22} />
              </Pressable>
            </View>
          ),
        }}
      />

      {projects === undefined ? (
        <View style={styles.list}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          data={projectItems}
          keyExtractor={(item) => item.project._id}
          renderItem={({ item }) => (
            <ProjectRow item={item} onPress={() => void navigateToProject(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState icon="briefcase-outline" title="No projects yet" body="Create a project to get started." />
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: theme.backgroundSelected }}
                onPress={openCreateProject}
                style={[styles.primaryButton, { backgroundColor: theme.text }]}>
                <ThemedText style={{ color: theme.background }} type="smallBold">
                  Create Project
                </ThemedText>
              </Pressable>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
          }
        />
      )}

      <OptionsSheet onClose={closeCreateProject} title="Create Project" visible={createOpen}>
        <SheetSection>
          <View style={styles.createInputs}>
            <SheetInput label="Project name" onChangeText={setProjectName} value={projectName} />
            <SheetInput label="Client label" onChangeText={setProjectClientLabel} value={projectClientLabel} />
          </View>
        </SheetSection>
        <Pressable
          accessibilityRole="button"
          disabled={!projectName.trim() || creating}
          onPress={() => void submitCreateProject()}
          style={[
            styles.primaryButton,
            { backgroundColor: !projectName.trim() || creating ? theme.hairline : theme.text },
          ]}>
          <ThemedText style={{ color: theme.background }} type="smallBold">
            {creating ? 'Creating…' : 'Create Project'}
          </ThemedText>
        </Pressable>
      </OptionsSheet>

      <OptionsSheet onClose={() => setToolsOpen(false)} title="Account" visible={toolsOpen}>
        <SheetSection title="Appearance">
          <SheetRow icon="white-balance-sunny" label="Light" selected={themeOverride === 'light'} onPress={() => setThemeOverride('light')} />
          <SheetRow icon="theme-light-dark" label="System" selected={themeOverride === 'system'} onPress={() => setThemeOverride('system')} />
          <SheetRow icon="moon-waning-crescent" label="Dark" selected={themeOverride === 'dark'} onPress={() => setThemeOverride('dark')} />
        </SheetSection>
        <SheetSection>
          <SheetRow icon="account-edit-outline" label="Edit profile" onPress={() => { setToolsOpen(false); openProfileSheet(); }} />
          <SheetRow icon="shield-lock-outline" label="Privacy policy" onPress={() => void Linking.openURL('https://track.q9labs.ai/privacy')} />
          <SheetRow icon="file-document-outline" label="Terms of Service" onPress={() => void Linking.openURL('https://track.q9labs.ai/terms')} />
          <SheetRow icon="email-outline" label="Support" onPress={() => void Linking.openURL('mailto:q9labs.ai@gmail.com')} />
          <SheetRow icon="logout" label="Sign out" onPress={() => { setToolsOpen(false); void signOut(); }} />
          <SheetRow destructive icon="trash-can-outline" label={deletingAccount ? 'Deleting account…' : 'Delete account'} onPress={() => { setToolsOpen(false); confirmDeletion(); }} />
        </SheetSection>
      </OptionsSheet>
    </ThemedView>
  );
}

function ProjectRow({ item, onPress }: { item: MobileProject; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      android_ripple={{ color: theme.backgroundSelected }}
      hitSlop={4}
      onPress={() => { hapticLight(); onPress(); }}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ColoredAvatar label={item.project.name} seed={item.project._id} shape="rounded" size={44} />
      <View style={styles.rowBody}>
        <ThemedText type="smallBold">{item.project.name}</ThemedText>
        <ThemedText style={{ color: theme.textSecondary }} type="code">
          {item.membership.role} · {item.groupCount} {item.groupCount === 1 ? 'group' : 'groups'}
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
  headerButton: {
    alignItems: 'center',
    height: TouchTarget,
    justifyContent: 'center',
    width: TouchTarget,
  },
  list: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingTop: Spacing.two,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: Spacing.four,
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
