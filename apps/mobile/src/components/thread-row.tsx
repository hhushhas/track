import { parseMentions } from '@track/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

export type DetailedMessage = {
  message: Doc<'messages'>;
  author: Doc<'users'> | null;
  authorRole?: Doc<'projectMembers'>['role'] | null;
  authorCompany?: { companyId: Id<'companies'>; displayName: string } | null;
  attachments: Array<{ attachment: Doc<'attachments'>; url: string | null }>;
  replyTo?: { messageId: Id<'messages'>; authorName: string; body: string; createdAt: number } | null;
  channelThread?: {
    threadId: Id<'channelThreads'>;
    name: string;
    status: 'active' | 'archived';
    replyCount: number;
    latestReplyAt: number | null;
  } | null;
};

export type ThreadItem =
  | { kind: 'message'; key: string; at: number; item: DetailedMessage }
  | { kind: 'assistant'; key: string; at: number; stream: Doc<'assistantStreams'> };

export type GroupedThreadItem =
  | { kind: 'message'; key: string; at: number; item: DetailedMessage; isFirstInGroup: boolean }
  | { kind: 'assistant'; key: string; at: number; stream: Doc<'assistantStreams'>; isFirstInGroup: boolean }
  | { kind: 'date-sep'; key: string; at: number; label: string };

export type ProjectMemberRow = { membership: Doc<'projectMembers'>; user: Doc<'users'> | null };

type Props = {
  item: Exclude<GroupedThreadItem, { kind: 'date-sep' }>;
  isFirstInGroup: boolean;
  isOwnMessage?: boolean;
  onLongPress: () => void;
  onSwipeReply?: () => void;
};

function AnimatedDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withTiming(1, { duration: 400 }), -1, true));
  }, [delay, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, style]} />;
}

function AnimatedDots() {
  return (
    <View style={styles.dotsRow}>
      <AnimatedDot delay={0} />
      <AnimatedDot delay={200} />
      <AnimatedDot delay={400} />
    </View>
  );
}

function HighlightedText({ body }: { body: string }) {
  const theme = useTheme();
  const parts = body.split(/(@\w+)/g);
  return (
    <ThemedText type="small">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <ThemedText key={i} style={{ color: theme.accent, fontWeight: '600' }} type="small">
            {part}
          </ThemedText>
        ) : (
          part
        )
      )}
    </ThemedText>
  );
}

