import type { TaskPriority } from '@track/shared/tasks';
import { useMutation, useQuery } from 'convex/react';
import { useNetworkState } from 'expo-network';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import {
  TaskActivityTab,
  TaskCommentComposer,
  TaskDetailsTab,
  TaskDiscussionTab,
} from '@/components/task-detail-content';
import type {
  MobileTaskAssignee,
  MobileTaskBoard,
  MobileTaskDetail,
  MobileTaskListItem,
  TaskEditField,
} from '@/components/task-detail-types';
import {
  TaskCardSkeletons,
  TaskDueChip,
  TaskPriorityBadge,
  TaskSegmentedControl,
  TaskStateBanner,
  TaskStatusPill,
} from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFontScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { channelHref } from '@/lib/company-navigation';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
import { setActivePushContext } from '@/lib/push-presentation';
import { shortTaskKey, taskPriorityLabel } from '@/lib/task-presentation';

type DetailTab = 'details' | 'discussion' | 'activity';

type TaskFieldPatch = {
  assigneeProjectMemberId?: Id<'projectMembers'> | null;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  title?: string;
  workflowStateId?: Id<'taskWorkflowStates'>;
};

const priorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];
const detailTabs: Array<{ label: string; value: DetailTab }> = [
  { label: 'Details', value: 'details' },
  { label: 'Discussion', value: 'discussion' },
  { label: 'Activity', value: 'activity' },
];
const fieldTitles: Record<TaskEditField, string> = {
  assignee: 'Assignee',
  description: 'Description',
  dueDate: 'Due date',
  labels: 'Labels',
  more: 'Task options',
  priority: 'Priority',
  status: 'Move to',
};

function errorMessage(failure: unknown) {
  if (!(failure instanceof Error)) return 'The task action failed.';
  if (failure.message.includes('task_conflict')) return 'This task changed elsewhere.';
  if (failure.message.includes('task_access_changed')) return 'This task is no longer available to this represented membership.';
  return failure.message.replaceAll('_', ' ');
}

