import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_OTP } from '../domain/demoCredentials'
import { createInitialAccount } from '../domain/data'
import { loadPersistedAccount, persistAccount } from '../domain/persistence'
import { updateContact } from '../domain/state'
import { LoginScreen } from './LoginScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

const renderLogin = async (expectedMobile = '9876543210', onAuthenticated = vi.fn()) => {
  await act(async () => root.render(<LoginScreen expectedMobile={expectedMobile} onAuthenticated={onAuthenticated} />))
  return onAuthenticated
}

const setInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const clickButton = async (name: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === name)
  expect(button, `button named ${name}`).toBeDefined()
  await act(async () => button?.click())
}

const continueWithMobile = async (mobile = '9876543210') => {
  await setInput(container.querySelector<HTMLInputElement>('#mobile-number')!, mobile)
  await clickButton('Send Aadhaar OTP')
}

describe('LoginScreen credentials and validation', () => {
  it('explains what members can access after signing in', async () => {
    await renderLogin()

    expect(container.textContent).toContain('Sign in to view your EPF balance, contribution history and requests in one place.')
    expect(container.textContent).not.toContain('Secure access with an Aadhaar OTP')
  })

  it('rejects malformed and non-matching mobile numbers', async () => {
    await renderLogin()
    const mobile = container.querySelector<HTMLInputElement>('#mobile-number')!

    await setInput(mobile, '51234')
    await clickButton('Send Aadhaar OTP')
    expect(container.textContent).toContain('Please enter a valid 10-digit mobile number.')

    await setInput(mobile, '9123456789')
    await clickButton('Send Aadhaar OTP')
    expect(container.textContent).toContain('This mobile number does not match the fictional account.')
  })

  it('rejects a 10-digit number beginning with 3 as an invalid Indian mobile number', async () => {
    await renderLogin()
    const mobile = container.querySelector<HTMLInputElement>('#mobile-number')!
    await setInput(mobile, '3123456789')

    expect(container.textContent).toContain('Please enter a valid 10-digit mobile number.')
    expect(container.textContent).not.toContain('Step 2 of 2')

    await setInput(mobile, '9876543210')
    expect(container.textContent).not.toContain('Please enter a valid 10-digit mobile number.')
  })

  it('shows an incorrect OTP error only after verification and clears it on edit', async () => {
    await renderLogin()
    await continueWithMobile()
    const digits = [...container.querySelectorAll<HTMLInputElement>('.ux4g-otp-input')]

    for (let index = 0; index < digits.length; index += 1) await setInput(digits[index], '9')
    expect(container.querySelector('[role="alert"]')).toBeNull()

    await clickButton('Verify Aadhaar OTP and continue')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('We could not verify this OTP')

    await setInput(digits[0], DEMO_OTP[0])
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('uses the persisted member mobile as the authoritative login credential', async () => {
    let stored: string | null = null
    const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value } }
    const changed = updateContact(createInitialAccount(), { type: 'mobile', value: '8765432109', updatedOn: '2026-08-28' })
    persistAccount(storage, changed)
    const expectedMobile = loadPersistedAccount(storage).member.mobile.value

    await renderLogin(expectedMobile)
    await continueWithMobile('9876543210')
    expect(container.textContent).toContain('does not match the fictional account')

    await continueWithMobile(expectedMobile)
    expect(container.textContent).toContain('Enter the Aadhaar OTP')
    expect(container.textContent).toContain('••••••2109')
  })

  it('shows the synthetic login credentials and guidance without a demo outcome control', async () => {
    await renderLogin('9876543210')

    expect(container.textContent).toContain('Demo login credentials')
    expect(container.textContent).toContain('9876543210')
    expect(container.textContent).toContain(DEMO_OTP)
    expect(container.textContent).toContain('Enter this same OTP wherever an OTP field appears in the demo.')
    expect(container.textContent).toContain('page footer on desktop')
    expect(container.textContent).toContain('Menu')
    expect(container.textContent).not.toContain('Demo verification outcome')
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
  })

  it('disables verification until all six digits are entered and then shows incorrect OTP errors', async () => {
    await renderLogin()
    await continueWithMobile()
    const verifyButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === 'Verify Aadhaar OTP and continue')!
    expect(verifyButton.disabled).toBe(true)
    expect(container.querySelector('[role="alert"]')).toBeNull()

    const digits = [...container.querySelectorAll<HTMLInputElement>('.ux4g-otp-input')]
    for (let index = 0; index < digits.length; index += 1) await setInput(digits[index], '9')
    expect(verifyButton.disabled).toBe(false)
    await clickButton('Verify Aadhaar OTP and continue')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('We could not verify this OTP')
    expect(digits.every((digit) => digit.getAttribute('aria-invalid') === 'true')).toBe(true)
  })

  it('supports auto-advance, Backspace navigation, six-digit paste and successful verification', async () => {
    vi.useFakeTimers()
    const authenticated = await renderLogin()
    await continueWithMobile()
    const digits = [...container.querySelectorAll<HTMLInputElement>('.ux4g-otp-input')]

    await setInput(digits[0], '1')
    expect(document.activeElement).toBe(digits[1])
    await act(async () => digits[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })))
    expect(document.activeElement).toBe(digits[0])

    await act(async () => {
      const paste = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(paste, 'clipboardData', { value: { getData: () => DEMO_OTP } })
      digits[0].dispatchEvent(paste)
    })
    expect(digits.map((digit) => digit.value).join('')).toBe(DEMO_OTP)

    await clickButton('Verify Aadhaar OTP and continue')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('OTP verified')
    await act(async () => vi.advanceTimersByTime(900))
    expect(authenticated).toHaveBeenCalledOnce()
  })
})
