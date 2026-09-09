import { useMutation } from 'convex/react'
import { ArrowLeft, ArrowRight, GripVertical, LockKeyhole, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { appToast } from '#/components/ui/app-toast'
import { Button } from '#/components/ui/button'
import { canEditTaskView, groupTaskViewsByState, type TaskBoardView, type TaskIdentity, type TaskView } from './task-types'
import { DueChip, OriginCaption, PriorityGlyph, StateRing, TaskAvatar } from './ui/TaskVisuals'

export function TaskBoard({
  board,
  identity,
  currentProjectMemberId,
  currentProjectRole,
  onAnnounce,
  onCreate,
  onOpen,
  tasks,
}: {
  board: TaskBoardView
  identity: TaskIdentity
  currentProjectMemberId?: Id<'projectMembers'>
  currentProjectRole?: Doc<'projectMembers'>['role']
  onAnnounce: (message: string) => void
  onCreate: (stateId: Id<'taskWorkflowStates'>) => void
  onOpen: (publicKey: string) => void
  tasks: Array<TaskView>
}) {
  const moveTask = useMutation(api.tasks.moveTask)
  const [optimisticStates, setOptimisticStates] = useState<Record<string, string>>({})
  const [activeDragTaskId, setActiveDragTaskId] = useState<Id<'tasks'> | null>(null)
  const [dropStateId, setDropStateId] = useState<Id<'taskWorkflowStates'> | null>(null)
  const draggedTask = useRef<Id<'tasks'> | null>(null)
  const pointerDrag = useRef<{
    active: boolean
    pointerId: number
    startX: number
    startY: number
    taskId: Id<'tasks'>
  } | null>(null)
  const suppressClick = useRef(false)
  const grouped = useMemo(
    () => groupTaskViewsByState(board.states, tasks, optimisticStates),
    [board.states, optimisticStates, tasks],
  )

  async function move(item: TaskView, stateId: Id<'taskWorkflowStates'>, targetIndex: number) {
    if (!canEditTaskView(item, currentProjectMemberId, currentProjectRole)) {
      const message = 'You can move tasks assigned to you or created by you. Project managers can move any task.'
      onAnnounce(message)
      appToast.error('Task cannot be moved', message)
      return
    }
    const destinationTasks = grouped.get(stateId) ?? []
    setOptimisticStates((current) => ({ ...current, [item.task._id]: stateId }))
    try {
      await moveTask({
        taskId: item.task._id,
        workflowStateId: stateId,
        beforeTaskId: destinationTasks[targetIndex]?.task._id,
        expectedRevision: item.task.revision,
        ...identity,
      })
      onAnnounce(`${item.task.title} moved.`)
      appToast.success('Task moved', `${item.task.publicKey} moved successfully.`)
    } catch (error) {
      const message = taskMoveErrorMessage(error)
      onAnnounce(message)
      appToast.error('Task not moved', message)
    } finally {
      setOptimisticStates((current) => {
        const next = { ...current }
        delete next[item.task._id]
        return next
      })
    }
  }

  function clearDrag() {
    draggedTask.current = null
    pointerDrag.current = null
    setActiveDragTaskId(null)
    setDropStateId(null)
  }

  function destinationAt(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY)
    return element?.closest<HTMLElement>('[data-task-state-id]')?.dataset.taskStateId as
      | Id<'taskWorkflowStates'>
      | undefined
  }

  return (
    <div aria-label={board.board.name} className="task-board" role="region">
      {board.states.map((state, stateIndex) => {
        const columnTasks = grouped.get(state._id) ?? []
        return (
          <section
            className={`task-column${dropStateId === state._id ? ' task-column-drop-target' : ''}`}
            data-task-state-id={state._id}
            key={state._id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const item = tasks.find((candidate) => candidate.task._id === draggedTask.current)
              if (item) void move(item, state._id, columnTasks.length)
              clearDrag()
            }}
          >
            <header>
              <StateRing category={state.category} />
              <h2>{state.name}</h2>
              <span>{columnTasks.length}</span>
              <button aria-label={`Add task to ${state.name}`} className="task-column-add" onClick={() => onCreate(state._id)} type="button"><Plus size={13} /></button>
            </header>
            <div className="task-column-list">
              {columnTasks.map((item) => {
                const canEdit = canEditTaskView(item, currentProjectMemberId, currentProjectRole)
                return (
                <article
                  className={`task-card${activeDragTaskId === item.task._id ? ' task-card-dragging' : ''}${canEdit ? '' : ' task-card-readonly'}`}
                  data-draggable={canEdit ? 'true' : 'false'}
                  draggable={canEdit}
                  key={item.task._id}
                  onClickCapture={(event) => {
                    if (!suppressClick.current) return
                    event.preventDefault()
                    event.stopPropagation()
                    suppressClick.current = false
                  }}
                  onDragEnd={clearDrag}
                  onDragStart={(event) => {
                    if (!canEdit) {
                      event.preventDefault()
                      return
                    }
                    draggedTask.current = item.task._id
                    setActiveDragTaskId(item.task._id)
                    // Setting a payload is required by some browsers before they
                    // will accept a drop, and makes the drag operation explicit.
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', item.task._id)
                  }}
                  onPointerCancel={clearDrag}
                  onPointerDown={(event) => {
                    if (!canEdit || event.pointerType === 'mouse' || !event.isPrimary) return
                    pointerDrag.current = {
                      active: false,
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      taskId: item.task._id,
                    }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={(event) => {
                    const drag = pointerDrag.current
                    if (!drag || drag.pointerId !== event.pointerId) return
                    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return
                    drag.active = true
                    suppressClick.current = true
                    draggedTask.current = drag.taskId
                    setActiveDragTaskId(drag.taskId)
                    setDropStateId(destinationAt(event.clientX, event.clientY) ?? null)
                    event.preventDefault()
                  }}
                  onPointerUp={(event) => {
                    const drag = pointerDrag.current
                    if (!drag || drag.pointerId !== event.pointerId) return
                    const destinationStateId = drag.active
                      ? destinationAt(event.clientX, event.clientY) ?? dropStateId
                      : null
                    if (destinationStateId) {
                      const destinationTasks = grouped.get(destinationStateId) ?? []
                      void move(item, destinationStateId, destinationTasks.length)
                      event.preventDefault()
                    }
                    if (drag.active) window.setTimeout(() => { suppressClick.current = false }, 0)
                    clearDrag()
                  }}
                >
                  {canEdit ? (
                    <span
                      aria-hidden="true"
                      className="task-card-drag-handle"
                      draggable
                      title={`Drag ${item.task.title}`}
                    >
                      <GripVertical size={14} />
                    </span>
                  ) : null}
                  <button className="task-card-open" onClick={() => onOpen(item.task.publicKey)} type="button">
                    <span className="task-card-idline"><span>{item.task.publicKey}</span><StateRing category={state.category} size="dense" /></span>
                    <strong>{item.task.title}</strong>
                    <span className="task-card-foot">
                      <TaskAvatar member={item.assignee} />
                      <OriginCaption boardName={board.board.name} item={item} />
                      <span className="task-card-spacer" />
                      <DueChip dueDate={item.task.dueDate} terminal={item.terminal} />
                      <PriorityGlyph priority={item.task.priority} />
                    </span>
                  </button>
                  {!canEdit ? (
                    <span className="task-card-lock" title="You can view this task, but you cannot change its status.">
                      <LockKeyhole aria-hidden="true" size={11} /> Read-only
                    </span>
                  ) : null}
                  <div aria-label="Keyboard move controls" className="task-card-moves">
                    <Button
                      aria-label={`Move ${item.task.title} left`}
                      disabled={!canEdit || stateIndex === 0}
                      onClick={() => void move(item, board.states[stateIndex - 1]._id, 0)}
                      size="icon-sm"
                      variant="ghost"
                    ><ArrowLeft size={12} /></Button>
                    <Button
                      aria-label={`Move ${item.task.title} right`}
                      disabled={!canEdit || stateIndex === board.states.length - 1}
                      onClick={() => void move(item, board.states[stateIndex + 1]._id, 0)}
                      size="icon-sm"
                      variant="ghost"
                    ><ArrowRight size={12} /></Button>
                  </div>
                </article>
                )
              })}
              {!columnTasks.length ? <p className="task-column-empty">Drop tasks here</p> : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function taskMoveErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('task_edit_forbidden')) {
    return 'You can move tasks assigned to you or created by you. Project managers can move any task.'
  }
  if (message.includes('task_conflict')) return 'This task changed elsewhere. Wait for the board to refresh, then try again.'
  if (message.includes('task_open_subtasks_confirmation_required')) {
    return 'Complete the open subtasks before moving this task to a finished status.'
  }
  if (message.includes('task_destination_invalid')) return 'That status is no longer available. Refresh the board and try again.'
  return "The move couldn't be saved. The card returned to its current position."
}
