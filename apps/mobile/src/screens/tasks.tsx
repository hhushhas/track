import type { TaskPriority } from '@track/shared/tasks';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useNetworkState } from 'expo-network';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { ConversationProjectTabs } from '@/components/conversation-project-tabs';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { ScreenEntrance } from '@/components/screen-entrance';
import { OptionsSheet, SheetFieldButton, SheetInput, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import type { TaskMoveInput } from '@/components/task-board';
import {
  SuggestionInbox,
  TaskCollection,
  type MobileBoardView,
  type MobileSuggestionView,
  type MobileTaskView,
} from '@/components/task-list-content';
import { TaskAction, TaskStateBanner } from '@/components/task-ui';
import {
  SprintFlowHeader,
  TaskCreateContext,
  TasksToolbar,
  type TaskViewMode,
} from '@/components/tasks-dashboard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useCompany } from '@/contexts/company-context';
import { usePrimaryNavigationVisibility } from '@/contexts/primary-navigation-visibility-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticMedium } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
import { useAppToast } from '@/components/app-toast';
import { enqueueOfflineTask } from '@/lib/offline-task-queue';
import { groupMobileTasksByState, taskDetailHref, taskListHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { taskPriorityLabel } from '@/lib/task-presentation';
import { taskCoverageStatus } from '@/lib/task-coverage';
import { scopeMyTaskItems } from '@/lib/my-task-views';
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
type GlobalBoardView = FunctionReturnType<typeof api.taskBoards.listMine>[number];
type TaskStatusTarget = {
  identity: {
    actingCompanyId?: Id<'companies'>;
    projectMemberId?: Id<'projectMembers'>;
  };
  states: Doc<'taskWorkflowStates'>[];
  task: {
    _id: Id<'tasks'>;
    boardId: Id<'taskBoards'>;
    revision: number;
    title: string;
    workflowStateId: Id<'taskWorkflowStates'>;
  };
};
const priorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];

function readableError(failure: unknown) {
  return taskErrorMessage(failure, 'The task action failed. Check your connection and try again.');
}

export default function TasksScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const { showToast } = useAppToast();
  const release = useReleaseConfig();
  const network = useNetworkState();
  const { actingCompany, actingCompanyId, companies, setActingCompanyId } = useCompany();
  const { setCreateAction, setCreateContext } = usePrimaryNavigationVisibility();
  const { trackUserId } = useTrackUser();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const stackCreateFields = screenWidth < 390 || fontScale > 1.2;
  const { projectId, companyId, membershipId, archive, tab: tabParam, suggestionId, boardId: routeBoardId, groupId: routeGroupId, taskId: focusedTaskId, create: createParam, dueDate: createDueDate, view: viewParam } = useLocalSearchParams<{
    projectId?: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
    tab?: string;
    suggestionId?: string;
    boardId?: string;
    groupId?: string;
    taskId?: string;
    create?: string;
    dueDate?: string;
    view?: string;
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
    ?? boards?.find((item) => routeGroupId && item.board.groupId === routeGroupId)
    ?? boards?.find((item) => item.board.isDefault)
    ?? boards?.[0];
  const tasks = useQuery(api.tasks.list, release.tasks && projectId && tab !== 'inbox' ? {
    projectId: project,
    boardId: selectedBoard?.board._id,
    ...queryIdentity,
  } : 'skip') as MobileTaskView[] | undefined;
  const activeCompanies = useMemo(() => (companies ?? []).filter(({ company }) => company?.status === 'active'), [companies]);
  useEffect(() => {
    if (!actingCompanyId && activeCompanies[0]?.company?._id) setActingCompanyId(activeCompanies[0].company._id);
  }, [actingCompanyId, activeCompanies, setActingCompanyId]);
  const projectDirectoryPages = usePaginatedQuery(api.mobile.listTaskProjects, release.tasks && !projectId && trackUserId && actingCompanyId ? {
    userId: trackUserId,
    actingCompanyId,
  } : 'skip', { initialNumItems: 12 });
  const projectDirectory = useMemo(() => (projectDirectoryPages.results as Array<FunctionReturnType<typeof api.mobile.listTaskProjects>['page'][number]>)
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.membership.status === 'active')),
  [projectDirectoryPages.results]);
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedMyTaskProjectId, setSelectedMyTaskProjectId] = useState<string | null>(null);
  const myTaskPages = usePaginatedQuery(api.mobile.listMyTasks, release.tasks && !projectId && trackUserId && actingCompanyId ? {
    userId: trackUserId,
    actingCompanyId,
  } : 'skip', { initialNumItems: 50 });
  const myTasks = useMemo(() => {
    const seenTaskIds = new Set<string>();
    return [...myTaskPages.results as GlobalTaskView[]]
      .filter((item) => item.companyId === actingCompanyId)
      .filter((item) => {
        if (seenTaskIds.has(item.task._id)) return false;
        seenTaskIds.add(item.task._id);
        return true;
      })
      .sort((left, right) =>
        (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31')
        || right.task.updatedAt - left.task.updatedAt,
      );
  }, [actingCompanyId, myTaskPages.results]);
  const { status: myTaskStatus } = myTaskPages;
  const cappedTaskProject = (myTaskPages.results as GlobalTaskView[])
    .find((item) => item.hasMoreAssignedTasks);
  const taskCoverage = taskCoverageStatus(myTaskStatus, 'Exhausted', Boolean(cappedTaskProject));
  useEffect(() => {
    setSelectedMyTaskProjectId(null);
  }, [actingCompanyId]);
  const globalBoards = useQuery(api.taskBoards.listMine, release.tasks && !projectId ? {
    actingCompanyId: actingCompanyId ?? undefined,
  } : 'skip') as GlobalBoardView[] | undefined;
  const companyBoards = useMemo(() => scopeMyTaskItems(
    globalBoards?.filter((item) => String(item.companyId ?? '') === String(actingCompanyId ?? '')) ?? [],
    selectedMyTaskProjectId,
  ), [actingCompanyId, globalBoards, selectedMyTaskProjectId]);
  const allGlobalTasks = useMemo(() => scopeMyTaskItems([...myTasks].sort((left, right) =>
    (left.task.dueDate ?? '9999-12-31').localeCompare(right.task.dueDate ?? '9999-12-31')
    || right.task.updatedAt - left.task.updatedAt,
  ), selectedMyTaskProjectId), [myTasks, selectedMyTaskProjectId]);
  const boardTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allGlobalTasks) {
      const boardKey = String(item.task.boardId);
      counts.set(boardKey, (counts.get(boardKey) ?? 0) + 1);
    }
    return counts;
  }, [allGlobalTasks]);
  const boardTaskCountsPartial = taskCoverage !== 'complete';
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
  const [createProjectPickerOpen, setCreateProjectPickerOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<TaskStatusTarget | null>(null);
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
  const [activeBoardStateId, setActiveBoardStateId] = useState('');
  const [boardSort, setBoardSort] = useState<BoardSort>('manual');
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const [statusFilterId, setStatusFilterId] = useState('');
  const [hideEmptyColumns, setHideEmptyColumns] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createPicker, setCreatePicker] = useState<CreatePicker>(null);
  const [viewMode, setViewMode] = useState<TaskViewMode>(viewParam === 'list' ? 'list' : 'board');

  useLayoutEffect(() => {
    if (createParam !== '1') {
      setCreateProjectPickerOpen(false);
      return;
    }
    setCreateProjectPickerOpen(!projectId);
  }, [createParam, projectId]);

  useFocusEffect(useCallback(() => {
    setCreateAction(() => {
      if (readOnly) return;
      if (projectId) {
        setDueDate(createDueDate ?? null);
        setCreateOpen(true);
      } else {
        setCreateProjectPickerOpen(true);
      }
    });
    if (!projectId) {
      setCreateContext(null);
      return () => {
        setCreateAction(null);
        setCreateContext(null);
      };
    }
    setCreateContext({ archive: archive === '1', companyId, groupId: routeGroupId, membershipId, projectId, scope: routeGroupId ? 'channel' : 'project' });
    return () => {
      setCreateAction(null);
      setCreateContext(null);
    };
  }, [archive, companyId, createDueDate, membershipId, projectId, readOnly, routeGroupId, setCreateAction, setCreateContext]));

  // Keep route-driven navigation authoritative when the bottom bar changes
  // project or opens/closes the task suggestion inbox without remounting this
  // screen.
  useEffect(() => {
    setTab(tabParam === 'inbox' ? 'inbox' : 'board');
    setBoardId(routeBoardId ?? '');
    setViewMode(viewParam === 'list' ? 'list' : 'board');
    setError('');
  }, [projectId, routeBoardId, tabParam, viewParam]);

  useLayoutEffect(() => {
    if (createParam !== '1' || !projectId || readOnly) return;
    setCreateOpen(true);
    setDueDate(createDueDate ?? null);
  }, [createDueDate, createParam, projectId, readOnly]);

  useEffect(() => {
    if (createParam !== '1' || projectId || projectDirectoryPages.status !== 'Exhausted' || projectDirectory.length !== 1) return;
    const onlyProject = projectDirectory[0];
    if (onlyProject) openCreateForProject(onlyProject);
  }, [createParam, projectDirectory, projectDirectoryPages.status, projectId]);

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

  function closeCreateSheet() {
    setCreatePicker(null);
    setCreateOpen(false);
    if (createParam) router.setParams({ create: undefined, dueDate: undefined });
  }

  function closeCreateProjectPicker() {
    setCreateProjectPickerOpen(false);
    router.setParams({ create: undefined });
  }

  function openCreateForProject(item: NonNullable<typeof projectDirectory[number]>) {
    const projectIdentity: MobileTaskIdentity | null = item.membership.companyId ? {
      archived: item.membership.status === 'archived',
      companyId: item.membership.companyId,
      membershipId: item.membership._id,
    } : null;
    setCreateProjectPickerOpen(false);
    router.replace(taskListHref(item.project._id, projectIdentity, undefined, undefined, { create: true }) as never);
  }

  const createProjectPickerSheet = (
    <OptionsSheet onClose={closeCreateProjectPicker} title="Choose a Project" visible={createProjectPickerOpen}>
      <SheetNote>Tasks belong to a Project. Choose where this task should live.</SheetNote>
      <SheetSection title={actingCompany?.company?.displayName ?? 'Accessible Projects'}>
        {projectDirectory.map((item) => (
          <SheetRow
            detail={item.membership.role ?? undefined}
            icon="project"
            key={item.project._id}
            label={item.project.name}
            onPress={() => openCreateForProject(item)}
          />
        ))}
        {projectDirectoryPages.status === 'LoadingFirstPage' ? <SkeletonList count={3} label="Loading Projects" /> : null}
        {projectDirectoryPages.status === 'CanLoadMore' ? <SheetRow icon="chevron-down" label="Load more Projects" onPress={() => projectDirectoryPages.loadMore(30)} /> : null}
        {projectDirectoryPages.status === 'Exhausted' && projectDirectory.length === 0 ? <EmptyState icon="project" title="No accessible Projects" body="Join a Project before creating a task." /> : null}
      </SheetSection>
    </OptionsSheet>
  );

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
    const seenTaskIds = new Set<string>();
    const visibleTasks = (tasks ?? [])
      .filter((item) => {
        if (seenTaskIds.has(item.task._id)) return false;
        seenTaskIds.add(item.task._id);
        return true;
      })
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
  const statusStates = statusTarget?.states ?? [];
  const visibleTaskCount = columns.reduce((count, column) => count + column.tasks.length, 0);
  useEffect(() => {
    setActiveBoardStateId((current) =>
      columns.some((column) => column.state._id === current)
        ? current
        : columns[0]?.state._id ?? '',
    );
  }, [columns]);
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

  async function move(input: TaskMoveInput) {
    await moveTask({ ...input, ...queryIdentity });
    hapticMedium();
  }

  function moveToState(state: Doc<'taskWorkflowStates'>) {
    const target = statusTarget;
    setStatusTarget(null);
    if (!target || state._id === target.task.workflowStateId) return;
    void moveTask({
      expectedRevision: target.task.revision,
      taskId: target.task._id,
      workflowStateId: state._id,
      ...target.identity,
    }).then(() => hapticMedium()).catch((failure) => setError(readableError(failure)));
  }

  function openProjectTaskStatus(item: MobileTaskView) {
    const board = boards?.find((candidate) => candidate.board._id === item.task.boardId);
    if (!board) {
      setError('Task statuses are unavailable right now.');
      return;
    }
    setStatusTarget({ identity: queryIdentity, states: board.states, task: item.task });
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
        groupId: routeGroupId as Id<'groups'> | undefined,
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
        closeCreateSheet();
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
      closeCreateSheet();
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
        <EmptyState icon="task" title="Tasks aren’t available here yet" body="You can still use Project conversations while task tools are unavailable." />
      </ThemedView>
    );
  }

  if (!projectId) {
    const matchingBoards = companyBoards.filter(({ board, project: boardProject }) =>
      (board.name + ' ' + boardProject.name).toLocaleLowerCase().includes(taskSearch.trim().toLocaleLowerCase()),
    );
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          accessibilityLabel="Project boards"
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset, paddingTop: Spacing.four + safeAreaInsets.top, paddingLeft: Spacing.four + safeAreaInsets.left, paddingRight: Spacing.four + safeAreaInsets.right }]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
        >
          {offline ? <TaskStateBanner icon="cloud-off" message="Offline. Reconnect to refresh Boards." tone="offline" /> : null}
          {error ? <TaskStateBanner action={{ label: 'Dismiss', onPress: () => setError('') }} icon="refresh" message={error} tone="danger" /> : null}
          <View style={styles.globalHeading}>
            <View style={styles.globalTitleCopy}>
              <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.pageTitle} type="display">My Tasks</ThemedText>
              <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{actingCompany?.company?.displayName ?? 'Boards in your workspace'}</ThemedText>
            </View>
          </View>
          <View style={styles.personalControls}>
            {projectDirectoryPages.status === 'LoadingFirstPage' ? <SheetNote>Loading Projects...</SheetNote> : <ConversationProjectTabs
              onSelect={setSelectedMyTaskProjectId}
              projects={projectDirectory.map(({ project: directoryProject }) => ({ id: String(directoryProject._id), name: directoryProject.name }))}
              selectedId={selectedMyTaskProjectId}
            />}
            {projectDirectoryPages.status === 'CanLoadMore' || projectDirectoryPages.status === 'LoadingMore' ? <Pressable accessibilityRole="button" disabled={projectDirectoryPages.status === 'LoadingMore'} onPress={() => projectDirectoryPages.loadMore(12)} style={[styles.loadMoreProjects, { borderColor: theme.homeBorder }]}><ThemedText themeColor="textSecondary" type="captionBold">{projectDirectoryPages.status === 'LoadingMore' ? 'Loading Projects...' : 'Load more Projects'}</ThemedText></Pressable> : null}
            <View style={[styles.taskSearch, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
              <PlatformIcon color={theme.textTertiary} name="search" size={19} />
              <TextInput accessibilityLabel="Search boards" autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" keyboardAppearance={theme.background === '#1b1917' ? 'dark' : 'light'} onChangeText={setTaskSearch} placeholder="Search boards and Projects" placeholderTextColor={theme.textTertiary} returnKeyType="search" style={[styles.taskSearchInput, { color: theme.text }]} value={taskSearch} />
            </View>
          </View>
          <View style={styles.taskProjectSection}>
            <View style={[styles.boardDirectoryHeading, { borderBottomColor: theme.hairline, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: Spacing.two }]}><ThemedText accessibilityRole="header" type="subtitle">Boards</ThemedText></View>
            {globalBoards === undefined ? <SkeletonList count={3} label="Loading boards" /> : matchingBoards.length ? matchingBoards.map((item) => {
              const taskCount = boardTaskCounts.get(String(item.board._id)) ?? 0;
              const countLabel = String(taskCount) + (boardTaskCountsPartial ? '+' : '');
              return <Pressable
                accessibilityHint={'Opens ' + item.board.name + ' in ' + item.project.name}
                accessibilityLabel={item.board.name + ' board, ' + item.project.name + ' Project, ' + taskCount + (boardTaskCountsPartial ? ' or more' : '') + ' assigned tasks'}
                accessibilityRole="button"
                key={item.board._id}
                onPress={() => {
                  const identity = item.companyId ? { companyId: item.companyId, membershipId: item.projectMemberId } : null;
                  router.push(taskListHref(item.project._id, identity, undefined, undefined, { boardId: item.board._id }) as never);
                }}
                style={({ pressed }) => [styles.boardDirectoryRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent', borderBottomColor: theme.hairline }]}
              >
                <View style={[styles.boardDirectoryIcon, { backgroundColor: theme.backgroundSelected }]}><PlatformIcon color={theme.textSecondary} name="view-board" size={17} /></View>
                <View style={styles.boardDirectoryCopy}><ThemedText numberOfLines={1} type="smallBold">{item.board.name}</ThemedText><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{item.project.name}</ThemedText></View>
                <View style={[styles.boardCountBadge, { backgroundColor: theme.backgroundElement }]}><ThemedText themeColor="textSecondary" type="captionBold">{countLabel}</ThemedText></View>
                <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
              </Pressable>;
            }) : <EmptyState icon="view-board" title={taskSearch ? 'No matching boards' : 'No boards yet'} body={taskSearch ? 'Try a shorter Board or Project name.' : selectedMyTaskProjectId ? 'Boards in this Project will appear here.' : 'Boards in your Projects will appear here.'} />}
          </View>
        </ScrollView>
        {createProjectPickerSheet}
      </ThemedView>
    );
  }
  const heading = (
    <>
      {offline ? <TaskStateBanner icon="cloud-off" message="Offline — showing saved tasks" tone="offline" /> : null}
      {readOnly ? <TaskStateBanner icon="shield-lock-outline" message="Read-only archive" /> : null}
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
            projectName={projectNavigation?.available && projectNavigation.project
              ? projectNavigation.project.name
              : 'Project tasks'}
            scopeLabel={selectedBoard?.board.groupId ? 'Channels' : 'Project'}
            searchActive={Boolean(boardSearch)}
          />
          <SprintFlowHeader
            activeStateId={activeBoardStateId || undefined}
            columnCount={columns.length}
            onStatePress={setActiveBoardStateId}
            states={columns.map((column) => column.state)}
            taskCount={visibleTaskCount}
          />
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
      activeBoardStateId={activeBoardStateId}
      assigneeName={assigneeName}
      columns={columns}
      focusedTaskId={focusedTaskId}
      onActiveBoardStateChange={setActiveBoardStateId}
      onCreate={() => setCreateOpen(true)}
      onMove={move}
      onOpen={(item) => router.push(taskDetailHref(project, item.task.publicKey, identity))}
      onStatusPress={openProjectTaskStatus}
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

      <OptionsSheet onClose={() => setStatusTarget(null)} title="Move to" visible={Boolean(statusTarget)}>
        <SheetSection title={statusTarget?.task.title}>
          {statusStates.map((state) => (
            <SheetRow
              icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'}
              key={state._id}
              label={state.name}
              onPress={() => moveToState(state)}
              selected={state._id === statusTarget?.task.workflowStateId}
            />
          ))}
          {statusStates.length === 0 ? (
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

      {createProjectPickerSheet}

      <OptionsSheet
        onClose={closeCreateSheet}
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
            <View style={[styles.fieldGrid, stackCreateFields && styles.fieldGridLarge]}>
              <View style={[styles.fieldCell, stackCreateFields && styles.fieldCellStacked]}><DateField onChange={setDueDate} value={dueDate} /></View>
              <View style={[styles.fieldCell, stackCreateFields && styles.fieldCellStacked]}>
                <SheetFieldButton icon="person" label="Assignee" onClear={selectedCreateAssigneeId ? () => setAssigneeId('') : undefined} onPress={() => setCreatePicker('assignee')} placeholder="Unassigned" value={assignableCreateAssignees?.find((item) => item.member._id === selectedCreateAssigneeId)?.user.displayName} />
              </View>
              <View style={[styles.fieldCell, stackCreateFields && styles.fieldCellStacked]}>
                <SheetFieldButton icon="circle-outline" label="Status" onPress={() => setCreatePicker('status')} value={selectedCreateBoard?.states.find((state) => state._id === createWorkflowStateId)?.name} />
              </View>
              <View style={[styles.fieldCell, stackCreateFields && styles.fieldCellStacked]}>
                <SheetFieldButton icon="flag" label="Priority" onPress={() => setCreatePicker('priority')} value={taskPriorityLabel(priority)} />
              </View>
            </View>
            <SheetInput label="Description (optional)" maxLength={4000} multiline onChangeText={setDescription} value={description} />
            {boards && boards.length > 1 ? <SheetFieldButton icon="view-board" label="Board" onPress={() => setCreatePicker('board')} value={selectedCreateBoard?.board.name} /> : null}
            {error ? <ThemedText themeColor="danger" type="small">{error}</ThemedText> : null}
            <TaskAction disabled={busy || !title.trim()} label={busy ? 'Creating…' : 'Create task'} onPress={() => void create()} primary />
          </>
        )}
      </OptionsSheet>

      <OptionsSheet onClose={() => setSearchOpen(false)} title="Search tasks" visible={searchOpen}>
        <SheetInput label="Search" maxLength={200} onChangeText={setBoardSearch} placeholder="Search by title or description" value={boardSearch} />
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
  fieldCell: { flex: 1, minWidth: 150 },
  fieldCellStacked: { flex: 0, width: '100%' },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fieldGridLarge: { flexDirection: 'column' },
  flex: { flex: 1, minWidth: 0 },
  boardDirectoryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: TouchTarget },
  boardHeadingDivider: { flex: 1, height: StyleSheet.hairlineWidth },
  boardOwner: { flexShrink: 1, maxWidth: '58%' },
  boardDirectoryIcon: { alignItems: 'center', borderRadius: Radius.pill, height: 38, justifyContent: 'center', width: 38 },
  boardDirectoryIconWrap: { height: 38, position: 'relative', width: 38 },
  boardDirectoryCopy: { flex: 1, gap: 2, minWidth: 0 },
  boardDirectoryRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: 68, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  boardUnreadBadge: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: 1.5, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 3, position: 'absolute', right: -4, top: -4 },
  boardUnreadCount: { fontSize: 9, lineHeight: 12 },
  boardCountBadge: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, justifyContent: 'center', minHeight: 26, minWidth: 28, paddingHorizontal: Spacing.two },
  personalEmpty: { paddingVertical: Spacing.three },
  personalSection: { gap: Spacing.two },
  personalSectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: TouchTarget },
  selectedDayLabel: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: TouchTarget },
  personalControls: { gap: Spacing.three, marginTop: Spacing.three },
  searchAndFilter: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  filterSheetActions: { gap: Spacing.two, paddingTop: Spacing.two },
  filterButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, height: TouchTarget, justifyContent: 'center', minWidth: TouchTarget, paddingHorizontal: Spacing.two },
  taskSearch: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingLeft: Spacing.three },
  taskSearchInput: { ...Typography.body, flex: 1, minHeight: TouchTarget, paddingVertical: Spacing.two },
  loadMoreProjects: { alignItems: 'center', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: TouchTarget },
  taskViewTabs: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  taskProjectSection: { gap: Spacing.two },
  weekHeadingActions: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  weekPickerButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  weekDays: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  weekDay: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.half, justifyContent: 'center', minHeight: 78, minWidth: 72, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  loadWeek: { alignItems: 'center', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: TouchTarget },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  inboxHeading: { gap: Spacing.one },
  globalHeading: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  globalTitleCopy: { flex: 1, gap: Spacing.half, minWidth: 0 },
  pageTitle: { flexShrink: 1 },
  companyPill: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, maxWidth: '58%', minHeight: 40, paddingHorizontal: Spacing.two },
  companyPillText: { flexShrink: 1 },
  coverageCopy: { flex: 1, gap: 2, minWidth: 0 },
  coverageHint: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  taskCountPill: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, minHeight: 30, paddingHorizontal: Spacing.two },
  projectBoardPrompt: { gap: Spacing.two, marginTop: Spacing.two },
  screen: { flex: 1 },
  screenContent: { flex: 1 },
  taskSectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: TouchTarget, paddingTop: Spacing.two },
  taskSectionMeta: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
});
