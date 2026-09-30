import { parseMentions } from '@track/shared';
import type { FunctionReturnType } from 'convex/server';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { AssistantMessage } from '@/components/chat/assistant-message';
import { MessageBubble } from '@/components/chat/message-bubble';
import type { DetailedMessage } from '@/components/chat/types';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { messageSwipeIntent } from '@/lib/message-swipe';

export type { AttachmentWithUrl, DetailedMessage } from '@/components/chat/types';

export type ThreadItem =
  | { kind: 'message'; key: string; at: number; item: DetailedMessage }
  | { kind: 'assistant'; key: string; at: number; stream: Doc<'assistantStreams'> };

export type GroupedThreadItem =
  | { kind: 'message'; key: string; at: number; item: DetailedMessage; isFirstInGroup: boolean }
  | { kind: 'assistant'; key: string; at: number; stream: Doc<'assistantStreams'>; isFirstInGroup: boolean }
  | { kind: 'date-sep'; key: string; at: number; label: string };

export type ProjectMemberRow = FunctionReturnType<typeof api.mobile.listProjectMembersPage>['page'][number];

const SWIPE_LIMIT = 72;
const SWIPE_THRESHOLD = 56;
const SWIPE_ACTION_WIDTH = 112;

type Props = {
  item: Exclude<GroupedThreadItem, { kind: 'date-sep' }>;
  isFirstInGroup: boolean;
  isOwnMessage?: boolean;
  onLongPress: () => void;
  /** Opens the source of a forwarded snapshot when still authorized. */
  onOpenForwardSource?: () => void;
  /** Opens the Channel thread attached to this message. */
  onOpenThread?: () => void;
  /** Jumps to the message this one quotes. */
  onPressReply?: () => void;
  onSwipeReply?: () => void;
  onSwipeForward?: () => void;
  onSwipeReport?: () => void;
  variant?: 'conversation' | 'thread';
};