export default function TaskScreen() {
  const theme = useTheme();
  const router = useRouter();
  const release = useReleaseConfig();
  const network = useNetworkState();
  const { projectId, taskKey, companyId, membershipId, archive } = useLocalSearchParams<{
    projectId: string;
    taskKey: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
  }>();
  const project = projectId as Id<'projects'>;
  useFocusEffect(useCallback(() => {
    if (projectId && taskKey) setActivePushContext({ projectId, taskKey });
    return () => setActivePushContext(null);
  }, [projectId, taskKey]));
  const identity = companyId && membershipId ? {
    actingCompanyId: companyId as Id<'companies'>,
    projectMemberId: membershipId as Id<'projectMembers'>,
  } : {};
  const detail = useQuery(api.tasks.getByKey, release.tasks ? {
    projectId: project,
    publicKey: taskKey,
    ...identity,
  } : 'skip') as MobileTaskDetail | null | undefined;
  const boards = useQuery(api.taskBoards.list, release.tasks ? {
    projectId: project,
    ...identity,
  } : 'skip') as MobileTaskBoard[] | undefined;
  const allTasks = useQuery(api.tasks.list, release.tasks ? {
    projectId: project,
    ...identity,
  } : 'skip') as MobileTaskListItem[] | undefined;
  const assignees = useQuery(api.tasks.listEligibleAssignees, detail && archive !== '1' ? {
    projectId: project,
    groupId: detail.task.groupId,
    ...identity,
  } : 'skip') as MobileTaskAssignee[] | undefined;
  const labels = useQuery(api.taskLabels.list, release.tasks && archive !== '1' ? {
    projectId: project,
    ...identity,
  } : 'skip') as Array<Doc<'taskLabels'>> | undefined;
  const updateTask = useMutation(api.tasks.update);
  const createTask = useMutation(api.tasks.create);
  const createComment = useMutation(api.taskComments.create);
  const setFollowing = useMutation(api.tasks.setFollowing);
  const setArchived = useMutation(api.tasks.setArchived);
  const setTaskLabels = useMutation(api.taskLabels.setTaskLabels);
  const [tab, setTab] = useState<DetailTab>('details');
  const [field, setField] = useState<TaskEditField | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [mentionIds, setMentionIds] = useState<Array<Id<'projectMembers'>>>([]);
  const [subtask, setSubtask] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [confirmPatch, setConfirmPatch] = useState<TaskFieldPatch | null>(null);
  const [busy, setBusy] = useState(false);
  // Each save returns the next revision, so consecutive inline edits chain
  // without waiting for the reactive query to catch up.
  const savedRevision = useRef<number | null>(null);

  const offline = network.isConnected === false || network.isInternetReachable === false;
  const board = boards?.find((item) => item.board._id === detail?.task.boardId);
  const subtasks = useMemo(
    () => allTasks?.filter((item) => item.task.parentTaskId === detail?.task._id) ?? [],
    [allTasks, detail?.task._id],
  );
  const completedSubtasks = subtasks.filter((item) =>
    item.state?.category === 'completed' || item.state?.category === 'canceled',
  ).length;
  const readOnly = archive === '1' || Boolean(detail && !detail.capabilities.canEdit);
  const labelIds = detail?.labels.map((label) => label._id) ?? [];

  async function run(action: () => Promise<unknown>, clear?: () => void) {
    setBusy(true);
    setError('');
    try {
      await action();
      clear?.();
      hapticMedium();
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof Error && failure.message.includes('task_conflict')) {
        savedRevision.current = null;
        setConflict(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveField(patch: TaskFieldPatch, confirmOpenSubtasks?: boolean) {
    if (!detail) return;
    setField(null);
    setConfirmPatch(null);
    await run(async () => {
      try {
        savedRevision.current = await updateTask({
          taskId: detail.task._id,
          expectedRevision: Math.max(detail.task.revision, savedRevision.current ?? 0),
          confirmOpenSubtasks,
          ...patch,
          ...identity,
        });
      } catch (failure) {
        if (failure instanceof Error
          && failure.message.includes('task_open_subtasks_confirmation_required')) {
          setConfirmPatch(patch);
        }
        throw failure;
      }
    });
  }

  async function saveLabels(next: Array<Id<'taskLabels'>>) {
    if (!detail) return;
    await run(async () => {
      savedRevision.current = await setTaskLabels({
        taskId: detail.task._id,
        labelIds: next,
        expectedRevision: Math.max(detail.task.revision, savedRevision.current ?? 0),
        ...identity,
      });
    });
  }

  async function toggleSubtask(item: MobileTaskListItem) {
    if (!board) return;
    const terminal = item.state?.category === 'completed' || item.state?.category === 'canceled';
    const destination = terminal
      ? board.states.find((state) => state.isDefault)
        ?? board.states.find((state) => state.category === 'unstarted')
      : board.states.find((state) => state.category === 'completed');
    if (!destination) return;
    await run(() => updateTask({
      taskId: item.task._id,
      expectedRevision: item.task.revision,
      workflowStateId: destination._id,
      confirmOpenSubtasks: true,
      ...identity,
    }));
  }

  function openReference(reference: Doc<'taskReferences'>) {
    if (!reference.groupId) return;
    hapticLight();
    router.push(channelHref(
      project,
      reference.groupId,
      companyId && membershipId ? {
        archived: archive === '1',
        companyId: companyId as Id<'companies'>,
        membershipId: membershipId as Id<'projectMembers'>,
      } : null,
      reference.messageId,
    ) as never);
  }

  function reviewConflict() {
    savedRevision.current = null;
    setConflict(false);
    setError('');
    setTitleDraft(null);
  }

  if (!release.tasks) {
    return (
      <ThemedView style={styles.screen}>
        <EmptyState icon="file-document-outline" title="Tasks unavailable" body="Conversation remains available while the task release is disabled." />
      </ThemedView>
    );
  }
  if (detail === undefined) {
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ title: taskKey ? shortTaskKey(taskKey) : 'Task' }} />
        <View style={styles.loading}>
          <View style={[styles.loadingHero, { backgroundColor: theme.skeleton }]} />
          <TaskCardSkeletons count={3} />
        </View>
      </ThemedView>
    );
  }
  if (!detail) {
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ title: 'Task unavailable' }} />
        <EmptyState icon="shield-lock-outline" title="Task unavailable" body="The task does not exist or this represented membership cannot access its scope." />
      </ThemedView>
    );
  }

  const assigneeName = assignees?.find((item) => item.member._id === detail.task.assigneeProjectMemberId)?.user.displayName
    ?? (detail.assignee ? 'Assigned member' : 'Unassigned');

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: shortTaskKey(detail.task.publicKey),
        headerRight: () => (
          <Pressable
            accessibilityLabel="Task options"
            onPress={() => {
              hapticLight();
              setField('more');
            }}
            style={styles.headerButton}>
            <PlatformIcon color={theme.accent} name="dots-horizontal" size={22} />
          </Pressable>
        ),
      }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={[styles.content, tab === 'discussion' && styles.contentWithComposer]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled">
          {offline ? <TaskStateBanner icon="cloud-off" message="Offline — reconnect to update this task" tone="offline" /> : null}
          {archive === '1' ? <TaskStateBanner icon="shield-lock-outline" message="Read-only Company exit archive" /> : null}
          {readOnly && archive !== '1' ? <TaskStateBanner icon="shield-lock-outline" message="You can view this task, but editing is restricted" /> : null}
          {detail.restrictedEarlierContext ? (
            <TaskStateBanner icon="shield-lock-outline" message="Some earlier context is restricted by Channel access" />
          ) : null}
          {conflict ? (
            <TaskStateBanner
              action={{ label: 'Review latest', onPress: reviewConflict }}
              icon="refresh"
              message="This task changed elsewhere"
              tone="danger"
            />
          ) : confirmPatch ? (
            <TaskStateBanner
              action={{ label: 'Complete anyway', onPress: () => void saveField(confirmPatch, true) }}
              icon="alert-circle"
              message="This task still has open checklist items."
              tone="danger"
            />
          ) : error ? (
            <TaskStateBanner action={{ label: 'Dismiss', onPress: () => setError('') }} icon="refresh" message={error} tone="danger" />
          ) : null}

          <View style={[styles.hero, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}>
            <View style={styles.eyebrow}>
              <Pressable
                accessibilityHint="Copies the full task id"
                accessibilityLabel={`Task id ${detail.task.publicKey}`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  hapticLight();
                  Clipboard.setString(detail.task.publicKey);
                  setKeyCopied(true);
                  setTimeout(() => setKeyCopied(false), 1500);
                }}>
                <ThemedText themeColor="textSecondary" type="mono">
                  {keyCopied ? 'Copied' : shortTaskKey(detail.task.publicKey)}
                </ThemedText>
              </Pressable>
              <ThemedText numberOfLines={1} style={styles.eyebrowBoard} themeColor="textTertiary" type="caption">
                {detail.board?.name ?? 'Archived board'}
              </ThemedText>
              <TaskPriorityBadge
                onPress={readOnly ? undefined : () => setField('priority')}
                priority={detail.task.priority}
              />
            </View>
            {titleDraft === null ? (
              <Pressable
                accessibilityHint={readOnly ? undefined : 'Edits the title in place'}
                accessibilityRole={readOnly ? 'header' : 'button'}
                disabled={readOnly}
                onPress={() => setTitleDraft(detail.task.title)}>
                <ThemedText style={styles.taskTitle}>{detail.task.title}</ThemedText>
              </Pressable>
            ) : (
              <TextInput
                accessibilityLabel="Task title"
                allowFontScaling
                autoFocus
                cursorColor={theme.accent}
                maxFontSizeMultiplier={MaxFontScale}
                multiline
                onBlur={() => {
                  const next = titleDraft.trim();
                  setTitleDraft(null);
                  if (next && next !== detail.task.title) void saveField({ title: next });
                }}
                onChangeText={setTitleDraft}
                selectionColor={theme.accent}
                selectionHandleColor={theme.accent}
                style={[styles.taskTitle, styles.titleInput, {
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                }]}
                value={titleDraft}
              />
            )}
            <View style={styles.heroMeta}>
              <TaskStatusPill
                category={detail.state?.category}
                label={detail.state?.name ?? 'Unknown'}
                onPress={readOnly ? undefined : () => setField('status')}
              />
              <TaskDueChip
                category={detail.state?.category}
                dueDate={detail.task.dueDate}
                onPress={readOnly ? undefined : () => setField('dueDate')}
              />
              <Pressable
                accessibilityLabel={`Assignee: ${assigneeName}`}
                accessibilityRole="button"
                disabled={readOnly}
                onPress={() => setField('assignee')}
                style={styles.inlineMeta}>
                <PlatformIcon color={theme.textSecondary} name="person" size={16} />
                <ThemedText themeColor="textSecondary" type="caption">{assigneeName}</ThemedText>
              </Pressable>
            </View>
          </View>

          <TaskSegmentedControl onChange={setTab} segments={detailTabs} value={tab} />

          {tab === 'details' ? (
            <TaskDetailsTab
              assigneeName={assigneeName}
              busy={busy}
              completedSubtasks={completedSubtasks}
              detail={detail}
              onAddSubtask={() => void run(() => createTask({
                projectId: project,
                boardId: detail.task.boardId,
                parentTaskId: detail.task._id,
                title: subtask.trim(),
                priority: 'none',
                idempotencyKey: `${Date.now()}-subtask`,
                ...identity,
              }), () => setSubtask(''))}
              onEditField={(next) => {
                if (next === 'description') setDescription(detail.task.description ?? '');
                setField(next);
              }}
              onOpenReference={openReference}
              onSubtaskChange={setSubtask}
              onToggleSubtask={(item) => void toggleSubtask(item)}
              readOnly={readOnly}
              subtask={subtask}
              subtasks={subtasks}
            />
          ) : null}
          {tab === 'discussion' ? <TaskDiscussionTab assignees={assignees} detail={detail} /> : null}
          {tab === 'activity' ? <TaskActivityTab detail={detail} /> : null}
        </ScrollView>

        {tab === 'discussion' && detail.capabilities.canComment && archive !== '1' ? (
          <TaskCommentComposer
            assignees={assignees}
            busy={busy}
            mentionIds={mentionIds}
            onChangeText={setComment}
            onMentionToggle={(memberId) => setMentionIds((current) =>
              current.includes(memberId as Id<'projectMembers'>)
                ? current.filter((id) => id !== memberId)
                : [...current, memberId as Id<'projectMembers'>],
            )}
            onSend={() => void run(() => createComment({
              taskId: detail.task._id,
              body: comment.trim(),
              mentionedProjectMemberIds: mentionIds,
              idempotencyKey: `${Date.now()}-comment`,
              ...identity,
            }), () => {
              setComment('');
              setMentionIds([]);
            })}
            value={comment}
          />
        ) : null}
      </KeyboardAvoidingView>

      <OptionsSheet
        onClose={() => setField(null)}
        title={field ? fieldTitles[field] : ''}
        visible={field !== null}>
        {field === 'status' ? (
          <SheetSection>
            {board?.states.map((state) => (
              <SheetRow
                icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'}
                key={state._id}
                label={state.name}
                onPress={() => void saveField({ workflowStateId: state._id })}
                selected={detail.task.workflowStateId === state._id}
              />
            ))}
          </SheetSection>
        ) : null}
        {field === 'priority' ? (
          <SheetSection>
            {priorities.map((value) => (
              <SheetRow
                icon="flag"
                key={value}
                label={taskPriorityLabel(value)}
                onPress={() => void saveField({ priority: value })}
                selected={detail.task.priority === value}
              />
            ))}
          </SheetSection>
        ) : null}
        {field === 'assignee' ? (
          <SheetSection>
            <SheetRow
              icon="person"
              label="Unassigned"
              onPress={() => void saveField({ assigneeProjectMemberId: null })}
              selected={!detail.task.assigneeProjectMemberId}
            />
            {assignees?.map((item) => (
              <SheetRow
                icon="person"
                key={item.member._id}
                label={`${item.user.displayName}${item.company ? ` · ${item.company.displayName}` : ''}`}
                onPress={() => void saveField({ assigneeProjectMemberId: item.member._id })}
                selected={detail.task.assigneeProjectMemberId === item.member._id}
              />
            ))}
          </SheetSection>
        ) : null}
        {field === 'dueDate' ? (
          <DateField
            autoOpen
            onChange={(value) => void saveField({ dueDate: value })}
            value={detail.task.dueDate}
          />
        ) : null}
        {field === 'description' ? (
          <>
            <SheetInput autoFocus label="Description" multiline onChangeText={setDescription} value={description} />
            <SheetRow
              icon="check"
              label={busy ? 'Saving…' : 'Save description'}
              onPress={() => void saveField({ description: description.trim() || null })}
            />
          </>
        ) : null}
        {field === 'labels' ? (
          <SheetSection>
            {labels?.length ? labels.map((label) => (
              <SheetRow
                icon="tag"
                key={label._id}
                label={label.name}
                onPress={() => void saveLabels(labelIds.includes(label._id)
                  ? labelIds.filter((id) => id !== label._id)
                  : [...labelIds, label._id])}
                selected={labelIds.includes(label._id)}
              />
            )) : <SheetRow icon="tag" label="No labels defined yet" onPress={() => setField(null)} />}
          </SheetSection>
        ) : null}
        {field === 'more' ? (
          <SheetSection>
            {detail.capabilities.canComment ? (
              <SheetRow
                icon={detail.following ? 'bell-off-outline' : 'bell-outline'}
                label={detail.following ? 'Unfollow task' : 'Follow task'}
                onPress={() => {
                  setField(null);
                  void run(() => setFollowing({
                    taskId: detail.task._id,
                    enabled: !detail.following,
                    ...identity,
                  }));
                }}
              />
            ) : null}
            {!readOnly ? (
              <SheetRow icon="tag" label="Edit labels" onPress={() => setField('labels')} />
            ) : null}
            {detail.capabilities.canArchive ? (
              <SheetRow
                destructive={!detail.task.archivedAt}
                icon={detail.task.archivedAt ? 'archive-restore' : 'archive'}
                label={detail.task.archivedAt ? 'Restore task' : 'Archive task'}
                onPress={() => {
                  setField(null);
                  void run(() => setArchived({
                    taskId: detail.task._id,
                    archived: !detail.task.archivedAt,
                    ...identity,
                  }));
                }}
              />
            ) : null}
          </SheetSection>
        ) : null}
      </OptionsSheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six },
  contentWithComposer: { paddingBottom: Spacing.four },
  eyebrow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  eyebrowBoard: { flex: 1 },
  headerButton: { alignItems: 'center', height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  hero: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  heroMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  inlineMeta: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minHeight: 32 },
  loading: { gap: Spacing.four, padding: Spacing.three, paddingTop: Spacing.six },
  loadingHero: { borderRadius: Radius.large, height: 112 },
  screen: { flex: 1 },
  taskTitle: { fontSize: 25, fontWeight: '700', letterSpacing: -0.3, lineHeight: 32 },
  titleInput: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
