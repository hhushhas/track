import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';

import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { OptionsSheet, SheetRow, SheetSection } from '@/components/options-sheet';
import type { MobileTaskView } from '@/components/task-detail-types';
import { BoardCardHeight, TaskCard, TaskStateBanner, TaskStatusPill } from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticMedium } from '@/lib/haptics';

const ColumnWidth = 268;
const ColumnGap = Spacing.three;
const CardGap = Spacing.two;
const Slot = BoardCardHeight + CardGap;
const ListTop = 44;
const EdgeZone = 64;
const ScrollStep = 14;

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

type DragState = {
  activeColumn: SharedValue<number>;
  activeIndex: SharedValue<number>;
  autoX: SharedValue<number>;
  autoY: SharedValue<number>;
  boardHeight: SharedValue<number>;
  boardWidth: SharedValue<number>;
  boardX: SharedValue<number>;
  boardY: SharedValue<number>;
  cardX: SharedValue<number>;
  cardY: SharedValue<number>;
  columnScroll: SharedValue<number[]>;
  dragging: SharedValue<number>;
  grabX: SharedValue<number>;
  grabY: SharedValue<number>;
  lift: SharedValue<number>;
  listTop: SharedValue<number>;
  scrollX: SharedValue<number>;
};

function useDragState(): DragState {
  return {
    activeColumn: useSharedValue(-1),
    activeIndex: useSharedValue(0),
    autoX: useSharedValue(0),
    autoY: useSharedValue(0),
    boardHeight: useSharedValue(0),
    boardWidth: useSharedValue(0),
    boardX: useSharedValue(0),
    boardY: useSharedValue(0),
    cardX: useSharedValue(0),
    cardY: useSharedValue(0),
    columnScroll: useSharedValue<number[]>([]),
    dragging: useSharedValue(0),
    grabX: useSharedValue(0),
    grabY: useSharedValue(0),
    lift: useSharedValue(0),
    listTop: useSharedValue(0),
    scrollX: useSharedValue(0),
  };
}

function byRank(a: MobileTaskView, b: MobileTaskView) {
  return a.task.rank < b.task.rank ? -1 : a.task.rank > b.task.rank ? 1 : 0;
}

const taskReasonPattern = /task_[a-z_]+(?::\d+)?/;

/** Convex wraps a thrown code in a server stack, so the code is recovered
 *  rather than lost behind a blanket failure the reporter cannot act on. */
function moveFailureReason(error: unknown) {
  if (!(error instanceof Error)) return '';
  return taskReasonPattern.exec(error.message)?.[0] ?? error.message.split('\n')[0].trim();
}

function moveFailureMessage(reason: string) {
  if (reason.startsWith('task_conflict')) {
    return 'This task changed elsewhere — the card returned to its saved place.';
  }
  if (reason === 'task_edit_forbidden') return 'You are not allowed to move this task.';
  if (reason === 'task_destination_invalid') {
    return 'That column is no longer part of this board. Reopen the board and try again.';
  }
  if (reason === 'task_access_changed') return 'Your access to this task changed. Refresh and try again.';
  if (!reason) return 'The move could not be saved.';
  return `The move could not be saved: ${reason.replaceAll('_', ' ')}`;
}

