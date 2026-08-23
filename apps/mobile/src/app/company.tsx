import { Stack } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import { ColoredAvatar } from '@/components/colored-avatar';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';

type NamedCompany = { displayName: string; _id?: string };

export default function CompanyScreen() {
  const theme = useTheme();
  const { trackUserId } = useTrackUser();
  const { actingCompanyId, companies, companyModelEnabled, setActingCompanyId } = useCompany();
  const actingCompany = companies?.find(({ company }) => company?._id === actingCompanyId);
  const canAdministerActingCompany =
    actingCompany?.membership.role === 'owner' || actingCompany?.membership.role === 'admin';
  const administerArgs =
    actingCompanyId && canAdministerActingCompany ? { actingCompanyId } : 'skip';
  const companyInvitations = useQuery(
    api.companies.listPendingForMe,
    companyModelEnabled ? {} : 'skip',
  );
  const relationshipInvitations = useQuery(api.relationships.listInvitations, administerArgs);
  const projectInvitations = useQuery(api.sharedProjects.listInvitations, administerArgs);
  const relationships = useQuery(api.relationships.listMine, administerArgs);
  const decideCompanyInvitation = useMutation(api.companies.decideInvitation);
  const decideRelationshipInvitation = useMutation(api.relationships.decideInvitation);
  const decideProjectInvitation = useMutation(api.sharedProjects.decideInvitation);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      Alert.alert(success);
    } catch {
      Alert.alert(
        'Action unavailable',
        'Your authority or the invitation changed. Refresh and try again.',
      );
    }
  }

  if (!companyModelEnabled)
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ title: 'Companies' }} />
        <EmptyState
          body="This server has not enabled the Company release."
          icon="office-building"
          title="Company collaboration is disabled"
        />
      </ThemedView>
    );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Companies' }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <ActingIdentityCard company={actingCompany?.company} role={actingCompany?.membership.role} />

        <Section title="Act as">
          <ThemedText style={styles.sectionNote} themeColor="textSecondary" type="caption">
            Choose the identity represented by Project and Channel actions. Company membership alone
            never grants content.
          </ThemedText>
          <CompanyChoice
            label="Personal / legacy Projects"
            onPress={() => setActingCompanyId(null)}
            selected={!actingCompanyId}
          />
          {companies === undefined ? (
            <SkeletonList count={2} label="Loading your Companies" />
          ) : (
            companies.map(({ company, membership }) =>
              company ? (
                <CompanyChoice
                  detail={
                    company.status === 'active'
                      ? membership.role
                      : `${membership.role} · ${company.status}`
                  }
                  key={company._id}
                  label={company.displayName}
                  onPress={() =>
                    company.status === 'active'
                      ? setActingCompanyId(company._id)
                      : Alert.alert(
                          'Company suspended',
                          'An owner can reactivate this Company from the web administration surface.',
                        )
                  }
                  selected={company._id === actingCompanyId}
                  suspended={company.status !== 'active'}
                />
              ) : null,
            )
          )}
        </Section>

        {companyInvitations?.length ? (
          <Section title="Company invitations">
            {companyInvitations.map(({ company, invitation }) => (
              <InvitationCard
                accept={() =>
                  run(
                    () =>
                      decideCompanyInvitation({
                        invitationId: invitation._id,
                        decision: 'accept',
                      }),
                    'Company joined',
                  )
                }
                decline={() =>
                  run(
                    () =>
                      decideCompanyInvitation({
                        invitationId: invitation._id,
                        decision: 'decline',
                      }),
                    'Invitation declined',
                  )
                }
                detail={`Join as ${invitation.role}`}
                key={invitation._id}
                title={company?.displayName ?? 'Company'}
              />
            ))}
          </Section>
        ) : null}

        {actingCompanyId && relationshipInvitations?.length ? (
          <Section title="Relationship invitations">
            {relationshipInvitations.map(
              ({ invitation, inviter, invitingCompany, relationship, participants }) => (
                <InvitationCard
                  accept={() =>
                    run(
                      () =>
                        decideRelationshipInvitation({
                          actingCompanyId,
                          invitationId: invitation._id,
                          decision: 'accept',
                        }),
                      'Relationship joined',
                    )
                  }
                  audience={participants}
                  audienceLabel="Accepting shares this relationship with"
                  decline={() =>
                    run(
                      () =>
                        decideRelationshipInvitation({
                          actingCompanyId,
                          invitationId: invitation._id,
                          decision: 'decline',
                        }),
                      'Invitation declined',
                    )
                  }
                  detail={`${invitingCompany?.displayName ?? 'A Company'} invited ${participants.map((company) => company.displayName).join(', ')}`}
                  invitedBy={inviter?.displayName}
                  key={invitation._id}
                  title={relationship?.name ?? 'Relationship'}
                />
              ),
            )}
          </Section>
        ) : null}

        {actingCompanyId && trackUserId && projectInvitations?.length ? (
          <Section title="Shared Project invitations">
            {projectInvitations.map(({ invitation, invitingCompany, project }) => (
              <InvitationCard
                accept={() =>
                  run(
                    () =>
                      decideProjectInvitation({
                        actingCompanyId,
                        invitationId: invitation._id,
                        decision: 'accept',
                        initialMembers: [{ userId: trackUserId, role: 'manager' }],
                      }),
                    'Project joined',
                  )
                }
                audience={invitingCompany ? [invitingCompany] : []}
                audienceLabel="Accepting grants access to"
                decline={() =>
                  run(
                    () =>
                      decideProjectInvitation({
                        actingCompanyId,
                        invitationId: invitation._id,
                        decision: 'decline',
                        initialMembers: [],
                      }),
                    'Invitation declined',
                  )
                }
                detail={`${invitingCompany?.displayName ?? 'A Company'} will gain only the confirmed General Channel audience.`}
                key={invitation._id}
                title={project?.name ?? 'Shared Project'}
              />
            ))}
          </Section>
        ) : null}

        {actingCompanyId ? (
          <Section title="Relationships">
            {!canAdministerActingCompany ? (
              <ThemedText style={styles.sectionNote} themeColor="textSecondary" type="caption">
                Relationship administration is limited to this Company&apos;s owners and admins.
              </ThemedText>
            ) : relationships === undefined ? (
              <SkeletonList count={2} label="Loading relationships" />
            ) : relationships.length ? (
              relationships.map((entry) =>
                entry ? (
                  <View
                    key={entry.relationship._id}
                    style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="title">{entry.relationship.name}</ThemedText>
                    <AudienceList companies={entry.participants} label="Participating Companies" />
                  </View>
                ) : null,
              )
            ) : (
              <ThemedText style={styles.sectionNote} themeColor="textSecondary" type="caption">
                No relationships yet.
              </ThemedText>
            )}
            <View style={[styles.webNote, { borderColor: theme.hairline }]}>
              <PlatformIcon color={theme.textSecondary} name="open-in-new" size={17} />
              <ThemedText style={styles.webNoteText} themeColor="textSecondary" type="caption">
                Profile editing, member administration, removal votes, migration, and archive
                administration are available on web in this release.
              </ThemedText>
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function ActingIdentityCard({
  company,
  role,
}: {
  company?: { displayName: string; status: string; _id: string } | null;
  role?: string;
}) {
  const theme = useTheme();
  const suspended = Boolean(company) && company?.status !== 'active';

  return (
    <View style={[styles.identity, { backgroundColor: theme.backgroundElement }]}>
      {company ? (
        <ColoredAvatar label={company.displayName} seed={company._id} shape="rounded" size={48} />
      ) : (
        <View style={[styles.identityIcon, { backgroundColor: theme.backgroundSelected }]}>
          <PlatformIcon color={theme.textSecondary} name="person" size={24} />
        </View>
      )}
      <View style={styles.identityBody}>
        <ThemedText themeColor="textSecondary" type="captionBold">
          Acting as
        </ThemedText>
        <ThemedText numberOfLines={1} type="subtitle">
          {company?.displayName ?? 'Personal / legacy Projects'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="caption">
          {company ? `${role} · ${company.status}` : 'No Company identity represented'}
        </ThemedText>
      </View>
      {suspended ? (
        <PlatformIcon color={theme.warning} name="alert-circle" size={20} />
      ) : company ? (
        <PlatformIcon color={theme.success} name="shield-check" size={20} />
      ) : null}
    </View>
  );
}

function CompanyChoice({
  detail,
  label,
  onPress,
  selected,
  suspended,
}: {
  detail?: string;
  label: string;
  onPress: () => void;
  selected: boolean;
  suspended?: boolean;
}) {
  const theme = useTheme();

  return (
    // See projects.tsx: a themed fill and a ripple on the same pressable share
    // one Android drawable that never repaints on a theme change.
    <View
      style={[
        styles.choice,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: selected ? theme.accent : 'transparent',
        },
      ]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        android_ripple={{ color: theme.backgroundSelected }}
        onPress={onPress}
        style={styles.choicePressable}>
        <ColoredAvatar label={label} shape="rounded" size={32} />
        <View style={styles.choiceBody}>
          <ThemedText numberOfLines={1} type="title">
            {label}
          </ThemedText>
          {detail ? (
            <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
              {detail}
            </ThemedText>
          ) : null}
        </View>
        {suspended ? <PlatformIcon color={theme.warning} name="alert-circle" size={19} /> : null}
        {selected ? <PlatformIcon color={theme.accent} name="check-circle" size={19} /> : null}
      </Pressable>
    </View>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <ThemedText type="titleLarge">{title}</ThemedText>
      {children}
    </View>
  );
}

/** Names the Companies that gain access, so consent is informed before it is given. */
function AudienceList({ companies, label }: { companies: NamedCompany[]; label: string }) {
  if (!companies.length) return null;

  return (
    <View style={styles.audience}>
      <ThemedText themeColor="textSecondary" type="captionBold">
        {label}
      </ThemedText>
      {companies.map((company) => (
        <View key={company._id ?? company.displayName} style={styles.audienceRow}>
          <ColoredAvatar
            label={company.displayName}
            seed={company._id}
            shape="rounded"
            size={24}
          />
          <ThemedText numberOfLines={1} style={styles.audienceName} type="caption">
            {company.displayName}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function InvitationCard({
  accept,
  audience,
  audienceLabel,
  decline,
  detail,
  invitedBy,
  title,
}: {
  accept: () => void;
  audience?: NamedCompany[];
  audienceLabel?: string;
  decline: () => void;
  detail: string;
  invitedBy?: string;
  title: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cardHeader}>
        <ColoredAvatar label={title} shape="rounded" size={36} />
        <View style={styles.cardHeading}>
          <ThemedText numberOfLines={2} type="title">
            {title}
          </ThemedText>
          {invitedBy ? (
            <ThemedText themeColor="textSecondary" type="caption">
              Invited by {invitedBy}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <ThemedText themeColor="textSecondary" type="caption">
        {detail}
      </ThemedText>
      {audience && audienceLabel ? (
        <AudienceList companies={audience} label={audienceLabel} />
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: theme.backgroundSelected }}
          onPress={accept}
          style={[styles.button, { backgroundColor: theme.text }]}>
          <ThemedText style={{ color: theme.background }} type="title">
            Accept
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: theme.backgroundSelected }}
          onPress={decline}
          style={[styles.button, { borderColor: theme.hairline, borderWidth: 1 }]}>
          <ThemedText type="title">Decline</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  audience: { gap: Spacing.one },
  audienceName: { flex: 1 },
  audienceRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  button: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    flex: 1,
    justifyContent: 'center',
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  card: { borderRadius: Radius.large, gap: Spacing.two, padding: Spacing.three },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  cardHeading: { flex: 1, gap: 2 },
  choice: {
    borderRadius: Radius.large,
    borderWidth: 1,
    overflow: 'hidden',
  },
  choiceBody: { flex: 1, gap: 2, minWidth: 0 },
  choicePressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: TouchTarget + 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six },
  identity: {
    alignItems: 'center',
    borderRadius: Radius.large,
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  identityBody: { flex: 1, gap: 2, minWidth: 0 },
  identityIcon: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  screen: { flex: 1 },
  section: { gap: Spacing.two },
  sectionNote: { lineHeight: 17 },
  webNote: {
    alignItems: 'flex-start',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
    padding: Spacing.three,
  },
  webNoteText: { flex: 1, lineHeight: 17 },
});