export function ThreadRow({
  item,
  isFirstInGroup,
  isOwnMessage,
  onLongPress,
  onOpenForwardSource,
  onOpenThread,
  onPressReply,
  onSwipeReply,
  onSwipeForward,
  onSwipeReport,
  variant = 'conversation',
}: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [actionsExposed, setActionsExposed] = useState(false);
  const translateX = useSharedValue(0);
  const trayOpenAtStart = useSharedValue(false);
  const hasSwipeActions = item.kind === 'message' && Boolean(onSwipeForward && onSwipeReport);

  const gesture = Gesture.Pan()
    .enabled(Boolean(onSwipeReply || hasSwipeActions))
    .activeOffsetX([-10, 10])
    .onBegin(() => {
      trayOpenAtStart.value = translateX.value <= -SWIPE_THRESHOLD;
    })
    .onUpdate((e) => {
      if (trayOpenAtStart.value) {
        translateX.value = Math.min(0, -SWIPE_ACTION_WIDTH + e.translationX);
      } else if (e.translationX > 0) {
        translateX.value = onSwipeReply ? Math.min(e.translationX, SWIPE_LIMIT) : 0;
      } else if (hasSwipeActions) {
        translateX.value = Math.max(e.translationX, -SWIPE_ACTION_WIDTH);
      } else {
        translateX.value = 0;
      }
    })
    .onEnd((e) => {
      const intent = messageSwipeIntent(e.translationX, Boolean(onSwipeReply), hasSwipeActions, trayOpenAtStart.value);
      if (intent === 'actions') {
        scheduleOnRN(setActionsExposed, true);
        translateX.value = reducedMotion ? -SWIPE_ACTION_WIDTH : withSpring(-SWIPE_ACTION_WIDTH, { damping: 22, stiffness: 240 });
      } else if (intent === 'reply' && onSwipeReply) {
        scheduleOnRN(setActionsExposed, false);
        scheduleOnRN(onSwipeReply);
        translateX.value = reducedMotion ? 0 : withSpring(0, { damping: 20 });
      } else {
        scheduleOnRN(setActionsExposed, false);
        translateX.value = reducedMotion ? 0 : withSpring(0, { damping: 20 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0.7, 1], 'clamp') }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(Math.min(translateX.value, 0)), [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(Math.abs(Math.min(translateX.value, 0)), [0, SWIPE_THRESHOLD], [0.88, 1], 'clamp') }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.swipeContainer}>
        <Animated.View style={[styles.replyHint, replyIconStyle]}>
          <View style={[styles.replyHintBadge, { backgroundColor: theme.backgroundElement }]}>
            <PlatformIcon color={theme.textSecondary} name="reply" size={16} />
          </View>
        </Animated.View>
        {hasSwipeActions ? <Animated.View accessibilityElementsHidden={!actionsExposed} importantForAccessibility={actionsExposed ? 'auto' : 'no-hide-descendants'} style={[styles.messageActions, actionsStyle]}>
          <Pressable accessibilityHint="Opens Channel selection to forward this message" accessibilityLabel="Forward message" accessibilityRole="button" onPress={() => {
            setActionsExposed(false);
            translateX.value = reducedMotion ? 0 : withSpring(0, { damping: 20 });
            onSwipeForward?.();
          }} style={({ pressed }) => [styles.swipeAction, { backgroundColor: pressed ? theme.backgroundSelected : theme.accentSoft }]}>
            <PlatformIcon color={theme.accentStrong} name="forward" size={19} weight="regular" />
          </Pressable>
          <Pressable accessibilityHint="Choose a reason to report this message" accessibilityLabel="Report message" accessibilityRole="button" onPress={() => {
            setActionsExposed(false);
            translateX.value = reducedMotion ? 0 : withSpring(0, { damping: 20 });
            onSwipeReport?.();
          }} style={({ pressed }) => [styles.swipeAction, { backgroundColor: pressed ? theme.backgroundSelected : theme.dangerSoft }]}>
            <PlatformIcon color={theme.danger} name="flag" size={19} weight="regular" />
          </Pressable>
        </Animated.View> : null}
        <Animated.View style={[
          isFirstInGroup ? (variant === 'thread' ? styles.threadGroupStart : styles.groupStart) : styles.grouped,
          animatedStyle,
        ]}>
          {item.kind === 'assistant' ? (
            <AssistantMessage
              isFirstInGroup={isFirstInGroup}
              onLongPress={onLongPress}
              stream={item.stream}
              timeLabel={fmtTime(item.stream.createdAt)}
            />
          ) : (
            <MessageBubble
              isFirstInGroup={isFirstInGroup}
              isOwnMessage={Boolean(isOwnMessage)}
              message={item.item}
              onLongPress={onLongPress}
              onOpenForwardSource={onOpenForwardSource}
              onOpenThread={onOpenThread}
              onPressReply={onPressReply}
              timeLabel={fmtTime(item.item.message.createdAt)}
              variant={variant}
            />
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export function DateSeparator({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.dateSep}>
      <View style={[styles.dateSepPill, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText themeColor="textSecondary" type="captionBold">
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function resolveMentionIds(body: string, members: ProjectMemberRow[]) {
  return resolveMentionMembers(body, members).map((member) => member.userId);
}

export function resolveMentionProjectMemberIds(body: string, members: ProjectMemberRow[]) {
  return resolveMentionMembers(body, members).map((member) => member.projectMemberId);
}

function resolveMentionMembers(body: string, members: ProjectMemberRow[]) {
  const tokens = parseMentions(body).filter((t) => t !== 'track');
  if (!tokens.length) return [];
  const tokenSet = new Set(tokens.map(norm));
  const matches = new Map<string, Array<{ projectMemberId: Id<'projectMembers'>; userId: Id<'users'> }>>();
  for (const { membership, user } of members) {
    if (!user) continue;
    const keys = new Set([norm(user.displayName)]);
    for (const key of keys) {
      if (!tokenSet.has(key)) continue;
      matches.set(key, [
        ...(matches.get(key) ?? []),
        { projectMemberId: membership._id, userId: user._id },
      ]);
    }
  }
  const resolved = new Map<string, { projectMemberId: Id<'projectMembers'>; userId: Id<'users'> }>();
  for (const candidates of matches.values()) {
    if (candidates.length === 1) resolved.set(String(candidates[0].projectMemberId), candidates[0]);
  }
  return [...resolved.values()];
}

function norm(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

const styles = StyleSheet.create({
  dateSep: {
    alignItems: 'center',
    marginVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  dateSepPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  groupStart: {
    paddingTop: Spacing.three,
  },
  grouped: {
    paddingTop: 2,
  },
  replyHint: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: Spacing.two,
    position: 'absolute',
    top: 0,
    width: 32,
  },
  replyHintBadge: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  messageActions: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.one,
    justifyContent: 'flex-end',
    paddingRight: Spacing.two,
    position: 'absolute',
    right: 0,
    top: 0,
    width: SWIPE_ACTION_WIDTH,
  },
  swipeAction: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  swipeContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  threadGroupStart: {
    paddingTop: Spacing.two,
  },
});
