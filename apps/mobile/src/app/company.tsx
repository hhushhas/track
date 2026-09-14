import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import { useAppToast } from '@/components/app-toast';
import {
  ActingCompanyCard,
  CompanyChoice,
  CompanyHeaderTitle,
  CompanyPageIntro,
  CompanySectionHeading,
  CompanyTrustNotice,
  CompanyWebNote,
  InvitationCard,
  RelationshipCard,
  type CompanyAudience,
} from '@/components/company-dashboard';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { ProjectAccountButton } from '@/components/project-overview-dashboard';
import { StandalonePrimaryNavigation } from '@/components/primary-navigation';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { companyRoleLabel } from '@/lib/role-label';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CompanyScreen() {
  const { showToast } = useAppToast();
  const insets = useSafeAreaInsets();
  const { openProfileSheet, trackUserId } = useTrackUser();
  const { actingCompanyId, companies, companyModelEnabled, setActingCompanyId } = useCompany();
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const pendingDecisionRef = useRef<string | null>(null);
  const actingCompany = companies?.find(({ company }) => company?._id === actingCompanyId);
  const canAdminister = actingCompany?.membership.role === 'owner' || actingCompany?.membership.role === 'admin';
  const administerArgs = actingCompanyId && canAdminister ? { actingCompanyId } : 'skip';
  const companyInvitations = useQuery(api.companies.listPendingForMe, companyModelEnabled ? {} : 'skip');
  const relationshipInvitations = useQuery(api.relationships.listInvitations, administerArgs);
  const projectInvitations = useQuery(api.sharedProjects.listInvitations, administerArgs);
  const relationships = useQuery(api.relationships.listMine, administerArgs);
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

  const accountLabel = profile?.user?.displayName || profile?.user?.email || 'Track member';

  if (!companyModelEnabled) return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ headerRight: () => <ProjectAccountButton label={accountLabel} onPress={openProfileSheet} seed={trackUserId ?? 'track-member'} />, title: 'Companies' }} />
    <EmptyState body="This server has not enabled the Company release." icon="office-building" title="Company collaboration is disabled" />
  </ThemedView>;

  return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ headerRight: () => <ProjectAccountButton label={accountLabel} onPress={openProfileSheet} seed={trackUserId ?? 'track-member'} />, headerTitle: () => <CompanyHeaderTitle /> }} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.six + BottomTabInset + Math.max(insets.bottom, Spacing.two) }]} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
      <CompanyPageIntro />
      <ConnectivityBanner />
      <CompanyTrustNotice />
      <ActingCompanyCard companyId={actingCompany?.company?._id} companyName={actingCompany?.company?.displayName} projectCount={projectCount} role={actingCompany ? companyRoleLabel(actingCompany.membership.role) : 'Individual workspace'} status={actingCompany?.company?.status} />

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

      {actingCompanyId ? <View style={styles.section}>
        <CompanySectionHeading meta="Active links" title="RELATIONSHIPS" />
        {!canAdminister ? <ThemedText themeColor="textSecondary" type="caption">Relationship administration is limited to this Company&apos;s owners and admins.</ThemedText> : relationships === undefined ? <SkeletonList count={2} label="Loading relationships" /> : relationships.length ? relationships.map((entry) => entry ? <RelationshipCard companies={entry.participants as CompanyAudience[]} key={entry.relationship._id} name={entry.relationship.name} /> : null) : <ThemedText themeColor="textSecondary" type="caption">No active Company relationships.</ThemedText>}
        <CompanyWebNote />
      </View> : null}
    </ScrollView>
    <StandalonePrimaryNavigation active="tasks" />
  </ThemedView>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, padding: Spacing.four, paddingBottom: Spacing.six },
  screen: { flex: 1 },
  section: { gap: Spacing.two },
});
