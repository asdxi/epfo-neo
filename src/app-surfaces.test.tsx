import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './components/AppShell'
import { createInitialAccount } from './domain/data'
import { submitGrievance, submitTransfer } from './domain/state'
import { AccountPage } from './pages/AccountPage'
import { HomePage } from './pages/HomePage'
import { LegalPage } from './pages/LegalPage'
import { PassbookPage } from './pages/PassbookPage'
import { RequestsPage } from './pages/RequestsPage'
import { ServicesPage } from './pages/ServicesPage'

const noop = vi.fn()

const buttonNamed = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
  .find((button) => button.textContent?.trim() === name)

const clickButton = async (name: string) => {
  const button = buttonNamed(name)
  expect(button, `button named ${name}`).toBeDefined()
  await act(async () => button?.click())
}

describe('v0.2 application surfaces', () => {
  it('renders the five-route member shell with visible account access', () => {
    const html = renderToStaticMarkup(
      <AppShell activeRoute="home" memberName="Arjun Mehta" onNavigate={noop} onSignOut={noop}>
        <p>Route content</p>
      </AppShell>,
    )

    for (const label of ['Home', 'Passbook', 'Services', 'Requests', 'Account']) expect(html).toContain(label)
    expect(html).toContain('Arjun Mehta')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Skip to main content')
  })

  it('renders the decision-oriented home workspace from reconciled account data', () => {
    const html = renderToStaticMarkup(<HomePage account={createInitialAccount()} onNavigate={noop} onOpenService={noop} />)

    expect(html).toContain('₹4,82,650')
    expect(html).toContain('EPS')
    expect(html).toContain('Vertex Mobility')
    expect(html).toContain('June contribution')
    expect(html).toContain('EPF Contributions')
    expect(html).toContain('₹35,250')
    expect(html).toContain('No EPF-covered employment recorded')
    expect(html.indexOf('Vertex Mobility')).toBeLessThan(html.indexOf('Northstar Consumer Technologies'))
    expect(html).not.toContain('Recent Activity')
    expect(html).not.toContain('What Would You Like to Do?')
    expect(html).not.toContain('Action Required')
  })

  it('preserves the Home empty states after the hierarchy change', () => {
    const account = createInitialAccount()
    const emptyAccount = {
      ...account,
      exceptions: [],
      ledger: { ...account.ledger, contributions: [] },
    }
    const html = renderToStaticMarkup(<HomePage account={emptyAccount} onNavigate={noop} onOpenService={noop} />)

    expect(html).toContain('You’re All Caught Up')
    expect(html).toContain('No Contribution Recorded')
  })

  it('renders passbook dates, EPF and EPS as distinct concepts', () => {
    const html = renderToStaticMarkup(
      <PassbookPage
        account={createInitialAccount()}
        initialView="overview"
        onGenerateStatement={noop}
        onRaiseContributionGrievance={noop}
        onStartTransfer={noop}
      />,
    )

    expect(html).toContain('Recent Contributions')
    expect(html).toContain('Recorded 8 July 2026')
    expect(html).not.toContain('Harbor Foods India')
    expect(html).toContain('Employer EPF')
    expect(html).toContain('EPS')
    expect(html).not.toContain('Generate Statement')
    expect(html).not.toContain('Contributions</button>')
    expect(html).not.toContain('Complete Ledger History')
    expect(html).not.toContain('Estimated Interest Accrued')
  })

  it('shows PF account numbers for employers', () => {
    const html = renderToStaticMarkup(
      <PassbookPage account={createInitialAccount()} initialView="employers" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    )

    expect(html).toContain('PF Account Number · KA/VTX/0048291')
    expect(html).toContain('PF Account Number · DL/BLK/0019274')
  })

  it('disables transaction download only when a custom range is incomplete', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <PassbookPage account={createInitialAccount()} initialView="transactions" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    ))
    expect(buttonNamed('Download')?.disabled).toBe(false)
    const period = Array.from(container.querySelectorAll<HTMLSelectElement>('.transaction-filters select')).find((select) => select.parentElement?.textContent?.startsWith('Period'))
    await act(async () => {
      if (period) {
        period.value = 'custom'
        period.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })

    expect(buttonNamed('View Transactions')?.disabled).toBe(true)
    expect(buttonNamed('Download')?.disabled).toBe(true)
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders all five member services and request tracking', () => {
    const account = createInitialAccount()
    const services = renderToStaticMarkup(
      <ServicesPage account={account} onSubmitTransfer={noop} onSubmitClaim={noop} onSubmitPanVerification={noop} onSubmitCorrection={noop} onSubmitGrievance={noop} onViewRequests={noop} />,
    )
    const requests = renderToStaticMarkup(<RequestsPage account={account} initialRequestId="request-claim-2022" />)

    for (const label of ['Transfer Previous PF', 'Claims &amp; Withdrawals', 'KYC &amp; Verification', 'Correct Employment Records', 'Raise a Grievance']) expect(services).toContain(label)
    expect(requests).toContain('Requests')
    expect(requests).toContain('Open')
    expect(requests).toContain('Completed')
    expect(requests).toContain('Next Expected Step')
  })

  it('shows a submitted transfer as in progress without offering a duplicate action', () => {
    const account = submitTransfer(createInitialAccount(), '2026-08-28')
    const services = renderToStaticMarkup(
      <ServicesPage account={account} initialService="transfer" onSubmitTransfer={noop} onSubmitClaim={noop} onSubmitPanVerification={noop} onSubmitCorrection={noop} onSubmitGrievance={noop} onViewRequests={noop} />,
    )
    const passbook = renderToStaticMarkup(
      <PassbookPage account={account} initialView="employers" initialContextId="harbor" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    )

    expect(services).toContain('Transfer Is Already in Progress')
    expect(services).toContain('Track Transfer')
    expect(passbook).toContain('Transfer Is in Progress')
    expect(passbook).not.toContain('>Transfer Previous PF</button>')
  })

  it('renders editable account capabilities and both legal pages', () => {
    const account = createInitialAccount()
    const accountHtml = renderToStaticMarkup(<AccountPage account={account} onUpdateContact={noop} onUpdateCommunicationPreferences={noop} onDownloadReport={noop} onStartPanVerification={noop} onNavigateLegal={noop} />)
    const terms = renderToStaticMarkup(<LegalPage page="terms" onBack={noop} onNavigate={noop} />)
    const privacy = renderToStaticMarkup(<LegalPage page="privacy" onBack={noop} onNavigate={noop} />)

    expect(accountHtml).toContain('Edit Contact Details')
    expect(accountHtml).toContain('KYC and Verification')
    expect(accountHtml).toContain('Generated Reports')
    expect(terms).toContain('Terms of Use')
    expect(privacy).toContain('Privacy Policy')
  })

  it('completes the transfer service flow and returns a trackable request', async () => {
    let account = createInitialAccount()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <ServicesPage
        account={account}
        initialService="transfer"
        onSubmitTransfer={(submittedOn) => {
          account = submitTransfer(account, submittedOn)
          return account.requests.find((request) => request.type === 'transfer')
        }}
        onSubmitClaim={noop}
        onSubmitPanVerification={noop}
        onSubmitCorrection={noop}
        onSubmitGrievance={noop}
        onViewRequests={noop}
      />,
    ))

    await clickButton('Continue')
    await clickButton('Continue')
    expect(buttonNamed('Confirm and Submit Transfer')?.disabled).toBe(true)
    await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click())
    await clickButton('Confirm and Submit Transfer')

    expect(container.textContent).toContain('Transfer Request Submitted')
    expect(container.textContent).toContain('Reference Number')
    expect(account.requests.find((request) => request.type === 'transfer')?.state).toBe('submitted')
    await act(async () => root.unmount())
    container.remove()
  })

  it('completes a contribution grievance and creates a ticket', async () => {
    let account = createInitialAccount()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <ServicesPage
        account={account}
        initialService="grievance"
        initialEmploymentId="vertex"
        initialContributionId="vertex-2026-06"
        onSubmitTransfer={noop}
        onSubmitClaim={noop}
        onSubmitPanVerification={noop}
        onSubmitCorrection={noop}
        onSubmitGrievance={(input) => {
          account = submitGrievance(account, input)
          return account.requests.find((request) => request.contributionId === input.contributionId)
        }}
        onViewRequests={noop}
      />,
    ))

    await clickButton('Continue')
    await clickButton('Continue')
    expect(buttonNamed('Submit Grievance')?.disabled).toBe(true)
    await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click())
    await clickButton('Submit Grievance')

    expect(container.textContent).toContain('Grievance Submitted')
    expect(container.textContent).toContain('Reference Number')
    expect(account.requests.find((request) => request.contributionId === 'vertex-2026-06')?.reference).toMatch(/^GRV-/)
    await act(async () => root.unmount())
    container.remove()
  })
})
