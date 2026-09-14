# Maestro E2E flows

Device flows for the Track mobile app (`ai.q9labs.track`), driven by
[Maestro](https://maestro.mobile.dev). A few flows target
`com.apple.Preferences` to exercise iOS system permission screens.

These were written during the July 2026 push-notification and task-UI
verification work and lived unversioned in `scratchpad/` until the 2026-08-23
docs audit promoted them here. They remain opt-in device checks and are not the
curated CI acceptance suite; CI runs the deterministic browser journeys under
[`e2e/README.md`](../README.md).

## Running

Flows assume a booted simulator or emulator with the app installed and a signed-in
session. Run one flow, or the whole directory:

```bash
maestro test e2e/maestro/create-task.yaml
maestro test e2e/maestro/
```

Flows contain no credentials — sign in before running them.
