import { demoAuditEvents, demoRecords } from '@track/shared';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function RecordScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
          <ThemedText type="code" themeColor="textSecondary">
            Project Record
          </ThemedText>
          <ThemedText type="subtitle">Reviewed evidence</ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          {demoRecords.map((record) => (
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
    gap: Spacing.one,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
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
  audit: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  auditItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
  },
});
