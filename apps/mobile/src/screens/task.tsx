import type { TaskPriority } from '@track/shared/tasks';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useNetworkState } from 'expo-network';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ActionButton } from '@/components/action-button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { OptionsSheet, SheetInput, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import {
  TaskCommentComposer,
  TaskDetailsTab,
  TaskUpdatesFeed,
} from '@/components/task-detail-content';
import type { TaskEditField } from '@/components/task-detail-types';
import {
  TaskCardSkeletons,
  TaskPriorityBadge,
  TaskStateBanner,
} from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFontScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { taskErrorMessage } from '@/lib/user-facing-error';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { channelHref, projectOverviewHref } from '@/lib/company-navigation';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { idempotencyKey } from '@/lib/idempotency';
import { useReleaseConfig } from '@/lib/release-config';
import { setActivePushContext } from '@/lib/push-presentation';
import { shortTaskKey, taskDueDisplay, taskPriorityLabel } from '@/lib/task-presentation';
import { taskDecisionForCategory } from '@/lib/task-decision';
import { visibleTaskUpdates } from '@/lib/task-updates';
import { taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { uniqueTaskViews } from '@/lib/unique-task-views';

type MobileTaskListItem = FunctionReturnType<typeof api.tasks.listChildren>['page'][number];

type TaskFieldPatch = {
  assigneeProjectMemberId?: Id<'projectMembers'> | null;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  title?: string;
  workflowStateId?: Id<'taskWorkflowStates'>;
};

type TaskEditableSnapshot = {
  description: string;
  title: string;
};

const priorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];
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
  return taskErrorMessage(failure, 'The task action failed. Check your connection and try again.');
}

