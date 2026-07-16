import { useMutation, useQuery } from 'convex/react'
import { Archive, ArrowDown, ArrowUp, CheckCircle2, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import type { TaskBoardView, TaskIdentity } from './task-types'
import { taskError } from './TaskCreateDialog'

const categories = ['backlog', 'unstarted', 'started', 'completed', 'canceled'] as const
type WorkflowDraft = {
  stateId?: Id<'taskWorkflowStates'>
  name: string
  category: Doc<'taskWorkflowStates'>['category']
  visualToken: string
  isDefault: boolean
}

export function TaskAdminDialog({
  boards,
  identity,
  onOpenChange,
  open,
  projectId,
}: {
  boards: Array<TaskBoardView>
  identity: TaskIdentity
  onOpenChange: (open: boolean) => void
  open: boolean
  projectId: Id<'projects'>
}) {
  const createBoard = useMutation(api.taskBoards.create)
  const archiveBoard = useMutation(api.taskBoards.archive)
  const restoreBoard = useMutation(api.taskBoards.restore)
  const setDefault = useMutation(api.taskBoards.setDefault)
  const reorderBoard = useMutation(api.taskBoards.reorder)
  const createLabel = useMutation(api.taskLabels.create)
  const setLabelArchived = useMutation(api.taskLabels.setArchived)
  const labels = useQuery(api.taskLabels.list, { projectId, includeArchived: true, ...identity })
  const [name, setName] = useState('')
  const [labelName, setLabelName] = useState('')
  const [editing, setEditing] = useState<string>()
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
    } catch (failure) {
      setError(taskError(failure))
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    await run(() => createBoard({ projectId, name, ...identity }))
    setName('')
  }

  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent className="task-admin-dialog">
    <DialogHeader><DialogTitle>Task administration</DialogTitle><DialogDescription>Manage Project boards and their independent workflows. Channel boards are created from their Channel task panel.</DialogDescription></DialogHeader>
    <form className="task-inline-form" onSubmit={(event) => void submit(event)}><Input aria-label="Board name" onChange={(event) => setName(event.target.value)} placeholder="New Project board" value={name} /><Button disabled={!name.trim()} type="submit"><Plus size={13} /> Create board</Button></form>
    <section className="task-label-admin"><strong>Project labels</strong><form className="task-inline-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { await createLabel({ projectId, name: labelName, colorToken: 'blue', ...identity }); setLabelName('') }) }}><Input aria-label="Label name" onChange={(event) => setLabelName(event.target.value)} placeholder="New label" value={labelName} /><Button disabled={!labelName.trim()} size="sm" type="submit"><Plus size={12} /> Add label</Button></form><div className="task-detail-actions">{labels?.map((label) => <Button key={label._id} onClick={() => void run(() => setLabelArchived({ labelId: label._id, archived: !label.archivedAt, ...identity }))} size="sm" variant="outline">{label.name}{label.archivedAt ? ' · restore' : ' · archive'}</Button>)}</div></section>
    <div className="task-admin-board-list">
      {boards.map((item, index) => <article className="task-admin-board" key={item.board._id}><div className="task-admin-board-summary"><div><strong>{item.board.name}</strong><span>{item.board.groupId ? 'Channel board' : 'Project board'} · {item.states.length} statuses</span></div><div>
        <Button aria-label={`Move ${item.board.name} up`} disabled={index === 0 || Boolean(item.board.archivedAt)} onClick={() => void run(() => reorderBoard({ boardId: item.board._id, targetIndex: index - 1, ...identity }))} size="icon" variant="ghost"><ArrowUp size={12} /></Button>
        <Button aria-label={`Move ${item.board.name} down`} disabled={index === boards.length - 1 || Boolean(item.board.archivedAt)} onClick={() => void run(() => reorderBoard({ boardId: item.board._id, targetIndex: index + 1, ...identity }))} size="icon" variant="ghost"><ArrowDown size={12} /></Button>
        <Button onClick={() => setEditing(editing === item.board._id ? undefined : item.board._id)} size="sm" variant="ghost"><Settings2 size={12} /> Configure</Button>
        {!item.board.isDefault && !item.board.archivedAt ? <Button onClick={() => void run(() => setDefault({ boardId: item.board._id, ...identity }))} size="sm" variant="ghost"><CheckCircle2 size={12} /> Make default</Button> : null}
        {item.board.archivedAt ? <Button onClick={() => void run(() => restoreBoard({ boardId: item.board._id, ...identity }))} size="sm" variant="outline"><RotateCcw size={12} /> Restore</Button> : <Button onClick={() => void run(() => archiveBoard({ boardId: item.board._id, ...identity }))} size="sm" variant="outline"><Archive size={12} /> Archive</Button>}
      </div></div>
      {editing === item.board._id && !item.board.archivedAt ? <BoardEditor board={item} identity={identity} onError={setError} /> : null}
      </article>)}
    </div>
    {error ? <p className="task-form-error" role="alert">{error}</p> : null}
  </DialogContent></Dialog>
}

