import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';

type Props = {
  assistantStreamId?: Id<'assistantStreams'>;
  identity: MobileTaskIdentity | null;
  messageId?: Id<'messages'>;
  projectId: Id<'projects'>;
};

export function TaskInlineCards({ assistantStreamId, identity, messageId, projectId }: Props) {
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

  if (!tasks?.length) return null;

  return (
    <View style={styles.cards}>
      {tasks.map((item) => (
        <Pressable
          key={item.task._id}
          onPress={() => {
            hapticLight();
            router.push(taskDetailHref(projectId, item.task.publicKey, identity));
          }}
          style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
          <ThemedText style={{ color: theme.textSecondary }} type="code">
            {item.task.publicKey} · {item.state?.name ?? 'Unknown status'}
          </ThemedText>
          <ThemedText numberOfLines={2} type="smallBold">{item.task.title}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  cards: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
    marginLeft: 52,
    marginRight: Spacing.three,
    marginTop: Spacing.one,
  },
});
