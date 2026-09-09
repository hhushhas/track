import type { TaskPriority } from '@track/shared/tasks';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useNetworkState } from 'expo-network';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { SkeletonList } from '@/components/skeleton-row';
import { OptionsSheet, SheetFieldButton, SheetInput, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import type { TaskMoveInput } from '@/components/task-board';
import {
  SuggestionInbox,
  TaskCollection,
  type MobileBoardView,
  type MobileSuggestionView,
  type MobileTaskView,
} from '@/components/task-list-content';
import { TaskAction, TaskCard, TaskStateBanner } from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { hapticMedium } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
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
type GlobalTaskView = MobileTaskView & {
  project: { _id: Id<'projects'>; name: string };
  companyName: string;
  companyId?: Id<'companies'>;
  projectMemberId: Id<'projectMembers'>;
};
const priorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];

function readableError(failure: unknown) {
  return taskErrorMessage(failure, 'The task action failed. Check your connection and try again.');
}

export default function TasksScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const release = useReleaseConfig();
  const network = useNetworkState();
  const { trackUserId } = useTrackUser();
  const { projectId, companyId, membershipId, archive, tab: tabParam, suggestionId, boardId: routeBoardId, taskId: focusedTaskId } = useLocalSearchParams<{
    projectId?: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
    tab?: string;
    suggestionId?: string;
    boardId?: string;
    taskId?: string;
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
  const suggestions = useQuery(api.taskSuggestions.list, release.tasks && projectId && tab === 'inbox' && !readOnly ? {
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
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createPicker, setCreatePicker] = useState<CreatePicker>(null);

  // Keep route-driven navigation authoritative when the bottom bar changes
  // project or opens/closes the task suggestion inbox without remounting this
  // screen.
  useEffect(() => {
    setTab(tabParam === 'inbox' ? 'inbox' : 'board');
    setBoardId(routeBoardId ?? '');
    setError('');
  }, [projectId, routeBoardId, tabParam]);

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
      .filter((item) => !search || `${item.task.title} ${item.task.description ?? ''}`.toLowerCase().includes(search))
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
      const result = await createTask({
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
      });
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
        <Stack.Screen options={{ title: 'Tasks unavailable' }} />
        <EmptyState icon="file-document-outline" title="Tasks unavailable" body="Conversation remains available while the task release is disabled." />
      </ThemedView>
    );
  }

  if (!projectId) {
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ title: 'My tasks' }} />
        <FlatList
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
            description={item.task.description}
            dueDate={item.task.dueDate}
            evidence={item.references.length > 0}
            onPress={() => router.push(taskDetailHref(item.project._id, item.task.publicKey, item.companyId ? {
              companyId: item.companyId,
              membershipId: item.projectMemberId,
            } : null))}
            priority={item.task.priority}
            publicKey={item.task.publicKey}
            stateName={item.state?.name ?? 'Unknown'}
            title={item.task.title}
          />}
        />
      </ThemedView>
    );
  }

  const heading = (
    <>
      {offline ? <TaskStateBanner icon="cloud-off" message="Offline — showing saved tasks" tone="offline" /> : null}
      {readOnly ? <TaskStateBanner icon="shield-lock-outline" message="Read-only Company exit archive" /> : null}
      {tab !== 'inbox' ? (
        <>
          {tab === 'board' ? (
            <View style={styles.boardToolbar}>
              <Pressable
                accessibilityLabel={`Board: ${selectedBoard?.board.name ?? 'none'}`}
                accessibilityRole="button"
                onPress={() => setBoardOpen(true)}
                style={styles.boardViewButton}>
                <PlatformIcon color={theme.text} name="view-board" size={18} />
                <ThemedText numberOfLines={1} style={styles.boardViewLabel} type="smallBold">{selectedBoard?.board.name ?? 'Board'}</ThemedText>
                <PlatformIcon color={theme.textSecondary} name="chevron-down" size={16} />
              </Pressable>
              <View style={styles.boardTools}>
                <IconButton accessibilityLabel="Search tasks" icon="search" onPress={() => setSearchOpen(true)} selected={Boolean(boardSearch)} size={19} />
                <IconButton accessibilityLabel="Filter and sort tasks" icon="filter" onPress={() => setFilterOpen(true)} selected={boardFilter !== 'all' || Boolean(statusFilterId) || boardSort !== 'manual' || hideEmptyColumns} size={19} />
              </View>
            </View>
          ) : null}
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
      tab="board"
      tasks={boards === undefined ? undefined : tasks}
    />
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: tab === 'inbox' ? 'Task suggestions' : 'Tasks',
        headerLargeTitle: false,
        headerTransparent: false,
        headerRight: () => (
          <View style={styles.headerActions}>
            {!readOnly ? (
              <IconButton
                accessibilityLabel={tab === 'inbox' ? 'Return to board' : 'Review task suggestions'}
                icon="lightbulb-outline"
                onPress={() => {
                  setTab((current) => current === 'inbox' ? 'board' : 'inbox');
                }}
                selected={tab === 'inbox'}
              />
            ) : null}
            {!readOnly ? (
              <IconButton accessibilityLabel="Create task" icon="plus" onPress={() => setCreateOpen(true)} size={24} />
            ) : null}
          </View>
        ),
      }} />

      {tab === 'board' ? (
        <View style={styles.boardScreen}>
          {heading}
          {collection}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]}
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
        </ScrollView>
      )}

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
        title={createPicker ? `Choose ${createPicker}` : 'Create task'}
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
            <View style={styles.sheetIntro}>
              <ThemedText type="subtitle">Turn work into a clear next step</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">Only the title is required. Structured details use compact pickers.</ThemedText>
            </View>
            <SheetInput label="Title" maxLength={180} onChangeText={setTitle} value={title} />
            <SheetInput label="Description" maxLength={4000} multiline onChangeText={setDescription} value={description} />
            <SheetFieldButton icon="person" label="Assignee" onClear={selectedCreateAssigneeId ? () => setAssigneeId('') : undefined} onPress={() => setCreatePicker('assignee')} placeholder="Unassigned" value={assignableCreateAssignees?.find((item) => item.member._id === selectedCreateAssigneeId)?.user.displayName} />
            <SheetFieldButton icon="flag" label="Priority" onPress={() => setCreatePicker('priority')} value={taskPriorityLabel(priority)} />
            <SheetFieldButton icon="circle-outline" label="Status" onPress={() => setCreatePicker('status')} value={selectedCreateBoard?.states.find((state) => state._id === createWorkflowStateId)?.name} />
            {boards && boards.length > 1 ? <SheetFieldButton icon="view-board" label="Board" onPress={() => setCreatePicker('board')} value={selectedCreateBoard?.board.name} /> : null}
            <DateField onChange={setDueDate} value={dueDate} />
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
  boardToolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 40 },
  boardTools: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  boardViewButton: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, maxWidth: 220, minHeight: TouchTarget },
  boardViewLabel: { flexShrink: 1 },
  boardScreen: { flex: 1, gap: Spacing.three, padding: Spacing.four },
  content: { gap: Spacing.three, padding: Spacing.four },
  contextHeading: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  contextTitle: { flex: 1, gap: 2 },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  inboxHeading: { gap: Spacing.one },
  globalHeading: { gap: Spacing.one },
  globalList: { gap: Spacing.two },
  projectBoardPrompt: { gap: Spacing.two, marginTop: Spacing.two },
  screen: { flex: 1 },
  sheetIntro: { gap: Spacing.one },
});
