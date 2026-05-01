export function ThreadDaySeparator({ label }: { label: string }) {
  return (
    <div className="track-thread-day-separator" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  )
}