export function TaskBoard({
  assigneeName,
  columns,
  onMove,
  onOpen,
  readOnly,
}: {
  assigneeName: (item: MobileTaskView) => string | undefined;
  columns: BoardColumnView[];
  onMove: (input: TaskMoveInput) => Promise<void>;
  onOpen: (item: MobileTaskView) => void;
  readOnly: boolean;
}) {
  const theme = useTheme();
  const rootRef = useAnimatedRef<Animated.View>();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const drag = useDragState();
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ index: number; stateId: string; taskId: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<MobileTaskView | null>(null);
  const [failure, setFailure] = useState<{ message: string; retry?: TaskMoveInput } | null>(null);

  const display = useMemo(() => {
    const sorted = columns.map((column) => ({ ...column, tasks: [...column.tasks].sort(byRank) }));
    const moved = pending && sorted.flatMap((column) => column.tasks)
      .find((item) => item.task._id === pending.taskId);
    if (!pending || !moved) return sorted;
    return sorted.map((column) => {
      const tasks = column.tasks.filter((item) => item.task._id !== pending.taskId);
      if (column.state._id !== pending.stateId) return { ...column, tasks };
      tasks.splice(Math.min(pending.index, tasks.length), 0, moved);
      return { ...column, tasks };
    });
  }, [columns, pending]);

  const dragged = display.flatMap((column) => column.tasks).find((item) => item.task._id === dragTaskId);

  async function commit(input: TaskMoveInput, optimistic: { index: number; stateId: string }) {
    setPending({ ...optimistic, taskId: input.taskId });
    setFailure(null);
    try {
      await onMove(input);
    } catch (error) {
      const reason = moveFailureReason(error);
      setFailure(reason === 'task_open_subtasks_confirmation_required'
        ? { message: 'This task still has open checklist items.', retry: { ...input, confirmOpenSubtasks: true } }
        : { message: moveFailureMessage(reason) });
    } finally {
      setPending(null);
    }
  }

  // The dragged task arrives from the worklet rather than from React state, so a
  // gesture that began before the last render still resolves the right card.
  function drop(taskId: string, columnIndex: number, index: number) {
    const target = display[Math.min(Math.max(columnIndex, 0), display.length - 1)];
    const item = display.flatMap((column) => column.tasks).find((row) => row.task._id === taskId);
    setDragTaskId(null);
    if (!target || !item) return;
    const others = target.tasks.filter((row) => row.task._id !== item.task._id);
    const position = Math.min(Math.max(index, 0), others.length);
    const unchanged = target.state._id === item.task.workflowStateId &&
      target.tasks.findIndex((row) => row.task._id === item.task._id) === position;
    if (unchanged) return;
    void commit({
      afterTaskId: others[position - 1]?.task._id,
      beforeTaskId: others[position]?.task._id,
      expectedRevision: item.task.revision,
      taskId: item.task._id,
      workflowStateId: target.state._id,
    }, { index: position, stateId: target.state._id });
  }

  function moveTo(state: Doc<'taskWorkflowStates'>) {
    const item = moveTarget;
    setMoveTarget(null);
    if (!item || state._id === item.task.workflowStateId) return;
    const others = display.find((column) => column.state._id === state._id)?.tasks ?? [];
    void commit({
      afterTaskId: others[others.length - 1]?.task._id,
      expectedRevision: item.task.revision,
      taskId: item.task._id,
      workflowStateId: state._id,
    }, { index: others.length, stateId: state._id });
  }

  const scrollHandler = useAnimatedScrollHandler((event) => {
    drag.scrollX.value = event.contentOffset.x;
  });

  useFrameCallback(() => {
    if (!drag.dragging.value || !drag.autoX.value) return;
    const limit = Math.max(0, columns.length * (ColumnWidth + ColumnGap) - drag.boardWidth.value);
    const next = Math.min(Math.max(drag.scrollX.value + drag.autoX.value * ScrollStep, 0), limit);
    drag.scrollX.value = next;
    scrollTo(scrollRef, next, 0, false);
  });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: drag.lift.value,
    transform: [
      { translateX: drag.cardX.value },
      { translateY: drag.cardY.value },
      { scale: 1 + drag.lift.value * 0.05 },
    ],
  }));

  return (
    <Animated.View ref={rootRef} style={styles.root}>
      {failure ? (
        <TaskStateBanner
          action={failure.retry
            ? { label: 'Complete anyway', onPress: () => {
              const retry = failure.retry!;
              const column = display.find((item) => item.state._id === retry.workflowStateId);
              void commit(retry, { index: column?.tasks.length ?? 0, stateId: retry.workflowStateId });
            } }
            : { label: 'Dismiss', onPress: () => setFailure(null) }}
          icon="alert-circle"
          message={failure.message}
          tone="danger"
        />
      ) : null}
      <Animated.ScrollView
        contentContainerStyle={styles.columns}
        horizontal
        onScroll={scrollHandler}
        ref={scrollRef}
        scrollEnabled={!dragTaskId}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}>
        {display.map((column, index) => (
          <BoardColumn
            assigneeName={assigneeName}
            column={column}
            columnCount={display.length}
            drag={drag}
            dragTaskId={dragTaskId}
            index={index}
            key={column.state._id}
            onDrop={drop}
            onLift={setDragTaskId}
            onOpen={onOpen}
            onStatusPress={setMoveTarget}
            readOnly={readOnly}
            rootRef={rootRef}
          />
        ))}
      </Animated.ScrollView>
      {dragged ? (
        <Animated.View pointerEvents="none" style={[styles.overlay, { shadowColor: theme.text }, overlayStyle]}>
          <TaskCard
            assignee={assigneeName(dragged)}
            category={dragged.state?.category}
            dueDate={dragged.task.dueDate}
            evidence={dragged.references.length > 0}
            onPress={() => undefined}
            priority={dragged.task.priority}
            publicKey={dragged.task.publicKey}
            stateName={dragged.state?.name ?? 'Unknown'}
            title={dragged.task.title}
            variant="board"
          />
        </Animated.View>
      ) : null}
      <OptionsSheet onClose={() => setMoveTarget(null)} title="Move to" visible={Boolean(moveTarget)}>
        <SheetSection title={moveTarget?.task.title}>
          {columns.map((column) => (
            <SheetRow
              icon={column.state.category === 'completed' ? 'check-circle' : 'circle-outline'}
              key={column.state._id}
              label={column.state.name}
              onPress={() => moveTo(column.state)}
              selected={column.state._id === moveTarget?.task.workflowStateId}
            />
          ))}
        </SheetSection>
      </OptionsSheet>
    </Animated.View>
  );
}

