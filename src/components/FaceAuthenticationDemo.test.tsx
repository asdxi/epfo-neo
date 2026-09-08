import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { FaceAuthenticationDemo } from './FaceAuthenticationDemo'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren() })

it('enables capture only after deterministic demo alignment', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host); const complete = vi.fn()
  await act(async () => root.render(<FaceAuthenticationDemo onComplete={complete} onContinueForNow={vi.fn()} />))
  const capture = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Capture And Continue')!
  expect(capture.disabled).toBe(true)
  await act(async () => vi.advanceTimersByTime(1400))
  expect(capture.disabled).toBe(false)
  await act(async () => capture.click())
  expect(complete).toHaveBeenCalledOnce()
  await act(async () => root.unmount())
})
