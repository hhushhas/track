import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { OptionsSheet, SheetRow, SheetSection } from '@/components/options-sheet';
import type { MobileTaskView } from '@/components/task-detail-types';
import { TaskCard, TaskStateBanner, TaskStatusPill } from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useBottomTabContentInset } from '@/hooks/use-bottom-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { boardPageIndex } from '@/lib/task-workflow';

export type BoardColumnView = {
  state: Doc<'taskWorkflowStates'>;
  tasks: MobileTaskView[];
};

export type TaskMoveInput = {
  afterTaskId?: Id<'tasks'>;
  beforeTaskId?: Id<'tasks'>;
  confirmOpenSubtasks?: boolean;
  expectedRevision: number;
  taskId: Id<'tasks'>;
  workflowStateId: Id<'taskWorkflowStates'>;
};

const taskReasonPattern = /task_[a-z_]+(?::\d+)?/;
const STATUS_TAB_WIDTH = 132;
const STATUS_TAB_GAP = Spacing.two;
const STATUS_TAB_STEP = STATUS_TAB_WIDTH + STATUS_TAB_GAP;

function moveFailureReason(error: unknown) {
  if (!(error instanceof Error)) return '';
  return taskReasonPattern.exec(error.message)?.[0] ?? error.message.split('\n')[0].trim();
}

function moveFailureMessage(reason: string) {
  if (reason.startsWith('task_conflict')) return 'This task changed elsewhere. The board has been refreshed.';
  if (reason === 'task_edit_forbidden') return 'You are not allowed to move this task.';
  if (reason === 'task_destination_invalid') return 'That status is no longer available on this board.';
  if (reason === 'task_access_changed') return 'Your access to this task changed. Refresh and try again.';
  return 'The move could not be saved. Check your connection and try again.';
}

