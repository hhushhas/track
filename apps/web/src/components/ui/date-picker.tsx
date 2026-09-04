import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'

const weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function formatValue(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function formatLabel(value: string) {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Choose date'
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

function DatePicker({
  'aria-label': ariaLabel,
  className,
  disabled = false,
  onChange,
  value,
}: {
  'aria-label': string
  className?: string
  disabled?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const selectedDate = parseDate(value)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = selectedDate ?? new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const offset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
    return Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1
      return day > 0 && day <= daysInMonth ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null
    })
  }, [visibleMonth])
  const todayValue = formatValue(new Date())

  function selectDate(date: Date) {
    onChange(formatValue(date))
    setOpen(false)
  }

  function shiftMonth(amount: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <button
            aria-label={ariaLabel}
            className={`track-date-picker-trigger${className ? ` ${className}` : ''}`}
            disabled={disabled}
            type="button"
          />
        }
      >
        <CalendarDays aria-hidden="true" size={14} />
        <span>{formatLabel(value)}</span>
        {value ? <X aria-hidden="true" className="track-date-picker-clear-icon" size={13} /> : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="track-date-picker-popover" sideOffset={6}>
        <div className="track-date-picker-header">
          <button aria-label="Previous month" onClick={() => shiftMonth(-1)} type="button"><ChevronLeft size={15} /></button>
          <strong>{monthLabel(visibleMonth)}</strong>
          <button aria-label="Next month" onClick={() => shiftMonth(1)} type="button"><ChevronRight size={15} /></button>
        </div>
        <div aria-label={monthLabel(visibleMonth)} className="track-date-picker-grid" role="grid">
          {weekdayLabels.map((label) => <span aria-hidden="true" className="track-date-picker-weekday" key={label}>{label}</span>)}
          {days.map((date, index) => {
            const dateValue = date ? formatValue(date) : ''
            const isSelected = dateValue === value
            const isToday = dateValue === todayValue
            return date ? (
              <button
                aria-current={isToday ? 'date' : undefined}
                aria-label={date.toLocaleDateString('en', { dateStyle: 'full' })}
                aria-selected={isSelected}
                className={`track-date-picker-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                key={dateValue}
                onClick={() => selectDate(date)}
                role="gridcell"
                type="button"
              >
                {date.getDate()}
              </button>
            ) : <span aria-hidden="true" className="track-date-picker-day empty" key={`empty-${index}`} />
          })}
        </div>
        <div className="track-date-picker-footer">
          <button onClick={() => selectDate(new Date())} type="button">Today</button>
          {value ? <button onClick={() => { onChange(''); setOpen(false) }} type="button">Clear</button> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
