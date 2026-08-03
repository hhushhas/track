import type { TaskActivityAction } from '@track/shared/tasks';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Doc } from '../../../../convex/_generated/dataModel';
import { ColoredAvatar } from '@/components/colored-avatar';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import type {
  MobileTaskAssignee,
  MobileTaskDetail,
  MobileTaskListItem,
  TaskEditField,
} from '@/components/task-detail-types';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticMedium } from '@/lib/haptics';
import {
  taskActivityLabel,
  taskDueDisplay,
  taskLabelColor,
  taskPriorityLabel,
  taskReferenceBlockedReason,
  taskReferenceLabel,
} from '@/lib/task-presentation';

export function TaskDetailsTab({
  assigneeName,
  busy,
  completedSubtasks,
  detail,
  onAddSubtask,
  onEditField,
  onOpenReference,
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
  onEditField: (field: TaskEditField) => void;
  onOpenReference: (reference: Doc<'taskReferences'>) => void;
  onSubtaskChange: (value: string) => void;
  onToggleSubtask: (item: MobileTaskListItem) => void;
  readOnly: boolean;
  subtask: string;
  subtasks: MobileTaskListItem[];
}) {
  const theme = useTheme();
  const due = taskDueDisplay(detail.task.dueDate, undefined, detail.state?.category);
  return (
    <>
      <Surface title="Overview">
        <MetadataRow
          icon="person"
          label="Assignee"
          onPress={readOnly ? undefined : () => onEditField('assignee')}
          value={assigneeName}
        />
        <MetadataRow
          icon="calendar"
          label="Due date"
          onPress={readOnly ? undefined : () => onEditField('dueDate')}
          tone={due?.overdue ? 'danger' : undefined}
          value={due?.label ?? 'No due date'}
        />
        <MetadataRow
          icon="flag"
          label="Priority"
          onPress={readOnly ? undefined : () => onEditField('priority')}
          value={taskPriorityLabel(detail.task.priority)}
        />
        <MetadataRow icon="view-board" label="Board" value={detail.board?.name ?? 'Archived board'} />
      </Surface>

      <TaskSection title="Description">
        <Pressable
          accessibilityHint={readOnly ? undefined : 'Opens the description editor'}
          accessibilityRole={readOnly ? 'text' : 'button'}
          disabled={readOnly}
          onPress={() => onEditField('description')}
          style={[styles.description, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
          <ThemedText themeColor={detail.task.description ? 'text' : 'textSecondary'} type="small">
            {detail.task.description || (readOnly ? 'No description.' : 'Add a description…')}
          </ThemedText>
        </Pressable>
      </TaskSection>

      {detail.labels.length || !readOnly ? (
        <TaskSection title="Labels">
          <View style={styles.chips}>
            {detail.labels.map((label) => (
              <View key={label._id} style={[styles.label, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.labelDot, { backgroundColor: taskLabelColor(label.colorToken, theme.accent) }]} />
                <ThemedText type="smallBold">{label.name}</ThemedText>
              </View>
            ))}
            {!readOnly ? (
              <Pressable
                accessibilityLabel="Edit labels"
                accessibilityRole="button"
                onPress={() => onEditField('labels')}
                style={[styles.label, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
                <PlatformIcon color={theme.textSecondary} name="tag" size={15} />
                <ThemedText themeColor="textSecondary" type="smallBold">
                  {detail.labels.length ? 'Edit' : 'Add labels'}
                </ThemedText>
              </Pressable>
            ) : null}
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
                    <ThemedText themeColor="textSecondary" type="caption">{item.state?.name ?? 'Unknown'}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : <ThemedText themeColor="textSecondary" type="small">No checklist items yet.</ThemedText>}
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
          <ReferenceRow key={reference._id} onOpen={onOpenReference} reference={reference} />
        )) : (
          <View style={[styles.description, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
            <ThemedText themeColor="textSecondary" type="small">No linked conversation or evidence.</ThemedText>
          </View>
        )}
      </TaskSection>
    </>
  );
}

/**
 * Evidence is the reason a task exists, so an available reference opens the
 * message that produced it. A blocked one says why and stays inert.
 */
function ReferenceRow({
  onOpen,
  reference,
}: {
  onOpen: (reference: Doc<'taskReferences'>) => void;
  reference: Doc<'taskReferences'>;
}) {
  const theme = useTheme();
  const blocked = taskReferenceBlockedReason(reference.availability, Boolean(reference.groupId));
  return (
    <Pressable
      accessibilityHint={blocked ?? 'Opens the linked conversation'}
      accessibilityRole={blocked ? 'text' : 'link'}
      accessibilityState={{ disabled: Boolean(blocked) }}
      disabled={Boolean(blocked)}
      onPress={() => onOpen(reference)}
      style={({ pressed }) => [styles.evidence, {
        backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
        borderColor: theme.hairline,
      }]}>
      <View style={styles.evidenceHeader}>
        <PlatformIcon
          color={blocked ? theme.textTertiary : theme.accent}
          name={blocked ? 'shield-lock-outline' : 'link'}
          size={17}
        />
        <ThemedText style={styles.evidenceTitle} type="smallBold">
          {taskReferenceLabel(reference.type)}
        </ThemedText>
        {blocked ? null : <PlatformIcon color={theme.textSecondary} name="chevron-right" size={18} />}
      </View>
      {reference.quote ? (
        <View style={[styles.quote, { borderLeftColor: theme.accent }]}>
          <ThemedText numberOfLines={3} type="small">{reference.quote}</ThemedText>
        </View>
      ) : null}
      {blocked ? <ThemedText themeColor="textSecondary" type="caption">{blocked}</ThemedText> : null}
    </Pressable>
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
                <ThemedText themeColor="textSecondary" type="caption">{formatTimestamp(item.createdAt)}</ThemedText>
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
            <ThemedText themeColor="textSecondary" type="caption">{formatTimestamp(item.createdAt)}</ThemedText>
          </View>
        </View>
      )) : <ThemedText themeColor="textSecondary" type="small">No activity recorded yet.</ThemedText>}
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
                <ThemedText style={{ color: selected ? theme.accentStrong : theme.textSecondary }} type="label">
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
          <PlatformIcon color={Colors.light.text} name="arrow-up" size={19} />
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
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {trailing ? <ThemedText themeColor="textSecondary" type="captionBold">{trailing}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

/** A field is edited where it is read: the row itself opens its own picker. */
function MetadataRow({
  icon,
  label,
  onPress,
  tone,
  value,
}: {
  icon: React.ComponentProps<typeof PlatformIcon>['name'];
  label: string;
  onPress?: () => void;
  tone?: 'danger';
  value: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityHint={onPress ? `Changes the ${label.toLowerCase()}` : undefined}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.metadataRow, {
        backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
        borderBottomColor: theme.hairline,
      }]}>
      <PlatformIcon color={theme.textSecondary} name={icon} size={18} />
      <ThemedText style={styles.metadataLabel} themeColor="textSecondary" type="small">{label}</ThemedText>
      <ThemedText
        numberOfLines={1}
        style={styles.metadataValue}
        themeColor={tone === 'danger' ? 'danger' : 'text'}
        type="smallBold">
        {value}
      </ThemedText>
      {onPress ? <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} /> : null}
    </Pressable>
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
  addButton: { alignItems: 'center', borderRadius: Radius.medium, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  addSubtask: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  checkLabel: { flex: 1 },
  checkRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  checklist: { borderRadius: Radius.large, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  comment: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.two },
  commentBubble: { borderRadius: Radius.large, borderTopLeftRadius: 4, flex: 1, gap: Spacing.one, padding: Spacing.three },
  commentMeta: { alignItems: 'baseline', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  composerInput: { borderRadius: Radius.xlarge, flex: 1, fontSize: 14, lineHeight: 20, maxHeight: 112, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? 11 : 8 },
  composerRow: { alignItems: 'flex-end', flexDirection: 'row', gap: Spacing.two },
  description: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, minHeight: 72, padding: Spacing.three },
  evidence: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, padding: Spacing.three },
  evidenceHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  evidenceTitle: { flex: 1 },
  inlineInput: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flex: 1, fontSize: 14, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  label: { alignItems: 'center', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  labelDot: { borderRadius: 4, height: 8, width: 8 },
  metadataLabel: { flex: 1 },
  metadataRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  metadataValue: { maxWidth: '48%' },
  mentionChip: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  mentionRow: { gap: Spacing.two },
  progressTrack: { borderRadius: Radius.small, height: 6, overflow: 'hidden' },
  progressValue: { borderRadius: Radius.small, height: 6 },
  quote: { borderLeftWidth: 3, paddingLeft: Spacing.three },
  section: { gap: Spacing.two },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sendButton: { alignItems: 'center', borderRadius: TouchTarget / 2, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  surface: { borderRadius: Radius.large, overflow: 'hidden' },
  timelineBody: { flex: 1, gap: 2, paddingBottom: Spacing.four },
  timelineDot: { borderRadius: 5, height: 10, marginTop: 5, width: 10 },
  timelineLine: { flex: 1, marginBottom: -5, marginTop: Spacing.one, width: 2 },
  timelineRail: { alignItems: 'center', width: 16 },
  timelineRow: { flexDirection: 'row', gap: Spacing.three, minHeight: 58 },
});
