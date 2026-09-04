import type { TaskPriority } from '@track/shared/tasks';
import { useMutation, useQuery } from 'convex/react';
import { useNetworkState } from 'expo-network';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { PrimaryNavigation } from '@/components/primary-navigation';
import { SkeletonList } from '@/components/skeleton-row';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import type { TaskMoveInput } from '@/components/task-board';
import {
  SuggestionInbox,
  TaskCollection,
  type MobileBoardView,
  type MobileSuggestionView,
  type MobileTaskView,
} from '@/components/task-list-content';
import { TaskAction, TaskCard, TaskSegmentedControl, TaskStateBanner } from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { useCompany } from '@/contexts/company-context';
import { useTrackUser } from '@/contexts/track-user-context';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
import { groupMobileTasksByState, taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { taskPriorityLabel } from '@/lib/task-presentation';

type AssigneeView = {
  member: Doc<'projectMembers'>;
  user: { _id: Id<'users'>; displayName: string };
  company: Doc<'companies'> | null;
};

type PrimaryTaskTab = 'board' | 'my' | 'all';
type TaskTab = PrimaryTaskTab | 'inbox';
type BoardSort = 'manual' | 'due' | 'priority';
type BoardFilter = 'all' | 'open' | 'completed' | 'high';
type GlobalTaskView = MobileTaskView & {
  project: { _id: Id<'projects'>; name: string };
  companyId?: Id<'companies'>;
  projectMemberId: Id<'projectMembers'>;
};
const priorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];
const primaryTabs: Array<{ label: string; value: PrimaryTaskTab }> = [
  { label: 'Board', value: 'board' },
  { label: 'My tasks', value: 'my' },
  { label: 'All', value: 'all' },
];

function readableError(failure: unknown) {
  if (!(failure instanceof Error)) return 'The task action failed.';
  if (failure.message.includes('task_access_changed')) return 'Your access changed. Refresh and try again.';
  if (failure.message.includes('task_duplicate_decision_required')) return 'Choose whether to add a reference or create a separate task.';
  return failure.message.replaceAll('_', ' ');
}

