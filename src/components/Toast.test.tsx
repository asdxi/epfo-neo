import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast'

describe('Toast', () => {
  afterEach(() => vi.useRealTimers())

  it('uses polite semantics for success and can be dismissed', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const dismiss = vi.fn()
    await act(async () => root.render(<Toast toast={{ id: 1, tone: 'success', title: 'OTP Sent', message: 'A new OTP was sent.' }} onDismiss={dismiss} />))
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')?.click())
    expect(dismiss).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
    container.remove()
  })

  it('auto-dismisses after five seconds and pauses while focused', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const dismiss = vi.fn()
    await act(async () => root.render(<Toast toast={{ id: 2, tone: 'error', title: 'Download Failed', message: 'Try again.' }} onDismiss={dismiss} />))
    const close = container.querySelector<HTMLButtonElement>('button')!
    await act(async () => close.focus())
    await act(async () => vi.advanceTimersByTime(6000))
    expect(dismiss).not.toHaveBeenCalled()
    await act(async () => close.blur())
    await act(async () => vi.advanceTimersByTime(5000))
    expect(dismiss).toHaveBeenCalledOnce()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    await act(async () => root.unmount())
    container.remove()
  })
})
