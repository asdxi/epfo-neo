import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialAccount } from '../domain/data'
import { ServicesPage } from './ServicesPage'

const noop = () => undefined

describe('Services page navigation', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.history.replaceState(null, '', window.location.pathname)
  })

  it('uses browser history to return from a service action to the catalogue', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const pushState = vi.spyOn(window.history, 'pushState')
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const manageNomination = vi.fn()

    await act(async () => root.render(
      <ServicesPage
        account={createInitialAccount()}
        onSubmitTransfer={noop}
        onSubmitClaim={noop}
        onSubmitPanVerification={noop}
        onSubmitCorrection={noop}
        onSubmitGrievance={noop}
        onManageNomination={manageNomination}
      />,
    ))

    expect(container.textContent).toContain('Choose a service to see what you need and what happens next.')
    expect(container.textContent).toContain('Manage nomination in Account')
    expect(container.textContent).toContain('Add or update nominee details and confirm how the total share is divided.')
    expect(container.textContent).not.toContain('Balance ready to move')
    expect(container.textContent).not.toContain('Contribution support')
    expect(container.textContent).not.toContain('Report This Contribution')
    expect(Array.from(container.querySelectorAll('.service-catalogue-item button')).filter((button) => button.textContent === 'View Service')).toHaveLength(5)
    expect(container.querySelector('.service-danger-zone')?.textContent).toContain('Exit from EPFO Scheme')
    expect(container.querySelector('.service-danger-zone button')?.textContent).toBe('Exit')
    const nominationAction = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Add Nominee')
    await act(async () => nominationAction?.click())
    expect(manageNomination).toHaveBeenCalledOnce()

    const correctionItem = Array.from(container.querySelectorAll('.service-catalogue-item')).find((item) => item.textContent?.includes('Correct Employment Records'))
    const action = correctionItem?.querySelector('button')
    await act(async () => action?.click())

    expect(pushState).toHaveBeenCalledWith(expect.objectContaining({ epfoService: 'correction' }), '')
    expect(container.textContent).toContain('Correct a Recorded Employment Detail')
    expect(container.querySelector('.ux4g-breadcrumb')).toBeNull()
    expect(container.textContent).not.toContain('Member service')
    expect(container.textContent).toContain('Back to Services')
    expect(container.querySelector('.service-back-button')?.classList.contains('ux4g-btn-sm')).toBe(true)

    await act(async () => window.dispatchEvent(new PopStateEvent('popstate', { state: null })))
    expect(container.textContent).toContain('Choose a service to see what you need and what happens next.')
    expect(container.textContent).not.toContain('Correct a Recorded Employment Detail')

    pushState.mockRestore()
    scrollTo.mockRestore()
    await act(async () => root.unmount())
  })
})