function BoardColumn({
  assigneeName,
  column,
  columnCount,
  drag,
  dragTaskId,
  index,
  onDrop,
  onLift,
  onOpen,
  onStatusPress,
  readOnly,
  rootRef,
}: {
  assigneeName: (item: MobileTaskView) => string | undefined;
  column: BoardColumnView;
  columnCount: number;
  drag: DragState;
  dragTaskId: string | null;
  index: number;
  onDrop: (taskId: string, column: number, index: number) => void;
  onLift: (taskId: string | null) => void;
  onOpen: (item: MobileTaskView) => void;
  onStatusPress: (item: MobileTaskView) => void;
  readOnly: boolean;
  rootRef: AnimatedRef<Animated.View>;
}) {
  const theme = useTheme();
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const content = useSharedValue(0);
  const viewport = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    const offsets = [...drag.columnScroll.value];
    offsets[index] = event.contentOffset.y;
    drag.columnScroll.value = offsets;
  });

  useFrameCallback(() => {
    if (!drag.dragging.value || drag.activeColumn.value !== index || !drag.autoY.value) return;
    const limit = Math.max(0, content.value - viewport.value);
    const current = drag.columnScroll.value[index] ?? 0;
    const next = Math.min(Math.max(current + drag.autoY.value * ScrollStep, 0), limit);
    const offsets = [...drag.columnScroll.value];
    offsets[index] = next;
    drag.columnScroll.value = offsets;
    scrollTo(listRef, 0, next, false);
  });

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: drag.dragging.value && drag.activeColumn.value === index ? 1 : 0,
    transform: [{ translateY: drag.activeIndex.value * Slot - CardGap / 2 }],
  }));

  return (
    <View style={styles.column}>
      {/* The count sits against its own chip: pushed to the column edge it read
          as a label on the next column. */}
      <View style={styles.columnHeading}>
        <TaskStatusPill category={column.state.category} label={column.state.name} />
        <ThemedText
          accessibilityLabel={`${column.tasks.length} ${column.tasks.length === 1 ? 'task' : 'tasks'} in ${column.state.name}`}
          themeColor="textSecondary"
          type="captionBold">
          {column.tasks.length}
        </ThemedText>
      </View>
      <Animated.ScrollView
        contentContainerStyle={styles.columnBody}
        onContentSizeChange={(_, height) => { content.value = height; }}
        onLayout={(event) => { viewport.value = event.nativeEvent.layout.height; }}
        onScroll={scrollHandler}
        ref={listRef}
        scrollEnabled={!dragTaskId}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.indicator, { backgroundColor: theme.accent }, indicatorStyle]} />
        {column.tasks.map((item, position) => (
          <BoardCard
            assigneeName={assigneeName}
            columnCount={columnCount}
            columnIndex={index}
            drag={drag}
            dragging={dragTaskId === item.task._id}
            item={item}
            key={item.task._id}
            onDrop={onDrop}
            onLift={onLift}
            onOpen={onOpen}
            onStatusPress={onStatusPress}
            position={position}
            readOnly={readOnly}
            rootRef={rootRef}
          />
        ))}
        {!column.tasks.length ? (
          <View style={[styles.columnEmpty, { borderColor: theme.hairline }]}>
            <ThemedText themeColor="textTertiary" type="small">Drop a task here</ThemedText>
          </View>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

function BoardCard({
  assigneeName,
  columnCount,
  columnIndex,
  drag,
  dragging,
  item,
  onDrop,
  onLift,
  onOpen,
  onStatusPress,
  position,
  readOnly,
  rootRef,
}: {
  assigneeName: (item: MobileTaskView) => string | undefined;
  columnCount: number;
  columnIndex: number;
  drag: DragState;
  dragging: boolean;
  item: MobileTaskView;
  onDrop: (taskId: string, column: number, index: number) => void;
  onLift: (taskId: string | null) => void;
  onOpen: (item: MobileTaskView) => void;
  onStatusPress: (item: MobileTaskView) => void;
  position: number;
  readOnly: boolean;
  rootRef: AnimatedRef<Animated.View>;
}) {
  const cardRef = useAnimatedRef<Animated.View>();
  const taskId = item.task._id;

  const pan = Gesture.Pan()
    .enabled(!readOnly)
    .activateAfterLongPress(220)
    .onStart((event) => {
      const card = measure(cardRef);
      const board = measure(rootRef);
      if (!card || !board) return;
      drag.boardX.value = board.pageX;
      drag.boardY.value = board.pageY;
      drag.boardWidth.value = board.width;
      drag.boardHeight.value = board.height;
      drag.grabX.value = event.absoluteX - card.pageX;
      drag.grabY.value = event.absoluteY - card.pageY;
      drag.cardX.value = card.pageX - board.pageX;
      drag.cardY.value = card.pageY - board.pageY;
      // Derived from the lifted card so a banner above the columns cannot skew
      // the drop index.
      drag.listTop.value = drag.cardY.value - position * Slot
        + (drag.columnScroll.value[columnIndex] ?? 0);
      drag.activeColumn.value = columnIndex;
      drag.activeIndex.value = position;
      drag.dragging.value = 1;
      drag.lift.value = withTiming(1, { duration: 120 });
      runOnJS(hapticMedium)();
      runOnJS(onLift)(taskId);
    })
    .onUpdate((event) => {
      if (!drag.dragging.value) return;
      drag.cardX.value = event.absoluteX - drag.grabX.value - drag.boardX.value;
      drag.cardY.value = event.absoluteY - drag.grabY.value - drag.boardY.value;
      const localX = drag.cardX.value + ColumnWidth / 2 + drag.scrollX.value;
      const column = Math.min(
        Math.max(Math.floor(localX / (ColumnWidth + ColumnGap)), 0),
        Math.max(columnCount - 1, 0),
      );
      drag.activeColumn.value = column;
      const offset = drag.columnScroll.value[column] ?? 0;
      drag.activeIndex.value = Math.max(
        0,
        Math.round((drag.cardY.value - drag.listTop.value + offset) / Slot),
      );
      drag.autoX.value = event.absoluteX < drag.boardX.value + EdgeZone
        ? -1
        : event.absoluteX > drag.boardX.value + drag.boardWidth.value - EdgeZone ? 1 : 0;
      drag.autoY.value = event.absoluteY < drag.boardY.value + drag.listTop.value + EdgeZone
        ? -1
        : event.absoluteY > drag.boardY.value + drag.boardHeight.value - EdgeZone ? 1 : 0;
    })
    .onEnd(() => {
      if (!drag.dragging.value) return;
      runOnJS(onDrop)(taskId, drag.activeColumn.value, drag.activeIndex.value);
    })
    .onFinalize(() => {
      drag.dragging.value = 0;
      drag.autoX.value = 0;
      drag.autoY.value = 0;
      drag.activeColumn.value = -1;
      drag.lift.value = withTiming(0, { duration: 120 });
      runOnJS(onLift)(null);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View ref={cardRef} style={dragging ? styles.lifted : undefined}>
        <TaskCard
          assignee={assigneeName(item)}
          category={item.state?.category}
          dueDate={item.task.dueDate}
          evidence={item.references.length > 0}
          onPress={() => onOpen(item)}
          onStatusPress={readOnly ? undefined : () => onStatusPress(item)}
          priority={item.task.priority}
          publicKey={item.task.publicKey}
          stateName={item.state?.name ?? 'Unknown'}
          title={item.task.title}
          variant="board"
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  column: { width: ColumnWidth },
  columnBody: { gap: CardGap, paddingBottom: Spacing.six },
  columnEmpty: {
    alignItems: 'center',
    borderRadius: Radius.large,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 112,
  },
  columnHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    height: ListTop,
  },
  columns: { gap: ColumnGap, paddingRight: Spacing.three },
  indicator: { borderRadius: Radius.small, height: 3, left: 0, position: 'absolute', right: 0, top: 0 },
  lifted: { opacity: 0.25 },
  overlay: {
    elevation: 12,
    left: 0,
    position: 'absolute',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    top: 0,
    width: ColumnWidth,
  },
  root: { flex: 1, gap: Spacing.two },
});
