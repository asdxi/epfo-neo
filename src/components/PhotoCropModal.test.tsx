import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { PhotoCropModal } from './PhotoCropModal'

afterEach(() => document.body.replaceChildren())

it('provides an accessible fixed-ratio crop dialog with keyboard cancellation', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const cancel = vi.fn()

  await act(async () => root.render(<PhotoCropModal sourceUrl="blob:demo-photo" onCancel={cancel} onSave={vi.fn()} />))

  const dialog = host.querySelector('[role="dialog"]')
  expect(dialog?.getAttribute('aria-modal')).toBe('true')
  expect(host.querySelectorAll('input[type="range"]')).toHaveLength(3)
  expect([...host.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Cancel', 'Crop And Save'])

  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(cancel).toHaveBeenCalledOnce()
  await act(async () => root.unmount())
})
