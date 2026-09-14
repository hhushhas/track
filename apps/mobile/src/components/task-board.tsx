import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { OptionsSheet, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import type { MobileTaskView } from '@/components/task-detail-types';
import { TaskCard, TaskStateBanner } from '@/components/task-ui';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isCompactTaskBoard } from '@/lib/task-board-layout';

const ColumnWidth = 280;
const ColumnGap = Spacing.three;
const CardGap = Spacing.two;

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

type LastMove = {
  input: TaskMoveInput;
  message: string;
  optimistic: { index: number; stateId: string };
};

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
  const { width: windowWidth } = useWindowDimensions();
  const compactBoard = isCompactTaskBoard(windowWidth);
  const [pending, setPending] = useState<{ index: number; stateId: string; taskId: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<MobileTaskView | null>(null);
  const [failure, setFailure] = useState<{ message: string; retry?: TaskMoveInput } | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

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

  async function commit(
    input: TaskMoveInput,
    optimistic: { index: number; stateId: string },
    undo?: TaskMoveInput,
    undoOptimistic?: { index: number; stateId: string },
    restoreUndoOnFailure?: LastMove,
  ) {
    setPending({ ...optimistic, taskId: input.taskId });
    setFailure(null);
    setLastMove(null);
    try {
      await onMove(input);
      if (undo && undoOptimistic) {
        const destination = states.find((state) => state._id === input.workflowStateId)?.name ?? 'the selected status';
        setLastMove({ input: undo, message: `Task moved to ${destination}.`, optimistic: undoOptimistic });
      }
    } catch (error) {
      if (restoreUndoOnFailure) setLastMove(restoreUndoOnFailure);
      const reason = moveFailureReason(error);
      setFailure(reason === 'task_open_subtasks_confirmation_required'
        ? { message: 'This task still has open checklist items.', retry: { ...input, confirmOpenSubtasks: true } }
        : { message: moveFailureMessage(reason) });
    } finally {
      setPending(null);
    }
  }

  function moveTo(state: Doc<'taskWorkflowStates'>) {
    const item = moveTarget;
    setMoveTarget(null);
    if (!item || state._id === item.task.workflowStateId) return;
    const others = display.find((column) => column.state._id === state._id)?.tasks ?? [];
    const source = display.find((column) => column.state._id === item.task.workflowStateId);
    const sourceTasks = source?.tasks.filter((row) => row.task._id !== item.task._id) ?? [];
    const sourcePosition = source?.tasks.findIndex((row) => row.task._id === item.task._id) ?? 0;
    void commit({
      afterTaskId: others[others.length - 1]?.task._id,
      expectedRevision: item.task.revision,
      taskId: item.task._id,
      workflowStateId: state._id,
    }, { index: others.length, stateId: state._id }, {
      afterTaskId: sourceTasks[sourcePosition - 1]?.task._id,
      beforeTaskId: sourceTasks[sourcePosition]?.task._id,
      expectedRevision: item.task.revision + 1,
      taskId: item.task._id,
      workflowStateId: item.task.workflowStateId,
    }, { index: sourcePosition, stateId: item.task.workflowStateId });
  }

  function reorderWithinColumn(position: 'top' | 'up' | 'down' | 'bottom') {
    const item = moveTarget;
    setMoveTarget(null);
    if (!item) return;
    const source = display.find((column) => column.state._id === item.task.workflowStateId);
    if (!source) return;
    const currentIndex = source.tasks.findIndex((row) => row.task._id === item.task._id);
    const others = source.tasks.filter((row) => row.task._id !== item.task._id);
    const nextIndex = position === 'top'
      ? 0
      : position === 'bottom'
        ? others.length
        : position === 'up'
          ? Math.max(0, currentIndex - 1)
          : Math.min(others.length, currentIndex + 1);
    if (nextIndex === currentIndex) return;
    void commit({
      afterTaskId: others[nextIndex - 1]?.task._id,
      beforeTaskId: others[nextIndex]?.task._id,
      expectedRevision: item.task.revision,
      taskId: item.task._id,
      workflowStateId: item.task.workflowStateId,
    }, { index: nextIndex, stateId: item.task.workflowStateId }, {
      afterTaskId: others[currentIndex - 1]?.task._id,
      beforeTaskId: others[currentIndex]?.task._id,
      expectedRevision: item.task.revision + 1,
      taskId: item.task._id,
      workflowStateId: item.task.workflowStateId,
    }, { index: currentIndex, stateId: item.task.workflowStateId });
  }

  return (
    <View style={styles.root}>
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
      {lastMove ? (
        <TaskStateBanner
          action={{
            label: 'Undo',
            onPress: () => {
              const undo = lastMove;
              void commit(undo.input, undo.optimistic, undefined, undefined, undo);
            },
          }}
          icon="check-circle"
          message={lastMove.message}
          tone="success"
        />
      ) : null}
      {compactBoard ? (
        <>
          <ScrollView contentContainerStyle={styles.compactColumns} horizontal showsHorizontalScrollIndicator={false}>
            {display.map((column) => (
              <BoardColumn
                assigneeName={assigneeName}
                column={column}
                columnWidth={Math.min(282, Math.max(272, windowWidth - 108))}
                focusedTaskId={focusedTaskId}
                key={column.state._id}
                onOpen={onOpen}
                onStatusPress={setMoveTarget}
                readOnly={readOnly}
              />
            ))}
          </ScrollView>
        </>
      ) : (
        <ScrollView
          contentContainerStyle={styles.columns}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {display.map((column) => (
            <BoardColumn
              assigneeName={assigneeName}
              column={column}
              columnWidth={ColumnWidth}
              focusedTaskId={focusedTaskId}
              key={column.state._id}
              onOpen={onOpen}
              onStatusPress={setMoveTarget}
              readOnly={readOnly}
            />
          ))}
        </ScrollView>
      )}
      <OptionsSheet onClose={() => setMoveTarget(null)} title="Move to" visible={Boolean(moveTarget)}>
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
        {moveTarget ? (
          <SheetSection title="Order in current status">
            <SheetRow icon="arrow-up" label="Move to top" onPress={() => reorderWithinColumn('top')} />
            <SheetRow icon="chevron-up" label="Move up" onPress={() => reorderWithinColumn('up')} />
            <SheetRow icon="chevron-down" label="Move down" onPress={() => reorderWithinColumn('down')} />
            <SheetRow icon="arrow-down" label="Move to bottom" onPress={() => reorderWithinColumn('bottom')} />
          </SheetSection>
        ) : null}
      </OptionsSheet>
    </View>
  );
}

