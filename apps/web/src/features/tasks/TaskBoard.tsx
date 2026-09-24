import { useMutation } from 'convex/react'
import { ArrowLeft, ArrowRight, CalendarDays, Inbox, MessageCircle, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { Button } from '#/components/ui/button'
import { groupTaskViewsByState, type TaskBoardView, type TaskIdentity, type TaskListItem } from './task-types'
import { formatTaskCommentCount, formatTaskDateLong, PriorityPill, StateRing, TaskAvatar, TaskLabelPill } from './ui/TaskVisuals'

export function taskMoveErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('task_edit_forbidden')) return 'You can move tasks assigned to you or created by you. Project managers can move any task.'
  if (message.includes('task_conflict')) return 'This task changed elsewhere. Wait for the board to refresh, then try again.'
  if (message.includes('task_open_subtasks_confirmation_required')) return 'Complete the open subtasks before moving this task to a finished status.'
  if (message.includes('task_destination_invalid')) return 'That status is no longer available. Refresh the board and try again.'
  return "The move couldn't be saved. The card returned to its current position."
}

export function TaskBoard({
  board,
  identity,
  onAnnounce,
  onCreate,
  onOpen,
  tasks,
}: {
  board: TaskBoardView
  identity: TaskIdentity
  onAnnounce: (message: string) => void
  onCreate: (stateId: Id<'taskWorkflowStates'>) => void
  onOpen: (publicKey: string) => void
  tasks: Array<TaskListItem>
}) {
  const moveTask = useMutation(api.tasks.moveTask)
  const [optimisticStates, setOptimisticStates] = useState<Record<string, string>>({})
  const [draggedTask, setDraggedTask] = useState<Id<'tasks'> | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    item: TaskListItem
    stateId: Id<'taskWorkflowStates'>
    targetIndex: number
  } | null>(null)
  const grouped = useMemo(
    () => groupTaskViewsByState(board.states, tasks, optimisticStates),
    [board.states, optimisticStates, tasks],
  )

  async function move(
    item: TaskListItem,
    stateId: Id<'taskWorkflowStates'>,
    targetIndex: number,
    confirmOpenSubtasks = false,
  ): Promise<boolean> {
    const destinationTasks = (grouped.get(stateId) ?? []).filter((candidate) => candidate.task._id !== item.task._id)
    const index = Math.min(Math.max(targetIndex, 0), destinationTasks.length)
    const currentIndex = (grouped.get(item.task.workflowStateId) ?? [])
      .findIndex((candidate) => candidate.task._id === item.task._id)
    if (stateId === item.task.workflowStateId && currentIndex === index) return true
    setOptimisticStates((current) => ({ ...current, [item.task._id]: stateId }))
    try {
      await moveTask({
        taskId: item.task._id,
        workflowStateId: stateId,
        beforeTaskId: destinationTasks[index]?.task._id,
        afterTaskId: destinationTasks[index - 1]?.task._id,
        expectedRevision: item.task.revision,
        confirmOpenSubtasks,
        ...identity,
      })
      onAnnounce(`${item.task.title} moved.`)
      return true
    } catch (failure) {
      if (failure instanceof Error && failure.message.includes('task_open_subtasks_confirmation_required') && !confirmOpenSubtasks) {
        setPendingMove({ item, stateId, targetIndex })
      } else {
        onAnnounce(taskMoveErrorMessage(failure))
      }
      return false
    } finally {
      setOptimisticStates((current) => {
        const next = { ...current }
        delete next[item.task._id]
        return next
      })
    }
  }

  return (
    <>
    <div aria-label={board.board.name} className="task-board" role="region">
      {board.states.map((state, stateIndex) => {
        const columnTasks = grouped.get(state._id) ?? []
        return (
          <section
            className="task-column"
            key={state._id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              const item = tasks.find((candidate) => candidate.task._id === draggedTask)
              if (item) void move(item, state._id, columnTasks.length)
              setDraggedTask(null)
            }}
          >
            <header>
              <StateRing category={state.category} />
              <h2>{state.name}</h2>
              <span>{columnTasks.length}</span>
              <button aria-label={`Add task to ${state.name}`} className="task-column-add" onClick={() => onCreate(state._id)} type="button"><Plus size={13} /></button>
            </header>
            <div className="task-column-list">
              {columnTasks.map((item) => (
                <article
                  className={`task-card task-card-${state.category}`}
                  draggable
                  key={item.task._id}
                  onDragEnd={() => setDraggedTask(null)}
                  onDragStart={() => setDraggedTask(item.task._id)}
                >
                  <button className="task-card-open" onClick={() => onOpen(item.task.publicKey)} type="button">
                    <span className="task-card-idline"><span>{item.task.publicKey}</span><MoreHorizontal aria-hidden="true" size={15} /></span>
                    <strong>{item.task.title}</strong>
                    <span className="task-card-tags"><PriorityPill priority={item.task.priority} /><TaskLabelPill labels={item.labels} /></span>
                    <span className="task-card-foot">
                      <TaskAvatar member={item.assignee} />
                      <span className="task-card-spacer" />
                      {item.task.dueDate ? <span className="task-card-date"><CalendarDays aria-hidden="true" size={14} />{formatTaskDateLong(item.task.dueDate)}</span> : null}
                      <span aria-label={`${item.commentCount >= 101 ? 'More than 100' : item.commentCount} comments`} className="task-comment-count"><MessageCircle aria-hidden="true" size={14} />{formatTaskCommentCount(item.commentCount)}</span>
                    </span>
                  </button>
                  <div aria-label="Keyboard move controls" className="task-card-moves">
                    <Button
                      aria-label={`Move ${item.task.title} left`}
                      disabled={stateIndex === 0}
                      onClick={() => void move(item, board.states[stateIndex - 1]._id, 0)}
                      size="icon-sm"
                      variant="ghost"
                    ><ArrowLeft size={12} /></Button>
                    <Button
                      aria-label={`Move ${item.task.title} right`}
                      disabled={stateIndex === board.states.length - 1}
                      onClick={() => void move(item, board.states[stateIndex + 1]._id, 0)}
                      size="icon-sm"
                      variant="ghost"
                    ><ArrowRight size={12} /></Button>
                  </div>
                </article>
              ))}
              {!columnTasks.length ? state.category === 'canceled' ? <div className="task-column-empty task-column-empty-detailed"><Inbox aria-hidden="true" size={28} /><strong>No canceled tasks</strong><span>Tasks moved here will appear for future reference.</span></div> : <p className="task-column-empty">Drop tasks here</p> : null}
            </div>
          </section>
        )
      })}
    </div>
    <ConfirmDialog
      confirmLabel="Move task"
      description="This task still has open subtasks. Moving it to a completed status will leave those subtasks open."
      onConfirm={async () => {
        if (!pendingMove) return false
        const next = pendingMove
        setPendingMove(null)
        const moved = await move(next.item, next.stateId, next.targetIndex, true)
        if (!moved) return false
        setPendingMove(null)
        return true
      }}
      onOpenChange={(open) => {
        if (!open) setPendingMove(null)
      }}
      open={Boolean(pendingMove)}
      title="Move task with open subtasks?"
    />
    </>
  )
}