export default function TaskScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const release = useReleaseConfig();
  const { trackUserId } = useTrackUser();
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
  const routeIdentity: MobileTaskIdentity | null = companyId && membershipId ? {
    archived: archive === '1',
    companyId: companyId as Id<'companies'>,
    membershipId: membershipId as Id<'projectMembers'>,
  } : null;
  const detail = useQuery(api.tasks.getByKey, release.tasks ? {
    projectId: project,
    publicKey: taskKey,
    ...identity,
  } : 'skip');
  const boards = useQuery(api.taskBoards.list, release.tasks ? {
    projectId: project,
    ...identity,
  } : 'skip');
  const childPage = usePaginatedQuery(api.tasks.listChildren, detail ? {
    parentTaskId: detail.task._id,
    includeArchived: archive === '1' || Boolean(detail.task.archivedAt),
    ...identity,
  } : 'skip', { initialNumItems: 50 });
  const commentPage = usePaginatedQuery(api.tasks.listHistory, detail ? {
    taskId: detail.task._id,
    kind: 'comments',
    ...identity,
  } : 'skip', { initialNumItems: 50 });
  const activityPage = usePaginatedQuery(api.tasks.listHistory, detail ? {
    taskId: detail.task._id,
    kind: 'activities',
    ...identity,
  } : 'skip', { initialNumItems: 50 });
  const referencePage = usePaginatedQuery(api.tasks.listReferences, detail ? {
    taskId: detail.task._id,
    ...identity,
  } : 'skip', { initialNumItems: 50 });
  const assignees = useQuery(api.tasks.listEligibleAssignees, detail && archive !== '1' ? {
    projectId: project,
    groupId: detail.task.groupId,
    ...identity,
  } : 'skip');
  const projectNavigation = useQuery(api.mobile.resolveNavigation, trackUserId && projectId ? {
    userId: trackUserId,
    projectId: project,
    actingCompanyId: companyId as Id<'companies'> | undefined,
    projectMemberId: membershipId as Id<'projectMembers'> | undefined,
  } : 'skip');
  const assignableAssignees = useMemo(() => {
    if (!assignees || !detail) return assignees;
    if (detail.capabilities.canAssignOthers) return assignees;
    return assignees.filter((item) => item.member._id === identity.projectMemberId);
  }, [assignees, detail, identity.projectMemberId]);
  const canClearAssignee = Boolean(detail?.capabilities.canAssignOthers)
    || detail?.task.assigneeProjectMemberId === identity.projectMemberId;
  const labels = useQuery(api.taskLabels.list, release.tasks && archive !== '1' ? {
    projectId: project,
    ...identity,
  } : 'skip');
  const updateTask = useMutation(api.tasks.update);
  const createTask = useMutation(api.tasks.create);
  const createComment = useMutation(api.taskComments.create);
  const setFollowing = useMutation(api.tasks.setFollowing);
  const setArchived = useMutation(api.tasks.setArchived);
  const setTaskLabels = useMutation(api.taskLabels.setTaskLabels);
  const [field, setField] = useState<TaskEditField | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [subtask, setSubtask] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [confirmPatch, setConfirmPatch] = useState<TaskFieldPatch | null>(null);
  const [highlightSubtaskId, setHighlightSubtaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [mentionIds, setMentionIds] = useState<Array<Id<'projectMembers'>>>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  // Each save returns the next revision, so consecutive inline edits chain
  // without waiting for the reactive query to catch up.
  const savedRevision = useRef<number | null>(null);
  const checklistY = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const subtaskIntentRef = useRef(idempotencyKey());
  const commentDraftKey = useRef<string | null>(null);
  const subtaskPendingRef = useRef(false);
  const focusTitleInput = useCallback((input: TextInput | null) => {
    if (input) input.focus();
  }, []);
  const taskIdentityRef = useRef<string | null>(null);
  const serverSnapshotRef = useRef<TaskEditableSnapshot | null>(null);
  const baselineSnapshotRef = useRef<TaskEditableSnapshot | null>(null);
  const taskIdentity = [
    projectId,
    taskKey,
    companyId ?? '',
    membershipId ?? '',
  ].join(':');

  useEffect(() => {
    if (!detail || detail.task.publicKey !== taskKey) return;
    const nextSnapshot = {
      description: detail.task.description ?? '',
      title: detail.task.title,
    };
    if (taskIdentityRef.current !== taskIdentity || !serverSnapshotRef.current || !baselineSnapshotRef.current) {
      taskIdentityRef.current = taskIdentity;
      serverSnapshotRef.current = nextSnapshot;
      baselineSnapshotRef.current = nextSnapshot;
      savedRevision.current = detail.task.revision;
      setTitleDraft(null);
      setDescription('');
      setConflict(false);
      setError('');
      return;
    }

    const previousSnapshot = serverSnapshotRef.current;
    const baselineSnapshot = baselineSnapshotRef.current;
    const localTitle = titleDraft ?? previousSnapshot.title;
    const localDescription = field === 'description' ? description : previousSnapshot.description;
    const titleDirty = localTitle !== baselineSnapshot.title;
    const descriptionDirty = localDescription !== baselineSnapshot.description;
    const titleChanged = previousSnapshot.title !== nextSnapshot.title;
    const descriptionChanged = previousSnapshot.description !== nextSnapshot.description;
    if ((titleDirty && titleChanged) || (descriptionDirty && descriptionChanged)) setConflict(true);
    if (!titleDirty && titleDraft !== null && titleDraft !== nextSnapshot.title) setTitleDraft(nextSnapshot.title);
    if (!descriptionDirty && field === 'description' && description !== nextSnapshot.description) setDescription(nextSnapshot.description);
    serverSnapshotRef.current = nextSnapshot;
    if (!titleDirty && !descriptionDirty) {
      baselineSnapshotRef.current = nextSnapshot;
      savedRevision.current = detail.task.revision;
    }
  }, [description, detail, field, taskIdentity, taskKey, titleDraft]);

  const offline = network.isConnected === false || network.isInternetReachable === false;
  const board = boards?.find((item) => item.board._id === detail?.task.boardId);
  const subtasks = useMemo(() => childPage.results, [childPage.results]);
  const visibleSubtasks = uniqueTaskViews(subtasks);
  const openSubtaskCount = visibleSubtasks.filter((item) =>
    item.state?.category !== 'completed' && item.state?.category !== 'canceled',
  ).length;
  const comments = useMemo(
    () => commentPage.results.filter((item): item is Doc<'taskComments'> => 'body' in item),
    [commentPage.results],
  );
  const activities = useMemo(
    () => activityPage.results.filter((item): item is Doc<'taskActivities'> => 'action' in item),
    [activityPage.results],
  );
  const hasMoreUpdates = commentPage.status === 'CanLoadMore' || commentPage.status === 'LoadingMore'
    || activityPage.status === 'CanLoadMore' || activityPage.status === 'LoadingMore';
  const updates = useMemo(() => visibleTaskUpdates(
    comments,
    activities,
    commentPage.status === 'CanLoadMore' || commentPage.status === 'LoadingMore',
    activityPage.status === 'CanLoadMore' || activityPage.status === 'LoadingMore',
  ), [activities, activityPage.status, commentPage.status, comments]);
  const references = referencePage.results;
  const readOnly = archive === '1' || Boolean(detail && !detail.capabilities.canEdit);
  const labelIds = detail?.labels.flatMap((label) => label ? [label._id] : []) ?? [];

  async function run(action: () => Promise<unknown>, clear?: () => void) {
    setBusy(true);
    setError('');
    try {
      await action();
      clear?.();
      hapticMedium();
      return true;
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof Error && failure.message.includes('task_conflict')) {
        savedRevision.current = null;
        setConflict(true);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveField(patch: TaskFieldPatch, confirmOpenSubtasks?: boolean) {
    if (!detail) return;
    setField(null);
    setConfirmPatch(null);
    setBusy(true);
    setError('');
    try {
      const nextRevision = await updateTask({
        taskId: detail.task._id,
        expectedRevision: savedRevision.current ?? detail.task.revision,
        confirmOpenSubtasks,
        ...patch,
        ...identity,
      });
      savedRevision.current = nextRevision;
      const previousSnapshot = serverSnapshotRef.current;
      if (previousSnapshot) {
        const nextSnapshot = {
          description: patch.description === undefined
            ? previousSnapshot.description
            : patch.description ?? '',
          title: patch.title ?? previousSnapshot.title,
        };
        serverSnapshotRef.current = nextSnapshot;
        baselineSnapshotRef.current = nextSnapshot;
      }
      if (patch.title !== undefined) setTitleDraft(null);
      hapticMedium();
    } catch (failure) {
      if (failure instanceof Error
        && failure.message.includes('task_open_subtasks_confirmation_required')) {
        setConfirmPatch(patch);
        return;
      }
      setError(errorMessage(failure));
      if (failure instanceof Error && failure.message.includes('task_conflict')) {
        savedRevision.current = null;
        setConflict(true);
      }
      if (patch.description !== undefined) setField('description');
    } finally {
      setBusy(false);
    }
  }

  async function saveLabels(next: Array<Id<'taskLabels'>>) {
    if (!detail) return;
    await run(async () => {
      savedRevision.current = await setTaskLabels({
        taskId: detail.task._id,
        labelIds: next,
        expectedRevision: savedRevision.current ?? detail.task.revision,
        ...identity,
      });
    });
  }

  async function toggleSubtask(item: MobileTaskListItem) {
    if (!board) return;
    setHighlightSubtaskId(null);
    const terminal = item.state?.category === 'completed' || item.state?.category === 'canceled';
    const destination = terminal
      ? board.states.find((state) => state.isDefault)
        ?? board.states.find((state) => state.category === 'unstarted')
      : board.states.find((state) => state.category === 'completed');
    if (!destination) return;
    await run(async () => {
      await updateTask({
        taskId: item.task._id,
        expectedRevision: item.task.revision,
        workflowStateId: destination._id,
        confirmOpenSubtasks: true,
        ...identity,
      });
    });
  }

  function reviewOpenChecklist() {
    const firstOpen = subtasks.find((item) =>
      item.state?.category !== 'completed' && item.state?.category !== 'canceled');
    setConfirmPatch(null);
    setError('');
    setHighlightSubtaskId(firstOpen?.task._id ?? null);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, checklistY.current - Spacing.three) });
    });
  }

  function openReference(reference: Doc<'taskReferences'>) {
    if (!reference.groupId) return;
    hapticLight();
    const context = companyId && membershipId ? {
      archived: archive === '1',
      companyId: companyId as Id<'companies'>,
      membershipId: membershipId as Id<'projectMembers'>,
    } : null;
    if (reference.channelThreadId) {
      router.push(threadConversationHref(project, reference.groupId, reference.channelThreadId, context, reference.messageId) as never);
      return;
    }
    router.push(channelHref(project, reference.groupId, context, reference.messageId) as never);
  }

  function loadEarlierUpdates() {
    if (commentPage.status === 'CanLoadMore') commentPage.loadMore(50);
    if (activityPage.status === 'CanLoadMore') activityPage.loadMore(50);
  }

  async function addComment() {
    const body = comment.trim();
    if (!detail || !body || busy || !detail.capabilities.canComment) return;
    setBusy(true);
    setError('');
    try {
      await createComment({
        taskId: detail.task._id,
        body,
        mentionedProjectMemberIds: mentionIds,
        idempotencyKey: commentDraftKey.current ??= idempotencyKey(),
        ...identity,
      });
      setComment('');
      commentDraftKey.current = null;
      setMentionIds([]);
      setComposerOpen(false);
    } catch (failure) {
      setError(taskErrorMessage(failure, 'The update could not be added. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

  function reviewConflict() {
    if (!detail) return;
    const snapshot = {
      description: detail.task.description ?? '',
      title: detail.task.title,
    };
    serverSnapshotRef.current = snapshot;
    baselineSnapshotRef.current = snapshot;
    savedRevision.current = detail.task.revision;
    setConflict(false);
    setError('');
    setTitleDraft(null);
    setDescription('');
  }

  function addSubtask() {
    if (!detail || !subtask.trim() || subtaskPendingRef.current) return;
    subtaskPendingRef.current = true;
    void run(() => createTask({
      projectId: project,
      boardId: detail.task.boardId,
      parentTaskId: detail.task._id,
      title: subtask.trim(),
      priority: 'none',
      idempotencyKey: subtaskIntentRef.current,
      ...identity,
    }), () => {
      setSubtask('');
      subtaskIntentRef.current = idempotencyKey();
    }).finally(() => {
      subtaskPendingRef.current = false;
    });
  }

  if (!release.tasks) {
    return (
      <ThemedView style={styles.screen}>
        <EmptyState icon="task" title="Tasks aren’t available here yet" body="You can still use Project conversations while task tools are unavailable." />
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
        <EmptyState icon="shield-lock-outline" title="Task unavailable" body="This task isn’t available with your current Project access." />
      </ThemedView>
    );
  }

  const assigneeName = assignees?.find((item) => item.member._id === detail.task.assigneeProjectMemberId)?.user.displayName
    ?? (detail.assignee ? 'Assigned member' : 'Unassigned');
  const updatesLoading = commentPage.status === 'LoadingFirstPage' || activityPage.status === 'LoadingFirstPage';
  const taskDecision = taskDecisionForCategory(detail.state?.category);
  const decisionState = board?.states.find((state) => state.category === taskDecision.targetCategory);
  const dueDisplay = taskDueDisplay(detail.task.dueDate, undefined, detail.state?.category);
  const canAdvance = !readOnly && detail.state?.category !== 'completed' && detail.state?.category !== 'canceled';

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: 'Task',
        headerRight: () => (
          <View style={styles.headerActions}>
            <IconButton
              accessibilityLabel={detail.following ? 'Unfollow task' : 'Follow task'}
              appearance="plain"
              icon="bookmark"
              onPress={() => void run(() => setFollowing({
                taskId: detail.task._id,
                enabled: !detail.following,
                ...identity,
              }))}
              selected={detail.following}
            />
            <IconButton
              accessibilityLabel="Task options"
              appearance="plain"
              icon="dots-horizontal"
              onPress={() => {
                setField('more');
              }}
            />
          </View>
        ),
      }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomContentInset },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled">
          {offline ? <TaskStateBanner icon="cloud-off" message="Offline — reconnect to update this task" tone="offline" /> : null}
          {archive === '1' ? <TaskStateBanner icon="shield-lock-outline" message="Read-only archive" /> : null}
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
          ) : error ? (
            <TaskStateBanner action={{ label: 'Dismiss', onPress: () => setError('') }} icon="refresh" message={error} tone="danger" />
          ) : null}

          <View style={styles.hero}>
          <View style={styles.eyebrow}>
            <ThemedText themeColor="accentStrong" type="captionBold">Project</ThemedText>
            <ThemedText numberOfLines={1} style={styles.eyebrowBoard} themeColor="textTertiary" type="caption">
              {projectNavigation?.available && projectNavigation.project ? projectNavigation.project.name : 'Project'}
            </ThemedText>
          </View>
          {detail.board ? <ThemedText themeColor="textSecondary" type="caption">Board · {detail.board.name}</ThemedText> : null}
          <View style={styles.heroKeyRow}>
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
              ref={focusTitleInput}
              cursorColor={theme.accent}
              keyboardAppearance={theme.background === '#1b1917' ? 'dark' : 'light'}
              maxFontSizeMultiplier={MaxFontScale}
              multiline
              onBlur={() => {
                const next = titleDraft.trim();
                if (!next || next === detail.task.title) {
                  setTitleDraft(null);
                  return;
                }
                void saveField({ title: next });
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
          <View style={[styles.propertyGroup, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}>
            <TaskPropertyRow icon={detail.state?.category === 'completed' ? 'check-circle' : detail.state?.category === 'started' ? 'play' : detail.state?.category === 'canceled' ? 'close' : 'circle-outline'} label="Status" onPress={readOnly ? undefined : () => setField('status')} value={detail.state?.name ?? 'Unknown'} />
            <TaskPropertyRow icon={dueDisplay?.overdue ? 'calendar-remove' : 'calendar'} label="Due date" onPress={readOnly ? undefined : () => setField('dueDate')} tone={dueDisplay?.overdue ? 'danger' : undefined} value={dueDisplay?.label ?? 'No due date'} />
            <TaskPropertyRow icon="account-circle" label="Assignee" onPress={readOnly ? undefined : () => setField('assignee')} value={assigneeName} />
          </View>
        </View>

          {canAdvance ? (
            <ActionButton
              disabled={readOnly}
              icon={taskDecision.icon}
              label={taskDecision.label}
              loading={busy}
              onPress={() => {
                if (decisionState) void saveField({ workflowStateId: decisionState._id });
                else setField('status');
              }}
              style={styles.decisionButton}
            />
          ) : null}

          <TaskDetailsTab
            busy={busy}
            detail={detail}
            highlightSubtaskId={highlightSubtaskId ?? undefined}
            onAddSubtask={addSubtask}
            onChecklistLayout={(event) => { checklistY.current = event.nativeEvent.layout.y; }}
            onEditField={(next) => {
              if (next === 'description') setDescription(detail.task.description ?? '');
              setField(next);
            }}
            onOpenReference={openReference}
            onOpenSubtask={(item) => router.push(taskDetailHref(project, item.task.publicKey, routeIdentity))}
            onLoadMoreReferences={referencePage.status === 'CanLoadMore' ? () => referencePage.loadMore(50) : undefined}
            onSubtaskChange={setSubtask}
            onToggleSubtask={(item) => void toggleSubtask(item)}
            readOnly={readOnly}
            subtask={subtask}
            subtasks={subtasks}
            references={references}
            referencesLoading={referencePage.status === 'LoadingFirstPage'}
            referencesLoadingMore={referencePage.status === 'LoadingMore'}
            onLoadMoreSubtasks={childPage.status === 'CanLoadMore' ? () => childPage.loadMore(50) : undefined}
            subtasksLoadingMore={childPage.status === 'LoadingMore'}
          />

          <View style={styles.updatesSection}>
            <View style={styles.updatesHeading}>
              <ThemedText type="subtitle">Conversation and updates</ThemedText>
              <ThemedText themeColor="textSecondary" type="caption">Comments and task changes in one timeline.</ThemedText>
            </View>
            <TaskUpdatesFeed
              assignees={assignees}
              loading={updatesLoading}
              loadingEarlier={commentPage.status === 'LoadingMore' || activityPage.status === 'LoadingMore'}
              onLoadEarlier={hasMoreUpdates ? loadEarlierUpdates : undefined}
              updates={updates}
              workflowStates={board?.states}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {composerOpen && detail.capabilities.canComment ? <TaskCommentComposer
        assignees={assignees}
        busy={busy}
        mentionIds={mentionIds}
        onCancel={() => setComposerOpen(false)}
        onChangeText={(value) => {
          if (value !== comment) commentDraftKey.current = null;
          setComment(value);
        }}
        onMentionToggle={(memberId) => setMentionIds((current) => current.includes(memberId as Id<'projectMembers'>)
          ? current.filter((id) => id !== memberId)
          : [...current, memberId as Id<'projectMembers'>])}
        onSend={() => void addComment()}
        value={comment}
      /> : detail.capabilities.canComment ? <Pressable accessibilityLabel="Write a task update" accessibilityRole="button" onPress={() => setComposerOpen(true)} style={[styles.taskUpdatePrompt, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}>
        <PlatformIcon color={theme.accentStrong} name="message" size={18} />
        <ThemedText themeColor="textSecondary" type="small">Write an update</ThemedText>
      </Pressable> : null}

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
              disabled={!canClearAssignee}
              onPress={() => void saveField({ assigneeProjectMemberId: null })}
              selected={!detail.task.assigneeProjectMemberId}
            />
            {assignableAssignees?.map((item) => (
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
            <SheetRow
              icon="project"
              label="View project"
              onPress={() => {
                setField(null);
                router.push(projectOverviewHref(project, routeIdentity ? {
                  archived: Boolean(routeIdentity.archived),
                  companyId: routeIdentity.companyId,
                  membershipId: routeIdentity.membershipId,
                } : null));
              }}
            />
            <SheetRow
              icon="view-board"
              label="Show on board"
              onPress={() => {
                setField(null);
                router.push(taskListHref(project, routeIdentity, undefined, undefined, {
                  boardId: detail.task.boardId,
                  taskId: detail.task._id,
                }));
              }}
            />
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
              <SheetRow icon="tag" label={detail.labels.some(Boolean) ? 'Edit labels' : 'Add labels'} onPress={() => setField('labels')} />
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

      <OptionsSheet
        onClose={() => { setConfirmPatch(null); setError(''); }}
        title="Open checklist items"
        visible={Boolean(confirmPatch)}>
        <SheetNote>
          {openSubtaskCount} {openSubtaskCount === 1 ? 'checklist item is' : 'checklist items are'} still open.
        </SheetNote>
        <ActionButton label="Review checklist" onPress={reviewOpenChecklist} />
        <ActionButton
          label="Complete anyway"
          onPress={() => {
            const patch = confirmPatch;
            setConfirmPatch(null);
            setError('');
            if (patch) void saveField(patch, true);
          }}
          variant="secondary"
        />
        <ActionButton label="Cancel" onPress={() => { setConfirmPatch(null); setError(''); }} variant="secondary" />
      </OptionsSheet>
    </ThemedView>
  );
}

function TaskPropertyRow({ icon, label, onPress, tone, value }: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: 'danger';
  value: string;
}) {
  const theme = useTheme();
  return <Pressable
    accessibilityLabel={`${label}: ${value}`}
    accessibilityRole={onPress ? 'button' : 'text'}
    disabled={!onPress}
    onPress={onPress}
    style={({ pressed }) => [styles.propertyRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent', borderBottomColor: theme.hairline }]}>
    <PlatformIcon color={tone === 'danger' ? theme.danger : theme.textSecondary} name={icon} size={18} weight="medium" />
    <ThemedText style={styles.propertyLabel} themeColor="textSecondary" type="small">{label}</ThemedText>
    <ThemedText numberOfLines={1} style={[styles.propertyValue, tone === 'danger' && { color: theme.danger }]} type="smallBold">{value}</ThemedText>
    {onPress ? <PlatformIcon color={theme.textTertiary} name="chevron-right" size={17} /> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six, paddingTop: Spacing.five },
  decisionButton: { alignSelf: 'stretch' },
  eyebrow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  eyebrowBoard: { flex: 1 },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  headerButton: { alignItems: 'center', height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  hero: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  heroKeyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  propertyGroup: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  propertyLabel: { flex: 1, marginLeft: Spacing.two },
  propertyRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 50, paddingHorizontal: Spacing.three },
  propertyValue: { flexShrink: 1, maxWidth: '48%' },
  loading: { gap: Spacing.four, padding: Spacing.three, paddingTop: Spacing.six },
  loadingHero: { borderCurve: 'continuous', borderRadius: Radius.large, height: 112 },
  screen: { flex: 1 },
  taskTitle: { fontSize: 25, fontWeight: '700', letterSpacing: -0.3, lineHeight: 32 },
  taskUpdatePrompt: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, margin: Spacing.three, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  updatesHeading: { gap: Spacing.one },
  updatesSection: { gap: Spacing.two, paddingTop: Spacing.two },
  titleInput: {
    borderCurve: 'continuous',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