export default function TasksScreen() {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const router = useRouter();
  const release = useReleaseConfig();
  const network = useNetworkState();
  const { trackUserId } = useTrackUser();
  const { actingCompanyId } = useCompany();
  const { projectId, companyId, membershipId, archive, tab: tabParam } = useLocalSearchParams<{
    projectId?: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
    tab?: string;
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
  const [tab, setTab] = useState<TaskTab>(projectId ? (tabParam === 'inbox' ? 'inbox' : 'board') : 'my');
  const [boardId, setBoardId] = useState<string>('');
  const selectedBoard = boards?.find((item) => item.board._id === boardId)
    ?? boards?.find((item) => item.board.isDefault)
    ?? boards?.[0];
  const createAssignees = useQuery(api.tasks.listEligibleAssignees, release.tasks && projectId && !readOnly
    && selectedBoard ? {
    projectId: project,
    groupId: selectedBoard.board.groupId,
    ...queryIdentity,
  } : 'skip') as AssigneeView[] | undefined;
  const tasks = useQuery(api.tasks.list, release.tasks && projectId && tab !== 'inbox'
    && (tab !== 'my' || currentMemberId) ? {
    projectId: project,
    boardId: tab === 'board' ? selectedBoard?.board._id : undefined,
    assigneeProjectMemberId: tab === 'my' ? currentMemberId : undefined,
    ...queryIdentity,
  } : 'skip') as MobileTaskView[] | undefined;
  const myTasks = useQuery(api.mobile.listMyTasks, release.tasks && !projectId && trackUserId ? {
    userId: trackUserId,
    actingCompanyId: (companyId as Id<'companies'> | undefined) ?? actingCompanyId ?? undefined,
    openOnly: true,
  } : 'skip') as GlobalTaskView[] | undefined;
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
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const [boardSort, setBoardSort] = useState<BoardSort>('manual');
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Keep route-driven navigation authoritative when the bottom bar changes
  // project or opens/closes the task suggestion inbox without remounting this
  // screen.
  useEffect(() => {
    setTab(projectId ? (tabParam === 'inbox' ? 'inbox' : 'board') : 'my');
    setBoardId('');
    setError('');
  }, [projectId, tabParam]);

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
      .sort((a, b) => {
        if (boardSort === 'priority') return priorityRank[a.task.priority] - priorityRank[b.task.priority];
        if (boardSort === 'due') return (a.task.dueDate ?? '9999-12-31').localeCompare(b.task.dueDate ?? '9999-12-31');
        return a.task.rank.localeCompare(b.task.rank);
      });
    const grouped = groupMobileTasksByState(
      selectedBoard.states.map((state) => state._id),
      visibleTasks,
    );
    return selectedBoard.states.map((state, index) => ({
      state,
      tasks: grouped[index].tasks,
    }));
  }, [boardFilter, boardSearch, boardSort, selectedBoard, tasks]);
  const statusStates = boards?.find((item) =>
    item.board._id === statusTarget?.task.boardId,
  )?.states ?? [];

  function setPrimaryTab(next: PrimaryTaskTab) {
    setTab(next);
    setError('');
  }

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
        boardId: selectedBoard?.board._id,
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
        <Stack.Screen options={{ title: 'My Tasks' }} />
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentInset }]} contentInsetAdjustmentBehavior="automatic">
          {offline ? <TaskStateBanner icon="cloud-off" message="Offline — showing saved tasks" tone="offline" /> : null}
          <View style={styles.globalHeading}>
            <ThemedText themeColor="textSecondary" type="message">
              Your open work across every Project you can access.
            </ThemedText>
          </View>
          <GlobalTaskList
            onOpen={(item) => router.push(taskDetailHref(item.project._id, item.task.publicKey, item.companyId ? {
              companyId: item.companyId,
              membershipId: item.projectMemberId,
            } : null))}
            tasks={myTasks}
          />
          <View style={styles.projectBoardPrompt}>
            <ThemedText type="subtitle">Need a Project board?</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">Choose a Project only when you want its board, Channels, or to create new work.</ThemedText>
            <TaskAction label="Open Projects" onPress={() => router.push('/projects')} primary />
          </View>
        </ScrollView>
        <PrimaryNavigation />
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
                <Pressable accessibilityLabel="Sort tasks" onPress={() => setSortOpen(true)} style={styles.toolButton}>
                  <PlatformIcon color={theme.textSecondary} name="sort" size={19} />
                </Pressable>
                <Pressable accessibilityLabel="Search tasks" onPress={() => setSearchOpen(true)} style={styles.toolButton}>
                  <PlatformIcon color={boardSearch ? theme.accentStrong : theme.textSecondary} name="search" size={19} />
                </Pressable>
                <Pressable accessibilityLabel="Filter tasks" onPress={() => setFilterOpen(true)} style={styles.toolButton}>
                  <PlatformIcon color={boardFilter !== 'all' ? theme.accentStrong : theme.textSecondary} name="filter" size={19} />
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={styles.contextHeading}>
            <View style={styles.contextTitle}>
              <ThemedText numberOfLines={1} type="subtitle">
                {tab === 'board'
                  ? selectedBoard?.board.name ?? 'Project tasks'
                  : tab === 'my' ? 'My tasks' : 'All project tasks'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {tasks ? `${tasks.length} task${tasks.length === 1 ? '' : 's'}` : 'Loading work…'}
              </ThemedText>
            </View>
          </View>
          <TaskSegmentedControl onChange={setPrimaryTab} segments={primaryTabs} value={tab} />
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
      onCreate={() => setCreateOpen(true)}
      onMove={move}
      onOpen={(item) => router.push(taskDetailHref(project, item.task.publicKey, identity))}
      onStatusPress={setStatusTarget}
      onViewAll={() => setTab('all')}
      readOnly={readOnly}
      selectedBoard={selectedBoard}
      tab={tab === 'inbox' ? 'all' : tab}
      tasks={boards === undefined ? undefined : tasks}
    />
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: tab === 'inbox' ? 'Task inbox' : 'Tasks',
        headerLargeTitle: Platform.OS === 'ios' && tab !== 'board',
        headerTransparent: Platform.OS === 'ios' && tab !== 'board',
        headerBlurEffect: 'systemMaterial',
        headerRight: () => (
          <View style={styles.headerActions}>
            {!readOnly ? (
              <Pressable
                accessibilityLabel={tab === 'inbox' ? 'Return to tasks' : 'Open task inbox'}
                onPress={() => {
                  hapticLight();
                  setTab((current) => current === 'inbox' ? 'board' : 'inbox');
                }}
                style={[styles.headerButton, tab === 'inbox' && { backgroundColor: theme.backgroundSelected }]}>
                <PlatformIcon color={tab === 'inbox' ? theme.accent : theme.text} name="inbox" size={22} />
              </Pressable>
            ) : null}
            {!readOnly ? (
              <Pressable accessibilityLabel="Create task" onPress={() => setCreateOpen(true)} style={styles.headerButton}>
                <PlatformIcon color={theme.accent} name="plus" size={24} />
              </Pressable>
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
          {statusStates.map((state) => (
            <SheetRow
              icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'}
              key={state._id}
              label={state.name}
              onPress={() => moveToState(state)}
              selected={state._id === statusTarget?.task.workflowStateId}
            />
          ))}
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

      <OptionsSheet onClose={() => setCreateOpen(false)} title="Create task" visible={createOpen}>
        <View style={styles.sheetIntro}>
          <ThemedText type="subtitle">Turn work into a clear next step</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Keep the title actionable; the details can evolve with the conversation.
          </ThemedText>
        </View>
        <SheetInput label="Title" onChangeText={setTitle} value={title} />
        <SheetInput label="Description" multiline onChangeText={setDescription} value={description} />
        <DateField onChange={setDueDate} value={dueDate} />
        {boards && boards.length > 1 ? (
          <SheetSection title="Board">
            {boards.map((item) => (
              <SheetRow
                icon="view-board"
                key={item.board._id}
                label={item.board.name}
                selected={item.board._id === selectedBoard?.board._id}
                onPress={() => setBoardId(item.board._id)}
              />
            ))}
          </SheetSection>
        ) : null}
        <SheetSection title="Priority">
          {priorities.map((value) => (
            <SheetRow
              icon="flag"
              key={value}
              label={taskPriorityLabel(value)}
              selected={priority === value}
              onPress={() => setPriority(value)}
            />
          ))}
        </SheetSection>
        <SheetSection title="Assignee">
          <SheetRow icon="person" label="Unassigned" selected={!selectedCreateAssigneeId} onPress={() => setAssigneeId('')} />
          {assignableCreateAssignees?.map((item) => (
            <SheetRow
              icon="person"
              key={item.member._id}
              label={`${item.user.displayName}${item.company ? ` · ${item.company.displayName}` : ''}`}
              selected={selectedCreateAssigneeId === item.member._id}
              onPress={() => setAssigneeId(item.member._id)}
            />
          ))}
        </SheetSection>
        {error ? <ThemedText themeColor="danger" type="small">{error}</ThemedText> : null}
        <TaskAction disabled={busy || !title.trim()} label={busy ? 'Creating…' : 'Create task'} onPress={() => void create()} primary />
      </OptionsSheet>

      <OptionsSheet onClose={() => setSearchOpen(false)} title="Search tasks" visible={searchOpen}>
        <SheetInput autoFocus label="Search" onChangeText={setBoardSearch} placeholder="Search by title or description" value={boardSearch} />
        <TaskAction label="Done" onPress={() => setSearchOpen(false)} primary />
      </OptionsSheet>
      <OptionsSheet onClose={() => setSortOpen(false)} title="Sort tasks" visible={sortOpen}>
        <SheetSection>
          <SheetRow icon="drag-handle" label="Board order" selected={boardSort === 'manual'} onPress={() => { setBoardSort('manual'); setSortOpen(false); }} />
          <SheetRow icon="calendar" label="Due date" selected={boardSort === 'due'} onPress={() => { setBoardSort('due'); setSortOpen(false); }} />
          <SheetRow icon="flag" label="Priority" selected={boardSort === 'priority'} onPress={() => { setBoardSort('priority'); setSortOpen(false); }} />
        </SheetSection>
      </OptionsSheet>
      <OptionsSheet onClose={() => setFilterOpen(false)} title="Filter tasks" visible={filterOpen}>
        <SheetSection>
          <SheetRow icon="check-box-outline" label="All tasks" selected={boardFilter === 'all'} onPress={() => { setBoardFilter('all'); setFilterOpen(false); }} />
          <SheetRow icon="circle-outline" label="Open tasks" selected={boardFilter === 'open'} onPress={() => { setBoardFilter('open'); setFilterOpen(false); }} />
          <SheetRow icon="check-circle" label="Completed" selected={boardFilter === 'completed'} onPress={() => { setBoardFilter('completed'); setFilterOpen(false); }} />
          <SheetRow icon="flag" label="High priority" selected={boardFilter === 'high'} onPress={() => { setBoardFilter('high'); setFilterOpen(false); }} />
        </SheetSection>
      </OptionsSheet>
      <PrimaryNavigation tasksHref={`/tasks?projectId=${encodeURIComponent(project)}${companyId && membershipId ? `&companyId=${encodeURIComponent(companyId)}&membershipId=${encodeURIComponent(membershipId)}${archive === '1' ? '&archive=1' : ''}` : ''}`} />
    </ThemedView>
  );
}

function GlobalTaskList({ onOpen, tasks }: { onOpen: (item: GlobalTaskView) => void; tasks?: GlobalTaskView[] }) {
  if (tasks === undefined) return <SkeletonList count={4} label="Loading My Tasks" />;
  if (!tasks.length) {
    return <EmptyState icon="check-box-outline" title="Nothing assigned to you" body="Tasks assigned to you across your Projects will appear here." />;
  }
  return (
    <View style={styles.globalList}>
      {tasks.map((item) => (
        <TaskCard
          assignee="You"
          category={item.state?.category}
          contextLabel={item.project.name}
          description={item.task.description}
          dueDate={item.task.dueDate}
          evidence={item.references.length > 0}
          key={item.task._id}
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

const styles = StyleSheet.create({
  boardToolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 40 },
  boardTools: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  boardViewButton: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, maxWidth: 220, minHeight: TouchTarget },
  boardViewLabel: { flexShrink: 1 },
  boardScreen: { flex: 1, gap: Spacing.three, padding: Spacing.three },
  content: { gap: Spacing.three, padding: Spacing.three },
  contextHeading: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  contextTitle: { flex: 1, gap: 2 },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  headerButton: { alignItems: 'center', borderRadius: TouchTarget / 2, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  inboxHeading: { gap: Spacing.one },
  globalHeading: { gap: Spacing.one },
  globalList: { gap: Spacing.two },
  projectBoardPrompt: { gap: Spacing.two, marginTop: Spacing.two },
  screen: { flex: 1 },
  sheetIntro: { gap: Spacing.one },
  toolButton: { alignItems: 'center', borderRadius: TouchTarget / 2, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
});
