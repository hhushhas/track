import { Toast } from '@base-ui/react/toast'
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

type AppToastType = 'error' | 'info' | 'loading' | 'success'

const toastManager = Toast.createToastManager()
const pendingToastKey = 'track-pending-toast'

type PendingToast = { description?: string; title: string; type: Exclude<AppToastType, 'loading'> }

function addToast(type: AppToastType, title: string, description?: string) {
  return toastManager.add({
    description,
    priority: type === 'error' ? 'high' : 'low',
    timeout: type === 'error' ? 7000 : 4500,
    title,
    type,
  })
}

export const appToast = {
  dismiss: (toastId?: string) => toastManager.close(toastId),
  error: (title: string, description?: string) => addToast('error', title, description),
  info: (title: string, description?: string) => addToast('info', title, description),
  success: (title: string, description?: string) => addToast('success', title, description),
  promise<Value>(
    promise: Promise<Value>,
    messages: { loading: string; success: string | ((value: Value) => string); error: string | ((error: unknown) => string) },
  ) {
    return toastManager.promise(promise, {
      loading: { priority: 'low', timeout: 0, title: messages.loading, type: 'loading' },
      success: (value) => ({
        priority: 'low',
        timeout: 4500,
        title: typeof messages.success === 'function' ? messages.success(value) : messages.success,
        type: 'success',
      }),
      error: (error) => ({
        priority: 'high',
        timeout: 7000,
        title: typeof messages.error === 'function' ? messages.error(error) : messages.error,
        type: 'error',
      }),
    })
  },
}

export function queueToastAfterNavigation(toast: PendingToast) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(pendingToastKey, JSON.stringify(toast))
  } catch {
    // Navigation and authentication must still complete when browser storage is unavailable.
  }
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let serializedToast: string | null = null
    try {
      serializedToast = window.sessionStorage.getItem(pendingToastKey)
      if (serializedToast) window.sessionStorage.removeItem(pendingToastKey)
    } catch {
      return
    }
    if (!serializedToast) return
    try {
      const toast = JSON.parse(serializedToast) as Partial<PendingToast>
      if (
        typeof toast.title !== 'string' ||
        !toast.title.trim() ||
        (toast.description !== undefined && typeof toast.description !== 'string') ||
        toast.type !== 'error' && toast.type !== 'info' && toast.type !== 'success'
      ) return
      addToast(toast.type, toast.title, toast.description)
    } catch {
      // Ignore malformed browser state rather than interrupting application startup.
    }
  }, [])

  return (
    <Toast.Provider limit={4} timeout={4500} toastManager={toastManager}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="track-toast-viewport">
          <AppToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function AppToastList() {
  const { toasts } = Toast.useToastManager()

  return toasts.map((toast) => (
    <Toast.Root className="track-toast" key={toast.id} swipeDirection="right" toast={toast}>
      <span aria-hidden="true" className="track-toast-icon">
        <ToastIcon type={toast.type as AppToastType | undefined} />
      </span>
      <Toast.Content className="track-toast-content">
        <Toast.Title className="track-toast-title" />
        {toast.description ? <Toast.Description className="track-toast-description" /> : null}
      </Toast.Content>
      <Toast.Close aria-label="Dismiss notification" className="track-toast-close">
        <X size={16} strokeWidth={1.8} />
      </Toast.Close>
    </Toast.Root>
  ))
}

function ToastIcon({ type }: { type?: AppToastType }) {
  if (type === 'success') return <CheckCircle2 size={18} strokeWidth={1.9} />
  if (type === 'error') return <AlertCircle size={18} strokeWidth={1.9} />
  if (type === 'loading') return <LoaderCircle className="track-toast-spinner" size={18} strokeWidth={1.9} />
  return <Info size={18} strokeWidth={1.9} />
}
