import type { TaskActivityAction } from '@track/shared/tasks';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';

import type { Doc } from '../../../../convex/_generated/dataModel';
import { ColoredAvatar } from '@/components/colored-avatar';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
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
import { useBottomTabBarInset } from '@/hooks/use-bottom-tab-inset';
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
  highlightSubtaskId,
  onAddSubtask,
  onChecklistLayout,
  onEditField,
  onOpenSubtask,
  onOpenReference,
  onLoadMoreReferences,
  onSubtaskChange,
  onToggleSubtask,
  readOnly,
  subtask,
  subtasks,
  references,
  referencesLoading,
  referencesLoadingMore,
  onLoadMoreSubtasks,
  subtasksLoadingMore,
}: {
  assigneeName: string;
  busy: boolean;
  completedSubtasks: number;
  detail: MobileTaskDetail;
  highlightSubtaskId?: string;
  onAddSubtask: () => void;
  onChecklistLayout: (event: LayoutChangeEvent) => void;
  onEditField: (field: TaskEditField) => void;
  onOpenSubtask: (item: MobileTaskListItem) => void;
  onOpenReference: (reference: Doc<'taskReferences'>) => void;
  onLoadMoreReferences?: () => void;
  onSubtaskChange: (value: string) => void;
  onToggleSubtask: (item: MobileTaskListItem) => void;
  readOnly: boolean;
  subtask: string;
  subtasks: MobileTaskListItem[];
  references: Doc<'taskReferences'>[];
  referencesLoading: boolean;
  referencesLoadingMore: boolean;
  onLoadMoreSubtasks?: () => void;
  subtasksLoadingMore: boolean;
}) {
  const theme = useTheme();
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const due = taskDueDisplay(detail.task.dueDate, undefined, detail.state?.category);
  const labels = detail.labels.filter((label): label is NonNullable<typeof label> => label !== null);
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

      {labels.length ? (
        <TaskSection title="Labels">
          <View style={styles.chips}>
            {labels.map((label) => label && (
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
                  Edit
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </TaskSection>
      ) : null}

      <View onLayout={onChecklistLayout}>
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
                  const description = item.task.description?.trim();
                  const expanded = expandedSubtaskId === item.task._id;
                  return (
                    <View
                      key={item.task._id}
                      style={[styles.checkItem, item.task._id === highlightSubtaskId && { backgroundColor: theme.accentSoft }, index > 0 && {
                        borderTopColor: theme.hairline,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      }]}>
                      <View style={styles.checkRow}>
                        <Pressable
                          accessibilityLabel={`${complete ? 'Mark incomplete' : 'Mark complete'}: ${item.task.title}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: complete, disabled: readOnly || busy }}
                          disabled={readOnly || busy}
                          onPress={() => onToggleSubtask(item)}
                          style={styles.checkToggle}>
                          <PlatformIcon color={complete ? theme.accent : theme.textSecondary} name={complete ? 'check-box' : 'check-box-outline'} size={22} />
                        </Pressable>
                        <Pressable
                          accessibilityHint={description ? 'Expands the checklist item description' : 'Opens the checklist item details'}
                          accessibilityRole="button"
                          onPress={() => description
                            ? setExpandedSubtaskId((current) => current === item.task._id ? null : item.task._id)
                            : onOpenSubtask(item)}
                          style={styles.checkCopy}>
                          <ThemedText numberOfLines={expanded ? undefined : 2} style={[styles.checkLabel, complete && {
                            color: theme.textSecondary,
                            textDecorationLine: 'line-through',
                          }]} type="small">
                            {item.task.title}
                          </ThemedText>
                          <ThemedText themeColor="textSecondary" type="caption">{item.state?.name ?? 'Unknown'}</ThemedText>
                        </Pressable>
                        <PlatformIcon color={theme.textTertiary} name={description ? (expanded ? 'chevron-up' : 'chevron-down') : 'chevron-right'} size={18} />
                      </View>
                      {expanded && description ? (
                        <View style={[styles.checkDescription, { borderTopColor: theme.hairline }]}>
                          <ThemedText type="small">{description}</ThemedText>
                          <Pressable accessibilityRole="button" onPress={() => onOpenSubtask(item)} style={styles.checkDetailsAction}>
                            <ThemedText themeColor="accentStrong" type="smallBold">Open details</ThemedText>
                            <PlatformIcon color={theme.accentStrong} name="chevron-right" size={16} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={[styles.emptyBlock, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
              <PlatformIcon color={theme.textTertiary} name="check-box-outline" size={20} />
              <View style={styles.emptyBlockCopy}>
                <ThemedText type="smallBold">No checklist items yet</ThemedText>
                <ThemedText themeColor="textSecondary" type="caption">
                  Break this task into smaller steps when the work needs a clear handoff.
                </ThemedText>
              </View>
            </View>
          )}
          {onLoadMoreSubtasks || subtasksLoadingMore ? <LoadMoreButton label="checklist items" loading={subtasksLoadingMore} onPress={onLoadMoreSubtasks} /> : null}
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
      </View>

      <TaskSection title="Linked context">
        {references.length ? references.map((reference) => (
          <ReferenceRow key={reference._id} onOpen={onOpenReference} reference={reference} />
        )) : referencesLoading ? <ThemedText themeColor="textSecondary" type="small">Loading linked context…</ThemedText> : (
          <View style={[styles.description, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
            <ThemedText themeColor="textSecondary" type="small">No linked conversation or evidence.</ThemedText>
          </View>
        )}
        {onLoadMoreReferences || referencesLoadingMore ? <LoadMoreButton label="linked context" loading={referencesLoadingMore} onPress={onLoadMoreReferences} /> : null}
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
  comments,
  loading,
  loadingMore,
  onLoadMore,
}: {
  assignees?: MobileTaskAssignee[];
  comments: Array<Doc<'taskComments'>>;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore?: () => void;
}) {
  const theme = useTheme();
  const visibleComments = comments.filter((item) => !item.archivedAt);
  return (
    <TaskSection title="Discussion" trailing={`${visibleComments.length} ${visibleComments.length === 1 ? 'comment' : 'comments'}`}>
      {visibleComments.length ? visibleComments.map((item) => {
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
      }) : loading ? <ThemedText themeColor="textSecondary" type="small">Loading discussion…</ThemedText> : <EmptyState icon="message" title="Start the discussion" body="Keep decisions and implementation notes attached to the task." />}
      {onLoadMore || loadingMore ? <LoadMoreButton label="comments" loading={loadingMore} onPress={onLoadMore} /> : null}
    </TaskSection>
  );
}

export function TaskActivityTab({ activities, assignees, loading, loadingMore, onLoadMore, workflowStates }: {
  assignees?: MobileTaskAssignee[];
  activities: Array<Doc<'taskActivities'>>;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore?: () => void;
  workflowStates?: Array<{ _id: string; name: string }>;
}) {
  const theme = useTheme();
  return (
    <TaskSection
      title="Audit Ledger"
      trailing={(
        <>
          <ThemedText themeColor="textSecondary" type="captionBold">Showing full chain</ThemedText>
          <PlatformIcon color={theme.textTertiary} name="tune" size={16} />
        </>
      )}>
      {activities.length ? activities.map((item, index) => (
        <View key={item._id} style={styles.timelineRow}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineMarker, { backgroundColor: activityTone(item.action, theme).background }]}>
              <PlatformIcon color={activityTone(item.action, theme).foreground} name={activityIcon(item.action)} size={16} />
            </View>
            {index < activities.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: theme.hairline }]} /> : null}
          </View>
          <View style={[styles.timelineBody, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
            <View style={styles.activityMeta}>
              <ThemedText numberOfLines={1} style={styles.activityActor} type="smallBold">
                {assignees?.find((candidate) => candidate.member._id === item.actorProjectMemberId)?.user.displayName ?? 'Track activity'}
              </ThemedText>
              <ThemedText themeColor="textTertiary" type="caption">{formatRelativeActivityTime(item.createdAt)}</ThemedText>
            </View>
            <ThemedText type="smallBold">{activityPresentation(item, { assignees, workflowStates }).title}</ThemedText>
            {activityPresentation(item, { assignees, workflowStates }).detail ? <ThemedText themeColor="textSecondary" type="small">{activityPresentation(item, { assignees, workflowStates }).detail}</ThemedText> : null}
            {activityPresentation(item, { assignees, workflowStates }).before || activityPresentation(item, { assignees, workflowStates }).after ? (
              <View style={[styles.activityChange, { backgroundColor: theme.backgroundElevated }]}>
                {activityPresentation(item, { assignees, workflowStates }).before ? <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{activityPresentation(item, { assignees, workflowStates }).before}</ThemedText> : null}
                {activityPresentation(item, { assignees, workflowStates }).before && activityPresentation(item, { assignees, workflowStates }).after ? <PlatformIcon color={theme.textTertiary} name="chevron-right" size={13} /> : null}
                {activityPresentation(item, { assignees, workflowStates }).after ? <ThemedText numberOfLines={1} themeColor="accentStrong" type="captionBold">{activityPresentation(item, { assignees, workflowStates }).after}</ThemedText> : null}
              </View>
            ) : null}
          </View>
        </View>
      )) : loading ? <ThemedText themeColor="textSecondary" type="small">Loading activity…</ThemedText> : <ThemedText themeColor="textSecondary" type="small">No activity recorded yet.</ThemedText>}
      {onLoadMore || loadingMore ? <LoadMoreButton label="activity" loading={loadingMore} onPress={onLoadMore} /> : null}
    </TaskSection>
  );
}

function activityIcon(action: TaskActivityAction): IconName {
  if (action === 'created' || action === 'restored') return 'check-circle';
  if (action === 'commented') return 'message';
  if (action === 'priority_changed') return 'flag';
  if (action === 'assignee_changed') return 'account-edit-outline';
  if (action === 'state_changed') return 'chevron-right';
  if (action === 'archived') return 'archive';
  if (action === 'due_date_changed') return 'calendar';
  return 'edit';
}

function activityTone(action: TaskActivityAction, theme: ReturnType<typeof useTheme>) {
  if (action === 'priority_changed' || action === 'archived') return { background: theme.dangerSoft, foreground: theme.danger };
  if (action === 'state_changed' || action === 'assignee_changed') return { background: theme.accentSoft, foreground: theme.accentStrong };
  return { background: theme.backgroundElevated, foreground: theme.textSecondary };
}

function activityValue(value: unknown, options: { assignees?: MobileTaskAssignee[]; workflowStates?: Array<{ _id: string; name: string }> }): string | undefined {
  if (typeof value === 'string') {
    const state = options.workflowStates?.find((candidate) => candidate._id === value);
    if (state) return state.name;
    const assignee = options.assignees?.find((candidate) => candidate.member._id === value);
    if (assignee) return assignee.user.displayName;
    return value.length > 40 && /^[a-z0-9]+$/i.test(value) ? undefined : value;
  }
  if (typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['name', 'displayName', 'title', 'label', 'value', 'date']) {
    const candidate = record[key];
    const resolved: string | undefined = activityValue(candidate, options);
    if (resolved) return resolved;
  }
  return undefined;
}

type ActivityPresentation = {
  title: string;
  detail?: string;
  before?: string;
  after?: string;
};

function activityPresentation(item: Doc<'taskActivities'>, options: { assignees?: MobileTaskAssignee[]; workflowStates?: Array<{ _id: string; name: string }> }): ActivityPresentation {
  const before = activityValue(item.before, options);
  const after = activityValue(item.after, options);
  switch (item.action) {
    case 'created': return { title: 'Created task', detail: 'Task added to the Project board.' };
    case 'state_changed': return { title: `Moved status${after ? ` to ${after}` : ''}`, detail: undefined, before, after };
    case 'priority_changed': return { title: `Changed priority${after ? ` to ${after}` : ''}`, detail: undefined, before, after };
    case 'assignee_changed': return { title: after ? `Assigned task to ${after}` : 'Removed task assignee', detail: undefined, before, after };
    case 'due_date_changed': return { title: after ? `Set due date to ${after}` : 'Removed due date', detail: undefined, before, after };
    case 'title_changed': return { title: 'Renamed task', detail: undefined, before, after };
    case 'description_changed': return { title: 'Updated task description', detail: 'The task context changed.' };
    case 'labels_changed': return { title: 'Updated labels', detail: undefined, before, after };
    case 'board_changed': return { title: `Moved task${after ? ` to ${after}` : ''}`, detail: undefined, before, after };
    case 'scope_changed': return { title: 'Changed task scope', detail: 'Access boundaries were updated.' };
    case 'commented': return { title: 'Added a comment', detail: 'A new discussion note was added to this task.' };
    case 'archived': return { title: 'Archived task', detail: 'The task was removed from active work.' };
    case 'restored': return { title: 'Restored task', detail: 'The task is active again.' };
    default: return { title: taskActivityLabel(item.action), detail: undefined, before, after };
  }
}

function formatRelativeActivityTime(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(timestamp);
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
  const bottomTabBarInset = useBottomTabBarInset();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const canSend = value.trim().length > 0 && !busy;

  return (
    <View style={[styles.composer, {
      backgroundColor: theme.background,
      borderTopColor: theme.hairline,
      marginBottom: keyboardVisible ? 0 : bottomTabBarInset,
      paddingBottom: Spacing.three,
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
          <PlatformIcon color={Colors.light.text} name="send" size={19} />
        </Pressable>
      </View>
    </View>
  );
}

function LoadMoreButton({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={styles.loadMoreButton}>
      <ThemedText type="smallBold">{loading ? `Loading more ${label}…` : `Load more ${label}`}</ThemedText>
    </Pressable>
  );
}

function Surface({ children, title }: { children: React.ReactNode; title: string }) {
  const theme = useTheme();
  return (
    <TaskSection title={title}>
      <View style={[styles.surface, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>{children}</View>
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
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {typeof trailing === 'string'
          ? <ThemedText themeColor="textSecondary" type="captionBold">{trailing}</ThemedText>
          : trailing ? <View style={styles.sectionTrailing}>{trailing}</View> : null}
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
  addButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  addSubtask: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  checkCopy: { flex: 1, gap: 2, justifyContent: 'center', minHeight: TouchTarget, minWidth: 0, paddingVertical: Spacing.two },
  checkDescription: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two, marginLeft: TouchTarget + Spacing.three, paddingBottom: Spacing.three, paddingRight: Spacing.three, paddingTop: Spacing.two },
  checkDetailsAction: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget },
  checkItem: { minHeight: TouchTarget },
  checkLabel: { flexShrink: 1 },
  checkRow: { alignItems: 'center', flexDirection: 'row', minHeight: TouchTarget, paddingRight: Spacing.three },
  checkToggle: { alignItems: 'center', height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  checklist: { borderCurve: 'continuous', borderRadius: Radius.large, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  comment: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.two },
  commentBubble: { borderCurve: 'continuous', borderRadius: Radius.large, borderTopLeftRadius: 4, flex: 1, gap: Spacing.one, padding: Spacing.three },
  commentMeta: { alignItems: 'baseline', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  composerInput: { borderRadius: Radius.xlarge, flex: 1, fontSize: 14, lineHeight: 20, maxHeight: 112, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? 11 : 8 },
  composerRow: { alignItems: 'flex-end', flexDirection: 'row', gap: Spacing.two },
  description: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, minHeight: 72, padding: Spacing.three },
  emptyBlock: { alignItems: 'flex-start', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  emptyBlockCopy: { flex: 1, gap: Spacing.one },
  evidence: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, padding: Spacing.three },
  evidenceHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  evidenceTitle: { flex: 1 },
  inlineInput: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flex: 1, fontSize: 14, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  label: { alignItems: 'center', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  labelDot: { borderRadius: 4, height: 8, width: 8 },
  loadMoreButton: { alignItems: 'center', borderRadius: Radius.medium, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  metadataLabel: { flex: 1 },
  metadataRow: { alignItems: 'center', borderCurve: 'continuous', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.three, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  metadataValue: { maxWidth: '48%' },
  mentionChip: { borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  mentionRow: { gap: Spacing.two },
  progressTrack: { borderRadius: Radius.small, height: 6, overflow: 'hidden' },
  progressValue: { borderRadius: Radius.small, height: 6 },
  quote: { borderLeftWidth: 3, paddingLeft: Spacing.three },
  section: { gap: Spacing.two },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTrailing: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, maxWidth: '58%' },
  sendButton: { alignItems: 'center', borderRadius: TouchTarget / 2, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  surface: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  activityActor: { flex: 1 },
  activityChange: { alignItems: 'center', borderRadius: Radius.small, flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  activityMeta: { alignItems: 'baseline', flexDirection: 'row', gap: Spacing.two },
  timelineBody: { borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: Spacing.one, padding: Spacing.three },
  timelineLine: { flex: 1, marginBottom: -5, marginTop: Spacing.one, width: 2 },
  timelineMarker: { alignItems: 'center', borderRadius: Radius.pill, height: 30, justifyContent: 'center', width: 30 },
  timelineRail: { alignItems: 'center', width: 32 },
  timelineRow: { flexDirection: 'row', gap: Spacing.two, minHeight: 58 },
});
