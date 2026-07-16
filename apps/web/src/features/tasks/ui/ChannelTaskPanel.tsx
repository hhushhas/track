import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import { AssigneeAvatar, SurfaceState, type SurfaceStatus, type TaskPresentation } from './task-types'
import { StateRing } from './StateRing'

type ChannelView = 'conversation' | 'board'
const channelViews: ChannelView[] = ['conversation', 'board']

export function ChannelHeaderTabs({ active, openTaskCount, onChange, panelIds }: { active: ChannelView; openTaskCount: number; onChange: (tab: ChannelView) => void; panelIds: Record<ChannelView, string> }) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectTab = (index: number) => {
    const tab = channelViews[index]
    if (!tab) return
    onChange(tab)
    tabRefs.current[index]?.focus()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % channelViews.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + channelViews.length) % channelViews.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = channelViews.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    selectTab(nextIndex)
  }

  return <div aria-label="Channel view" className="channel-view-tabs" role="tablist">{channelViews.map((tab, index) => <button aria-controls={panelIds[tab]} aria-selected={active === tab} id={`channel-${tab}-tab`} key={tab} onClick={() => onChange(tab)} onKeyDown={(event) => handleKeyDown(event, index)} ref={(element) => { tabRefs.current[index] = element }} role="tab" tabIndex={active === tab ? 0 : -1} type="button">{tab === 'conversation' ? 'Conversation' : <>Board <kbd>{openTaskCount}</kbd></>}</button>)}</div>
}
export interface ThreadRailItem { id: string; title: string; meta: string; unread?: boolean }
export function ChannelRailSections({ tasks, threads, status = 'ready', onOpenTask, onOpenThread, onRetry }: { tasks: TaskPresentation[]; threads: ThreadRailItem[]; status?: SurfaceStatus; onOpenTask: (key: string) => void; onOpenThread: (id: string) => void; onRetry?: () => void }) {
  if (status !== 'ready') return <div className="channel-task-panel"><SurfaceState status={status} emptyMessage="No open tasks in this channel." onRetry={onRetry} /></div>
  return <div className="channel-task-panel"><Rail title="Open tasks · this channel">{tasks.length ? tasks.map(task => <button className="channel-task-row" key={task.key} onClick={() => onOpenTask(task.key)} type="button"><StateRing category={task.state.category} label={task.state.name} size="dense" /><span><strong>{task.title}</strong><small>{task.key}{task.due ? ` · ${task.due.date}` : ''}</small></span>{task.assignee ? <AssigneeAvatar assignee={task.assignee} size={20} /> : null}</button>) : <p>No open tasks in this channel.</p>}</Rail><Rail title="Threads">{threads.length ? threads.map(thread => <button className="channel-thread-row" key={thread.id} onClick={() => onOpenThread(thread.id)} type="button"><span aria-hidden="true" className={thread.unread ? 'thread-unread' : ''} /><span><strong>{thread.title}</strong><small>{thread.meta}</small></span></button>) : <p>No active threads.</p>}</Rail></div>
}
function Rail({ title, children }: { title: string; children: ReactNode }) { return <section className="channel-rail-section"><header>{title}</header>{children}</section> }
