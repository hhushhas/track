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
      {sections.map((section, sectionIndex) => {
        const sectionOffset = offset
        offset += section.options.length
        const sectionLabelId = `${id}-section-${sectionIndex}`
        return (
          <div
            aria-label={showSectionLabels ? undefined : section.label}
            aria-labelledby={showSectionLabels ? sectionLabelId : undefined}
            className="track-mention-section"
            key={section.label}
            role="group"
          >
            {showSectionLabels ? <p aria-hidden="true" className="track-mention-section-label" id={sectionLabelId}>{section.label}</p> : null}
            {section.options.map((option, optionIndex) => {
              const index = sectionOffset + optionIndex
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
                  tabIndex={-1}
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
