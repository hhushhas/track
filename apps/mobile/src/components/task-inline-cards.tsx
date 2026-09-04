import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { shortTaskKey } from '@/lib/task-presentation';
import { displayText } from '@/lib/display-text';

/** Matches the avatar column MessageBubble reserves, so cards line up with bubbles. */
const GUTTER = 40;

type Props = {
  assistantStreamId?: Id<'assistantStreams'>;
  identity: MobileTaskIdentity | null;
  isOwnMessage?: boolean;
  messageId?: Id<'messages'>;
  /**
   * Reports whether the message or answer carries cards, so the screen can break
   * the author group after an interruption. Keyed by the message or stream id,
   * which is also the row key the thread list uses.
   */
  onCardsChange?: (rowId: string, hasCards: boolean) => void;
  projectId: Id<'projects'>;
};

export function TaskInlineCards({
  assistantStreamId,
  identity,
  isOwnMessage,
  messageId,
  onCardsChange,
  projectId,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const queryIdentity = identity ? {
    actingCompanyId: identity.companyId,
    projectMemberId: identity.membershipId,
  } : {};
  const messageTasks = useQuery(
    api.tasks.listForMessage,
    messageId ? { messageId, ...queryIdentity } : 'skip',
  );
  const assistantTasks = useQuery(
    api.tasks.listForAssistant,
    assistantStreamId ? { assistantStreamId, ...queryIdentity } : 'skip',
  );
  const tasks = messageId ? messageTasks : assistantTasks;
  const hasCards = Boolean(tasks?.length);
  const rowId = messageId ?? assistantStreamId;

  useEffect(() => {
    if (rowId) onCardsChange?.(rowId, hasCards);
  }, [hasCards, onCardsChange, rowId]);

  if (!tasks?.length) return null;

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther]}>
      {isOwnMessage ? null : <View style={styles.gutter} />}
      <View style={styles.stack}>
        {tasks.map((item) => {
          const status = item.state?.name ?? 'Unknown status';
          return (
            <Pressable
              accessibilityHint="Opens the task"
              accessibilityLabel={`Task ${item.task.publicKey}, ${status}, ${item.task.title}`}
              accessibilityRole="button"
              android_ripple={{ color: theme.backgroundSelected }}
              key={item.task._id}
              onPress={() => {
                hapticLight();
                router.push(taskDetailHref(projectId, item.task.publicKey, identity));
              }}
              style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
              <PlatformIcon color={theme.textSecondary} name="check-circle" size={16} />
              <View style={styles.body}>
                <ThemedText numberOfLines={1} type="smallBold">
                  {displayText(item.task.title)}
                </ThemedText>
                <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">
                  {`${shortTaskKey(item.task.publicKey)} · ${status}`}
                </ThemedText>
              </View>
              <PlatformIcon color={theme.textTertiary} name="chevron-right" size={16} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
  },
  gutter: {
    width: GUTTER,
  },
  body: {
    flexShrink: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  stack: {
    flexShrink: 1,
    gap: Spacing.one,
    maxWidth: '84%',
  },
});
