import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { OptionsSheet, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { ScreenEntrance } from '@/components/screen-entrance';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { usePrimaryNavigationVisibility } from '@/contexts/primary-navigation-visibility-context';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { companyRoleLabel } from '@/lib/role-label';
import { projectOverviewHref, type RepresentedProjectContext } from '@/lib/company-navigation';
import { hapticLight } from '@/lib/haptics';

type ProjectScope = 'all' | string;

export default function TeamScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomContentInset = useBottomTabContentInset(Spacing.six);
  const { actingCompany, actingCompanyId, companies, companyModelEnabled, setActingCompanyId } = useCompany();
  const { setHidden: setNavigationHidden } = usePrimaryNavigationVisibility();
  const lastScrollY = useRef(0);
  const [companySheetOpen, setCompanySheetOpen] = useState(false);
  const [projectScope, setProjectScope] = useState<ProjectScope>('all');
  const overview = useQuery(api.companyOverview.get, actingCompanyId ? { companyId: actingCompanyId, days: 7 } : 'skip');

  const activeCompanies = useMemo(() => (companies ?? []).filter(({ company }) => company?.status === 'active'), [companies]);
  const projects = overview?.projects ?? [];
  const workload = overview?.workload ?? [];
  const memberPreviewFallback = useMemo(() => {
    const seen = new Set<string>();
    return projects.flatMap((project) => (project.members ?? []).flatMap((member) => {
      const id = String(member.id);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, name: member.name, initials: initials(member.name), total: 0, open: 0, completed: 0, overdue: 0 }];
    }));
  }, [projects]);
  const visibleWorkload = workload.length ? workload : memberPreviewFallback;
  const workloadMetricsAvailable = workload.length > 0;
  const selectedProject = projects.find((project) => String(project.id) === projectScope);
  const visibleProjects = selectedProject ? [selectedProject] : projects;
  const role = actingCompany ? companyRoleLabel(actingCompany.membership.role) : 'Company member';
  const canManageMembers = actingCompany?.membership.role === 'owner' || actingCompany?.membership.role === 'admin';
  const companyName = actingCompany?.company?.displayName ?? 'Company';

  function switchCompany(companyId: Id<'companies'>) {
    hapticLight();
    setActingCompanyId(companyId);
    setProjectScope('all');
    setCompanySheetOpen(false);
  }

  function openProject(project: (typeof visibleProjects)[number]) {
    const context: RepresentedProjectContext | null = project.companyId && project.membershipId
      ? { archived: false, companyId: project.companyId, membershipId: project.membershipId }
      : null;
    if (context) router.push(projectOverviewHref(project.id, context));
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = nextY - lastScrollY.current;
    if (nextY < 16 || delta < -10) setNavigationHidden(false);
    else if (nextY > 56 && delta > 10) setNavigationHidden(true);
    lastScrollY.current = nextY;
  }

  return (
    <ThemedView style={[styles.screen, { backgroundColor: theme.homeBackground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenEntrance style={styles.screenContent}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset, paddingTop: insets.top + Spacing.three }]}
          contentInsetAdjustmentBehavior="never"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText themeColor="textSecondary" type="captionBold">TEAM</ThemedText>
              <ThemedText type="display">People and workload</ThemedText>
              <ThemedText themeColor="textSecondary">See where work is moving across every Project in {companyName}.</ThemedText>
            </View>
            <Pressable
              accessibilityHint="Opens Company selection"
              accessibilityLabel={`Company: ${companyName}`}
              accessibilityRole="button"
              onPress={() => { hapticLight(); setCompanySheetOpen(true); }}
              style={({ pressed }) => [styles.companyButton, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }, pressed && { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.companyMark, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name="office-building" size={17} /></View>
              <View style={styles.flex}><ThemedText numberOfLines={1} type="smallBold">{companyName}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{role}</ThemedText></View>
              <PlatformIcon color={theme.textTertiary} name="chevron-down" size={16} />
            </Pressable>
          </View>

          <ConnectivityBanner />

          {!companyModelEnabled ? <EmptyState body="Company collaboration is not enabled on this server." icon="account-group" title="Team is unavailable" /> : !actingCompanyId ? (
            <View style={[styles.scopeEmpty, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
              <View style={[styles.scopeIcon, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name="account-group" size={22} /></View>
              <ThemedText type="subtitle">Choose a Company workspace</ThemedText>
              <ThemedText style={styles.centerText} themeColor="textSecondary">Team workload is scoped to one Company so people and Projects never mix accidentally.</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => setCompanySheetOpen(true)} style={[styles.primaryAction, { backgroundColor: theme.accent }]}><ThemedText style={{ color: theme.background }} type="smallBold">Choose Company</ThemedText></Pressable>
            </View>
          ) : overview === undefined ? <SkeletonList count={5} label="Loading Company Team" /> : (
            <View style={styles.sections}>
              <View style={[styles.scopeBar, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
                <View style={styles.scopeTitle}><PlatformIcon color={theme.accentStrong} name="project" size={17} /><ThemedText type="smallBold">Project scope</ThemedText></View>
                <ThemedText themeColor="textSecondary" type="caption">All Projects</ThemedText>
              </View>

              <View style={styles.statGrid}>
                <SignalCard icon="account-group" label="Active people" value={overview.stats.activePeople} detail="across Projects" tone="info" />
                <SignalCard icon="task" label="Open tasks" value={overview.stats.openTasks} detail="need attention" tone="accent" />
                <SignalCard icon="calendar-clock" label="Overdue" value={overview.stats.overdueTasks} detail="past due" tone="danger" />
                <SignalCard icon="check-circle" label="Completed" value={overview.stats.completedThisWeek} detail="this week" tone="success" />
              </View>

              <View style={[styles.panel, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
                <View style={styles.panelHeading}><View><ThemedText type="subtitle">Project lens</ThemedText><ThemedText themeColor="textSecondary" type="caption">Use a Project to focus the health view.</ThemedText></View><PlatformIcon color={theme.textTertiary} name="view-board" size={18} /></View>
                <ScrollView contentContainerStyle={styles.scopeTabs} horizontal showsHorizontalScrollIndicator={false}>
                  <ScopeTab label="All Projects" selected={projectScope === 'all'} onPress={() => setProjectScope('all')} />
                  {projects.map((project) => <ScopeTab key={project.id} label={project.name} selected={projectScope === String(project.id)} onPress={() => setProjectScope(String(project.id))} />)}
                </ScrollView>
              </View>

              <View style={[styles.panel, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
                <View style={styles.panelHeading}><View><ThemedText type="subtitle">{workloadMetricsAvailable ? 'Workload by teammate' : 'People in active Projects'}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{workloadMetricsAvailable ? 'People with assigned work in this Company.' : 'Member previews are available while workload metrics refresh.'}</ThemedText></View><PlatformIcon color={theme.textTertiary} name="account-group" size={18} /></View>
                {visibleWorkload.length ? visibleWorkload.map((person) => <WorkloadRow key={person.id} metricsAvailable={workloadMetricsAvailable} person={person} />) : <ThemedText themeColor="textSecondary">No Project members are visible yet.</ThemedText>}
              </View>

              <View style={[styles.panel, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
                <View style={styles.panelHeading}><View><ThemedText type="subtitle">{selectedProject ? selectedProject.name : 'Project health'}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{selectedProject ? 'Selected Project signal' : 'Across your active Projects'}</ThemedText></View><PlatformIcon color={theme.textTertiary} name="analytics" size={18} /></View>
                {visibleProjects.length ? visibleProjects.map((project) => <ProjectHealthRow key={project.id} project={project} onPress={() => openProject(project)} />) : <EmptyState icon="project" title="No active Projects" body="Projects you can access will appear here." />}
              </View>

              <Pressable accessibilityHint={canManageMembers ? 'Opens Company member management' : 'Company member management is restricted to administrators'} accessibilityLabel={canManageMembers ? 'Manage Company members' : 'Company member access'} accessibilityRole="button" disabled={!canManageMembers} onPress={() => router.push('/company')} style={[styles.manageRow, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }, !canManageMembers && styles.disabledRow]}>
                <View style={[styles.manageIcon, { backgroundColor: theme.backgroundSelected }]}><PlatformIcon color={theme.textSecondary} name={canManageMembers ? 'account-edit-outline' : 'shield-lock-outline'} size={18} /></View>
                <View style={styles.flex}><ThemedText type="smallBold">{canManageMembers ? 'Manage Company members' : 'Member access is read-only'}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{canManageMembers ? 'Invite, remove, or review Company roles.' : 'Ask a Company admin to change membership or roles.'}</ThemedText></View>
                {canManageMembers ? <PlatformIcon color={theme.textTertiary} name="chevron-right" size={17} /> : null}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </ScreenEntrance>

      <OptionsSheet onClose={() => setCompanySheetOpen(false)} title="Switch Company" visible={companySheetOpen}>
        <SheetNote>Team metrics stay inside the selected Company workspace.</SheetNote>
        <SheetSection title="Company workspaces">
          {activeCompanies.map(({ company }) => company ? <SheetRow icon="office-building" key={company._id} label={company.displayName} onPress={() => switchCompany(company._id)} selected={company._id === actingCompanyId} /> : null)}
          {!activeCompanies.length ? <SheetNote>No active Company workspaces are available.</SheetNote> : null}
        </SheetSection>
      </OptionsSheet>
    </ThemedView>
  );
}

function ScopeTab({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { hapticLight(); onPress(); }} style={[styles.scopeTab, { backgroundColor: selected ? theme.accentSoft : theme.backgroundElement, borderColor: selected ? theme.accent : theme.hairline }]}><ThemedText numberOfLines={1} style={{ color: selected ? theme.accentStrong : theme.textSecondary }} type="captionBold">{label}</ThemedText></Pressable>;
}

function SignalCard({ detail, icon, label, tone, value }: { detail: string; icon: 'account-group' | 'calendar-clock' | 'check-circle' | 'task'; label: string; tone: 'accent' | 'danger' | 'info' | 'success'; value: number }) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : tone === 'success' ? theme.success : tone === 'info' ? theme.info : theme.accentStrong;
  return <View accessibilityLabel={`${label}: ${value}. ${detail}.`} style={[styles.signalCard, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
    <View style={[styles.signalIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={color} name={icon} size={18} /></View>
    <View style={styles.signalCopy}>
      <ThemedText numberOfLines={1} type="smallBold">{label}</ThemedText>
      <View style={styles.signalValueRow}><ThemedText style={styles.signalValue} type="titleLarge">{value}</ThemedText><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{detail}</ThemedText></View>
    </View>
  </View>;
}

function WorkloadRow({ metricsAvailable, person }: { metricsAvailable: boolean; person: { id: string; name: string; initials: string; total: number; open: number; completed: number; overdue: number } }) {
  const theme = useTheme();
  return <View style={[styles.workloadRow, { borderTopColor: theme.hairline }]}><View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}><ThemedText themeColor="textSecondary" type="captionBold">{person.initials}</ThemedText></View><View style={styles.flex}><ThemedText numberOfLines={1} type="smallBold">{person.name}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{metricsAvailable ? `${person.open} open · ${person.completed} complete${person.overdue ? ` · ${person.overdue} overdue` : ''}` : 'Project member'}</ThemedText></View>{metricsAvailable ? <ThemedText themeColor={person.overdue ? 'danger' : 'textSecondary'} type="captionBold">{person.total}</ThemedText> : null}</View>;
}

function ProjectHealthRow({ onPress, project }: { onPress: () => void; project: { completedTasks: number; health: string; name: string; overdueTasks: number; progress: number; totalTasks: number } }) {
  const theme = useTheme();
  const healthColor = project.health === 'At risk' ? theme.danger : project.health === 'Completed' ? theme.success : theme.accentStrong;
  return <Pressable accessibilityLabel={`${project.name}. ${project.health}. ${project.progress}% complete.`} accessibilityRole="button" onPress={() => { hapticLight(); onPress(); }} style={({ pressed }) => [styles.projectHealthRow, { borderTopColor: theme.hairline }, pressed && { backgroundColor: theme.backgroundElement }]}><View style={[styles.projectIcon, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name="project" size={17} /></View><View style={styles.flex}><View style={styles.projectTitle}><ThemedText numberOfLines={1} style={styles.flex} type="smallBold">{project.name}</ThemedText><ThemedText style={{ color: healthColor }} type="captionBold">{project.health}</ThemedText></View><View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}><View style={[styles.progressFill, { backgroundColor: healthColor, width: `${Math.max(0, Math.min(100, project.progress))}%` }]} /></View><ThemedText themeColor="textSecondary" type="caption">{project.completedTasks} of {project.totalTasks} tasks complete{project.overdueTasks ? ` · ${project.overdueTasks} overdue` : ''}</ThemedText></View><PlatformIcon color={theme.textTertiary} name="chevron-right" size={17} /></Pressable>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: Radius.pill, height: 36, justifyContent: 'center', width: 36 },
  companyButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: 60, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  companyMark: { alignItems: 'center', borderRadius: Radius.medium, height: 32, justifyContent: 'center', width: 32 },
  content: { gap: Spacing.five, paddingHorizontal: Spacing.four },
  disabledRow: { opacity: 0.74 },
  flex: { flex: 1, minWidth: 0 },
  header: { gap: Spacing.three },
  headerCopy: { gap: Spacing.one },
  manageIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  manageRow: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: 68, padding: Spacing.three },
  panel: { borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.three, padding: Spacing.four },
  panelHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  primaryAction: { alignItems: 'center', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  progressFill: { borderRadius: Radius.pill, height: 6 },
  progressTrack: { borderRadius: Radius.pill, height: 6, marginTop: Spacing.two, overflow: 'hidden', width: '100%' },
  projectHealthRow: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: 76, paddingVertical: Spacing.two },
  projectIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  projectTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  scopeBar: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: Spacing.three },
  scopeEmpty: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, padding: Spacing.five },
  scopeIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 48, justifyContent: 'center', width: 48 },
  scopeTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  scopeTab: { borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 40, maxWidth: 180, paddingHorizontal: Spacing.three },
  scopeTabs: { gap: Spacing.two },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
  sections: { gap: Spacing.four },
  signalCard: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.homeSurface, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: Spacing.two, minHeight: 76, minWidth: '44%', padding: Spacing.two },
  signalCopy: { flex: 1, gap: 2, minWidth: 0 },
  signalGrid: { gap: Spacing.three },
  signalIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 34, justifyContent: 'center', width: 34 },
  signalValue: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  signalValueRow: { alignItems: 'baseline', flexDirection: 'row', gap: Spacing.one, minWidth: 0 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  workloadRow: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: 60, paddingVertical: Spacing.two },
  centerText: { textAlign: 'center' },
});

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}` : value.slice(0, 2)).toUpperCase() || 'T';
}
