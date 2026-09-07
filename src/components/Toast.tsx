import { useEffect, useRef, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'info'
export interface ToastMessage { id: number; tone: ToastTone; title: string; message: string }

const DISMISS_AFTER_MS = 5000

export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(DISMISS_AFTER_MS)
  const startedAt = useRef(0)

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const timer = window.setTimeout(onDismiss, remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
    }
  }, [onDismiss, paused])

  const icon = toast.tone === 'success' ? '✓' : toast.tone === 'error' ? '!' : 'i'
  return <div className="app-toast-region" aria-live={toast.tone === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
    <section
      className={`app-toast app-toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}
    >
      <span className="app-toast__icon" aria-hidden="true">{icon}</span>
      <div className="app-toast__content"><strong>{toast.title}</strong><p>{toast.message}</p></div>
      <button className="app-toast__dismiss" type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </section>
  </div>
}
