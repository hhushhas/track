import type { TaskActivityAction } from '@track/shared/tasks';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColoredAvatar } from '@/components/colored-avatar';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import type {
  MobileTaskAssignee,
  MobileTaskDetail,
  MobileTaskListItem,
} from '@/components/task-detail-types';
import { TaskAction } from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticMedium } from '@/lib/haptics';
import {
  taskActivityLabel,
  taskLabelColor,
  taskPriorityLabel,
} from '@/lib/task-presentation';

export function TaskDetailsTab({
  assigneeName,
  busy,
  completedSubtasks,
  detail,
  onAddSubtask,
  onArchive,
  onFollow,
  onSubtaskChange,
  onToggleSubtask,
  readOnly,
  subtask,
  subtasks,
}: {
  assigneeName: string;
  busy: boolean;
  completedSubtasks: number;
  detail: MobileTaskDetail;
  onAddSubtask: () => void;
  onArchive: () => void;
  onFollow: () => void;
  onSubtaskChange: (value: string) => void;
  onToggleSubtask: (item: MobileTaskListItem) => void;
  readOnly: boolean;
  subtask: string;
  subtasks: MobileTaskListItem[];
}) {
  const theme = useTheme();
  return (
    <>
      <Surface title="Overview">
        <MetadataRow icon="person" label="Assignee" value={assigneeName} />
        <MetadataRow icon="calendar" label="Due date" value={detail.task.dueDate ?? 'No due date'} />
        <MetadataRow icon="view-column" label="Board" value={detail.board?.name ?? 'Archived board'} />
        <MetadataRow icon="flag" label="Priority" value={taskPriorityLabel(detail.task.priority)} />
      </Surface>

      <TaskSection title="Description">
        <View style={[styles.description, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
          <ThemedText style={{ color: detail.task.description ? theme.text : theme.textSecondary }} type="small">
            {detail.task.description || 'No description yet.'}
          </ThemedText>
        </View>
      </TaskSection>

      {detail.labels.length ? (
        <TaskSection title="Labels">
          <View style={styles.chips}>
            {detail.labels.map((label) => (
              <View key={label._id} style={[styles.label, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.labelDot, { backgroundColor: taskLabelColor(label.colorToken, theme.accent) }]} />
                <ThemedText type="smallBold">{label.name}</ThemedText>
              </View>
            ))}
          </View>
        </TaskSection>
      ) : null}

      <TaskSection title="Checklist" trailing={subtasks.length ? `${completedSubtasks}/${subtasks.length}` : undefined}>
        {subtasks.length ? (
          <>
            <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.progressValue, {
                backgroundColor: theme.accent,
                width: `${(completedSubtasks / subtasks.length) * 100}%`,
              }]} />
            </View>
            <View style={[styles.checklist, { backgroundColor: theme.backgroundElement }]}>
              {subtasks.map((item, index) => {
                const complete = item.state?.category === 'completed' || item.state?.category === 'canceled';
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: complete, disabled: readOnly }}
                    disabled={readOnly || busy}
                    key={item.task._id}
                    onPress={() => onToggleSubtask(item)}
                    style={[styles.checkRow, index > 0 && {
                      borderTopColor: theme.hairline,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    }]}>
                    <PlatformIcon color={complete ? theme.accent : theme.textSecondary} name={complete ? 'check-box' : 'check-box-outline'} size={21} />
                    <ThemedText style={[styles.checkLabel, complete && {
                      color: theme.textSecondary,
                      textDecorationLine: 'line-through',
                    }]} type="small">
                      {item.task.title}
                    </ThemedText>
                    <ThemedText style={{ color: theme.textSecondary }} type="code">{item.state?.name ?? 'Unknown'}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : <ThemedText style={{ color: theme.textSecondary }} type="small">No checklist items yet.</ThemedText>}
        {!readOnly && !detail.task.parentTaskId ? (
          <View style={styles.addSubtask}>
            <TextInput
              accessibilityLabel="New checklist item"
              allowFontScaling
              onChangeText={onSubtaskChange}
              placeholder="Add a checklist item"
              placeholderTextColor={theme.textSecondary}
              style={[styles.inlineInput, {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.hairline,
                color: theme.text,
              }]}
              value={subtask}
            />
            <Pressable
              accessibilityLabel="Add checklist item"
              disabled={!subtask.trim() || busy}
              onPress={onAddSubtask}
              style={[styles.addButton, {
                backgroundColor: theme.backgroundSelected,
                opacity: subtask.trim() ? 1 : 0.5,
              }]}>
              <PlatformIcon color={theme.text} name="plus" size={20} />
            </Pressable>
          </View>
        ) : null}
      </TaskSection>

      <TaskSection title="Linked context">
        {detail.references.length ? detail.references.map((reference) => (
          <View key={reference._id} style={[styles.evidence, {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.hairline,
          }]}>
            <View style={styles.evidenceHeader}>
              <PlatformIcon color={theme.accent} name="link" size={17} />
              <ThemedText type="smallBold">
                {reference.type === 'message' ? 'Conversation message' : reference.type.replaceAll('_', ' ')}
              </ThemedText>
            </View>
            <ThemedText style={{ color: theme.textSecondary }} type="small">
              {reference.quote ?? (reference.availability === 'redacted'
                ? 'This evidence was redacted.'
                : 'This evidence is no longer available.')}
            </ThemedText>
          </View>
        )) : (
          <View style={[styles.description, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
            <ThemedText style={{ color: theme.textSecondary }} type="small">No linked conversation or evidence.</ThemedText>
          </View>
        )}
      </TaskSection>

      {detail.capabilities.canComment || detail.capabilities.canArchive ? (
        <View style={styles.actions}>
          {detail.capabilities.canComment ? (
            <TaskAction label={detail.following ? 'Unfollow task' : 'Follow task'} onPress={onFollow} />
          ) : null}
          {detail.capabilities.canArchive ? (
            <TaskAction label={detail.task.archivedAt ? 'Restore task' : 'Archive task'} onPress={onArchive} />
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export function TaskDiscussionTab({
  assignees,
  detail,
}: {
  assignees?: MobileTaskAssignee[];
  detail: MobileTaskDetail;
}) {
  const theme = useTheme();
  const comments = detail.comments.filter((item) => !item.archivedAt);
  return (
    <TaskSection title={`${comments.length} comments`}>
      {comments.length ? comments.map((item) => {
        const author = assignees?.find((candidate) => candidate.member._id === item.authorProjectMemberId)?.user.displayName
          ?? 'Project member';
        return (
          <View key={item._id} style={styles.comment}>
            <ColoredAvatar label={author} seed={item.authorProjectMemberId} size={32} />
            <View style={[styles.commentBubble, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.commentMeta}>
                <ThemedText type="smallBold">{author}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary }} type="code">{formatTimestamp(item.createdAt)}</ThemedText>
              </View>
              <ThemedText type="small">{item.body}</ThemedText>
            </View>
          </View>
        );
      }) : <EmptyState icon="forum-outline" title="Start the discussion" body="Keep decisions and implementation notes attached to the task." />}
    </TaskSection>
  );
}

export function TaskActivityTab({ detail }: { detail: MobileTaskDetail }) {
  const theme = useTheme();
  return (
    <TaskSection title="Recent activity">
      {detail.activities.length ? detail.activities.map((item, index) => (
        <View key={item._id} style={styles.timelineRow}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineDot, { backgroundColor: theme.accent }]} />
            {index < detail.activities.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: theme.hairline }]} /> : null}
          </View>
          <View style={styles.timelineBody}>
            <ThemedText type="smallBold">{taskActivityLabel(item.action as TaskActivityAction)}</ThemedText>
            <ThemedText style={{ color: theme.textSecondary }} type="code">{formatTimestamp(item.createdAt)}</ThemedText>
          </View>
        </View>
      )) : <ThemedText style={{ color: theme.textSecondary }} type="small">No activity recorded yet.</ThemedText>}
    </TaskSection>
  );
}

export function TaskCommentComposer({
  assignees,
  busy,
  mentionIds,
  onChangeText,
  onMentionToggle,
  onSend,
  value,
}: {
  assignees?: MobileTaskAssignee[];
  busy: boolean;
  mentionIds: Array<string>;
  onChangeText: (value: string) => void;
  onMentionToggle: (memberId: string) => void;
  onSend: () => void;
  value: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const canSend = value.trim().length > 0 && !busy;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View style={[styles.composer, {
      backgroundColor: theme.background,
      borderTopColor: theme.hairline,
      paddingBottom: keyboardVisible ? Spacing.two : Math.max(insets.bottom, Spacing.three),
    }]}>
      {assignees?.length ? (
        <ScrollView
          contentContainerStyle={styles.mentionRow}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}>
          {assignees.map((item) => {
            const selected = mentionIds.includes(item.member._id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={item.member._id}
                onPress={() => onMentionToggle(item.member._id)}
                style={[styles.mentionChip, {
                  backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
                  borderColor: selected ? theme.accent : theme.hairline,
                }]}>
                <ThemedText style={{ color: selected ? theme.accent : theme.textSecondary }} type="code">
                  @{item.user.displayName}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={styles.composerRow}>
        <TextInput
          accessibilityLabel="Add a task comment"
          allowFontScaling
          multiline
          onChangeText={onChangeText}
          placeholder="Add a comment…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.composerInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          value={value}
        />
        <Pressable
          accessibilityLabel="Send comment"
          disabled={!canSend}
          onPress={() => {
            hapticMedium();
            onSend();
          }}
          style={[styles.sendButton, { backgroundColor: theme.accent, opacity: canSend ? 1 : 0.45 }]}>
          <PlatformIcon color="#1b1917" name="arrow-up" size={19} />
        </Pressable>
      </View>
    </View>
  );
}

function Surface({ children, title }: { children: React.ReactNode; title: string }) {
  const theme = useTheme();
  return (
    <TaskSection title={title}>
      <View style={[styles.surface, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </TaskSection>
  );
}

function TaskSection({
  children,
  title,
  trailing,
}: {
  children: React.ReactNode;
  title: string;
  trailing?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {trailing ? <ThemedText style={{ color: theme.textSecondary }} type="code">{trailing}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof PlatformIcon>['name'];
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.metadataRow, { borderBottomColor: theme.hairline }]}>
      <PlatformIcon color={theme.textSecondary} name={icon} size={18} />
      <ThemedText style={[styles.metadataLabel, { color: theme.textSecondary }]} type="small">{label}</ThemedText>
      <ThemedText numberOfLines={1} style={styles.metadataValue} type="smallBold">{value}</ThemedText>
    </View>
  );
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  addButton: { alignItems: 'center', borderRadius: 10, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  addSubtask: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  checkLabel: { flex: 1 },
  checkRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  checklist: { borderRadius: 12, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  comment: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.two },
  commentBubble: { borderRadius: 12, borderTopLeftRadius: 4, flex: 1, gap: Spacing.one, padding: Spacing.three },
  commentMeta: { alignItems: 'baseline', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  composerInput: { borderRadius: 20, flex: 1, fontSize: 14, lineHeight: 20, maxHeight: 112, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? 11 : 8 },
  composerRow: { alignItems: 'flex-end', flexDirection: 'row', gap: Spacing.two },
  description: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, minHeight: 72, padding: Spacing.three },
  evidence: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, padding: Spacing.three },
  evidenceHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  inlineInput: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flex: 1, fontSize: 14, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  label: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  labelDot: { borderRadius: 4, height: 8, width: 8 },
  metadataLabel: { flex: 1 },
  metadataRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  metadataValue: { maxWidth: '48%' },
  mentionChip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  mentionRow: { gap: Spacing.two },
  progressTrack: { borderRadius: 3, height: 6, overflow: 'hidden' },
  progressValue: { borderRadius: 3, height: 6 },
  section: { gap: Spacing.two },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sendButton: { alignItems: 'center', borderRadius: TouchTarget / 2, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  surface: { borderRadius: 12, overflow: 'hidden' },
  timelineBody: { flex: 1, gap: 2, paddingBottom: Spacing.four },
  timelineDot: { borderRadius: 5, height: 10, marginTop: 5, width: 10 },
  timelineLine: { flex: 1, marginBottom: -5, marginTop: Spacing.one, width: 2 },
  timelineRail: { alignItems: 'center', width: 16 },
  timelineRow: { flexDirection: 'row', gap: Spacing.three, minHeight: 58 },
});
