import { Stack } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { useCompany } from "@/contexts/company-context";
import { useTrackUser } from "@/contexts/track-user-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing, TouchTarget } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function CompanyScreen() {
  const theme = useTheme();
  const { trackUserId } = useTrackUser();
  const {
    actingCompanyId,
    companies,
    companyModelEnabled,
    setActingCompanyId,
  } = useCompany();
  const actingCompany = companies?.find(
    ({ company }) => company?._id === actingCompanyId,
  );
  const canAdministerActingCompany =
    actingCompany?.membership.role === "owner" ||
    actingCompany?.membership.role === "admin";
  const companyInvitations = useQuery(
    api.companies.listPendingForMe,
    companyModelEnabled ? {} : "skip",
  );
  const relationshipInvitations = useQuery(
    api.relationships.listInvitations,
    actingCompanyId && canAdministerActingCompany
      ? { actingCompanyId }
      : "skip",
  );
  const projectInvitations = useQuery(
    api.sharedProjects.listInvitations,
    actingCompanyId && canAdministerActingCompany
      ? { actingCompanyId }
      : "skip",
  );
  const relationships = useQuery(
    api.relationships.listMine,
    actingCompanyId && canAdministerActingCompany
      ? { actingCompanyId }
      : "skip",
  );
  const decideCompanyInvitation = useMutation(api.companies.decideInvitation);
  const decideRelationshipInvitation = useMutation(
    api.relationships.decideInvitation,
  );
  const decideProjectInvitation = useMutation(
    api.sharedProjects.decideInvitation,
  );

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      Alert.alert(success);
    } catch {
      Alert.alert(
        "Action unavailable",
        "Your authority or the invitation changed. Refresh and try again.",
      );
    }
  }

  if (!companyModelEnabled)
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ title: "Companies" }} />
        <View style={styles.empty}>
          <ThemedText type="subtitle">
            Company collaboration is disabled
          </ThemedText>
          <ThemedText>
            This server has not enabled the Company release.
          </ThemedText>
        </View>
      </ThemedView>
    );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: "Companies" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">Acting Company</ThemedText>
        <ThemedText style={{ color: theme.textSecondary }} type="small">
          Choose the identity represented by Project and Channel actions.
          Company membership alone never grants content.
        </ThemedText>
        <Choice
          label="Personal / legacy Projects"
          onPress={() => setActingCompanyId(null)}
          selected={!actingCompanyId}
        />
        {(companies ?? []).map(({ company, membership }) =>
          company ? (
            <Choice
              key={company._id}
              label={`${company.displayName} · ${membership.role}${company.status !== "active" ? ` · ${company.status}` : ""}`}
              onPress={() =>
                company.status === "active"
                  ? setActingCompanyId(company._id)
                  : Alert.alert(
                      "Company suspended",
                      "An owner can reactivate this Company from the web administration surface.",
                    )
              }
              selected={company._id === actingCompanyId}
            />
          ) : null,
        )}

        {(companyInvitations ?? []).length ? (
          <Section title="Company invitations">
            {companyInvitations?.map(({ company, invitation }) => (
              <Invitation
                key={invitation._id}
                title={company?.displayName ?? "Company"}
                detail={`Join as ${invitation.role}`}
                accept={() =>
                  run(
                    () =>
                      decideCompanyInvitation({
                        invitationId: invitation._id,
                        decision: "accept",
                      }),
                    "Company joined",
                  )
                }
                decline={() =>
                  run(
                    () =>
                      decideCompanyInvitation({
                        invitationId: invitation._id,
                        decision: "decline",
                      }),
                    "Invitation declined",
                  )
                }
              />
            ))}
          </Section>
        ) : null}

        {actingCompanyId && (relationshipInvitations ?? []).length ? (
          <Section title="Relationship invitations">
            {relationshipInvitations?.map(
              ({ invitation, invitingCompany, relationship, participants }) => (
                <Invitation
                  key={invitation._id}
                  title={relationship?.name ?? "Relationship"}
                  detail={`${invitingCompany?.displayName ?? "A Company"} invited ${participants.map((company) => company.displayName).join(", ")}`}
                  accept={() =>
                    run(
                      () =>
                        decideRelationshipInvitation({
                          actingCompanyId,
                          invitationId: invitation._id,
                          decision: "accept",
                        }),
                      "Relationship joined",
                    )
                  }
                  decline={() =>
                    run(
                      () =>
                        decideRelationshipInvitation({
                          actingCompanyId,
                          invitationId: invitation._id,
                          decision: "decline",
                        }),
                      "Invitation declined",
                    )
                  }
                />
              ),
            )}
          </Section>
        ) : null}

        {actingCompanyId && trackUserId && (projectInvitations ?? []).length ? (
          <Section title="Shared Project invitations">
            {projectInvitations?.map(
              ({ invitation, invitingCompany, project }) => (
                <Invitation
                  key={invitation._id}
                  title={project?.name ?? "Shared Project"}
                  detail={`${invitingCompany?.displayName ?? "A Company"} will gain only the confirmed General Channel audience.`}
                  accept={() =>
                    run(
                      () =>
                        decideProjectInvitation({
                          actingCompanyId,
                          invitationId: invitation._id,
                          decision: "accept",
                          initialMembers: [
                            { userId: trackUserId, role: "manager" },
                          ],
                        }),
                      "Project joined",
                    )
                  }
                  decline={() =>
                    run(
                      () =>
                        decideProjectInvitation({
                          actingCompanyId,
                          invitationId: invitation._id,
                          decision: "decline",
                          initialMembers: [],
                        }),
                      "Invitation declined",
                    )
                  }
                />
              ),
            )}
          </Section>
        ) : null}

        {actingCompanyId ? (
          <Section title="Relationships">
            {(relationships ?? []).map(({ relationship, participants }) => (
              <View
                key={relationship._id}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText type="smallBold">{relationship.name}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary }} type="small">
                  {participants
                    .map((company) => company.displayName)
                    .join(" · ")}
                </ThemedText>
              </View>
            ))}
            <ThemedText style={{ color: theme.textSecondary }} type="small">
              Profile editing, member administration, removal votes, migration,
              and archive administration are available on web in this release.
            </ThemedText>
          </Section>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function Choice({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected
            ? theme.backgroundSelected
            : theme.backgroundElement,
        },
      ]}
    >
      <ThemedText type="smallBold">
        {selected ? "✓ " : ""}
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {children}
    </View>
  );
}

function Invitation({
  accept,
  decline,
  detail,
  title,
}: {
  accept: () => void;
  decline: () => void;
  detail: string;
  title: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText style={{ color: theme.textSecondary }} type="small">
        {detail}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable
          onPress={accept}
          style={[styles.button, { backgroundColor: theme.text }]}
        >
          <ThemedText style={{ color: theme.background }} type="smallBold">
            Accept
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={decline}
          style={[
            styles.button,
            { borderColor: theme.hairline, borderWidth: 1 },
          ]}
        >
          <ThemedText type="smallBold">Decline</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.two },
  button: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  card: { borderRadius: 10, gap: Spacing.two, padding: Spacing.three },
  choice: {
    borderRadius: 10,
    justifyContent: "center",
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  content: { gap: Spacing.three, padding: Spacing.three },
  empty: { gap: Spacing.two, padding: Spacing.four },
  screen: { flex: 1 },
  section: { gap: Spacing.two, marginTop: Spacing.three },
});
