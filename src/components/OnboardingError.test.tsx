import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_OTP } from '../domain/demoCredentials'
import { OnboardingScreen } from './OnboardingScreen'

describe('OnboardingScreen Error State', () => {
  afterEach(() => vi.useRealTimers())

  it('fails face authentication truthfully and provides a seeded-account escape', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const onComplete = vi.fn()
    const onExitErrorState = vi.fn()
    await act(async () => root.render(<OnboardingScreen demoMode="error" onBack={vi.fn()} onComplete={onComplete} onExitErrorState={onExitErrorState} />))

    const setInput = async (id: string, value: string) => {
      const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!
      await act(async () => {
        const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    const click = async (label: string) => {
      const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === label)!
      await act(async () => button.click())
    }

    await setInput('register-uan', '123456789012')
    await setInput('register-aadhaar', '123456789012')
    await setInput('register-name', 'Arjun Mehta')
    await setInput('register-dob', '1996-11-06')
    await setInput('register-mobile', '9876543210')
    await act(async () => container.querySelector<HTMLInputElement>('.ux4g-checkbox-input')?.click())
    await click('Continue')
    await setInput('register-family-name', 'Ramesh Mehta')
    await setInput('register-permanent-address', '42 Lake View Road')
    await setInput('register-current-address', '42 Lake View Road')
    await click('Continue to verification')
    const digits = [...container.querySelectorAll<HTMLInputElement>('.ux4g-otp-input')]
    for (let index = 0; index < digits.length; index += 1) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(digits[index], DEMO_OTP[index])
        digits[index].dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await click('Verify Aadhaar OTP')
    expect(container.textContent).not.toContain('I Will Do It Later')
    await act(async () => vi.advanceTimersByTime(1400))
    await click('Capture And Continue')
    expect(container.textContent).toContain('Face Authentication Couldn’t Be Completed')
    expect(container.textContent).toContain('UAN activation is not complete yet.')
    expect(container.textContent).not.toContain('UAN Activation Complete')
    expect(onComplete).not.toHaveBeenCalled()
    await click('Exit Error State')
    expect(onExitErrorState).toHaveBeenCalledOnce()

    await act(async () => root.unmount())
    container.remove()
  })
})
