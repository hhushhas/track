function TrackLoader({ label }: { label: string }) {
  return (
    <main className="track-loading" role="status" aria-live="polite" aria-label={label}>
      <div className="track-loader-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>{label}</p>
    </main>
  )
}

export default TrackLoader
