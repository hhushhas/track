import { ScrollView, StyleSheet, View } from 'react-native';

import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import {
  TaskAction,
  TaskCard,
  TaskCardSkeletons,
  TaskStatusPill,
} from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MobileTaskView = {
  task: Doc<'tasks'>;
  state: Doc<'taskWorkflowStates'> | null;
  assignee: Doc<'projectMembers'> | null;
  references: Array<Doc<'taskReferences'>>;
};

export type MobileBoardView = {
  board: Doc<'taskBoards'>;
  states: Array<Doc<'taskWorkflowStates'>>;
};

export type MobileSuggestionView = {
  suggestion: Doc<'taskSuggestions'>;
  references: Array<Doc<'taskSuggestionReferences'>>;
  canDismiss: boolean;
  possibleDuplicateTask: { _id: Id<'tasks'>; publicKey: string; title: string } | null;
  proposedAssignee: { user: { displayName: string }; company: Doc<'companies'> | null } | null;
};

export function TaskCollection({
  assigneeName,
  counts,
  grouped,
  onCreate,
  onOpen,
  onViewAll,
  readOnly,
  selectedBoard,
  tab,
  tasks,
}: {
  assigneeName: (item: MobileTaskView) => string | undefined;
  counts: Record<string, number>;
  grouped: Array<{ stateId: string; tasks: MobileTaskView[] }>;
  onCreate: () => void;
  onOpen: (item: MobileTaskView) => void;
  onViewAll: () => void;
  readOnly: boolean;
  selectedBoard?: MobileBoardView;
  tab: 'board' | 'my' | 'all';
  tasks?: MobileTaskView[];
}) {
  const theme = useTheme();
  if (tasks === undefined) return <TaskCardSkeletons count={4} />;
  if (!selectedBoard && tab === 'board') {
    return (
      <TaskEmptyState
        body="Create the first task to initialize this Project board."
        buttonLabel={readOnly ? undefined : 'Create task'}
        icon="view-column"
        onPress={onCreate}
        title="No board yet"
      />
    );
  }
  if (!tasks.length) {
    return (
      <TaskEmptyState
        body={tab === 'my'
          ? 'Tasks assigned to you will appear here.'
          : 'Create a task or turn a conversation into action.'}
        buttonLabel={tab === 'my' ? 'View all tasks' : readOnly ? undefined : 'Create task'}
        icon="check-box-outline"
        onPress={tab === 'my' ? onViewAll : onCreate}
        title={tab === 'my' ? 'Nothing assigned to you' : 'No tasks yet'}
      />
    );
  }

  if (tab !== 'board') {
    return (
      <View style={styles.list}>
        {tasks.map((item) => (
          <TaskCard
            assignee={assigneeName(item)}
            category={item.state?.category}
            dueDate={item.task.dueDate}
            key={item.task._id}
            linkedContext={item.references[0] ? 'Linked conversation' : undefined}
            onPress={() => onOpen(item)}
            priority={item.task.priority}
            publicKey={item.task.publicKey}
            stateName={item.state?.name ?? 'Unknown'}
            title={item.task.title}
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.board} horizontal showsHorizontalScrollIndicator={false}>
      {grouped.map((group) => {
        const state = selectedBoard?.states.find((item) => item._id === group.stateId);
        return (
          <View key={group.stateId} style={[styles.column, { backgroundColor: theme.background }]}>
            <View style={styles.columnHeading}>
              <TaskStatusPill category={state?.category} label={state?.name ?? 'Unknown'} />
              <ThemedText style={{ color: theme.textSecondary }} type="code">{counts[group.stateId] ?? 0}</ThemedText>
            </View>
            {group.tasks.map((item) => (
              <TaskCard
                assignee={assigneeName(item)}
                category={item.state?.category}
                compact
                dueDate={item.task.dueDate}
                key={item.task._id}
                linkedContext={item.references[0] ? 'Linked conversation' : undefined}
                onPress={() => onOpen(item)}
                priority={item.task.priority}
                publicKey={item.task.publicKey}
                stateName={item.state?.name ?? 'Unknown'}
                title={item.task.title}
              />
            ))}
            {!group.tasks.length ? (
              <View style={[styles.columnEmpty, { borderColor: theme.hairline }]}>
                <ThemedText style={{ color: theme.textSecondary }} type="small">No tasks</ThemedText>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

export function SuggestionInbox({
  onAccept,
  onDismiss,
  onHide,
  onLink,
  readOnly,
  suggestions,
}: {
  onAccept: (row: MobileSuggestionView) => void;
  onDismiss: (row: MobileSuggestionView) => void;
  onHide: (row: MobileSuggestionView) => void;
  onLink: (row: MobileSuggestionView) => void;
  readOnly: boolean;
  suggestions?: MobileSuggestionView[];
}) {
  const theme = useTheme();
  if (readOnly) {
    return <EmptyState icon="shield-lock-outline" title="No archived Inbox" body="Suggestions are active-work decisions and are not available in an exit archive." />;
  }
  if (suggestions === undefined) return <TaskCardSkeletons count={3} />;
  if (!suggestions.length) {
    return <EmptyState icon="inbox" title="Inbox is clear" body="Grounded suggestions from accessible conversation will appear here." />;
  }

  return (
    <View style={styles.list}>
      {suggestions.map((row) => (
        <View key={row.suggestion._id} style={[styles.suggestion, {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.hairline,
        }]}>
          <View style={styles.cardEyebrow}>
            <View style={[styles.confidence, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="code">{Math.round(row.suggestion.confidence * 100)}% confidence</ThemedText>
            </View>
            <PlatformIcon color={theme.textSecondary} name="forum-outline" size={18} />
          </View>
          <ThemedText type="subtitle">{row.suggestion.proposedTitle}</ThemedText>
          {row.suggestion.proposedDescription ? <ThemedText type="small">{row.suggestion.proposedDescription}</ThemedText> : null}
          {row.proposedAssignee ? (
            <ThemedText style={{ color: theme.textSecondary }} type="small">
              Proposed for {row.proposedAssignee.user.displayName}
              {row.proposedAssignee.company ? ` · ${row.proposedAssignee.company.displayName}` : ''}
            </ThemedText>
          ) : null}
          {row.references.map((reference) => (
            <View key={reference._id} style={[styles.quote, { borderLeftColor: theme.accent }]}>
              <ThemedText numberOfLines={3} style={{ color: theme.textSecondary }} type="small">
                “{reference.quote ?? 'Reference unavailable'}”
              </ThemedText>
            </View>
          ))}
          {row.possibleDuplicateTask ? (
            <ThemedText type="smallBold">
              Possible duplicate: {row.possibleDuplicateTask.publicKey} · {row.possibleDuplicateTask.title}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            <TaskAction label={row.possibleDuplicateTask ? 'Create separately' : 'Accept'} onPress={() => onAccept(row)} primary />
            {row.possibleDuplicateTask ? <TaskAction label="Add reference" onPress={() => onLink(row)} /> : null}
            {row.canDismiss ? <TaskAction label="Dismiss" onPress={() => onDismiss(row)} /> : null}
            <TaskAction label="Hide" onPress={() => onHide(row)} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TaskEmptyState({
  body,
  buttonLabel,
  icon,
  onPress,
  title,
}: {
  body: string;
  buttonLabel?: string;
  icon: React.ComponentProps<typeof PlatformIcon>['name'];
  onPress: () => void;
  title: string;
}) {
  return (
    <View style={styles.empty}>
      <EmptyState body={body} icon={icon} title={title} />
      {buttonLabel ? <TaskAction label={buttonLabel} onPress={onPress} primary /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  board: { alignItems: 'flex-start', gap: Spacing.three, paddingRight: Spacing.three },
  cardEyebrow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  column: { gap: Spacing.three, width: 286 },
  columnEmpty: { alignItems: 'center', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 112 },
  columnHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  confidence: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  empty: { alignSelf: 'center', gap: Spacing.three, maxWidth: 360, paddingTop: Spacing.six, width: '100%' },
  list: { gap: Spacing.three },
  quote: { borderLeftWidth: 3, paddingLeft: Spacing.three },
  suggestion: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.three, padding: Spacing.four },
});