function BoardColumn({
  assigneeName,
  column,
  columnWidth,
  focusedTaskId,
  onOpen,
  onStatusPress,
  readOnly,
}: {
  assigneeName: (item: MobileTaskView) => string | undefined;
  column: BoardColumnView;
  columnWidth: number;
  focusedTaskId?: string;
  onOpen: (item: MobileTaskView) => void;
  onStatusPress: (item: MobileTaskView) => void;
  readOnly: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.column, { backgroundColor: theme.background, borderColor: theme.background, width: columnWidth }]}>
      <View style={[styles.columnHeading, { borderBottomColor: theme.hairline }]}>
        <View style={styles.columnTitle}>
          <View style={[styles.columnDot, { backgroundColor: stateDotColor(column.state.category, theme) }]} />
          <ThemedText numberOfLines={1} type="smallBold">{column.state.name}</ThemedText>
        </View>
        <ThemedText
          accessibilityLabel={`${column.tasks.length} ${column.tasks.length === 1 ? 'task' : 'tasks'} in ${column.state.name}`}
          themeColor="textSecondary"
          type="captionBold">
          {column.tasks.length}
        </ThemedText>
      </View>
      <ScrollView
        contentContainerStyle={styles.columnBody}
        showsVerticalScrollIndicator={false}>
        {column.tasks.map((item) => (
          <BoardCard
            assigneeName={assigneeName}
            item={item}
            key={item.task._id}
            onOpen={onOpen}
            onLongPress={() => onStatusPress(item)}
            onStatusPress={onStatusPress}
            readOnly={readOnly}
            focused={item.task._id === focusedTaskId}
          />
        ))}
        {!column.tasks.length ? (
          <View style={[styles.columnEmpty, { borderColor: theme.hairline }]}>
            <PlatformIcon color={theme.textTertiary} name="view-column" size={20} />
            <ThemedText themeColor="textTertiary" type="caption">No tasks in this status</ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function stateDotColor(category: Doc<'taskWorkflowStates'>['category'], theme: ReturnType<typeof useTheme>) {
  if (category === 'completed') return theme.success;
  if (category === 'started') return theme.accentStrong;
  if (category === 'canceled') return theme.danger;
  return theme.textTertiary;
}

function BoardCard({
  assigneeName,
  focused,
  item,
  onLongPress,
  onOpen,
  onStatusPress,
  readOnly,
}: {
  assigneeName: (item: MobileTaskView) => string | undefined;
  focused: boolean;
  item: MobileTaskView;
  onLongPress: () => void;
  onOpen: (item: MobileTaskView) => void;
  onStatusPress: (item: MobileTaskView) => void;
  readOnly: boolean;
}) {
  const referenceCount = 'references' in item && Array.isArray(item.references)
    ? item.references.length
    : item.hasEvidence ? 1 : 0;
  return (
    <TaskCard
      assignee={assigneeName(item)}
      category={item.state?.category}
      dueDate={item.task.dueDate}
      evidence={referenceCount > 0}
      focused={focused}
      onLongPress={readOnly ? undefined : onLongPress}
      onPress={() => onOpen(item)}
      onStatusPress={readOnly ? undefined : () => onStatusPress(item)}
      priority={item.task.priority}
      publicKey={item.task.publicKey}
      referenceCount={referenceCount}
      stateName={item.state?.name ?? 'Unknown'}
      title={item.task.title}
      variant="board"
    />
  );
}

const styles = StyleSheet.create({
  column: { minHeight: 220, overflow: 'visible', width: ColumnWidth },
  columnBody: { gap: CardGap, paddingBottom: Spacing.four },
  columnEmpty: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: Radius.large,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: Spacing.one,
    justifyContent: 'center',
    minHeight: 104,
    paddingHorizontal: Spacing.two,
  },
  columnHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 34,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  columns: { gap: ColumnGap, paddingBottom: Spacing.four, paddingRight: Spacing.three },
  compactColumns: { gap: ColumnGap, paddingBottom: Spacing.four, paddingRight: Spacing.three },
  columnDot: { borderRadius: Radius.pill, height: 8, width: 8 },
  columnTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, minWidth: 0 },
  root: { flex: 1, gap: Spacing.two },
});
