import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'

import type { Id } from '../../../../../../convex/_generated/dataModel'
import { Building2, FolderKanban, ListTodo, LoaderCircle, MessagesSquare, Paperclip, Search, UserRound, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { AttachmentTypeIcon } from '#/features/workspace/attachment-ui'
import { useReleaseConfig } from '#/lib/release-config'

export type ProjectSearchFilter = 'all' | 'messages' | 'files' | 'groups' | 'people' | 'projects' | 'tasks' | 'threads'

export type ProjectSearchResult = {
  attachmentId?: Id<'attachments'>
  contentType?: string
  createdAt: number
  groupId?: Id<'groups'>
  groupName: string
  id: string
  kind: 'message' | 'file' | 'group' | 'person' | 'project' | 'task' | 'thread'
  messageId?: Id<'messages'>
  taskKey?: string
  threadId?: Id<'channelThreads'>
  threadName?: string
  preview: string
  subtitle: string
  title: string
}

export function ProjectSearchDialog({
  filter,
  loading,
  onClose,
  onFilterChange,
  onOpenResult,
  onQueryChange,
  open,
  projectName,
  query,
  returnFocusRef,
  sections,
  total,
  updating = false,
}: {
  filter: ProjectSearchFilter
  loading: boolean
  onClose: () => void
  onFilterChange: (filter: ProjectSearchFilter) => void
  onOpenResult: (result: ProjectSearchResult) => void
  onQueryChange: (query: string) => void
  open: boolean
  projectName: string
  query: string
  returnFocusRef?: RefObject<HTMLElement | null>
  sections: Array<{ key: string; label: string; results: ProjectSearchResult[] }>
  total: number
  updating?: boolean
}) {
  const releaseConfig = useReleaseConfig()
  const resultButtonsRef = useRef<Array<HTMLButtonElement | null>>([])
  const flatResults = useMemo(
    () => sections.flatMap((section) => section.results),
    [sections],
  )
  const [activeResultIndex, setActiveResultIndex] = useState(0)

  useEffect(() => {
    setActiveResultIndex(0)
  }, [filter, query])

  useEffect(() => {
    if (activeResultIndex < flatResults.length) return
    setActiveResultIndex(Math.max(flatResults.length - 1, 0))
  }, [activeResultIndex, flatResults.length])

  useEffect(() => {
    resultButtonsRef.current[activeResultIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeResultIndex])

  const filters: Array<{ Icon: typeof Search; label: string; value: ProjectSearchFilter }> = [
    { Icon: Search, label: 'All', value: 'all' },
    { Icon: MessagesSquare, label: 'Messages', value: 'messages' },
    { Icon: Paperclip, label: 'Files', value: 'files' },
    { Icon: FolderKanban, label: 'Channels', value: 'groups' },
    { Icon: UserRound, label: 'People', value: 'people' },
    { Icon: Building2, label: 'Projects', value: 'projects' },
    ...(releaseConfig.tasks ? [{ Icon: ListTodo, label: 'Tasks', value: 'tasks' as const }] : []),
    ...(releaseConfig.threads ? [{ Icon: MessagesSquare, label: 'Threads', value: 'threads' as const }] : []),
  ]
  const hasQuery = query.trim().length >= 2
  let resultIndex = -1

  function handleScopedKeyboard(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveResultIndex((index) =>
        flatResults.length > 0 ? (index + 1) % flatResults.length : 0,
      )
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveResultIndex((index) =>
        flatResults.length > 0 ? (index - 1 + flatResults.length) % flatResults.length : 0,
      )
      return
    }
    if (event.key === 'Enter' && flatResults[activeResultIndex]) {
      event.preventDefault()
      onOpenResult(flatResults[activeResultIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      {open ? <DialogContent
        aria-label="Project search"
        className="track-project-search z-[80] p-0"
        finalFocus={returnFocusRef}
        showCloseButton={false}
      >
        <header className="track-project-search-header">
          <div>
            <span className="mono-label">Current project search</span>
            <DialogTitle>{projectName}</DialogTitle>
            <DialogDescription className="sr-only">
              Search messages, files, Channels, people, the Project, threads, and tasks in the current Project.
            </DialogDescription>
          </div>
          <Button aria-label="Close project search" className="icon-button" onClick={onClose} type="button">
            <X aria-hidden="true" size={15} />
          </Button>
        </header>
        <div className="track-project-search-box">
          <Search aria-hidden="true" size={16} />
          <Input
            autoFocus
            autoComplete="off"
            className="track-project-search-input"
            name="project-search"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            onKeyDown={handleScopedKeyboard}
            placeholder="Search messages, files, tasks, people, Projects, and Channels…"
            value={query}
          />
          <span aria-live="polite">{updating ? 'Updating…' : `${total} results`}</span>
        </div>
        <div aria-label="Search filters" className="track-project-search-filters" role="toolbar">
          {filters.map((item) => (
            <button
              className={filter === item.value ? 'active' : ''}
              aria-pressed={filter === item.value}
              key={item.value}
              onClick={() => onFilterChange(item.value)}
              type="button"
            >
              <item.Icon aria-hidden="true" size={15} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="track-project-search-results">
          {!hasQuery ? (
            <div className="track-project-search-state">
              <Search aria-hidden="true" size={18} />
              <p>Type at least 2 characters to search this project.</p>
              <small>Use Ctrl K anywhere, or / inside a Channel when the composer is not focused.</small>
            </div>
          ) : loading ? (
            <div className="track-project-search-state">
              <LoaderCircle aria-hidden="true" className="spin" size={18} />
              <p>{updating ? 'Updating results…' : 'Searching project…'}</p>
            </div>
          ) : total === 0 ? (
            <div className="track-project-search-state">
              <Search aria-hidden="true" size={18} />
              <p>No results for "{query.trim()}".</p>
            </div>
          ) : (
            sections.map((section) =>
              section.results.length > 0 ? (
                <div className="track-project-search-section" key={section.key}>
                  <p className="track-project-search-section-label">{section.label}</p>
                  {section.results.map((result) => {
                    resultIndex += 1
                    const currentResultIndex = resultIndex
                    const isActive = currentResultIndex === activeResultIndex
                    return (
                      <button
                        className={isActive ? 'track-project-search-result active' : 'track-project-search-result'}
                        key={`${result.kind}-${result.id}`}
                        onClick={() => onOpenResult(result)}
                        onFocus={() => setActiveResultIndex(currentResultIndex)}
                        onKeyDown={handleScopedKeyboard}
                        ref={(element) => {
                          resultButtonsRef.current[currentResultIndex] = element
                        }}
                        type="button"
                      >
                        <span className={`track-project-search-icon ${result.kind}`}>
                          {result.kind === 'file' ? (
                            <AttachmentTypeIcon
                              contentType={result.contentType ?? 'application/octet-stream'}
                              filename={result.title}
                              size={16}
                            />
                          ) : result.kind === 'group' ? (
                            <FolderKanban aria-hidden="true" size={16} />
                          ) : result.kind === 'task' ? (
                            <ListTodo aria-hidden="true" size={16} />
                          ) : result.kind === 'person' ? (
                            <UserRound aria-hidden="true" size={16} />
                          ) : result.kind === 'project' ? (
                            <Building2 aria-hidden="true" size={16} />
                          ) : (
                            <MessagesSquare aria-hidden="true" size={16} />
                          )}
                        </span>
                        <span className="track-project-search-copy">
                          <strong>{result.title}</strong>
                          <small>{result.subtitle}</small>
                          <span>{result.preview}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null,
            )
          )}
        </div>
        <footer className="track-project-search-footer">
          <span><kbd>{'\u2191'}</kbd><kbd>{'\u2193'}</kbd> Move</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </DialogContent> : null}
    </Dialog>
  )
}