export function ThreadRow({ item, isFirstInGroup, isOwnMessage, onLongPress, onSwipeReply }: Props) {
  const theme = useTheme();
  const translateX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX, 80);
      }
    })
    .onEnd((e) => {
      if (e.translationX > 60 && onSwipeReply) {
        translateX.value = withSpring(0, { damping: 20 });
        runOnJS(onSwipeReply)();
      } else {
        translateX.value = withSpring(0, { damping: 20 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 60], [0, 1], 'clamp'),
  }));

  const rowStyle = [
    styles.row,
    !isFirstInGroup && styles.rowGrouped,
  ];

  function renderContent() {
    if (item.kind === 'assistant') {
      return (
        <Pressable hitSlop={4} onLongPress={onLongPress} style={rowStyle}>
          {isFirstInGroup ? (
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <ThemedText style={[styles.avatarLabel, { color: '#1b1917' }]}>T</ThemedText>
            </View>
          ) : (
            <View style={styles.avatarSpacer} />
          )}
          <View style={styles.body}>
            {isFirstInGroup && (
              <View style={styles.meta}>
                <ThemedText type="smallBold">Track Assistant</ThemedText>
                <ThemedText style={{ color: theme.textSecondary }} type="code">
                  {fmtTime(item.stream.createdAt)}
                </ThemedText>
              </View>
            )}
            {(item.stream.status === 'queued' || item.stream.status === 'running') && !item.stream.answer ? (
              <View style={styles.thinkingWrap}>
                <AnimatedDots />
                <ThemedText style={styles.thinkingLabel} themeColor="textSecondary" type="code">
                  Track is thinking…
                </ThemedText>
              </View>
            ) : (
              <HighlightedText body={item.stream.answer || item.stream.status} />
            )}
            {item.stream.evidence.length > 0 ? (
              <View style={styles.evidenceRow}>
                {item.stream.evidence.slice(0, 3).map((_, i) => (
                  <View key={i} style={[styles.evidenceChip, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText style={{ color: theme.accent }} type="code">Source {i + 1}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>
      );
    }

    const name = item.item.author?.displayName ?? 'Member';
    const authorId = item.item.author?._id ?? name;
    return (
      <Pressable hitSlop={4} onLongPress={onLongPress} style={rowStyle}>
        {isFirstInGroup ? (
          <ColoredAvatar label={name} seed={authorId} size={36} />
        ) : (
          <View style={styles.avatarSpacer} />
        )}
        <View style={[
          styles.messageSurface,
          { backgroundColor: isOwnMessage ? theme.backgroundSelected : theme.backgroundElement },
          !isFirstInGroup && styles.messageSurfaceGrouped,
        ]}>
          <View style={styles.body}>
            {isFirstInGroup && (
              <View style={styles.meta}>
                <View style={styles.metaLeft}>
                <ThemedText numberOfLines={1} style={styles.authorName} type="smallBold">{name}</ThemedText>
                  {item.item.authorRole ? (
                    <View style={[styles.roleChip, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText numberOfLines={1} style={{ color: theme.textSecondary }} type="code">
                        {item.item.authorRole}
                      </ThemedText>
                    </View>
                  ) : null}
                  {item.item.authorCompany ? (
                    <View style={[styles.roleChip, { backgroundColor: theme.accentSoft }]}>
                      <ThemedText numberOfLines={1} style={{ color: theme.accent }} type="code">
                        {item.item.authorCompany.displayName}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={{ color: theme.textSecondary }} type="code">
                  {fmtTime(item.item.message.createdAt)}
                </ThemedText>
              </View>
            )}

            {item.item.replyTo ? (
              <View style={[styles.quote, { borderLeftColor: theme.accent }]}>
                <ThemedText style={{ color: theme.textSecondary }} type="code">
                  {item.item.replyTo.authorName}
                </ThemedText>
                <ThemedText numberOfLines={2} type="small">{item.item.replyTo.body}</ThemedText>
              </View>
            ) : null}

            <HighlightedText body={item.item.message.body} />

            {item.item.channelThread ? (
              <View style={[styles.threadChip, { backgroundColor: theme.accentSoft }]}>
                <PlatformIcon color={theme.accent} name="forum-outline" size={14} />
                <ThemedText numberOfLines={1} style={{ color: theme.accent }} type="code">
                  {item.item.channelThread.name} · {item.item.channelThread.replyCount} {item.item.channelThread.replyCount === 1 ? 'reply' : 'replies'}
                </ThemedText>
              </View>
            ) : null}

            {item.item.attachments.map(({ attachment, url }) =>
              attachment.kind === 'voice_note' && url ? (
                <VoiceRow attachment={attachment} key={attachment._id} url={url} />
              ) : (
                <View key={attachment._id} style={[styles.fileChip, { backgroundColor: theme.backgroundElement }]}>
                  <PlatformIcon color={theme.textSecondary} name="paperclip" size={14} />
                  <ThemedText numberOfLines={1} style={{ color: theme.textSecondary }} type="code">
                    {attachment.filename}
                  </ThemedText>
                </View>
              )
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.swipeContainer}>
        <Animated.View style={[styles.replyIconContainer, replyIconStyle]}>
          <PlatformIcon color={theme.accent} name="arrow-up" size={20} />
        </Animated.View>
        <Animated.View style={animatedStyle}>
          {renderContent()}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export function DateSeparator({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.dateSep}>
      <ThemedText style={[styles.dateSepLabel, { color: theme.textSecondary }]} type="code">
        {label.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function VoiceRow({ attachment, url }: { attachment: Doc<'attachments'>; url: string }) {
  const theme = useTheme();
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  return (
    <Pressable
      android_ripple={{ color: theme.backgroundSelected }}
      hitSlop={4}
      onPress={() => {
        hapticLight();
        if (playing) {
          player.pause();
        } else {
          player.play();
        }
      }}
      style={[styles.voiceChip, { backgroundColor: theme.accentSoft }]}>
      <PlatformIcon color={theme.accent} name={playing ? 'stop' : 'microphone-outline'} size={16} />
      <ThemedText style={{ color: theme.accent }} type="code">
        {attachment.durationMs ? `${Math.round(attachment.durationMs / 1000)}s voice note` : 'Voice note'}
      </ThemedText>
    </Pressable>
  );
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function resolveMentionIds(body: string, members: ProjectMemberRow[]) {
  const tokens = parseMentions(body).filter((t) => t !== 'track');
  if (!tokens.length) return [];
  const tokenSet = new Set(tokens.map(norm));
  const ids = new Set<Id<'users'>>();
  for (const { user } of members) {
    if (!user) continue;
    const keys = new Set(
      [user.displayName, user.email, user.email?.split('@')[0]]
        .filter(Boolean)
        .map((v) => norm(String(v))),
    );
    if ([...keys].some((k) => tokenSet.has(k))) ids.add(user._id);
  }
  return [...ids];
}

function norm(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

const styles = StyleSheet.create({
  avatarLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 36 },
  avatar: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  avatarSpacer: { width: 36 },
  dot: { backgroundColor: '#f0b100', borderRadius: 3, height: 6, width: 6 },
  dotsRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  thinkingLabel: { marginTop: 2 },
  thinkingWrap: { gap: 4 },
  threadChip: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two, maxWidth: '100%', paddingHorizontal: Spacing.two, paddingVertical: 4 },
  body: { flex: 1, gap: 4, minWidth: 0 },
  dateSep: { alignItems: 'center', marginVertical: Spacing.four, paddingHorizontal: Spacing.four },
  dateSepLabel: { fontSize: 11, letterSpacing: 0.5 },
  evidenceChip: { borderRadius: 6, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  authorName: { flexShrink: 1, minWidth: 0 },
  fileChip: {
    alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8,
    flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two,
    paddingHorizontal: Spacing.two, paddingVertical: 4,
  },
  messageSurface: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 4,
  },
  messageSurfaceGrouped: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  meta: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between', minWidth: 0 },
  metaLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', flexShrink: 1, gap: Spacing.two, minWidth: 0 },
  quote: {
    borderLeftWidth: 3, borderRadius: 4, gap: 2,
    marginTop: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: 4,
  },
  roleChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  row: {
    flexDirection: 'row', gap: Spacing.three,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
  },
  rowGrouped: { paddingVertical: Spacing.one },
  replyIconContainer: { position: 'absolute', left: Spacing.three, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', width: 40 },
  swipeContainer: { position: 'relative' },
  voiceChip: {
    alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8,
    flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: 6,
  },
});
