import { Stack } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BoardEntry, MyTask, ProjectEntry } from '@/lib/my-task-types';
import { ConversationProjectTabs } from '@/components/conversation-project-tabs';
import { EmptyState } from '@/components/empty-state';
import { EntityMark } from '@/components/entity-mark';
import { OptionsSheet, SheetNote, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { SkeletonList } from '@/components/skeleton-row';
import { TaskCard, TaskPriorityBadge, TaskStateBanner } from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { localTaskDate, parseTaskDate } from '@/lib/task-presentation';
import {
  emptyMyTaskFilters,
  matchesMyTaskFilters,
  matchesMyTaskSearch,
  matchesMyTaskTimeView,
  sortMyTasks,
  type MyTaskFilters,
  type MyTaskViewKey,
  uniqueMyTasks,
} from '@/lib/my-task-work-view';
import { tasksForMyTaskWeek, weekDateKeys } from '@/lib/task-week';

const taskViews: Array<{ key: MyTaskViewKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
];

const statusChoices: Array<{ value: MyTaskFilters['status']; label: string }> = [
  { value: 'any', label: 'Any status' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];

const priorityChoices: Array<{ value: MyTaskFilters['priority']; label: string }> = [
  { value: 'any', label: 'Any priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'No priority' },
];

const dueDateChoices: Array<{ value: MyTaskFilters['dueDate']; label: string }> = [
  { value: 'any', label: 'Any due date' },
  { value: 'today', label: 'Due today' },
  { value: 'this-week', label: 'Due this week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'no-date', label: 'No due date' },
];

type Props = {
  assignedTasks: MyTask[];
  confirmationStateId: string | null;
  confirmationTask: MyTask | null;
  boards: BoardEntry[];
  companyName: string;
  createProjectPickerSheet: ReactNode;
  error?: string;
  hasMoreProjects: boolean;
  isLoading: boolean;
  isLoadingMoreProjects: boolean;
  isOffline: boolean;
  boardsLoading: boolean;
  onDismissError: () => void;
  onCancelTaskStatusConfirmation: () => void;
  onConfirmTaskStatus: () => void;
  onLoadMoreProjects: () => void;
  onOpenBoard: (board: BoardEntry) => void;
  onOpenTask: (task: MyTask) => void;
  onSetTaskStatus: (task: MyTask, workflowStateId: string) => void;
  onToggleTaskComplete: (task: MyTask) => void;
  profileName: string;
  projectDirectory: ProjectEntry[];
  projectDirectoryLoading: boolean;
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
};

function countLabel(count: number, partial: boolean) {
  return `${count}${partial ? '+' : ''}`;
}

function taskGroupLabel(date: string | undefined, today: string) {
  if (!date) return 'No due date';
  if (date < today) return 'Overdue';
  if (date === today) return 'Due today';
  const parsed = parseTaskDate(date);
  return parsed?.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) ?? date;
}

function groupByDueDate(tasks: MyTask[], today: string) {
  const groups = new Map<string, MyTask[]>();
  for (const task of sortMyTasks(tasks)) {
    const label = taskGroupLabel(task.task.dueDate, today);
    groups.set(label, [...(groups.get(label) ?? []), task]);
  }
  return [...groups.entries()];
}

export function MyTaskWorkspace({
  assignedTasks,
  confirmationStateId,
  confirmationTask,
  boards,
  companyName,
  createProjectPickerSheet,
  error,
  hasMoreProjects,
  isLoading,
  isLoadingMoreProjects,
  isOffline,
  boardsLoading,
  onDismissError,
  onCancelTaskStatusConfirmation,
  onConfirmTaskStatus,
  onLoadMoreProjects,
  onOpenBoard,
  onOpenTask,
  onSetTaskStatus,
  onToggleTaskComplete,
  profileName,
  projectDirectory,
  projectDirectoryLoading,
  selectedProjectId,
  onSelectProject,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomContentInset = useBottomTabContentInset();
  const today = localTaskDate();
  const dates = useMemo(() => weekDateKeys(today), [today]);
  const [view, setView] = useState<MyTaskViewKey>('today');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MyTaskFilters>(emptyMyTaskFilters);
  const [draftFilters, setDraftFilters] = useState<MyTaskFilters>(emptyMyTaskFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [canceledExpanded, setCanceledExpanded] = useState(false);
  const [statusTask, setStatusTask] = useState<MyTask | null>(null);

  const allTasks = useMemo(() => uniqueMyTasks(assignedTasks), [assignedTasks]);
  const boardById = useMemo(() => new Map(boards.map((board) => [String(board.board._id), board])), [boards]);
  const contextualTasks = useMemo(() => allTasks.filter((item) => {
    const projectMatches = !selectedProjectId || String(item.project._id) === selectedProjectId;
    const boardName = boardById.get(String(item.task.boardId))?.board.name ?? '';
    const scopeRowMatches = matchesMyTaskSearch(item, search, boardName);
    const filterMatches = matchesMyTaskFilters(item, filters, today, dates);
    return projectMatches && scopeRowMatches && filterMatches;
  }), [allTasks, boardById, dates, filters, search, selectedProjectId, today]);
  const visibleTasks = useMemo(() => sortMyTasks(contextualTasks.filter((item) =>
    matchesMyTaskTimeView(item, view, today, selectedDate),
  )), [contextualTasks, selectedDate, today, view]);

  const partialTasks = allTasks.some((item) => item.hasMoreAssignedTasks);
  const partialCounts = partialTasks || hasMoreProjects;
  const weekTasks = tasksForMyTaskWeek(contextualTasks, dates);
  const weekTaskTabs = sortMyTasks(weekTasks).slice(0, 4);
  const selectedDayTasks = selectedDate ? tasksForMyTaskWeek(contextualTasks, dates, selectedDate) : [];
  const todayCount = contextualTasks.filter((item) => matchesMyTaskTimeView(item, 'today', today, selectedDate)).length;
  const upcomingCount = contextualTasks.filter((item) => matchesMyTaskTimeView(item, 'upcoming', today, selectedDate)).length;
  const doneCount = contextualTasks.filter((item) => matchesMyTaskTimeView(item, 'done', today, selectedDate)).length;
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'any').length;
  const matchingBoards = boards.filter(({ board, project }) =>
    (!selectedProjectId || String(project._id) === selectedProjectId)
    && (board.name + ' ' + project.name).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const scopedBoard = statusTask ? boardById.get(String(statusTask.task.boardId)) : undefined;
  const confirmationBoard = confirmationTask ? boardById.get(String(confirmationTask.task.boardId)) : undefined;
  const confirmationState = confirmationBoard?.states.find((state) => String(state._id) === confirmationStateId);

  function openFilters() {
    setDraftFilters(filters);
    setFilterOpen(true);
  }

  function cancelFilters() {
    setDraftFilters(filters);
    setFilterOpen(false);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFilterOpen(false);
  }

  function renderTask(task: MyTask) {
    const board = boardById.get(String(task.task.boardId));
    return <TaskCard
      alwaysShowPriority
      category={task.state?.category}
      isCompleted={task.state?.category === 'completed'}
      onCompletionPress={() => onToggleTaskComplete(task)}
      onPress={() => onOpenTask(task)}
      onStatusPress={() => setStatusTask(task)}
      priority={task.task.priority}
      publicKey={task.task.publicKey}
      groupName={task.group?.name ?? undefined}
      projectName={task.project.name}
      quiet
      showKey={false}
      stateName={task.state?.name ?? 'Unknown status'}
      title={task.task.title}
      key={String(task.task._id)}
      contextLabel={board?.board.name}
    />;
  }

  function renderGroup(label: string, tasks: MyTask[]) {
    if (!tasks.length) return null;
    return <View key={label} style={styles.taskGroup}>
      <View style={styles.taskGroupHeading}>
        <ThemedText accessibilityRole="header" themeColor="textSecondary" type="captionBold">{label}</ThemedText>
        <ThemedText themeColor="textTertiary" type="caption">{countLabel(tasks.length, partialCounts)}</ThemedText>
      </View>
      {tasks.map(renderTask)}
    </View>;
  }

  function renderRows() {
    if (view === 'today') {
      return <>
        {renderGroup('Overdue', visibleTasks.filter((item) => Boolean(item.task.dueDate && item.task.dueDate < today)))}
        {renderGroup('Due today', visibleTasks.filter((item) => item.task.dueDate === today))}
      </>;
    }
    if (view === 'upcoming') return groupByDueDate(visibleTasks, today).map(([label, tasks]) => renderGroup(label, tasks));
    if (view === 'done') return renderGroup('Completed', visibleTasks);
    const openTasks = visibleTasks.filter((item) => item.state?.category !== 'completed' && item.state?.category !== 'canceled');
    const completedTasks = visibleTasks.filter((item) => item.state?.category === 'completed');
    const canceledTasks = visibleTasks.filter((item) => item.state?.category === 'canceled');
    return <>
      {groupByDueDate(openTasks, today).map(([label, tasks]) => renderGroup(label, tasks))}
      {completedTasks.length ? <View style={styles.collapsibleGroup}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: completedExpanded }} onPress={() => setCompletedExpanded((value) => !value)} style={styles.collapseButton}>
          <PlatformIcon color={theme.textSecondary} name={completedExpanded ? 'chevron-down' : 'chevron-right'} size={17} />
          <ThemedText type="captionBold">Completed</ThemedText>
          <ThemedText themeColor="textTertiary" type="caption">{countLabel(completedTasks.length, partialCounts)}</ThemedText>
        </Pressable>
        {completedExpanded ? completedTasks.map(renderTask) : null}
      </View> : null}
      {canceledTasks.length ? <View style={styles.collapsibleGroup}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: canceledExpanded }} onPress={() => setCanceledExpanded((value) => !value)} style={styles.collapseButton}>
          <PlatformIcon color={theme.textSecondary} name={canceledExpanded ? 'chevron-down' : 'chevron-right'} size={17} />
          <ThemedText type="captionBold">Canceled</ThemedText>
          <ThemedText themeColor="textTertiary" type="caption">{countLabel(canceledTasks.length, partialCounts)}</ThemedText>
        </Pressable>
        {canceledExpanded ? canceledTasks.map(renderTask) : null}
      </View> : null}
    </>;
  }

  const noTasksTitle = search.trim()
    ? 'No matching tasks'
    : activeFilterCount
      ? 'No tasks match these filters'
      : view === 'today'
        ? 'No urgent tasks due today'
        : view === 'upcoming'
          ? 'No upcoming tasks'
          : view === 'done'
            ? 'No completed tasks'
            : 'No assigned tasks';
  const noTasksBody = selectedDate
    ? 'No tasks match ' + (parseTaskDate(selectedDate)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) ?? selectedDate) + '. Clear the day or choose another one.'
    : activeFilterCount || search.trim()
      ? 'Change the search or filters to see more of your assigned work.'
      : view === 'today'
        ? 'Urgent overdue and due-today work will appear here.'
        : view === 'upcoming'
          ? 'Open tasks with future due dates will appear here.'
          : 'Tasks assigned to you will appear here.';

  return <ThemedView style={styles.screen}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView
      accessibilityLabel="My Tasks and Boards"
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: bottomContentInset,
          paddingTop: Spacing.four + insets.top,
          paddingLeft: Spacing.four + insets.left,
          paddingRight: Spacing.four + insets.right,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {isOffline ? <TaskStateBanner icon="cloud-off" message={allTasks.length ? 'Offline. Showing saved assignments.' : 'Offline. Reconnect to load assigned tasks and Boards.'} tone="offline" /> : null}
      {error ? <TaskStateBanner action={{ label: 'Dismiss', onPress: onDismissError }} icon="refresh" message={error} tone="danger" /> : null}
      {partialTasks ? <TaskStateBanner icon="information-outline" message="A Project has more than 500 assigned tasks. Its counts are partial." tone="offline" /> : null}
      {hasMoreProjects && !isLoadingMoreProjects ? <TaskStateBanner icon="information-outline" message="Counts include loaded Projects only. Load more Projects to update them." tone="offline" /> : null}

      <View style={styles.globalHeading}>
        <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.pageTitle} type="display">My Tasks</ThemedText>
        <View accessibilityLabel={'Company scope: ' + companyName} style={[styles.companyPill, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
          <PlatformIcon color={theme.textSecondary} name="office-building" size={14} />
          <ThemedText numberOfLines={1} style={styles.companyPillText} themeColor="textSecondary" type="captionBold">{companyName}</ThemedText>
        </View>
      </View>

      {projectDirectoryLoading
        ? <SkeletonList count={1} label="Loading Projects" />
        : <ConversationProjectTabs
          onSelect={onSelectProject}
          projects={projectDirectory.map(({ project, assignedTaskCount, assignedTaskCountPartial }) => ({
            id: String(project._id),
            name: project.name,
            colorKey: project.markColorKey,
            iconKey: project.markIconKey,
            assignedCount: assignedTaskCount,
            countPartial: assignedTaskCountPartial,
          }))}
          selectedId={selectedProjectId}
          showAssignedCountOnMark
        />}

      <View style={styles.searchFilterRow}>
        <View style={[styles.searchField, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
          <PlatformIcon color={theme.textTertiary} name="search" size={19} />
          <TextInput
            accessibilityLabel="Search tasks and Boards"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance={theme.background === '#1b1917' ? 'dark' : 'light'}
            onChangeText={setSearch}
            placeholder="Search tasks and Boards"
            placeholderTextColor={theme.textTertiary}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
          />
          {search ? <Pressable accessibilityLabel="Clear search" accessibilityRole="button" hitSlop={8} onPress={() => setSearch('')} style={styles.searchClear}>
            <PlatformIcon color={theme.textSecondary} name="close" size={17} />
          </Pressable> : null}
        </View>
        <Pressable accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filters'} accessibilityRole="button" onPress={openFilters} style={[styles.filterButton, { backgroundColor: activeFilterCount ? theme.accentSoft : theme.backgroundElement, borderColor: activeFilterCount ? theme.accentStrong : theme.homeBorder }]}>
          <PlatformIcon color={activeFilterCount ? theme.accentStrong : theme.textSecondary} name="filter" size={18} />
          <ThemedText style={{ color: activeFilterCount ? theme.accentStrong : theme.text }} type="captionBold">Filter</ThemedText>
          {activeFilterCount ? <View style={[styles.filterCount, { backgroundColor: theme.accent }]}><ThemedText themeColor="accentInk" type="captionBold">{activeFilterCount}</ThemedText></View> : null}
        </Pressable>
      </View>

      <ScrollView accessibilityLabel="Task time views" contentContainerStyle={styles.viewTabs} horizontal showsHorizontalScrollIndicator={false}>
        {taskViews.map(({ key, label }) => {
          const selected = view === key;
          const count = key === 'today' ? todayCount : key === 'upcoming' ? upcomingCount : key === 'done' ? doneCount : contextualTasks.length;
          return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={key} onPress={() => setView(key)} style={[styles.viewTab, { backgroundColor: selected ? theme.accentSoft : 'transparent', borderColor: selected ? theme.accentStrong : theme.homeBorder }]}>
            <ThemedText style={{ color: selected ? theme.accentStrong : theme.textSecondary }} type={selected ? 'captionBold' : 'caption'}>{label}</ThemedText>
            <ThemedText style={{ color: selected ? theme.accentStrong : theme.textTertiary }} type="caption">{countLabel(count, partialCounts)}</ThemedText>
          </Pressable>;
        })}
      </ScrollView>

      <View style={styles.weekHeading}>
        <View style={styles.weekHeadingCopy}>
          <ThemedText accessibilityRole="header" type="subtitle">Due this week</ThemedText>
          <ThemedText themeColor="textSecondary" type="caption">{countLabel(weekTasks.length, partialCounts)} urgent open {weekTasks.length === 1 ? 'task' : 'tasks'} due this week</ThemedText>
        </View>
        <Pressable accessibilityLabel={calendarOpen ? 'Close week calendar' : 'Choose a day this week'} accessibilityRole="button" accessibilityState={{ expanded: calendarOpen }} onPress={() => setCalendarOpen((value) => !value)} style={[styles.calendarToggle, { backgroundColor: calendarOpen ? theme.accentSoft : theme.backgroundElement, borderColor: theme.homeBorder }]}>
          <PlatformIcon color={calendarOpen ? theme.accentStrong : theme.textSecondary} name={calendarOpen ? 'close' : 'calendar'} size={19} />
        </Pressable>
      </View>
      {weekTaskTabs.length ? <ScrollView accessibilityLabel="Urgent tasks due this week" contentContainerStyle={styles.weekTaskTabs} horizontal showsHorizontalScrollIndicator={false}>
        {weekTaskTabs.map((task) => <Pressable
          accessibilityHint="Opens this task"
          accessibilityLabel={`${task.task.title}, urgent task due this week`}
          accessibilityRole="button"
          key={String(task.task._id)}
          onPress={() => onOpenTask(task)}
          style={({ pressed }) => [styles.weekTaskTab, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent', borderColor: theme.homeBorder }]}
        >
          <TaskPriorityBadge compact priority={task.task.priority} />
          <ThemedText numberOfLines={1} style={styles.weekTaskTitle} type="captionBold">{task.task.title}</ThemedText>
          <PlatformIcon color={theme.textSecondary} name="chevron-right" size={16} />
        </Pressable>)}
      </ScrollView> : null}
      {selectedDate ? <View style={styles.selectedDayRow}>
        <ThemedText themeColor="textSecondary" type="captionBold">{parseTaskDate(selectedDate)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) ?? selectedDate} selected</ThemedText>
        <Pressable accessibilityLabel="Clear selected day" accessibilityRole="button" hitSlop={8} onPress={() => setSelectedDate(null)}>
          <ThemedText themeColor="accentStrong" type="captionBold">Clear day</ThemedText>
        </Pressable>
      </View> : null}
      {calendarOpen ? <ScrollView accessibilityLabel="Days this week" contentContainerStyle={styles.weekDays} horizontal showsHorizontalScrollIndicator={false}>
        {dates.map((date) => {
          const parsed = parseTaskDate(date);
          if (!parsed) return null;
          const selected = date === selectedDate;
          const count = tasksForMyTaskWeek(contextualTasks, dates, date).length;
          return <Pressable accessibilityLabel={`${parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${count} urgent tasks`} accessibilityRole="button" accessibilityState={{ selected }} key={date} onPress={() => {
            setSelectedDate(date);
            if (view === 'today' && date > today) setView('upcoming');
            if (view === 'upcoming' && date <= today) setView('today');
          }} style={[styles.weekDay, { backgroundColor: selected ? theme.accentSoft : theme.homeSurface, borderColor: selected ? theme.accentStrong : theme.homeBorder }]}>
            <ThemedText style={{ color: selected ? theme.accentStrong : theme.textSecondary }} type="captionBold">{parsed.toLocaleDateString(undefined, { weekday: 'short' })}</ThemedText>
            <ThemedText style={{ color: selected ? theme.accentStrong : theme.text }} type="smallBold">{parsed.getDate()}</ThemedText>
            <ThemedText style={{ color: selected ? theme.accentStrong : theme.textTertiary }} type="caption">{countLabel(count, partialCounts)}</ThemedText>
          </Pressable>;
        })}
      </ScrollView> : null}

      {selectedDate ? <ThemedText themeColor="textSecondary" type="caption">{countLabel(selectedDayTasks.length, partialCounts)} urgent open {selectedDayTasks.length === 1 ? 'task' : 'tasks'} due on the selected day.</ThemedText> : null}
      {isLoading && !allTasks.length
        ? <SkeletonList count={3} label="Loading assigned tasks" />
        : visibleTasks.length
          ? <View style={styles.taskFeed}>{renderRows()}</View>
          : <EmptyState icon="task" title={noTasksTitle} body={noTasksBody} />}

      {hasMoreProjects || isLoadingMoreProjects ? <Pressable accessibilityRole="button" disabled={isLoadingMoreProjects} onPress={onLoadMoreProjects} style={[styles.loadMore, { borderColor: theme.homeBorder }]}>
        <ThemedText themeColor="textSecondary" type="captionBold">{isLoadingMoreProjects ? 'Loading Projects...' : 'Load more Projects'}</ThemedText>
      </Pressable> : null}

      <View style={styles.boardDirectory}>
        <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.profileName} type="subtitle">{profileName}</ThemedText>
        <View style={[styles.directoryDivider, { backgroundColor: theme.hairline }]} />
        <View style={styles.boardDirectoryHeading}><ThemedText themeColor="textSecondary" type="captionBold">Boards</ThemedText></View>
        {boardsLoading
          ? <SkeletonList count={3} label="Loading Boards" />
          : matchingBoards.length === 0
            ? <EmptyState icon="view-board" title={search ? 'No matching Boards' : 'No Boards yet'} body={search ? 'Try a Project or Board name.' : selectedProjectId ? 'Boards in this Project will appear here.' : 'Boards in your Projects will appear here.'} />
          : matchingBoards.map((item) => {
            const unreadCount = item.unreadCount;
            const unreadLabel = unreadCount ? `, ${unreadCount} unread notifications` : '';
            return <Pressable accessibilityHint={`Opens ${item.board.name} and its tasks`} accessibilityLabel={`${item.board.name} Board, ${item.project.name} Project${unreadLabel}`} accessibilityRole="button" key={item.board._id} onPress={() => onOpenBoard(item)} style={({ pressed }) => [styles.boardRow, { backgroundColor: pressed ? theme.backgroundSelected : 'transparent', borderBottomColor: theme.hairline }]}>
              <View style={styles.boardMarkWrap}>
                <EntityMark colorKey={item.board.markColorKey} iconKey={item.board.markIconKey} id={String(item.board._id)} kind="board" name={item.board.name} size={36} />
                {unreadCount > 0 ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.boardUnreadBadge, { backgroundColor: theme.accent, borderColor: theme.homeSurface }]}><ThemedText style={styles.boardUnreadCount} themeColor="accentInk" type="captionBold">{unreadCount > 99 ? '99+' : unreadCount}</ThemedText></View> : null}
              </View>
              <View style={styles.boardCopy}><ThemedText numberOfLines={1} type="smallBold">{item.board.name}</ThemedText><ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{item.project.name}</ThemedText></View>
              <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
            </Pressable>;
          })}
      </View>
    </ScrollView>

    <OptionsSheet onClose={cancelFilters} title="Filter tasks" visible={filterOpen}>
      <SheetNote>Choose status, priority, and due date, then apply them to your task list.</SheetNote>
      <SheetSection title="Status">
        {statusChoices.map(({ value, label }) => <SheetRow accessibilityRole="radio" icon="check-circle" key={value} label={label} selected={draftFilters.status === value} onPress={() => setDraftFilters((current) => ({ ...current, status: value }))} />)}
      </SheetSection>
      <SheetSection title="Priority">
        {priorityChoices.map(({ value, label }) => <SheetRow accessibilityRole="radio" icon="flag" key={value} label={label} selected={draftFilters.priority === value} onPress={() => setDraftFilters((current) => ({ ...current, priority: value }))} />)}
      </SheetSection>
      <SheetSection title="Due date">
        {dueDateChoices.map(({ value, label }) => <SheetRow accessibilityRole="radio" icon="calendar" key={value} label={label} selected={draftFilters.dueDate === value} onPress={() => setDraftFilters((current) => ({ ...current, dueDate: value }))} />)}
      </SheetSection>
      <View style={styles.filterActions}>
        <Pressable accessibilityRole="button" onPress={() => setDraftFilters(emptyMyTaskFilters)} style={[styles.filterSecondary, { borderColor: theme.homeBorder }]}><ThemedText themeColor="textSecondary" type="captionBold">Clear choices</ThemedText></Pressable>
        <Pressable accessibilityRole="button" onPress={cancelFilters} style={[styles.filterSecondary, { borderColor: theme.homeBorder }]}><ThemedText themeColor="textSecondary" type="captionBold">Cancel</ThemedText></Pressable>
        <Pressable accessibilityRole="button" onPress={applyFilters} style={[styles.filterApply, { backgroundColor: theme.accent }]}><ThemedText themeColor="accentInk" type="captionBold">Apply filters</ThemedText></Pressable>
      </View>
    </OptionsSheet>

    <OptionsSheet onClose={() => setStatusTask(null)} title={statusTask ? `Status: ${statusTask.task.title}` : 'Change task status'} visible={Boolean(statusTask)}>
      {scopedBoard?.states.length ? <SheetSection title="Move to status">
        {scopedBoard.states.map((state) => <SheetRow accessibilityRole="radio" icon="view-column" key={state._id} label={state.name} selected={state._id === statusTask?.task.workflowStateId} onPress={() => {
          if (!statusTask) return;
          if (state._id === statusTask.task.workflowStateId) {
            setStatusTask(null);
            return;
          }
          onSetTaskStatus(statusTask, String(state._id));
          setStatusTask(null);
        }} />)}
      </SheetSection> : <SheetNote>Task statuses are unavailable right now.</SheetNote>}
    </OptionsSheet>
    <OptionsSheet onClose={onCancelTaskStatusConfirmation} title="Open checklist items" visible={Boolean(confirmationTask)}>
      <SheetNote>This task has open checklist items. Move it to {confirmationState?.name ?? 'this status'} anyway?</SheetNote>
      <View style={styles.filterActions}>
        <Pressable accessibilityRole="button" onPress={onCancelTaskStatusConfirmation} style={[styles.filterSecondary, { borderColor: theme.homeBorder }]}><ThemedText themeColor="textSecondary" type="captionBold">Cancel</ThemedText></Pressable>
        <Pressable accessibilityRole="button" onPress={onConfirmTaskStatus} style={[styles.filterApply, { backgroundColor: theme.accent }]}><ThemedText themeColor="accentInk" type="captionBold">{confirmationState?.category === 'completed' ? 'Complete anyway' : 'Move anyway'}</ThemedText></Pressable>
      </View>
    </OptionsSheet>
    {createProjectPickerSheet}
  </ThemedView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: Spacing.three },
  globalHeading: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  pageTitle: { flexShrink: 1 },
  companyPill: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, maxWidth: '48%', minHeight: 34, paddingHorizontal: Spacing.two },
  companyPillText: { flexShrink: 1 },
  searchFilterRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  searchField: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  searchInput: { ...Typography.body, flex: 1, minWidth: 0, paddingVertical: Spacing.two },
  searchClear: { alignItems: 'center', borderRadius: Radius.pill, height: 32, justifyContent: 'center', width: 32 },
  filterButton: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget, paddingHorizontal: Spacing.two },
  filterCount: { alignItems: 'center', borderRadius: Radius.pill, justifyContent: 'center', minHeight: 20, minWidth: 20, paddingHorizontal: Spacing.one },
  viewTabs: { alignItems: 'center', gap: Spacing.one, paddingRight: Spacing.four },
  viewTab: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.one, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  weekHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: TouchTarget },
  weekHeadingCopy: { flex: 1, gap: Spacing.half },
  weekTaskTabs: { flexDirection: 'row', gap: Spacing.two, paddingRight: Spacing.two },
  weekTaskTab: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, maxWidth: 280, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  weekTaskTitle: { flexShrink: 1, minWidth: 0 },
  calendarToggle: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  selectedDayRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: TouchTarget },
  weekDays: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  weekDay: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.half, justifyContent: 'center', minHeight: 80, minWidth: 70, paddingHorizontal: Spacing.two },
  taskFeed: { gap: Spacing.three },
  taskGroup: { gap: Spacing.one },
  taskGroupHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 32 },
  collapsibleGroup: { gap: Spacing.one },
  collapseButton: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minHeight: TouchTarget },
  loadMore: { alignItems: 'center', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: TouchTarget },
  boardDirectory: { gap: Spacing.one, paddingTop: Spacing.four },
  profileName: { paddingBottom: Spacing.one },
  directoryDivider: { height: StyleSheet.hairlineWidth, marginBottom: Spacing.one, width: '100%' },
  boardDirectoryHeading: { minHeight: 30, justifyContent: 'center' },
  boardRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: 64, paddingHorizontal: Spacing.one, paddingVertical: Spacing.two },
  boardMarkWrap: { height: 38, position: 'relative', width: 38 },
  boardCopy: { flex: 1, gap: 2, minWidth: 0 },
  boardUnreadBadge: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: 1.5, justifyContent: 'center', minHeight: 24, minWidth: 24, paddingHorizontal: 3, paddingVertical: 2, position: 'absolute', right: -4, top: -4 },
  boardUnreadCount: Typography.captionBold,
  filterActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  filterSecondary: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  filterApply: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, flex: 1, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three },
});
