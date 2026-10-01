import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { EntityMark } from '@/components/entity-mark';
import { EntityMarkPicker } from '@/components/entity-mark-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, projectChannelsHref, projectOverviewHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { taskListHref } from '@/lib/task-navigation';
import type { EntityMarkColorKey, EntityMarkIconKey } from '@track/shared';

export default function ProjectSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ companyId?: string; membershipId?: string; projectId?: string }>();
  const projectId = params.projectId as Id<'projects'> | undefined;
  const companyId = params.companyId as Id<'companies'> | undefined;
  const membershipId = params.membershipId as Id<'projectMembers'> | undefined;
  const overview = useQuery(api.companyOverview.getProject, projectId && companyId && membershipId ? {
    actingCompanyId: companyId,
    days: 30,
    projectId,
    projectMemberId: membershipId,
  } : 'skip');
  const updateProject = useMutation(api.sharedProjects.updateDetails);
  const [markColorKey, setMarkColorKey] = useState<EntityMarkColorKey | ''>('');
  const [markIconKey, setMarkIconKey] = useState<EntityMarkIconKey | ''>('');
  const [savingMark, setSavingMark] = useState(false);
  const [markNotice, setMarkNotice] = useState<string | null>(null);
  useEffect(() => {
    setMarkColorKey((overview?.project.markColorKey as EntityMarkColorKey | undefined) ?? '');
    setMarkIconKey((overview?.project.markIconKey as EntityMarkIconKey | undefined) ?? '');
  }, [overview?.project.markColorKey, overview?.project.markIconKey]);
  const context: RepresentedProjectContext | null = companyId && membershipId ? { archived: false, companyId, membershipId } : null;
  const title = overview?.project.name ?? 'Project settings';

  return (
    <ThemedView style={[styles.screen, { backgroundColor: theme.homeBackground }]}>
      <Stack.Screen options={{ title: 'Project settings' }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        {overview === undefined ? <SettingsState copy="Loading Project settings…" /> : (
          <>
            <View style={[styles.identity, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
              <EntityMark colorKey={overview.project.markColorKey} iconKey={overview.project.markIconKey} id={String(overview.project.id)} kind="project" name={overview.project.name} size={TouchTarget} />
              <View style={styles.identityCopy}>
                <ThemedText numberOfLines={1} type="titleLarge">{title}</ThemedText>
                <ThemedText themeColor="textSecondary" type="caption">{overview.project.health} · {overview.memberCount} members</ThemedText>
              </View>
            </View>

            {overview.permissions.canManageProject ? <View style={styles.section}>
              <ThemedText type="titleLarge">Project mark</ThemedText>
              <View style={[styles.access, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
                <EntityMarkPicker colorKey={markColorKey} iconKey={markIconKey} onColorChange={setMarkColorKey} onIconChange={setMarkIconKey} />
                {markNotice ? <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary" type="caption">{markNotice}</ThemedText> : null}
                <Pressable accessibilityRole="button" disabled={savingMark} onPress={async () => {
                  if (!projectId || !companyId || !membershipId) return;
                  setSavingMark(true);
                  setMarkNotice(null);
                  try {
                    await updateProject({ actingCompanyId: companyId, projectId, projectMemberId: membershipId, markIconKey: markIconKey || null, markColorKey: markColorKey || null });
                    setMarkNotice('Project mark saved.');
                  } catch {
                    setMarkNotice('Could not save the Project mark. Check your access and try again.');
                  } finally {
                    setSavingMark(false);
                  }
                }} style={({ pressed }) => [styles.saveButton, { backgroundColor: pressed || savingMark ? theme.accentSoft : theme.accent }]}>
                  <ThemedText style={{ color: theme.accentInk }} type="captionBold">{savingMark ? 'Saving…' : 'Save Project mark'}</ThemedText>
                </Pressable>
              </View>
            </View> : null}

            <View style={styles.section}>
              <ThemedText type="titleLarge">Project workspace</ThemedText>
              <View style={[styles.surface, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
                <SettingsRow icon="project" label="Project overview" onPress={() => projectId && router.push(projectOverviewHref(projectId, context))} />
                <Divider />
                <SettingsRow icon="channel" label="Channels" onPress={() => projectId && router.push(projectChannelsHref(projectId, context))} />
                <Divider />
                <SettingsRow icon="view-board" label="Task board" onPress={() => projectId && router.push(taskListHref(projectId, companyId && membershipId ? { companyId, membershipId } : null))} />
                {overview.latestThread ? <>
                  <Divider />
                  <SettingsRow icon="thread" label="Latest conversation" onPress={() => projectId && router.push(channelHref(projectId, overview.latestThread!.groupId, context) as never)} />
                </> : null}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="titleLarge">Access</ThemedText>
              <View style={[styles.access, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
                <View style={styles.accessRow}>
                  <ThemedText type="title">Manage Project</ThemedText>
                  <ThemedText themeColor={overview.permissions.canManageProject ? 'success' : 'textSecondary'} type="captionBold">
                    {overview.permissions.canManageProject ? 'Allowed' : 'View only'}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary" type="caption">
                  Project management actions follow your represented Company membership and are enforced by the server.
                </ThemedText>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function SettingsRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' }]}>
      <PlatformIcon color={theme.textSecondary} name={icon} size={IconSize.medium} />
      <ThemedText style={styles.rowLabel} type="title">{label}</ThemedText>
      <PlatformIcon color={theme.textSecondary} name="chevron-right" size={IconSize.small} />
    </Pressable>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.hairline }]} />;
}

function SettingsState({ copy }: { copy: string }) {
  const theme = useTheme();
  return <View style={[styles.access, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}><ThemedText themeColor="textSecondary">{copy}</ThemedText></View>;
}

const styles = StyleSheet.create({
  access: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, padding: Spacing.four },
  accessRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  content: { gap: Spacing.five, padding: Spacing.four },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  identity: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, padding: Spacing.four },
  identityCopy: { flex: 1, gap: Spacing.one, minWidth: 0 },
  row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 58, paddingHorizontal: Spacing.three },
  saveButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.four },
  rowLabel: { flex: 1 },
  screen: { flex: 1 },
  section: { gap: Spacing.three },
  surface: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
