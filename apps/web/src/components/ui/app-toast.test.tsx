import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppToastProvider, appToast, queueToastAfterNavigation } from './app-toast'

describe('application toast feedback', () => {
  it('restores navigation feedback and renders accessible error feedback', async () => {
    queueToastAfterNavigation({ type: 'success', title: 'Signed in', description: 'Welcome back.' })
    render(<AppToastProvider><main>Workspace</main></AppToastProvider>)

    expect((await screen.findAllByText('Signed in')).length).toBeGreaterThan(0)
    expect(window.sessionStorage.getItem('track-pending-toast')).toBeNull()

    appToast.error('Task not saved', 'Your draft is still available.')

    expect((await screen.findAllByText('Task not saved')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Your draft is still available.').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Dismiss notification').length).toBeGreaterThan(0)
  })

  it('keeps navigation feedback best-effort when browser storage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable', 'SecurityError')
    })

    expect(() => queueToastAfterNavigation({ type: 'success', title: 'Signed in' })).not.toThrow()
    setItem.mockRestore()

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable', 'SecurityError')
    })
    expect(() => render(<AppToastProvider><main>Workspace</main></AppToastProvider>)).not.toThrow()
    getItem.mockRestore()
  })

  it('ignores structurally invalid navigation feedback', () => {
    window.sessionStorage.setItem('track-pending-toast', JSON.stringify({
      description: { unsafe: true },
      title: { unsafe: true },
      type: 'success',
    }))

    expect(() => render(<AppToastProvider><main>Workspace</main></AppToastProvider>)).not.toThrow()
    expect(window.sessionStorage.getItem('track-pending-toast')).toBeNull()
  })
})