/** A phone-first Kanban with one full-width, vertically scrolling status. */
export function TaskBoard({
  assigneeName,
  columns,
  focusedTaskId,
  onMove,
  onOpen,
  readOnly,
  states,
}: {
  assigneeName: (item: MobileTaskView) => string | undefined;
  columns: BoardColumnView[];
  focusedTaskId?: string;
  onMove: (input: TaskMoveInput) => Promise<void>;
  onOpen: (item: MobileTaskView) => void;
  readOnly: boolean;
  states: Array<Doc<'taskWorkflowStates'>>;
}) {
  const theme = useTheme();
  const bottomContentInset = useBottomTabContentInset();
  const [activeStateId, setActiveStateId] = useState<string>('');
  const [moveTarget, setMoveTarget] = useState<MobileTaskView | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; retry?: TaskMoveInput } | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const appliedFocusRef = useRef<string | undefined>(undefined);
  const pagerRef = useRef<FlatList<BoardColumnView>>(null);
  const statusListRef = useRef<FlatList<BoardColumnView>>(null);
  const taskListRefs = useRef(new Map<string, FlatList<MobileTaskView>>());
  const revealedFocusRef = useRef<string | undefined>(undefined);
  const movePendingRef = useRef(false);

  useEffect(() => {
    const shouldApplyFocus = Boolean(focusedTaskId) && appliedFocusRef.current !== focusedTaskId;
    const focusedColumn = shouldApplyFocus
      ? columns.find((column) => column.tasks.some((item) => item.task._id === focusedTaskId))
      : undefined;
    if (!focusedTaskId) appliedFocusRef.current = undefined;
    if (focusedColumn) {
      appliedFocusRef.current = focusedTaskId;
      setActiveStateId(focusedColumn.state._id);
      return;
    }
    if (columns.some((column) => column.state._id === activeStateId)) return;
    const preferred = columns.find((column) => column.tasks.length > 0) ?? columns[0];
    setActiveStateId(preferred?.state._id ?? '');
  }, [activeStateId, columns, focusedTaskId]);

  const activeColumn = useMemo(
    () => columns.find((column) => column.state._id === activeStateId) ?? columns[0],
    [activeStateId, columns],
  );
  const activeColumnIndex = Math.max(
    0,
    columns.findIndex((column) => column.state._id === activeColumn?.state._id),
  );

  useEffect(() => {
    if (!pageWidth) return;
    pagerRef.current?.scrollToOffset({ animated: true, offset: activeColumnIndex * pageWidth });
  }, [activeColumnIndex, pageWidth]);

  useEffect(() => {
    statusListRef.current?.scrollToIndex({
      animated: true,
      index: activeColumnIndex,
      viewPosition: 0.5,
    });
  }, [activeColumnIndex]);

  const activateColumn = useCallback((stateId: string) => {
    if (!columns.some((column) => column.state._id === stateId)) return;
    hapticLight();
    setActiveStateId(stateId);
  }, [columns]);

  const registerTaskList = useCallback((
    stateId: string,
    columnTasks: MobileTaskView[],
    list: FlatList<MobileTaskView> | null,
  ) => {
    if (!list) {
      taskListRefs.current.delete(stateId);
      return;
    }
    taskListRefs.current.set(stateId, list);
    const focusedIndex = columnTasks.findIndex((item) => item.task._id === focusedTaskId);
    if (stateId !== activeStateId || focusedIndex < 0 || revealedFocusRef.current === focusedTaskId) return;
    requestAnimationFrame(() => {
      list.scrollToIndex({ animated: false, index: focusedIndex, viewPosition: 0.3 });
      revealedFocusRef.current = focusedTaskId;
    });
  }, [activeStateId, focusedTaskId]);

  useEffect(() => {
    if (!focusedTaskId) revealedFocusRef.current = undefined;
  }, [focusedTaskId]);

  function measurePager(event: LayoutChangeEvent) {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== pageWidth) setPageWidth(nextWidth);
  }

  function finishPageSwipe(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    const index = boardPageIndex(event.nativeEvent.contentOffset.x, pageWidth, columns.length);
    const next = columns[index];
    if (next && next.state._id !== activeStateId) setActiveStateId(next.state._id);
  }

  async function commit(input: TaskMoveInput) {
    if (movePendingRef.current) return;
    movePendingRef.current = true;
    setFailure(null);
    setPendingTaskId(input.taskId);
    try {
      await onMove(input);
      setActiveStateId(input.workflowStateId);
    } catch (error) {
      const reason = moveFailureReason(error);
      setFailure(reason === 'task_open_subtasks_confirmation_required'
        ? { message: 'This task still has open checklist items.', retry: { ...input, confirmOpenSubtasks: true } }
        : { message: moveFailureMessage(reason) });
    } finally {
      movePendingRef.current = false;
      setPendingTaskId(null);
    }
  }

  function moveTo(state: Doc<'taskWorkflowStates'>) {
    const item = moveTarget;
    setMoveTarget(null);
    if (!item || state._id === item.task.workflowStateId) return;
    void commit({
      expectedRevision: item.task.revision,
      taskId: item.task._id,
      workflowStateId: state._id,
    });
  }

  if (!activeColumn) {
    const filteredOut = states.length > 0;
    return (
      <View style={[styles.empty, styles.emptyBoard, { borderColor: theme.hairline }]}>
        <ThemedText type="title">{filteredOut ? 'No matching tasks' : 'No statuses configured'}</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {filteredOut
            ? 'Adjust the search or filters to show this board again.'
            : readOnly ? 'This read-only board has no visible workflow.' : 'Add a workflow status before creating tasks.'}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {failure ? (
        <TaskStateBanner
          action={failure.retry
            ? { label: 'Complete anyway', onPress: () => void commit(failure.retry!) }
            : { label: 'Dismiss', onPress: () => setFailure(null) }}
          icon="alert-circle"
          message={failure.message}
          tone="danger"
        />
      ) : null}

      <FlatList
        accessibilityRole="tablist"
        contentContainerStyle={styles.statusTabs}
        data={columns}
        getItemLayout={(_, index) => ({ index, length: STATUS_TAB_STEP, offset: STATUS_TAB_STEP * index })}
        horizontal
        ItemSeparatorComponent={() => <View style={styles.statusTabSeparator} />}
        keyExtractor={(column) => column.state._id}
        ref={statusListRef}
        renderItem={({ item: column }) => {
          const selected = column.state._id === activeColumn.state._id;
          return (
            <Pressable
              accessibilityHint="Shows this Kanban column"
              accessibilityLabel={`${column.state.name}, ${column.tasks.length} tasks`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => activateColumn(column.state._id)}
              style={[styles.statusTab, {
                backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.hairline,
              }]}>
              <ThemedText numberOfLines={1} themeColor={selected ? 'text' : 'textSecondary'} type="smallBold">
                {column.state.name}
              </ThemedText>
              <View style={[styles.count, { backgroundColor: selected ? theme.accentSoft : theme.backgroundElevated }]}>
                <ThemedText themeColor={selected ? 'accentStrong' : 'textSecondary'} type="captionBold">
                  {column.tasks.length}
                </ThemedText>
              </View>
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
        style={styles.statusScroller}
      />

      <View onLayout={measurePager} style={styles.columnViewport}>
        {pageWidth ? (
          <FlatList
            data={columns}
            decelerationRate="fast"
            disableIntervalMomentum
            getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
            horizontal
            keyExtractor={(column) => column.state._id}
            onMomentumScrollEnd={finishPageSwipe}
            pagingEnabled
            ref={pagerRef}
            renderItem={({ item: column, index }) => (
              <View style={[styles.columnPage, { width: pageWidth }]}>
                <View style={styles.columnHeading}>
                  <TaskStatusPill category={column.state.category} label={column.state.name} />
                  <ThemedText themeColor="textSecondary" type="caption">
                    {index + 1} of {columns.length} · {column.tasks.length} {column.tasks.length === 1 ? 'task' : 'tasks'}
                  </ThemedText>
                </View>

                <FlatList
                  contentContainerStyle={[styles.list, { paddingBottom: bottomContentInset }]}
                  data={column.tasks}
                  keyExtractor={(item) => item.task._id}
                  ListEmptyComponent={(
                    <View style={[styles.empty, { borderColor: theme.hairline }]}>
                      <ThemedText type="title">No tasks in {column.state.name}</ThemedText>
                      <ThemedText themeColor="textSecondary" type="small">
                        {readOnly ? 'This board is read-only.' : 'Move a task here from its status menu.'}
                      </ThemedText>
                    </View>
                  )}
                  nestedScrollEnabled
                  onScrollToIndexFailed={({ averageItemLength, index }) => {
                    const list = taskListRefs.current.get(column.state._id);
                    list?.scrollToOffset({ animated: false, offset: averageItemLength * index });
                    requestAnimationFrame(() => list?.scrollToIndex({ animated: false, index, viewPosition: 0.3 }));
                  }}
                  ref={(list) => registerTaskList(column.state._id, column.tasks, list)}
                  renderItem={({ item }) => (
                    <View style={[styles.cardWrap, {
                      borderColor: item.task._id === focusedTaskId ? theme.accent : 'transparent',
                      opacity: pendingTaskId === item.task._id ? 0.55 : 1,
                    }]}>
                      <TaskCard
                        assignee={assigneeName(item)}
                        category={item.state?.category}
                        description={item.task.description}
                        dueDate={item.task.dueDate}
                        evidence={item.references.length > 0}
                        focused={item.task._id === focusedTaskId}
                        onLongPress={readOnly || pendingTaskId !== null ? undefined : () => setMoveTarget(item)}
                        onPress={() => onOpen(item)}
                        onStatusPress={readOnly || pendingTaskId !== null ? undefined : () => setMoveTarget(item)}
                        priority={item.task.priority}
                        publicKey={item.task.publicKey}
                        stateName={item.state?.name ?? 'Unknown'}
                        title={item.task.title}
                        variant="board"
                      />
                    </View>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
            style={styles.pager}
          />
        ) : null}
      </View>

      <OptionsSheet onClose={() => setMoveTarget(null)} title="Move to status" visible={Boolean(moveTarget)}>
        <SheetSection title={moveTarget?.task.title}>
          {states.map((state) => (
            <SheetRow
              icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'}
              key={state._id}
              label={state.name}
              onPress={() => moveTo(state)}
              selected={state._id === moveTarget?.task.workflowStateId}
            />
          ))}
        </SheetSection>
      </OptionsSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  columnPage: { flex: 1, gap: Spacing.three, paddingHorizontal: Spacing.one },
  columnHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  columnViewport: { flex: 1, marginHorizontal: -Spacing.one, minHeight: 0 },
  cardWrap: { borderRadius: Radius.large, borderWidth: 2 },
  count: { alignItems: 'center', borderRadius: Radius.pill, justifyContent: 'center', minWidth: 24, paddingHorizontal: 6, paddingVertical: 2 },
  empty: { borderCurve: 'continuous', borderRadius: Radius.large, borderStyle: 'dashed', borderWidth: 1, gap: Spacing.one, marginTop: Spacing.four, padding: Spacing.five },
  emptyBoard: { marginTop: 0 },
  list: { gap: Spacing.three, paddingTop: Spacing.two },
  pager: { flex: 1 },
  root: { flex: 1, gap: Spacing.three, minHeight: 0 },
  statusTab: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between', minHeight: TouchTarget, paddingHorizontal: Spacing.three, width: STATUS_TAB_WIDTH },
  statusTabSeparator: { width: STATUS_TAB_GAP },
  statusScroller: { flexGrow: 0, marginHorizontal: -Spacing.one, overflow: 'visible' },
  statusTabs: {
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
});
