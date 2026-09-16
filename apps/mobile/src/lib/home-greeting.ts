export type HomeGreeting = 'Good morning' | 'Good afternoon' | 'Good evening' | 'Good night'

/** Uses the device's local timezone because Date#getHours returns local time. */
export function getHomeGreeting(date: Date = new Date()): HomeGreeting {
  const hour = date.getHours()

  if (hour < 5 || hour >= 21) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
