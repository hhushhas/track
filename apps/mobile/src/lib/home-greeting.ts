export type HomeGreeting = 'Good morning' | 'Good afternoon' | 'Good evening' | 'Good night'

function hourInTimezone(date: Date, timeZone?: string) {
  if (!timeZone) return date.getHours()
  try {
    const hourPart = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone,
    }).formatToParts(date).find((part) => part.type === 'hour')?.value
    const hour = Number(hourPart)
    return Number.isFinite(hour) ? (hour === 24 ? 0 : hour) : date.getHours()
  } catch {
    return date.getHours()
  }
}

/** Uses the saved user timezone when supplied, with the device timezone as fallback. */
export function getHomeGreeting(date: Date = new Date(), timeZone?: string): HomeGreeting {
  const hour = hourInTimezone(date, timeZone)

  if (hour < 5 || hour >= 21) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
