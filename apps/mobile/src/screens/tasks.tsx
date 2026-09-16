import type { TaskPriority } from '@track/shared/tasks';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useNetworkState } from 'expo-network';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { SkeletonList } from '@/components/skeleton-row';
import { ScreenEntrance } from '@/components/screen-entrance';
import { OptionsSheet, SheetFieldButton, SheetInput, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { ProjectAccountButton } from '@/components/project-overview-dashboard';
import type { TaskMoveInput } from '@/components/task-board';
import {
  SuggestionInbox,
  TaskCollection,
  type MobileBoardView,
  type MobileSuggestionView,
  type MobileTaskView,
} from '@/components/task-list-content';
import { TaskAction, TaskCard, TaskStateBanner } from '@/components/task-ui';
import {
  SprintFlowHeader,
  TaskCreateContext,
  TaskSuggestionBanner,
  TasksToolbar,
  type TaskViewMode,
} from '@/components/tasks-dashboard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTrackUser } from '@/contexts/track-user-context';
import { hapticMedium } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
import { useAppToast } from '@/components/app-toast';
import { enqueueOfflineTask } from '@/lib/offline-task-queue';
import { groupMobileTasksByState, taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { taskPriorityLabel } from '@/lib/task-presentation';
import { resolveWorkflowStateId, taskMatchesWorkflowStateFilter, visibleBoardStateIds } from '@/lib/task-workflow';
import { taskErrorMessage } from '@/lib/user-facing-error';

type AssigneeView = {
  member: Doc<'projectMembers'>;
  user: { _id: Id<'users'>; displayName: string };
  company: Doc<'companies'> | null;
};

type TaskTab = 'board' | 'inbox';
type CreatePicker = 'assignee' | 'board' | 'priority' | 'status' | null;
type BoardSort = 'manual' | 'due' | 'priority';
type BoardFilter = 'all' | 'open' | 'completed' | 'high';
type GlobalTaskView = FunctionReturnType<typeof api.mobile.listMyTasks>['page'][number];
const priorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];

function readableError(failure: unknown) {
  return taskErrorMessage(failure, 'The task action failed. Check your connection and try again.');
}

export default function TasksScreen() {
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { showToast } = useAppToast();
  const release = useReleaseConfig();
  const network = useNetworkState();
  const { trackUserId, openProfileSheet } = useTrackUser();
  const largeText = useWindowDimensions().fontScale > 1.2;
  const { projectId, companyId, membershipId, archive, tab: tabParam, suggestionId, boardId: routeBoardId, taskId: focusedTaskId, create: createParam } = useLocalSearchParams<{
    projectId?: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
    tab?: string;
    suggestionId?: string;
    boardId?: string;
    taskId?: string;
    create?: string;
  }>();
  const project = projectId as Id<'projects'>;
  const identity: MobileTaskIdentity | null = companyId && membershipId ? {
    archived: archive === '1',
    companyId: companyId as Id<'companies'>,
    membershipId: membershipId as Id<'projectMembers'>,
  } : null;
  const queryIdentity = identity ? {
    actingCompanyId: identity.companyId,
    projectMemberId: identity.membershipId,
  } : {};
  const readOnly = archive === '1';
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const currentUser = useQuery(api.auth.getCurrentUser);
  const projectNavigation = useQuery(api.mobile.resolveNavigation, trackUserId && projectId ? {
    userId: trackUserId,
    projectId: project,
    actingCompanyId: identity?.companyId,
    projectMemberId: identity?.membershipId,
  } : 'skip');
  const boards = useQuery(api.taskBoards.list, release.tasks && projectId ? {
    projectId: project,
    ...queryIdentity,
  } : 'skip') as MobileBoardView[] | undefined;
  const assignees = useQuery(api.tasks.listEligibleAssignees, release.tasks && projectId && !readOnly ? {
    projectId: project,
    ...queryIdentity,
  } : 'skip') as AssigneeView[] | undefined;
  const currentMemberId = identity?.membershipId
    ?? assignees?.find((item) => item.user._id === currentUser?._id)?.member._id;
  const [tab, setTab] = useState<TaskTab>(tabParam === 'inbox' ? 'inbox' : 'board');
  const [boardId, setBoardId] = useState<string>(routeBoardId ?? '');
  const selectedBoard = boards?.find((item) => item.board._id === boardId)
    ?? boards?.find((item) => item.board.isDefault)
    ?? boards?.[0];
  const tasks = useQuery(api.tasks.list, release.tasks && projectId && tab !== 'inbox' ? {
    projectId: project,
    boardId: selectedBoard?.board._id,
    ...queryIdentity,
  } : 'skip') as MobileTaskView[] | undefined;
  const myTaskPages = usePaginatedQuery(api.mobile.listMyTasks, release.tasks && !projectId && trackUserId ? {
    userId: trackUserId,
    openOnly: true,
  } : 'skip', { initialNumItems: 10 });
  const myTasks = useMemo(() => [...myTaskPages.results as GlobalTaskView[]].sort((left, right) =>
    (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31') ||
    right.task.updatedAt - left.task.updatedAt,
  ), [myTaskPages.results]);
  const { loadMore: loadMoreMyTasks, status: myTaskStatus } = myTaskPages;
  useEffect(() => {
    if (myTaskStatus === 'CanLoadMore') loadMoreMyTasks(10);
  }, [loadMoreMyTasks, myTaskStatus]);
  const suggestions = useQuery(api.taskSuggestions.list, release.tasks && projectId && !readOnly ? {
    projectId: project,
    ...queryIdentity,
  } : 'skip') as MobileSuggestionView[] | undefined;
  const createTask = useMutation(api.tasks.create);
  const moveTask = useMutation(api.tasks.moveTask);
  const acceptSuggestion = useMutation(api.taskSuggestions.accept);
  const dismissSuggestion = useMutation(api.taskSuggestions.dismiss);
  const hideSuggestion = useMutation(api.taskSuggestions.hide);
  const linkSuggestion = useMutation(api.taskSuggestions.linkToExisting);
  const [createOpen, setCreateOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<MobileTaskView | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createBoardId, setCreateBoardId] = useState('');
  const [createWorkflowStateId, setCreateWorkflowStateId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const [boardSort, setBoardSort] = useState<BoardSort>('manual');
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const [statusFilterId, setStatusFilterId] = useState('');
  const [hideEmptyColumns, setHideEmptyColumns] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createPicker, setCreatePicker] = useState<CreatePicker>(null);
  const [viewMode, setViewMode] = useState<TaskViewMode>('board');

  // Keep route-driven navigation authoritative when the bottom bar changes
  // project or opens/closes the task suggestion inbox without remounting this
  // screen.
  useEffect(() => {
    setTab(tabParam === 'inbox' ? 'inbox' : 'board');
    setBoardId(routeBoardId ?? '');
    setError('');
  }, [projectId, routeBoardId, tabParam]);

  useEffect(() => {
    if (createParam !== '1' || !projectId || readOnly) return;
    setCreateOpen(true);
    router.setParams({ create: undefined });
  }, [createParam, projectId, readOnly, router]);

  const selectedCreateBoard = boards?.find((item) => item.board._id === createBoardId)
    ?? selectedBoard;
  const createAssignees = useQuery(api.tasks.listEligibleAssignees, release.tasks && projectId && !readOnly
    && selectedCreateBoard ? {
    projectId: project,
    groupId: selectedCreateBoard.board.groupId,
    ...queryIdentity,
  } : 'skip') as AssigneeView[] | undefined;
  const currentMember = assignees?.find((item) => item.member._id === currentMemberId);
  const canAssignOthers = currentMember
    ? ['owner', 'admin', 'staff', 'manager'].includes(currentMember.member.role)
    : false;
  const assignableCreateAssignees = canAssignOthers
    ? createAssignees
    : createAssignees?.filter((item) => item.member._id === currentMemberId);
  const selectedCreateAssigneeId = assignableCreateAssignees?.some((item) =>
    item.member._id === assigneeId,
  ) ? assigneeId : '';

  useEffect(() => {
    if (!createOpen || !selectedCreateBoard) return;
    setCreateWorkflowStateId((current) =>
      resolveWorkflowStateId(selectedCreateBoard.states, current),
    );
  }, [createOpen, selectedCreateBoard]);

  useEffect(() => {
    if (!statusFilterId || selectedBoard?.states.some((state) => state._id === statusFilterId)) return;
    setStatusFilterId('');
  }, [selectedBoard, statusFilterId]);

  const columns = useMemo(() => {
    if (!selectedBoard) return [];
    const search = boardSearch.trim().toLowerCase();
    const priorityRank: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    const visibleTasks = (tasks ?? [])
      .filter((item) => !search || `${item.task.title} ${'description' in item.task ? item.task.description ?? '' : ''}`.toLowerCase().includes(search))
      .filter((item) => boardFilter === 'all'
        || (boardFilter === 'completed' && item.state?.category === 'completed')
        || (boardFilter === 'open' && item.state?.category !== 'completed' && item.state?.category !== 'canceled')
        || (boardFilter === 'high' && (item.task.priority === 'urgent' || item.task.priority === 'high')))
      .filter((item) => taskMatchesWorkflowStateFilter(item.task.workflowStateId, statusFilterId))
      .sort((a, b) => {
        if (boardSort === 'priority') return priorityRank[a.task.priority] - priorityRank[b.task.priority];
        if (boardSort === 'due') return (a.task.dueDate ?? '9999-12-31').localeCompare(b.task.dueDate ?? '9999-12-31');
        return a.task.rank.localeCompare(b.task.rank);
      });
    const grouped = groupMobileTasksByState(
      selectedBoard.states.map((state) => state._id),
      visibleTasks,
    );
    const allColumns = selectedBoard.states.map((state, index) => ({
      state,
      tasks: grouped[index].tasks,
    }));
    const visibleStateIds = new Set(visibleBoardStateIds(
      allColumns.map((column) => ({ _id: column.state._id, taskCount: column.tasks.length })),
      statusFilterId,
      hideEmptyColumns,
    ));
    return allColumns.filter((column) => visibleStateIds.has(column.state._id));
  }, [boardFilter, boardSearch, boardSort, hideEmptyColumns, selectedBoard, statusFilterId, tasks]);
  const statusStates = boards?.find((item) =>
    item.board._id === statusTarget?.task.boardId,
  )?.states ?? [];
  const visibleTaskCount = columns.reduce((count, column) => count + column.tasks.length, 0);
  const visibleProjectTasks = useMemo(() => {
    const list = columns.flatMap((column) => column.tasks);
    if (boardSort === 'due') {
      return list.sort((left, right) =>
        (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31'));
    }
    if (boardSort === 'priority') {
      const rank: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      return list.sort((left, right) => rank[left.task.priority] - rank[right.task.priority]);
    }
    return list;
  }, [boardSort, columns]);
  const ambientSuggestion = suggestions?.[0];

  async function move(input: TaskMoveInput) {
    await moveTask({ ...input, ...queryIdentity });
    hapticMedium();
  }

  function moveToState(state: Doc<'taskWorkflowStates'>) {
    const item = statusTarget;
    setStatusTarget(null);
    if (!item || state._id === item.task.workflowStateId) return;
    void move({
      expectedRevision: item.task.revision,
      taskId: item.task._id,
      workflowStateId: state._id,
    }).catch((failure) => setError(readableError(failure)));
  }

  function assigneeName(item: MobileTaskView) {
    if (!item.task.assigneeProjectMemberId) return undefined;
    return assignees?.find((candidate) => candidate.member._id === item.task.assigneeProjectMemberId)?.user.displayName
      ?? (item.assignee ? 'Assigned member' : undefined);
  }

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const taskInput = {
        projectId: project,
        boardId: selectedCreateBoard?.board._id,
        workflowStateId: createWorkflowStateId
          ? createWorkflowStateId as Id<'taskWorkflowStates'>
          : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ?? undefined,
        assigneeProjectMemberId: selectedCreateAssigneeId
          ? selectedCreateAssigneeId as Id<'projectMembers'>
          : undefined,
        idempotencyKey: `${Date.now()}-${Math.random()}`,
        ...queryIdentity,
      };
      if (offline && trackUserId) {
        await enqueueOfflineTask(trackUserId, taskInput);
        hapticMedium();
        setCreateOpen(false);
        setTitle('');
        setDescription('');
        setCreateBoardId('');
        setCreateWorkflowStateId('');
        setPriority('none');
        setDueDate(null);
        setAssigneeId('');
        showToast({ title: 'Task saved offline', message: 'It will sync when your connection returns.', tone: 'info' });
        return;
      }
      const result = await createTask(taskInput);
      hapticMedium();
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setCreateBoardId('');
      setCreateWorkflowStateId('');
      setPriority('none');
      setDueDate(null);
      setAssigneeId('');
      router.push(taskDetailHref(project, result.publicKey, identity));
    } catch (failure) {
      setError(readableError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function runSuggestion(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      hapticMedium();
    } catch (failure) {
      setError(readableError(failure));
    }
  }

  function suggestionDestination(row: MobileSuggestionView) {
    const compatible = boards?.filter((item) => item.board.groupId === row.suggestion.groupId) ?? [];
    return compatible.find((item) => item.board.isDefault) ?? compatible[0];
  }

  function accept(row: MobileSuggestionView) {
    const destination = suggestionDestination(row);
    if (!destination) {
      setError('No compatible board is available for this suggestion.');
      return;
    }
    void runSuggestion(() => acceptSuggestion({
      suggestionId: row.suggestion._id,
      boardId: destination.board._id,
      title: row.suggestion.proposedTitle,
      description: row.suggestion.proposedDescription,
      priority: row.suggestion.proposedPriority,
      dueDate: row.suggestion.proposedDueDate,
      assigneeProjectMemberId: row.suggestion.proposedAssigneeProjectMemberId,
      duplicateOverride: Boolean(row.possibleDuplicateTask),
      idempotencyKey: `${Date.now()}-${row.suggestion._id}`,
      ...queryIdentity,
    }));
  }

  if (!release.tasks) {
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ headerRight: () => <ProjectAccountButton label="Track member" onPress={openProfileSheet} seed={trackUserId ?? 'track-member'} />, title: 'Tasks unavailable' }} />
        <EmptyState icon="task" title="Tasks unavailable" body="Conversation remains available while the task release is disabled." />
      </ThemedView>
    );
  }

  if (!projectId) {
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ headerRight: () => <ProjectAccountButton label="Track member" onPress={openProfileSheet} seed={trackUserId ?? 'track-member'} />, title: 'My tasks' }} />
        <ScreenEntrance style={styles.screenContent}><FlatList
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]}
          contentInsetAdjustmentBehavior="automatic"
          data={myTasks}
          keyExtractor={(item) => item.task._id}
          ListHeaderComponent={<>
            {offline ? <TaskStateBanner icon="cloud-off" message="Offline — showing saved tasks" tone="offline" /> : null}
            <View style={styles.globalHeading}>
              <ThemedText themeColor="textSecondary" type="message">Your open work across every Project you can access.</ThemedText>
            </View>
          </>}
          ListEmptyComponent={myTaskStatus === 'LoadingFirstPage'
            ? <SkeletonList count={4} label="Loading My Tasks" />
            : <EmptyState icon="check-box-outline" title="Nothing assigned to you" body="Tasks assigned to you across your Projects will appear here." />}
          ListFooterComponent={<View style={styles.projectBoardPrompt}>
            <ThemedText type="subtitle">Need a Project board?</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">Choose a Project only when you want its board, Channels, or to create new work.</ThemedText>
            <TaskAction label="Choose a Project" onPress={() => router.push('/projects')} primary />
          </View>}
          renderItem={({ item }) => <TaskCard
            assignee="You"
            category={item.state?.category}
            contextLabel={`${item.companyName} · ${item.project.name}`}
            description={'description' in item.task ? item.task.description : undefined}
            dueDate={item.task.dueDate}
            evidence={'references' in item && item.references.length > 0}
            onPress={() => router.push(taskDetailHref(item.project._id, item.task.publicKey, item.companyId ? {
              companyId: item.companyId,
              membershipId: item.projectMemberId,
            } : null))}
            priority={item.task.priority}
            publicKey={item.task.publicKey}
            stateName={item.state?.name ?? 'Unknown'}
            title={item.task.title}
          />}
        /></ScreenEntrance>
      </ThemedView>
    );
  }

  const heading = (
    <>
      {offline ? <TaskStateBanner icon="cloud-off" message="Offline — showing saved tasks" tone="offline" /> : null}
      {readOnly ? <TaskStateBanner icon="shield-lock-outline" message="Read-only Company exit archive" /> : null}
      {tab !== 'inbox' ? (
        <>
          <TasksToolbar
            boardName={selectedBoard?.board.name ?? 'Board'}
            filterActive={boardFilter !== 'all' || Boolean(statusFilterId) || boardSort !== 'manual'}
            mode={viewMode}
            onBoardPress={() => setBoardOpen(true)}
            onFilterPress={() => setFilterOpen(true)}
            onModeChange={setViewMode}
            onSearchPress={() => setSearchOpen(true)}
            onSuggestionsPress={() => setTab('inbox')}
            projectName={projectNavigation?.available && projectNavigation.project
              ? projectNavigation.project.name
              : 'Project tasks'}
            searchActive={Boolean(boardSearch)}
            suggestionCount={suggestions?.length ?? 0}
          />
          {ambientSuggestion ? (
            <TaskSuggestionBanner
              onDismiss={ambientSuggestion.canDismiss ? () => void runSuggestion(() => dismissSuggestion({
                suggestionId: ambientSuggestion.suggestion._id,
                reason: 'not_actionable',
                idempotencyKey: `${Date.now()}-dismiss`,
                ...queryIdentity,
              })) : undefined}
              onReview={() => setTab('inbox')}
              title={ambientSuggestion.suggestion.proposedTitle}
            />
          ) : null}
          <SprintFlowHeader columnCount={columns.length} taskCount={visibleTaskCount} />
        </>
      ) : (
        <View style={styles.inboxHeading}>
          <ThemedText type="subtitle">Conversation suggestions</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Review grounded work detected from the conversations you can access.
          </ThemedText>
        </View>
      )}
      {error ? (
        <TaskStateBanner
          action={{ label: 'Dismiss', onPress: () => setError('') }}
          icon="refresh"
          message={error}
          tone="danger"
        />
      ) : null}
    </>
  );

  const collection = (
    <TaskCollection
      assigneeName={assigneeName}
      columns={columns}
      focusedTaskId={focusedTaskId}
      onCreate={() => setCreateOpen(true)}
      onMove={move}
      onOpen={(item) => router.push(taskDetailHref(project, item.task.publicKey, identity))}
      onStatusPress={setStatusTarget}
      onViewAll={() => undefined}
      readOnly={readOnly}
      selectedBoard={selectedBoard}
      tab={viewMode === 'board' ? 'board' : 'all'}
      tasks={boards === undefined ? undefined : viewMode === 'board' ? tasks : visibleProjectTasks}
    />
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: 'Tasks',
        headerBackVisible: false,
        headerLargeTitle: false,
        headerTransparent: false,
        headerRight: () => (
          <View style={styles.headerActions}>
            {tab === 'inbox' ? (
              <IconButton accessibilityLabel="Return to task board" icon="arrow-left" onPress={() => setTab('board')} />
            ) : null}
            <ProjectAccountButton label="Track member" onPress={openProfileSheet} seed={trackUserId ?? 'track-member'} />
          </View>
        ),
      }} />

      {tab === 'board' && viewMode === 'board' ? (
        <ScreenEntrance style={styles.screenContent}><View style={[styles.boardScreen, { paddingBottom: bottomContentInset + TouchTarget + Spacing.four }]}>
          {heading}
          {collection}
        </View></ScreenEntrance>
      ) : (
        <ScreenEntrance style={styles.screenContent}><ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset + TouchTarget + Spacing.four }]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled">
          {heading}
          {tab === 'inbox'
            ? <SuggestionInbox
                focusedSuggestionId={suggestionId}
                onAccept={accept}
                onDismiss={(row) => void runSuggestion(() => dismissSuggestion({
                  suggestionId: row.suggestion._id,
                  reason: 'not_actionable',
                  idempotencyKey: `${Date.now()}-dismiss`,
                  ...queryIdentity,
                }))}
                onHide={(row) => void runSuggestion(() => hideSuggestion({
                  suggestionId: row.suggestion._id,
                  ...queryIdentity,
                }))}
                onLink={(row) => row.possibleDuplicateTask && void runSuggestion(() => linkSuggestion({
                  suggestionId: row.suggestion._id,
                  taskId: row.possibleDuplicateTask!._id,
                  idempotencyKey: `${Date.now()}-link`,
                  ...queryIdentity,
                }))}
                readOnly={readOnly}
                suggestions={suggestions}
              />
            : collection}
        </ScrollView></ScreenEntrance>
      )}

      {!readOnly && tab === 'board' ? (
        <View pointerEvents="box-none" style={[styles.createDock, { bottom: bottomContentInset + Spacing.two }]}>
          <TaskAction label="New task" onPress={() => setCreateOpen(true)} primary />
        </View>
      ) : null}

      <OptionsSheet onClose={() => setStatusTarget(null)} title="Move to" visible={Boolean(statusTarget)}>
        <SheetSection title={statusTarget?.task.title}>
          {boards === undefined ? (
            <SheetNote>Loading statuses…</SheetNote>
          ) : null}
          {statusStates.map((state) => (
            <SheetRow
              icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'}
              key={state._id}
              label={state.name}
              onPress={() => moveToState(state)}
              selected={state._id === statusTarget?.task.workflowStateId}
            />
          ))}
          {boards && statusStates.length === 0 ? (
            <SheetNote>
              No active statuses are available for this task.
            </SheetNote>
          ) : null}
        </SheetSection>
      </OptionsSheet>

      <OptionsSheet onClose={() => setBoardOpen(false)} title="Choose board" visible={boardOpen}>
        <SheetSection>
          {boards?.map((item) => (
            <SheetRow
              icon="view-board"
              key={item.board._id}
              label={item.board.name}
              selected={item.board._id === selectedBoard?.board._id}
              onPress={() => {
                setBoardId(item.board._id);
                setBoardOpen(false);
              }}
            />
          ))}
        </SheetSection>
      </OptionsSheet>

      <OptionsSheet
        onClose={() => { setCreatePicker(null); setCreateOpen(false); }}
        showScrollProgress
        title={createPicker ? `Choose ${createPicker}` : 'New task'}
        visible={createOpen}>
        {createPicker ? (
          <>
            <SheetSection><SheetRow icon="chevron-left" label="Back to task" onPress={() => setCreatePicker(null)} /></SheetSection>
            {createPicker === 'board' ? <SheetSection title="Board">
              {boards?.map((item) => <SheetRow icon="view-board" key={item.board._id} label={item.board.name} selected={item.board._id === selectedCreateBoard?.board._id} onPress={() => {
                setCreateBoardId(item.board._id);
                setCreateWorkflowStateId(resolveWorkflowStateId(item.states));
                setCreatePicker(null);
              }} />)}
            </SheetSection> : null}
            {createPicker === 'status' ? <SheetSection title="Status">
              {selectedCreateBoard?.states.map((state) => <SheetRow icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'} key={state._id} label={state.name} selected={createWorkflowStateId === state._id} onPress={() => { setCreateWorkflowStateId(state._id); setCreatePicker(null); }} />)}
              {boards && (!selectedCreateBoard || selectedCreateBoard.states.length === 0) ? <SheetNote>No active statuses are available for this board.</SheetNote> : null}
            </SheetSection> : null}
            {createPicker === 'priority' ? <SheetSection title="Priority">
              {priorities.map((value) => <SheetRow icon="flag" key={value} label={taskPriorityLabel(value)} selected={priority === value} onPress={() => { setPriority(value); setCreatePicker(null); }} />)}
            </SheetSection> : null}
            {createPicker === 'assignee' ? <SheetSection title="Assignee">
              <SheetRow icon="person" label="Unassigned" selected={!selectedCreateAssigneeId} onPress={() => { setAssigneeId(''); setCreatePicker(null); }} />
              {assignableCreateAssignees?.map((item) => <SheetRow icon="person" key={item.member._id} label={`${item.user.displayName}${item.company ? ` · ${item.company.displayName}` : ''}`} selected={selectedCreateAssigneeId === item.member._id} onPress={() => { setAssigneeId(item.member._id); setCreatePicker(null); }} />)}
            </SheetSection> : null}
          </>
        ) : (
          <>
            <TaskCreateContext
              boardName={selectedCreateBoard?.board.name}
              projectName={projectNavigation?.available && projectNavigation.project
                ? projectNavigation.project.name
                : 'Project'}
            />
            <SheetInput label="Task title" maxLength={180} onChangeText={setTitle} value={title} />
            <SheetInput label="Description" maxLength={4000} multiline onChangeText={setDescription} value={description} />
            <View style={[styles.fieldGrid, largeText && styles.fieldGridLarge]}>
              <View style={styles.fieldCell}>
                <SheetFieldButton icon="person" label="Assignee" onClear={selectedCreateAssigneeId ? () => setAssigneeId('') : undefined} onPress={() => setCreatePicker('assignee')} placeholder="Unassigned" value={assignableCreateAssignees?.find((item) => item.member._id === selectedCreateAssigneeId)?.user.displayName} />
              </View>
              <View style={styles.fieldCell}><DateField onChange={setDueDate} value={dueDate} /></View>
              <View style={styles.fieldCell}>
                <SheetFieldButton icon="circle-outline" label="Status" onPress={() => setCreatePicker('status')} value={selectedCreateBoard?.states.find((state) => state._id === createWorkflowStateId)?.name} />
              </View>
              <View style={styles.fieldCell}>
                <SheetFieldButton icon="flag" label="Priority" onPress={() => setCreatePicker('priority')} value={taskPriorityLabel(priority)} />
              </View>
            </View>
            {boards && boards.length > 1 ? <SheetFieldButton icon="view-board" label="Board" onPress={() => setCreatePicker('board')} value={selectedCreateBoard?.board.name} /> : null}
            {error ? <ThemedText themeColor="danger" type="small">{error}</ThemedText> : null}
            <TaskAction disabled={busy || !title.trim()} label={busy ? 'Creating…' : 'Create task'} onPress={() => void create()} primary />
          </>
        )}
      </OptionsSheet>

      <OptionsSheet onClose={() => setSearchOpen(false)} title="Search tasks" visible={searchOpen}>
        <SheetInput autoFocus label="Search" maxLength={200} onChangeText={setBoardSearch} placeholder="Search by title or description" value={boardSearch} />
        <TaskAction label="Done" onPress={() => setSearchOpen(false)} primary />
      </OptionsSheet>
      <OptionsSheet onClose={() => setFilterOpen(false)} title="Filter and sort" visible={filterOpen}>
        <SheetSection title="Show">
          <SheetRow icon="check-box-outline" label="All tasks" selected={boardFilter === 'all'} onPress={() => setBoardFilter('all')} />
          <SheetRow icon="circle-outline" label="Open tasks" selected={boardFilter === 'open'} onPress={() => setBoardFilter('open')} />
          <SheetRow icon="check-circle" label="Completed" selected={boardFilter === 'completed'} onPress={() => setBoardFilter('completed')} />
          <SheetRow icon="flag" label="High priority" selected={boardFilter === 'high'} onPress={() => setBoardFilter('high')} />
          <SheetRow icon="view-column" label="Hide empty statuses" selected={hideEmptyColumns} onPress={() => setHideEmptyColumns((current) => !current)} />
        </SheetSection>
        <SheetSection title="Status">
          <SheetRow icon="view-column" label="All statuses" selected={!statusFilterId} onPress={() => setStatusFilterId('')} />
          {selectedBoard?.states.map((state) => (
            <SheetRow
              icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'}
              key={state._id}
              label={state.name}
              onPress={() => setStatusFilterId(state._id)}
              selected={statusFilterId === state._id}
            />
          ))}
        </SheetSection>
        <SheetSection title="Order">
          <SheetRow icon="drag-handle" label="Board order" selected={boardSort === 'manual'} onPress={() => setBoardSort('manual')} />
          <SheetRow icon="calendar" label="Due date" selected={boardSort === 'due'} onPress={() => setBoardSort('due')} />
          <SheetRow icon="flag" label="Priority" selected={boardSort === 'priority'} onPress={() => setBoardSort('priority')} />
        </SheetSection>
        <TaskAction label="Done" onPress={() => setFilterOpen(false)} primary />
      </OptionsSheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  boardScreen: { flex: 1, gap: Spacing.two, padding: Spacing.three },
  content: { gap: Spacing.three, padding: Spacing.four },
  createDock: { alignItems: 'flex-end', paddingHorizontal: Spacing.four, position: 'absolute', right: 0 },
  fieldCell: { flex: 1, minWidth: 150 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fieldGridLarge: { flexDirection: 'column' },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  inboxHeading: { gap: Spacing.one },
  globalHeading: { gap: Spacing.one },
  projectBoardPrompt: { gap: Spacing.two, marginTop: Spacing.two },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
});
