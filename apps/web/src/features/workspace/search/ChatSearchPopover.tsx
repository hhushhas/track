import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

export function ChatSearchPopover({
  activeIndex,
  matchCount,
  onClose,
  onNext,
  onPrevious,
  onQueryChange,
  query,
}: {
  activeIndex: number
  matchCount: number
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onQueryChange: (query: string) => void
  query: string
}) {
  return (
    <div className="track-chat-search-popover" role="dialog" aria-label="Search this chat">
      <Search size={15} />
      <Input
        autoFocus
        className="track-chat-search-popover-input"
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault()
            onNext()
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onPrevious()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
        placeholder="Search this chat..."
        value={query}
      />
      <span className="track-chat-search-count">
        {query.trim() ? `${matchCount ? activeIndex + 1 : 0}/${matchCount}` : '/'}
      </span>
      <Button aria-label="Previous chat search match" className="track-chat-search-step" disabled={matchCount === 0} onClick={onPrevious} type="button">
        <ChevronUp size={13} />
      </Button>
      <Button aria-label="Next chat search match" className="track-chat-search-step" disabled={matchCount === 0} onClick={onNext} type="button">
        <ChevronDown size={13} />
      </Button>
      <Button aria-label="Close chat search" className="track-chat-search-step" onClick={onClose} type="button">
        <X size={13} />
      </Button>
    </div>
  )
}
