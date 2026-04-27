import { demoGroups, demoMessages, demoMetrics, demoProject } from '@track/shared';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const notificationModes = ['inherit', 'all', 'mentions', 'none'] as const;

type ThreadMessage = {
  id: string;
  author: string;
  role: string;
  body: string;
  time: string;
  tone: 'client' | 'staff' | 'ai';
};

export default function ThreadScreen() {
  const theme = useTheme();
  const [activeGroupId, setActiveGroupId] = useState<string>(demoGroups[0]?.id ?? '');
  const [composer, setComposer] = useState('');
  const [messages, setMessages] = useState<ThreadMessage[]>([...demoMessages]);
  const [notificationMode, setNotificationMode] =
    useState<(typeof notificationModes)[number]>('mentions');

  const activeGroup = demoGroups.find((group) => group.id === activeGroupId) ?? demoGroups[0];
  const metrics = useMemo(
    () => [...demoMetrics, { label: 'Notify', value: notificationMode }],
    [notificationMode],
  );

  function sendMessage() {
    const body = composer.trim();
    if (!body) return;
    const trackQuestion = body.toLowerCase().includes('@track');
    setMessages((current) => [
      ...current,
      {
        id: `mobile-msg-${Date.now()}`,
        author: 'Hasan',
        role: 'owner',
        body,
        time: 'now',
        tone: 'staff',
      },
      ...(trackQuestion
        ? [
            {
              id: `mobile-track-${Date.now()}`,
              author: 'Track Assistant',
              role: 'system',
              body: 'Yes. The current thread supports that with client request and vendor confirmation evidence.',
              time: 'now',
              tone: 'ai',
            } as const,
          ]
        : []),
    ]);
    setComposer('');
  }

  function runReview() {
    setMessages((current) => [
      ...current,
      {
        id: `mobile-review-${Date.now()}`,
        author: 'Track AI Review',
        role: 'system',
        body: 'Draft Record proposed: latest scope and export discussion needs review.',
        time: 'now',
        tone: 'ai',
      },
    ]);
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
          <View style={styles.headerTitle}>
            <ThemedText type="code" themeColor="textSecondary">
              {demoProject.clientLabel}
            </ThemedText>
            <ThemedText type="subtitle">{demoProject.name}</ThemedText>
          </View>
          <Pressable style={[styles.reviewButton, { backgroundColor: theme.accent }]} onPress={runReview}>
            <ThemedText type="smallBold" style={styles.reviewText}>
              Review
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
            {demoGroups.map((group) => {
              const selected = group.id === activeGroupId;
              return (
                <Pressable key={group.id} onPress={() => setActiveGroupId(group.id)}>
                  <ThemedView
                    type={selected ? 'backgroundSelected' : 'backgroundElement'}
                    style={[
                      styles.groupPill,
                      { borderColor: selected ? theme.accent : theme.hairline },
                    ]}>
                    <ThemedText type="smallBold">{group.name}</ThemedText>
                    <ThemedText type="code" themeColor="textSecondary">
                      {group.visibility}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.metrics}>
            {metrics.map((metric) => (
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

          <ThemedView type="backgroundElement" style={[styles.settings, { borderColor: theme.hairline }]}>
            <ThemedText type="code" themeColor="textSecondary">
              {activeGroup?.name} Notifications
            </ThemedText>
            <View style={styles.modeGrid}>
              {notificationModes.map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setNotificationMode(mode)}
                  style={[
                    styles.modeButton,
                    {
                      borderColor: mode === notificationMode ? theme.accent : theme.hairline,
                      backgroundColor: mode === notificationMode ? theme.accentSoft : theme.background,
                    },
                  ]}>
                  <ThemedText type="code">{mode}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <View style={styles.messages}>
            {messages.map((message) => (
              <ThemedView
                key={message.id}
                type={message.tone === 'ai' ? 'backgroundSelected' : 'backgroundElement'}
                style={[
                  styles.message,
                  { borderColor: message.tone === 'ai' ? theme.accent : theme.hairline },
                ]}>
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
          <Pressable style={[styles.attachButton, { borderColor: theme.hairline }]}>
            <ThemedText type="smallBold">+</ThemedText>
          </Pressable>
          <TextInput
            onChangeText={setComposer}
            onSubmitEditing={sendMessage}
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
            value={composer}
          />
          <Pressable onPress={sendMessage} style={[styles.sendButton, { backgroundColor: theme.text }]}>
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
  headerTitle: {
    flex: 1,
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
    minWidth: 136,
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
    width: '47%',
  },
  settings: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  modeButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
  attachButton: {
    minHeight: 40,
    minWidth: 40,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
