import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

export type MentionListboxSection<T> = {
  label: string
  options: ReadonlyArray<T>
}

type MentionListboxProps<T> = {
  activeIndex: number
  ariaLabel: string
  className: string
  id: string
  optionIdPrefix: string
  optionRefs?: RefObject<Array<HTMLButtonElement | null>>
  sections: ReadonlyArray<MentionListboxSection<T>>
  showSectionLabels?: boolean
  getKey: (option: T) => string
  onSelect: (option: T) => void
  renderOption: (option: T, index: number, active: boolean) => ReactNode
}

export function MentionListbox<T>({
  activeIndex,
  ariaLabel,
  className,
  getKey,
  id,
  onSelect,
  optionIdPrefix,
  optionRefs,
  renderOption,
  sections,
  showSectionLabels = true,
}: MentionListboxProps<T>) {
  const internalRefs = useRef<Array<HTMLButtonElement | null>>([])
  const entries = sections.flatMap((section) => section.options)

  useEffect(() => {
    internalRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  let offset = 0
  return (
    <div aria-label={ariaLabel} className={className} id={id} role="listbox">
      {sections.map((section) => {
        const sectionOffset = offset
        offset += section.options.length
        return (
          <div className="track-mention-section" key={section.label}>
            {showSectionLabels ? <p className="track-mention-section-label">{section.label}</p> : null}
            {section.options.map((option, sectionIndex) => {
              const index = sectionOffset + sectionIndex
              const active = index === activeIndex
              return (
                <button
                  aria-posinset={index + 1}
                  aria-selected={active}
                  aria-setsize={entries.length}
                  className={active ? 'track-mention-option active' : 'track-mention-option'}
                  id={`${optionIdPrefix}-${index}`}
                  key={getKey(option)}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(option)
                  }}
                  ref={(element) => {
                    internalRefs.current[index] = element
                    if (optionRefs) optionRefs.current[index] = element
                  }}
                  role="option"
                  type="button"
                >
                  {renderOption(option, index, active)}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
