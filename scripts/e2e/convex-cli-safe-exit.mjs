// Node 24 on Windows can abort while an HTTP-backed CLI is closing its libuv
// handles. Give those handles a brief drain window before Convex exits. This
// wrapper is only used by the local E2E stack and is inert on other platforms.
if (process.platform === 'win32') {
  const immediateExit = process.exit.bind(process)
  let exitScheduled = false
  const safeExit = (code = process.exitCode ?? 0) => {
    if (exitScheduled) return
    exitScheduled = true
    setTimeout(() => immediateExit(code), 250)
  }

  process.exit = safeExit
  process.once('beforeExit', safeExit)
}

await import('../../node_modules/convex/bin/main.js')
