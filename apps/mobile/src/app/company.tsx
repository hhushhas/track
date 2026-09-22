import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import { useAppToast } from '@/components/app-toast';
import {
  ActingCompanyCard,
  CompanyChoice,
  CompanySectionHeading,
  CompanyTrustNotice,
  InvitationCard,
  type CompanyAudience,
} from '@/components/company-dashboard';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import { StandalonePrimaryNavigation } from '@/components/primary-navigation';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { companyRoleLabel } from '@/lib/role-label';
import { projectOverviewHref } from '@/lib/company-navigation';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';

export default function CompanyScreen() {
  const { showToast } = useAppToast();
  const router = useRouter();
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset(Spacing.six);
  const { trackUserId } = useTrackUser();
  const { actingCompanyId, companies, companyModelEnabled, setActingCompanyId } = useCompany();
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const pendingDecisionRef = useRef<string | null>(null);
  const actingCompany = companies?.find(({ company }) => company?._id === actingCompanyId);
  const companyInvitations = useQuery(api.companies.listPendingForMe, companyModelEnabled ? {} : 'skip');
  const relationshipInvitations = useQuery(api.relationships.listInvitations, actingCompanyId ? { actingCompanyId } : 'skip');
  const projectInvitations = useQuery(api.sharedProjects.listInvitations, actingCompanyId ? { actingCompanyId } : 'skip');
  const profile = useQuery(api.auth.getProfileStatus, trackUserId ? { userId: trackUserId } : 'skip');
  const projectPage = usePaginatedQuery(api.mobile.listProjects, trackUserId ? {
    userId: trackUserId,
    actingCompanyId: actingCompanyId ?? undefined,
  } : 'skip', { initialNumItems: 100 });
  useEffect(() => {
    if (projectPage.status === 'CanLoadMore') projectPage.loadMore(100);
  }, [projectPage.loadMore, projectPage.status]);
  const projectCount = projectPage.status === 'LoadingFirstPage'
    ? undefined
    : projectPage.results.filter(Boolean).length;
  const activeProjects = useMemo(() => projectPage.results
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.membership.status !== 'archived'))
    .slice(0, 4), [projectPage.results]);
  const decideCompanyInvitation = useMutation(api.companies.decideInvitation);
  const decideRelationshipInvitation = useMutation(api.relationships.decideInvitation);
  const decideProjectInvitation = useMutation(api.sharedProjects.decideInvitation);
  const sortedCompanies = useMemo(() => [...(companies ?? [])].sort((left, right) => {
    if (left.company?._id === actingCompanyId) return -1;
    if (right.company?._id === actingCompanyId) return 1;
    if (left.company?.status !== right.company?.status) return left.company?.status === 'active' ? -1 : 1;
    return (left.company?.displayName ?? '').localeCompare(right.company?.displayName ?? '');
  }), [actingCompanyId, companies]);
  async function run(id: string, action: () => Promise<unknown>, success: string) {
    if (pendingDecisionRef.current) return;
    pendingDecisionRef.current = id;
    setPendingDecision(id);
    try {
      const result = await action();
      if (typeof result === 'object' && result !== null && 'status' in result && result.status === 'expired') throw new Error('invitation_expired');
      showToast({ title: success, tone: 'success' });
    } catch {
      showToast({ title: 'Action unavailable', message: 'Your authority or the invitation changed. Refresh and try again.', tone: 'error' });
    } finally {
      pendingDecisionRef.current = null;
      setPendingDecision(null);
    }
  }

  if (!companyModelEnabled) return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ title: 'Companies' }} />
    <EmptyState body="This server has not enabled the Company release." icon="office-building" title="Company collaboration is disabled" />
  </ThemedView>;

  return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ title: 'Companies' }} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
      <ConnectivityBanner />
      <CompanyTrustNotice />
      <ActingCompanyCard companyId={actingCompany?.company?._id} companyName={actingCompany?.company?.displayName} projectCount={projectCount} role={actingCompany ? companyRoleLabel(actingCompany.membership.role) : 'Individual workspace'} status={actingCompany?.company?.status} />

      <View style={styles.section}>
        <CompanySectionHeading count={activeProjects.length} meta="Available now" title="ACTIVE PROJECTS" />
        {projectPage.status === 'LoadingFirstPage' ? <SkeletonList count={3} label="Loading Company Projects" /> : activeProjects.length ? activeProjects.map((item) => (
          <Pressable
            accessibilityLabel={`${item.project.name}. Open Project.`}
            accessibilityRole="button"
            android_ripple={{ color: theme.backgroundSelected }}
            key={item.membership._id}
            onPress={() => router.push(projectOverviewHref(item.project._id, item.membership.companyId ? { archived: false, companyId: item.membership.companyId, membershipId: item.membership._id } : null) as never)}
            style={[styles.projectRow, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}
          >
            <View style={[styles.projectIcon, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name="project" size={18} /></View>
            <View style={styles.projectCopy}><ThemedText numberOfLines={1} type="title">{item.project.name}</ThemedText><ThemedText themeColor="textSecondary" type="caption">{item.groupCount} {item.groupCount === 1 ? 'Channel' : 'Channels'}{item.unreadCount ? ` · ${item.unreadCount} unread` : ''}</ThemedText></View>
            <PlatformIcon color={theme.textTertiary} name="chevron-right" size={17} />
          </Pressable>
        )) : <ThemedText themeColor="textSecondary" type="caption">No active Projects are available in this Company.</ThemedText>}
        {activeProjects.length ? <Pressable accessibilityRole="button" onPress={() => router.replace('/projects')} style={styles.allProjects}><ThemedText themeColor="accentStrong" type="captionBold">View all Projects</ThemedText><PlatformIcon color={theme.accentStrong} name="chevron-right" size={15} /></Pressable> : null}
      </View>

      <View style={styles.section}>
        <CompanySectionHeading meta={`${companies?.length ?? 0} available`} title="ACT AS" />
        <ThemedText themeColor="textSecondary" type="small">Choose the identity represented by Project actions. Company membership alone never grants content access.</ThemedText>
        {companies === undefined ? <SkeletonList count={3} label="Loading your Companies" /> : <>
          {sortedCompanies.map(({ company, membership }) => company ? <CompanyChoice detail={company.status === 'active' ? companyRoleLabel(membership.role) : `${companyRoleLabel(membership.role)} · Contact workspace admin`} key={company._id} label={company.displayName} onPress={() => company.status === 'active' ? setActingCompanyId(company._id) : undefined} selected={company._id === actingCompanyId} suspended={company.status !== 'active'} /> : null)}
          <CompanyChoice detail={`${profile?.user?.displayName || 'Track member'} · Individual workspace`} label="Personal Projects" onPress={() => setActingCompanyId(null)} personal selected={!actingCompanyId} />
        </>}
      </View>

      {companyInvitations?.length ? <View style={styles.section}>
        <CompanySectionHeading count={companyInvitations.length} meta="Action required" title="COMPANY INVITATIONS" />
        {companyInvitations.map(({ company, invitation }) => {
          const id = String(invitation._id);
          return <InvitationCard audienceLabel="Access stays restricted to accepted shared Projects and joined Channels." busy={pendingDecision !== null} decision={pendingDecision === id ? 'accept' : pendingDecision === `${id}:decline` ? 'decline' : null} detail={`Join as ${companyRoleLabel(invitation.role)}`} key={id} onAccept={() => void run(id, () => decideCompanyInvitation({ invitationId: invitation._id, decision: 'accept' }), 'Company joined')} onDecline={() => void run(`${id}:decline`, () => decideCompanyInvitation({ invitationId: invitation._id, decision: 'decline' }), 'Invitation declined')} title={company?.displayName ?? 'Company'} />;
        })}
      </View> : null}

      {actingCompanyId && relationshipInvitations?.length ? <View style={styles.section}>
        <CompanySectionHeading count={relationshipInvitations.length} meta="Action required" title="RELATIONSHIP INVITATIONS" />
        {relationshipInvitations.map(({ invitation, inviter, invitingCompany, relationship, participants }) => {
          const id = String(invitation._id);
          return <InvitationCard audience={participants as CompanyAudience[]} audienceLabel={`Accepting shares this relationship with ${participants.map((company) => company.displayName).join(', ')}.`} busy={pendingDecision !== null} decision={pendingDecision === id ? 'accept' : pendingDecision === `${id}:decline` ? 'decline' : null} detail={`${invitingCompany?.displayName ?? 'A Company'} · Invited by ${inviter?.displayName ?? 'an administrator'}`} key={id} onAccept={() => void run(id, () => decideRelationshipInvitation({ actingCompanyId, invitationId: invitation._id, decision: 'accept' }), 'Relationship joined')} onDecline={() => void run(`${id}:decline`, () => decideRelationshipInvitation({ actingCompanyId, invitationId: invitation._id, decision: 'decline' }), 'Invitation declined')} title={relationship?.name ?? 'Relationship'} />;
        })}
      </View> : null}

      {actingCompanyId && trackUserId && projectInvitations?.length ? <View style={styles.section}>
        <CompanySectionHeading count={projectInvitations.length} meta="Channel sync" title="SHARED PROJECT INVITATIONS" />
        {projectInvitations.map(({ invitation, invitingCompany, project }) => {
          const id = String(invitation._id);
          return <InvitationCard acceptLabel="Accept Project" audience={invitingCompany ? [invitingCompany] : []} audienceLabel={`${invitingCompany?.displayName ?? 'The inviting Company'} will gain only the confirmed Channel audience.`} busy={pendingDecision !== null} decision={pendingDecision === id ? 'accept' : pendingDecision === `${id}:decline` ? 'decline' : null} detail={`From ${invitingCompany?.displayName ?? 'a collaborating Company'}`} eyebrow="PROJECT INVITE" key={id} onAccept={() => void run(id, () => decideProjectInvitation({ actingCompanyId, invitationId: invitation._id, decision: 'accept', initialMembers: [{ userId: trackUserId, role: 'manager' }] }), 'Project joined')} onDecline={() => void run(`${id}:decline`, () => decideProjectInvitation({ actingCompanyId, invitationId: invitation._id, decision: 'decline', initialMembers: [] }), 'Invitation declined')} title={project?.name ?? 'Shared Project'} />;
        })}
      </View> : null}

    </ScrollView>
    <StandalonePrimaryNavigation active="team" />
  </ThemedView>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, padding: Spacing.four, paddingBottom: Spacing.six },
  allProjects: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget },
  projectCopy: { flex: 1, gap: 2, minWidth: 0 },
  projectIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  projectRow: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: 68, padding: Spacing.three },
  screen: { flex: 1 },
  section: { gap: Spacing.two },
});
