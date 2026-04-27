import { demoAuditEvents, demoRecords } from '@track/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DraftRecord = {
  id: string;
  title: string;
  type: string;
  evidence: string;
  status: 'pending' | 'accepted' | 'declined';
};

type ProjectRecord = {
  id: string;
  type: string;
  title: string;
  classification: string;
  status: string;
  owner: string;
  evidence: readonly string[] | string[];
};

export default function RecordScreen() {
  const theme = useTheme();
  const [inviteEmail, setInviteEmail] = useState('');
  const [drafts, setDrafts] = useState<DraftRecord[]>([
    {
      id: 'DR-208',
      title: 'Invoice audit trail in export',
      type: 'scope_change',
      evidence: 'Amina requested invoice audit trail inclusion.',
      status: 'pending',
    },
    {
      id: 'DR-207',
      title: 'Client summary PDF separate from full audit packet',
      type: 'decision',
      evidence: 'Hasan confirmed the export split in General.',
      status: 'pending',
    },
  ]);
  const [records, setRecords] = useState<ProjectRecord[]>([...demoRecords]);

  function acceptDraft(draftId: string, classification: string) {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    setDrafts((current) =>
      current.map((item) => (item.id === draftId ? { ...item, status: 'accepted' } : item)),
    );
    setRecords((current) => [
      {
        id: draft.id.replace('DR', 'REC'),
        type: draft.type,
        title: draft.title,
        classification,
        status: 'accepted',
        owner: 'Hasan Shoaib',
        evidence: [draft.evidence],
      },
      ...current,
    ]);
  }

  const pendingDrafts = drafts.filter((draft) => draft.status === 'pending');

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
          <View>
            <ThemedText type="code" themeColor="textSecondary">
              Project Record
            </ThemedText>
            <ThemedText type="subtitle">Reviewed evidence</ThemedText>
          </View>
          <Pressable style={[styles.exportButton, { backgroundColor: theme.text }]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Export
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={[styles.panel, { borderColor: theme.hairline }]}>
            <ThemedText type="code" themeColor="textSecondary">
              Invite
            </ThemedText>
            <View style={styles.inviteRow}>
              <TextInput
                onChangeText={setInviteEmail}
                placeholder="person@client.com"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.inviteInput,
                  {
                    borderColor: theme.hairline,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
                value={inviteEmail}
              />
              <Pressable style={[styles.inviteButton, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={{ color: '#1b1917' }}>
                  Send
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <View style={styles.section}>
            <ThemedText type="code" themeColor="textSecondary">
              Review Drafts
            </ThemedText>
            {pendingDrafts.map((draft) => (
              <ThemedView
                key={draft.id}
                type="backgroundElement"
                style={[styles.record, { borderColor: theme.hairline }]}>
                <View style={styles.recordMeta}>
                  <ThemedText type="code" themeColor="textSecondary">
                    {draft.id}
                  </ThemedText>
                  <ThemedView style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText type="code">{draft.type}</ThemedText>
                  </ThemedView>
                </View>
                <ThemedText type="smallBold">{draft.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {draft.evidence}
                </ThemedText>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => acceptDraft(draft.id, 'billable_scope')}
                    style={[styles.actionButton, { borderColor: theme.hairline }]}>
                    <ThemedText type="code">Billable</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => acceptDraft(draft.id, 'official_record')}
                    style={[styles.actionButton, { borderColor: theme.hairline }]}>
                    <ThemedText type="code">Official</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setDrafts((current) =>
                        current.map((item) =>
                          item.id === draft.id ? { ...item, status: 'declined' } : item,
                        ),
                      )
                    }
                    style={[styles.actionButton, { borderColor: theme.hairline }]}>
                    <ThemedText type="code">Decline</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            ))}
          </View>

          <View style={styles.section}>
            <ThemedText type="code" themeColor="textSecondary">
              Accepted Record
            </ThemedText>
            {records.map((record) => (
              <ThemedView
                key={record.id}
                type="backgroundElement"
                style={[styles.record, { borderColor: theme.hairline }]}>
                <View style={styles.recordMeta}>
                  <ThemedText type="code" themeColor="textSecondary">
                    {record.id}
                  </ThemedText>
                  <ThemedView style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText type="code">{record.classification}</ThemedText>
                  </ThemedView>
                </View>
                <ThemedText type="smallBold">{record.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {record.type} · {record.status} · {record.owner}
                </ThemedText>
              </ThemedView>
            ))}
          </View>

          <View style={styles.audit}>
            <ThemedText type="code" themeColor="textSecondary">
              Audit Trail
            </ThemedText>
            {demoAuditEvents.map((event) => (
              <ThemedView
                key={event}
                type="backgroundElement"
                style={[styles.auditItem, { borderColor: theme.hairline }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {event}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  exportButton: {
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inviteInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
  },
  inviteButton: {
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  record: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  audit: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  auditItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
  },
});
