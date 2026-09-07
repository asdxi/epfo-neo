import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { createInitialAccount } from '../domain/data'
import { ServicesPage } from './ServicesPage'

const noop = () => undefined

const commonProps = {
  onSubmitTransfer: noop,
  onSubmitClaim: noop,
  onSubmitPanVerification: noop,
  onSubmitCorrection: noop,
  onSubmitGrievance: noop,
}

describe('withdrawal and Mark Exit flows', () => {
  let container: HTMLDivElement | undefined

  afterEach(() => {
    container?.remove()
    container = undefined
  })

  it('separates partial and full withdrawal reasons and explains KYC demo allowance', async () => {
    container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<ServicesPage account={createInitialAccount()} initialService="claim" {...commonProps} />))
    await act(async () => [...container!.querySelectorAll('button')].find((button) => button.textContent === 'Continue')?.click())

    expect(container.textContent).toContain('Demo KYC Allowance')
    expect(container.textContent).toContain('PF Advance · Partial Withdrawal')
    expect(container.textContent).toContain('Illness')
    expect(container.textContent).not.toContain('Leaving Employment / Resignation')

    const typeSelect = container.querySelector<HTMLSelectElement>('#claim-intent')!
    await act(async () => {
      typeSelect.value = 'final'
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.textContent).toContain('Full PF Withdrawal · Final Settlement')
    expect(container.textContent).toContain('Leaving Employment / Resignation')
    expect(container.textContent).toContain('A current employment cannot be used for full settlement.')
    expect(container.textContent).not.toContain('Illness')
    await act(async () => root.unmount())
  })

  it('labels the service Mark Exit and explains future employment remains possible', async () => {
    container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<ServicesPage account={createInitialAccount()} initialService="exit" {...commonProps} />))
    expect(container.textContent).toContain('Before you mark an exit')
    expect(container.textContent).toContain('does not close your EPFO membership')
    expect(container.textContent).not.toContain('Exit from EPFO Scheme')
    await act(async () => root.unmount())
  })
})
