import { useMutation } from 'convex/react'
import { ArrowLeft, ArrowRight, CalendarDays, GripVertical, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { groupTaskViewsByState, type TaskBoardView, type TaskIdentity, type TaskView } from './task-types'

export function TaskBoard({
  board,
  identity,
  onAnnounce,
  onOpen,
  tasks,
}: {
  board: TaskBoardView
  identity: TaskIdentity
  onAnnounce: (message: string) => void
  onOpen: (publicKey: string) => void
  tasks: Array<TaskView>
}) {
  const moveTask = useMutation(api.tasks.move)
  const [optimisticStates, setOptimisticStates] = useState<Record<string, string>>({})
  const [draggedTask, setDraggedTask] = useState<Id<'tasks'> | null>(null)
  const grouped = useMemo(
    () => groupTaskViewsByState(board.states, tasks, optimisticStates),
    [board.states, optimisticStates, tasks],
  )

  async function move(item: TaskView, stateId: Id<'taskWorkflowStates'>, targetIndex: number) {
    setOptimisticStates((current) => ({ ...current, [item.task._id]: stateId }))
    try {
      await moveTask({
        taskId: item.task._id,
        destinationBoardId: board.board._id,
        workflowStateId: stateId,
        targetIndex,
        expectedRevision: item.task.revision,
        ...identity,
      })
      onAnnounce(`${item.task.title} moved.`)
    } catch {
      onAnnounce("Move couldn't be saved. The card returned to its current position.")
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
            <header><span className={`task-state-ring ${state.category}`} /><h2>{state.name}</h2><span>{columnTasks.length}</span></header>
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
                    <span className="task-card-key"><GripVertical aria-hidden="true" size={12} /> {item.task.publicKey}</span>
                    <strong>{item.task.title}</strong>
                    <span className={`task-priority ${item.task.priority}`}>{item.task.priority}</span>
                    <span className="task-card-meta">
                      {item.assignee ? <><UserRound size={12} /> {item.assignee.userDisplayNameSnapshot ?? 'Assigned'}</> : 'Unassigned'}
                      {item.task.dueDate ? <><CalendarDays size={12} /> {item.task.dueDate}</> : null}
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
