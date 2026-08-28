import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingScreen } from './OnboardingScreen'

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<OnboardingScreen onBack={vi.fn()} onComplete={vi.fn()} />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const setInput = async (id: string, value: string) => {
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!
  await act(async () => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('OnboardingScreen activation details', () => {
  it('uses the UX4G checkbox and keeps Continue disabled until every required detail is valid', async () => {
    const continueButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Continue')!
    const consent = container.querySelector<HTMLInputElement>('.ux4g-checkbox-input')!

    expect(container.querySelector('.ux4g-checkbox.ux4g-checkbox-md')).not.toBeNull()
    expect(container.querySelectorAll('.field-required')).toHaveLength(5)
    expect(continueButton.disabled).toBe(true)

    await setInput('register-uan', '123456789012')
    await setInput('register-aadhaar', '123456789012')
    await setInput('register-name', 'Arjun Mehta')
    await setInput('register-dob', '1996-11-06')
    await setInput('register-mobile', '9876543210')
    expect(continueButton.disabled).toBe(false)
    await act(async () => continueButton.click())
    expect(container.querySelector('#register-consent-error')?.textContent).toBe('You must agree to Aadhaar OTP verification to continue.')
    expect(container.querySelector('#register-consent-error')?.classList).toContain('service-field-error')

    await act(async () => consent.click())
    expect(container.querySelector('#register-consent-error')).toBeNull()
    await act(async () => continueButton.click())
    expect(container.textContent).toContain('Step 2 of 4')

    const profileButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Continue to verification')!
    expect(profileButton.disabled).toBe(true)
    await setInput('register-family-name', 'Ramesh Mehta')
    await setInput('register-permanent-address', '42 Lake View Road, Bengaluru')
    await setInput('register-current-address', '42 Lake View Road, Bengaluru')
    expect(profileButton.disabled).toBe(false)
    await act(async () => profileButton.click())

    const verifyButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Verify Aadhaar OTP')!
    expect(container.querySelectorAll('.ux4g-otp-input')).toHaveLength(6)
    expect(verifyButton.disabled).toBe(true)
  })

  it('shows a field-level error after a required field is left incomplete', async () => {
    const uan = container.querySelector<HTMLInputElement>('#register-uan')!
    await act(async () => {
      uan.focus()
      uan.blur()
    })

    expect(container.querySelector('#register-uan-error')?.textContent).toBe('Enter your 12-digit UAN.')
    expect(uan.getAttribute('aria-invalid')).toBe('true')
  })
})
