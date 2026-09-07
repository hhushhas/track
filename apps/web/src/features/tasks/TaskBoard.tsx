import { useMutation } from 'convex/react'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { groupTaskViewsByState, type TaskBoardView, type TaskIdentity, type TaskListItem } from './task-types'
import { DueChip, OriginCaption, PriorityGlyph, StateRing, TaskAvatar } from './ui/TaskVisuals'

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
  const grouped = useMemo(
    () => groupTaskViewsByState(board.states, tasks, optimisticStates),
    [board.states, optimisticStates, tasks],
  )

  async function move(
    item: TaskListItem,
    stateId: Id<'taskWorkflowStates'>,
    targetIndex: number,
    confirmOpenSubtasks = false,
  ) {
    const destinationTasks = (grouped.get(stateId) ?? []).filter((candidate) => candidate.task._id !== item.task._id)
    const index = Math.min(Math.max(targetIndex, 0), destinationTasks.length)
    const currentIndex = (grouped.get(item.task.workflowStateId) ?? [])
      .findIndex((candidate) => candidate.task._id === item.task._id)
    if (stateId === item.task.workflowStateId && currentIndex === index) return
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
    } catch (failure) {
      if (failure instanceof Error && failure.message.includes('task_open_subtasks_confirmation_required') && !confirmOpenSubtasks) {
        const proceed = typeof window !== 'undefined' && window.confirm('This task has open subtasks. Move it to a completed state anyway?')
        if (proceed) {
          await move(item, stateId, targetIndex, true)
          return
        }
        onAnnounce('Move cancelled. Open subtasks remain unchanged.')
      } else if (failure instanceof Error && failure.message.includes('task_edit_forbidden')) {
        onAnnounce("You don't have permission to move this task.")
      } else if (failure instanceof Error && failure.message.includes('task_conflict')) {
        onAnnounce('This task changed elsewhere. Refresh the board and try again.')
      } else {
        onAnnounce("Move couldn't be saved. The card returned to its current position.")
      }
    } finally {
      setOptimisticStates((current) => {
        const next = { ...current }
        delete next[item.task._id]
        return next
      })
    }
  }

  return (
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
                  className="task-card"
                  draggable
                  key={item.task._id}
                  onDragEnd={() => setDraggedTask(null)}
                  onDragStart={() => setDraggedTask(item.task._id)}
                >
                  <button className="task-card-open" onClick={() => onOpen(item.task.publicKey)} type="button">
                    <span className="task-card-idline"><span>{item.task.publicKey}</span><StateRing category={state.category} size="dense" /></span>
                    <strong>{item.task.title}</strong>
                    <span className="task-card-foot">
                      <TaskAvatar member={item.assignee} />
                      <OriginCaption boardName={board.board.name} item={item} />
                      <span className="task-card-spacer" />
                      <DueChip dueDate={item.task.dueDate} terminal={item.state?.category === 'completed' || item.state?.category === 'canceled'} />
                      <PriorityGlyph priority={item.task.priority} />
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
              {!columnTasks.length ? <p className="task-column-empty">Drop tasks here</p> : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