function BoardEditor({ board, identity, onError }: { board: TaskBoardView; identity: TaskIdentity; onError: (error: string) => void }) {
  const updateBoard = useMutation(api.taskBoards.update)
  const configureWorkflow = useMutation(api.taskBoards.configureWorkflow)
  const [name, setName] = useState(board.board.name)
  const [description, setDescription] = useState(board.board.description ?? '')
  const [states, setStates] = useState<WorkflowDraft[]>(() => board.states.map((state) => ({
    stateId: state._id,
    name: state.name,
    category: state.category,
    visualToken: state.visualToken,
    isDefault: state.isDefault,
  })))

  function updateState(index: number, patch: Partial<WorkflowDraft>) {
    setStates((current) => current.map((state, candidate) => candidate === index ? { ...state, ...patch } : state))
  }

  function moveState(index: number, offset: number) {
    setStates((current) => {
      const next = [...current]
      const [state] = next.splice(index, 1)
      next.splice(index + offset, 0, state!)
      return next
    })
  }

  async function save() {
    onError('')
    try {
      await updateBoard({ boardId: board.board._id, name, description: description || null, ...identity })
      const defaultIndex = Math.max(0, states.findIndex((state) => state.isDefault))
      const replacementStateId = states[defaultIndex]?.stateId ?? states.find((state) => state.stateId)?.stateId
      await configureWorkflow({
        boardId: board.board._id,
        defaultIndex,
        replacementStateId,
        states: states.map(({ stateId, name: stateName, category, visualToken }) => ({ stateId, name: stateName, category, visualToken })),
        ...identity,
      })
    } catch (failure) {
      onError(taskError(failure))
    }
  }

  return <div className="task-workflow-editor">
    <div className="task-form-grid"><label>Board name<Input onChange={(event) => setName(event.target.value)} value={name} /></label><label>Description<Input onChange={(event) => setDescription(event.target.value)} value={description} /></label></div>
    <div className="task-workflow-state-list">{states.map((state, index) => <div className="task-workflow-state" key={state.stateId ?? `new-${index}`}>
      <Input aria-label={`Status ${index + 1} name`} onChange={(event) => updateState(index, { name: event.target.value })} value={state.name} />
      <NativeSelect aria-label={`${state.name} category`} onChange={(event) => updateState(index, { category: event.target.value as WorkflowDraft['category'] })} value={state.category}>{categories.map((category) => <NativeSelectOption key={category} value={category}>{category}</NativeSelectOption>)}</NativeSelect>
      <Button aria-label={`Use ${state.name} as default`} onClick={() => setStates((current) => current.map((candidate, candidateIndex) => ({ ...candidate, isDefault: candidateIndex === index })))} size="sm" variant={state.isDefault ? 'default' : 'ghost'}>{state.isDefault ? 'Default' : 'Make default'}</Button>
      <Button aria-label={`Move ${state.name} up`} disabled={index === 0} onClick={() => moveState(index, -1)} size="icon" variant="ghost"><ArrowUp size={12} /></Button>
      <Button aria-label={`Move ${state.name} down`} disabled={index === states.length - 1} onClick={() => moveState(index, 1)} size="icon" variant="ghost"><ArrowDown size={12} /></Button>
      <Button aria-label={`Remove ${state.name}`} disabled={states.length <= 2} onClick={() => setStates((current) => current.filter((_, candidate) => candidate !== index))} size="icon" variant="ghost"><Trash2 size={12} /></Button>
    </div>)}</div>
    <div className="task-detail-actions"><Button onClick={() => setStates((current) => [...current, { name: 'New status', category: 'unstarted', visualToken: 'blue', isDefault: false }])} size="sm" variant="outline"><Plus size={12} /> Add status</Button><Button disabled={!name.trim() || states.some((state) => !state.name.trim())} onClick={() => void save()} size="sm">Save board and workflow</Button></div>
  </div>
}
