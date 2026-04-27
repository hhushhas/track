import { demoGroups, demoMessages, demoMetrics, demoProject } from '@track/shared';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ThreadScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
          <View>
            <ThemedText type="code" themeColor="textSecondary">
              {demoProject.clientLabel}
            </ThemedText>
            <ThemedText type="subtitle">{demoProject.name}</ThemedText>
          </View>
          <Pressable style={[styles.reviewButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={styles.reviewText}>
              Run Review
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.groupRail}
            showsHorizontalScrollIndicator={false}>
            {demoGroups.map((group) => (
              <ThemedView
                key={group.id}
                type="backgroundElement"
                style={[styles.groupPill, { borderColor: theme.hairline }]}>
                <ThemedText type="smallBold">{group.name}</ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {group.visibility}
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>

          <View style={styles.metrics}>
            {demoMetrics.map((metric) => (
              <ThemedView
                key={metric.label}
                type="backgroundElement"
                style={[styles.metric, { borderColor: theme.hairline }]}>
                <ThemedText type="subtitle">{metric.value}</ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {metric.label}
                </ThemedText>
              </ThemedView>
            ))}
          </View>

          <View style={styles.messages}>
            {demoMessages.map((message) => (
              <ThemedView
                key={message.id}
                type={message.tone === 'ai' ? 'backgroundSelected' : 'backgroundElement'}
                style={[styles.message, { borderColor: theme.hairline }]}>
                <View style={styles.messageMeta}>
                  <ThemedText type="smallBold">{message.author}</ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {message.role} · {message.time}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {message.body}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.composer, { borderTopColor: theme.hairline }]}>
          <TextInput
            placeholder="Message General or ask @track..."
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                borderColor: theme.hairline,
                color: theme.text,
                backgroundColor: theme.background,
              },
            ]}
          />
          <Pressable style={[styles.sendButton, { backgroundColor: theme.text }]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Send
            </ThemedText>
          </Pressable>
        </View>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  reviewButton: {
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reviewText: {
    color: '#1b1917',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  groupRail: {
    gap: Spacing.two,
  },
  groupPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 132,
    gap: Spacing.one,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metric: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    minWidth: '47%',
  },
  messages: {
    gap: Spacing.three,
  },
  message: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  composer: {
    borderTopWidth: 1,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
  },
  sendButton: {
    minHeight: 40,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
});
