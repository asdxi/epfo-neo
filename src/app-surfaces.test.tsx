import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './components/AppShell'
import { createInitialAccount } from './domain/data'
import { addGeneratedReport, saveNominees, submitGrievance, submitTransfer } from './domain/state'
import { AccountPage } from './pages/AccountPage'
import { HomePage } from './pages/HomePage'
import { LegalPage } from './pages/LegalPage'
import { PassbookPage } from './pages/PassbookPage'
import { RequestsPage } from './pages/RequestsPage'
import { RecordReviewPage } from './pages/RecordReviewPage'
import { ServicesPage } from './pages/ServicesPage'
import { noActiveIssueScenario, transferCompletedScenario, unavailableSourceScenario } from './test-fixtures/reconciliationScenarios'

const noop = vi.fn()

const createTransferEligibleAccount = () => {
  const account = createInitialAccount()
  account.requests = account.requests.filter((request) => request.type !== 'transfer')
  account.ledger.transfers = account.ledger.transfers.filter((transfer) => transfer.id !== 'transfer-harbor-vertex-2026-06-18')
  account.exceptions = account.exceptions.map((exception) => exception.kind === 'previous-balance' ? { ...exception, state: 'open', relatedRequestId: undefined } : exception)
  return account
}

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

  it('requires confirmation before signing out', async () => {
    const onSignOut = vi.fn()
    const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
    const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open') })
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<AppShell activeRoute="home" onNavigate={noop} onSignOut={onSignOut}><p>Content</p></AppShell>))

    await act(async () => container.querySelector<HTMLButtonElement>('.desktop-sign-out button')?.click())
    expect(onSignOut).not.toHaveBeenCalled()
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(true)
    await act(async () => container.querySelector<HTMLButtonElement>('.sign-out-dialog-actions .ux4g-btn-primary')?.click())
    expect(onSignOut).toHaveBeenCalledOnce()

    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close
    await act(async () => root.unmount())
    container.remove()
  })

  it('places Reset Demo in desktop and mobile navigation and requires confirmation', async () => {
    const onResetDemo = vi.fn()
    const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
    const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open') })
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<AppShell activeRoute="home" onNavigate={noop} onSignOut={noop} onResetDemo={onResetDemo} onOpenTerms={noop} onOpenPrivacy={noop}><p>Content</p></AppShell>))

    expect(container.querySelector('.drawer-reset-demo')?.textContent).toBe('Reset Demo')
    expect(container.querySelector('.footer-reset-demo')?.textContent).toBe('Reset Demo')
    const githubLink = container.querySelector<HTMLAnchorElement>('.app-footer-github')
    expect(githubLink?.href).toBe('https://github.com/asdxi/epfo-neo')
    expect(githubLink?.target).toBe('_blank')
    expect(githubLink?.getAttribute('aria-label')).toContain('opens in a new tab')
    await act(async () => container.querySelector<HTMLButtonElement>('.footer-reset-demo')?.click())
    expect(onResetDemo).not.toHaveBeenCalled()
    expect(container.querySelector('.reset-demo-dialog')?.hasAttribute('open')).toBe(true)
    await act(async () => container.querySelector<HTMLButtonElement>('.reset-demo-dialog .ux4g-btn-danger')?.click())
    expect(onResetDemo).toHaveBeenCalledOnce()

    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders the decision-oriented home workspace from reconciled account data', () => {
    const html = renderToStaticMarkup(<HomePage account={createInitialAccount()} onNavigate={noop} onOpenService={noop} onReviewIssues={noop} />)

    expect(html).toContain('₹1,88,094')
    expect(html).toContain('EPS')
    expect(html.match(/ux4g-btn-text-primary ux4g-btn-md home-panel-action/g)).toHaveLength(2)
    expect(html).toContain('Pied Piper')
    expect(html).toContain('Pending PF Transfer')
    expect(html).toContain('Your PF transfer from Waystar Royco is still being processed.')
    expect(html).not.toContain('Current employer')
    expect(html).not.toContain('Next step')
    expect(html).toContain('Employer PF Not Recorded')
    expect(html).toContain('View Details')
    expect(html).toContain('EPF Contributions')
    expect(html).toContain('₹25,850')
    expect(html).toContain('No EPF-Covered Employment Recorded')
    expect(html.indexOf('Pied Piper')).toBeLessThan(html.indexOf('Stark Industries'))
    expect(html).toContain('id="notice-board-title">Notices</h2>')
    expect(html.match(/>New<\/span>/g)).toHaveLength(2)
    expect(html).toContain('aria-label="Notices, newest first"')
    expect(html).toContain('target="_blank"')
    expect(html.indexOf('Keep Your Aadhaar-Linked Mobile Number Active')).toBeLessThan(html.indexOf('Updates Are Available in Requests'))
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
    const html = renderToStaticMarkup(<HomePage account={emptyAccount} onNavigate={noop} onOpenService={noop} onReviewIssues={noop} />)

    expect(html).toContain('You’re All Caught Up')
    expect(html).toContain('No Contribution Recorded')
  })

  it('keeps balance calculations in Passbook rather than Home', () => {
    const home = renderToStaticMarkup(<HomePage account={createInitialAccount()} onNavigate={noop} onOpenService={noop} onReviewIssues={noop} />)
    const passbook = renderToStaticMarkup(<PassbookPage account={createInitialAccount()} initialView="overview" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />)

    expect(home).not.toContain('How This Is Calculated')
    expect(home).not.toContain('balance-calculation-dialog')
    expect(passbook).toContain('class="ux4g-btn ux4g-btn-text-primary ux4g-btn-md passbook-calculation-link"')
    expect(passbook).toContain('id="balance-composition-title">Current EPF Balance Calculation</h2>')
    expect(passbook).toContain('Interest Credited')
    expect(passbook).toContain('PF received from earlier Member IDs.')
    expect(passbook).toContain('PF moved to later Member IDs.')
    expect(passbook).toContain('Accrued Pension Corpus Till Date')
    expect(passbook).toContain('<strong>₹96,250</strong>')
    expect(passbook).toContain('aria-expanded="false" aria-controls="eps-disclosure-body"')
    expect(passbook.indexOf('overview-eps eps-disclosure')).toBeLessThan(passbook.indexOf('Passbook views'))
    expect(passbook).toContain('<strong>Your Service:</strong> 6 years 5 months.')
    expect(passbook).not.toContain('to reach 10 years')
    expect(passbook).toContain('<strong>Before 10 Years of Service:</strong>')
    expect(passbook).toContain('not from ₹96,250. If you take it, these service years will no longer count toward a future pension.')
    expect(passbook).toContain('<strong>After 10 Years of Service:</strong> You cannot withdraw EPS as a lump sum.')
    expect(passbook).toContain('permanently reduced by 4% for each year before 58')
    expect(passbook).toContain('<strong>Interest:</strong> EPS does not credit interest to this contribution record.')
    expect(passbook).toContain('aria-label="Explain EPS"')
    expect(passbook).not.toContain('financial-explanation')
  })

  it('opens a home contribution in the filtered transaction ledger', async () => {
    window.history.replaceState(null, '', '/passbook?view=transactions&employer=vertex&type=contribution&period=6-months&load=1&highlight=vertex-2026-08')
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<PassbookPage account={createInitialAccount()} initialContextId="vertex-2026-08" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />))

    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Transactions')
    expect(container.querySelector<HTMLSelectElement>('.transaction-filters label:first-child select')?.value).toBe('vertex')
    expect(container.querySelector<HTMLSelectElement>('.transaction-filters label:nth-child(2) select')?.value).toBe('contribution')
    expect(container.querySelector('#transaction-vertex-2026-08')?.classList.contains('context-target-highlight')).toBe(true)
    expect(container.querySelector('#transaction-vertex-2026-08')?.textContent).toContain('Contribution for August 2026')

    await act(async () => root.unmount())
    container.remove()
    window.history.replaceState(null, '', '/')
  })

  it('renders missing contribution components as missing while preserving an explicit zero', () => {
    const account = createInitialAccount()
    const latest = account.ledger.contributions.find((item) => item.id === 'vertex-2026-08')!
    latest.employeeEpf = null
    latest.employerEpf = 0
    latest.eps = null
    const html = renderToStaticMarkup(<HomePage account={account} onNavigate={noop} onOpenService={noop} onReviewIssues={noop} />)

    expect(html).toContain('Salary Month')
    expect(html).not.toContain('Employee EPF')
  })

  it('renders the evidence-first PF record review and routes both issue actions', async () => {
    const account = createInitialAccount()
    const trackRequest = vi.fn()
    const raiseGrievance = vi.fn()
    const back = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<RecordReviewPage account={account} onBack={back} onTrackRequest={trackRequest} onStartTransfer={noop} onRaiseContributionGrievance={raiseGrievance} />))

    expect(container.textContent).toContain('Needs Attention')
    expect(container.textContent).toContain('Review items that need action or are still in progress')
    expect(container.textContent).toContain('Pending PF Transfer')
    expect(container.textContent).toContain('Waystar Royco→Pied Piper₹38,450')
    expect(container.textContent).toContain('Employment Record Verification')
    expect(container.textContent).not.toContain('Responsible Party')
    expect(container.textContent).not.toContain('Balance Treatment')
    expect(container.textContent).not.toContain('Pension Service')
    expect(container.textContent).toContain('EmployerPied PiperSalary MonthAugust 2026Recorded On8 September 2026Missing AmountEmployer EPF')
    expect(container.textContent).toContain('Expected AmountsEmployee EPF₹1,800VPF₹1,200Employer EPF₹550EPS₹1,250')
    expect(container.textContent).toContain('Recorded AmountsEmployee EPF₹1,800VPF₹1,200Employer EPFNot RecordedEPS₹1,250')
    expect(container.querySelector('.record-missing-value')?.textContent).toBe('Not Recorded')
    expect(container.querySelector('.record-missing-value')?.classList.contains('ux4g-tag')).toBe(false)
    expect(container.textContent).not.toContain('Rule record')
    expect(container.textContent).not.toContain('Supporting records')
    expect(container.textContent).not.toContain('Calculation trail')
    expect(container.querySelector('details.record-evidence')).toBeNull()
    expect(document.activeElement).toBe(container.querySelector('#record-review-title'))

    await clickButton('Track Transfer')
    expect(trackRequest).toHaveBeenCalledWith('request-transfer-2026')
    await clickButton('Request Review')
    expect(raiseGrievance).toHaveBeenCalledWith(expect.objectContaining({ id: 'vertex-2026-08' }))

    await act(async () => root.unmount())
    container.remove()
  })

  it('renders empty, resolved and unavailable record-review states without inventing outcomes', () => {
    const renderReview = (account: ReturnType<typeof createInitialAccount>) => renderToStaticMarkup(<RecordReviewPage account={account} onBack={noop} onTrackRequest={noop} onStartTransfer={noop} onRaiseContributionGrievance={noop} />)
    const empty = renderReview({ ...noActiveIssueScenario(), exceptions: [] })
    const resolved = renderReview(transferCompletedScenario())
    const unavailableAccount = unavailableSourceScenario()
    unavailableAccount.exceptions = unavailableAccount.exceptions.filter((exception) => exception.kind === 'previous-balance')
    const unavailable = renderReview(unavailableAccount)

    expect(empty).toContain('No Items Need Attention')
    expect(resolved).toContain('PF Transfer Completed')
    expect(resolved).toContain('No Action Needed')
    expect(unavailable).toContain('Record Unavailable')
    expect(unavailable).toContain('No financial or pension result has been assumed.')
    expect(unavailable).not.toContain('₹38,450')
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
    expect(html).not.toContain('Waystar Royco')
    expect(html).toContain('Employer EPF')
    expect(html).toContain('Employee EPF')
    expect(html).toContain('Employer EPF</span><strong><span class="record-missing-value">Not Recorded</span>')
    expect(html).toContain('EPS')
    expect(html).not.toContain('Generate Statement')
    expect(html).not.toContain('Contributions</button>')
    expect(html).not.toContain('Complete Ledger History')
    expect(html).not.toContain('Estimated Interest Accrued')
  })

  it('shows Member IDs for employers', () => {
    const html = renderToStaticMarkup(
      <PassbookPage account={createInitialAccount()} initialView="employers" initialContextId="bluekite" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    )

    expect(html).toContain('Member ID · KA/VTX/0048291')
    expect(html).toContain('Member ID · DL/BLK/0019274')
    expect(html).toContain('Dunder Mifflin Paper Co.')
    expect(html).toContain('Transfer Completed')
    expect(html).not.toContain('No Transfer Needed')

    const stark = renderToStaticMarkup(
      <PassbookPage account={createInitialAccount()} initialView="employers" initialContextId="northstar" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    )
    expect(stark).toContain('Stark Defence Systems')
    expect(stark).toContain('SDS/PF-TRUST/001842')
    expect(stark).toContain('Stark IT Services')
    expect(stark).toContain('Stark Digital Platforms')
    expect(stark).not.toContain('Historical Data Is Partial')
    expect(stark).toContain('Closing Balance: ₹0')
  })

  it('uses member-facing transaction filters and contribution breakup columns', () => {
    const html = renderToStaticMarkup(
      <PassbookPage account={createInitialAccount()} initialView="transactions" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    )

    expect(html).toContain('<option value="official-interest">Interest Credit</option>')
    expect(html).toContain('<option value="transfers">Transfers</option>')
    expect(html).not.toContain('<option value="estimated-interest">')
    expect(html).not.toContain('<option value="transfer-in">')
    expect(html).not.toContain('<option value="transfer-out">')
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

  it('shows transactions in a paginated table with ten rows per page', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(
      <PassbookPage account={createInitialAccount()} initialView="transactions" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    ))

    const period = Array.from(container.querySelectorAll<HTMLSelectElement>('.transaction-filters select')).find((select) => select.parentElement?.textContent?.startsWith('Period'))
    await act(async () => {
      if (period) {
        period.value = 'all-time'
        period.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    await act(async () => container.querySelector<HTMLButtonElement>('.transaction-actions .ux4g-btn-primary')?.click())

    expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual(['Date', 'Transaction', 'Employer', 'Type', 'Employee EPF', 'VPF', 'Employer EPF', 'EPF Total'])
    expect(container.querySelectorAll('.transaction-table tbody tr')).toHaveLength(10)
    expect(container.querySelector('.transaction-pagination [aria-label="Next transaction page"] svg')).not.toBeNull()
    expect(container.querySelector('.transaction-pagination-summary')?.textContent).toContain('Showing 1–10')
    expect(container.querySelector('.transaction-pagination-footer')).not.toBeNull()
    expect(container.querySelector('.transaction-pagination .ux4g-page-number.active')?.textContent).toBe('1')
    expect(container.querySelectorAll('.transaction-pagination .ux4g-page-number')).toHaveLength(4)
    expect(container.querySelector('.transaction-table .ux4g-tag-filled-success')?.textContent).toBe('Contribution')
    expect(container.querySelector('.transaction-table .ux4g-tag-filled-primary')?.textContent).toBe('Transfer')

    await act(async () => root.unmount())
    container.remove()
  })

  it('labels transfer rows by initiation method on both sides without changing posted amounts', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(
      <PassbookPage account={createInitialAccount()} initialView="transactions" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('.transaction-actions .ux4g-btn-primary')?.click())

    const rows = [...container.querySelectorAll<HTMLTableRowElement>('.transaction-table tbody tr')]
    const completedRows = rows.filter((row) => row.textContent?.includes('₹1,28,894'))
    const pendingRows = rows.filter((row) => row.textContent?.includes('₹0'))
    expect(completedRows).toHaveLength(2)
    expect(completedRows.every((row) => row.textContent?.includes('Automatic Transfer'))).toBe(true)
    expect(pendingRows).toHaveLength(2)
    expect(pendingRows.every((row) => row.textContent?.includes('Manual Transfer'))).toBe(true)
    expect(container.querySelectorAll('.transaction-secondary-line')).toHaveLength(4)
    expect(container.textContent).not.toContain('System Transfer')
    expect(container.textContent).not.toContain('Member Transfer')

    await act(async () => root.unmount())
    container.remove()
  })

  it('renders all five member services and request tracking', () => {
    const account = createInitialAccount()
    const services = renderToStaticMarkup(
      <ServicesPage account={account} onSubmitTransfer={noop} onSubmitClaim={noop} onSubmitPanVerification={noop} onSubmitCorrection={noop} onSubmitGrievance={noop} onViewRequests={noop} />,
    )
    const requests = renderToStaticMarkup(<RequestsPage account={account} initialRequestId="request-claim-2022" />)
    const openRequests = renderToStaticMarkup(<RequestsPage account={account} initialRequestId="request-transfer-2026" />)

    for (const label of ['Transfer Previous PF', 'Withdrawal Claim', 'KYC &amp; Verification', 'Correct Employment Records', 'Raise a Grievance', 'Exit from EPFO Scheme']) expect(services).toContain(label)
    expect(services).toContain('>View Service</button>')
    expect(services).toContain('>Exit</button>')
    expect(requests).toContain('Requests')
    expect(requests).toContain('HDFC Bank · •••• 7314')
    expect(requests).toContain('Latest Update: <strong>Request Completed</strong> · 19 Aug 2022')
    expect(requests).toContain('Open')
    expect(requests).toContain('Completed')
    expect(requests).toContain('Claims')
    expect(requests).toContain('<span>Claims</span><span class="request-tab-count">1</span>')
    expect(requests).toContain('<span>Grievances</span><span class="request-tab-count">1</span>')
    expect(openRequests).toContain('<span>Transfers</span><span class="request-tab-count">1</span>')
    expect(openRequests).toContain('<span>Corrections</span><span class="request-tab-count">1</span>')
    expect(requests).toContain('Next Step')
    expect(requests).not.toContain('Recommended Next Step')
    expect(requests).toContain('Search requests')
    expect(requests).toContain('Search requests')
    expect(requests).toContain('class="ux4g-input ux4g-input-md"')
    expect(requests).not.toContain('Operational history')
    expect(requests).not.toContain('Track services that take time')
    expect(requests).not.toContain('<p class="service-eyebrow">')

    const emptyRequests = renderToStaticMarkup(<RequestsPage account={{ ...account, requests: [] }} />)
    expect(emptyRequests).toContain('No Open Requests')

    const actionRequest = { ...account.requests[0], state: 'action-required' as const, citizenAction: 'Confirm the requested details.' }
    const actionRequired = renderToStaticMarkup(<RequestsPage account={{ ...account, requests: [actionRequest] }} initialRequestId={actionRequest.id} />)
    expect(actionRequired).toContain('Action Required')
    expect(actionRequired).not.toContain('Your Action Is Required')
  })

  it('uses service guidance and readable progress markup for a grievance', () => {
    const grievance = renderToStaticMarkup(
      <ServicesPage account={createInitialAccount()} initialService="grievance" onSubmitTransfer={noop} onSubmitClaim={noop} onSubmitPanVerification={noop} onSubmitCorrection={noop} onSubmitGrievance={noop} onViewRequests={noop} />,
    )

    expect(grievance).toContain('Step 1 of 4 · Understand')
    expect(grievance).toContain('service-progress-step-number')
    expect(grievance).toContain('Choose the affected employment or transaction and describe what appears incorrect')
    expect(grievance).not.toContain('Record selected')
    expect(grievance).not.toContain('The Record Does Not Explain the Cause')
    expect(grievance).not.toContain('ux4g-alert-warning')
  })

  it('retrieves open and completed requests by reference number', async () => {
    const account = createInitialAccount()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<RequestsPage account={account} />))

    const search = container.querySelector<HTMLInputElement>('#request-id-search')!
    const submitSearch = async (requestId: string) => {
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        valueSetter?.call(search, requestId)
        search.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () => container.querySelector<HTMLButtonElement>('.request-search button[type="submit"]')?.click())
    }

    await submitSearch('clm-2022-18421')
    expect(container.querySelector('#request-view-completed')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.request-detail')?.textContent).toContain('CLM-2022-18421')

    await submitSearch('  TRF-2026-004512  ')
    expect(container.querySelector('#request-view-open')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.request-detail')?.textContent).toContain('TRF-2026-004512')

    await act(async () => root.unmount())
    container.remove()
  })

  it('restores keyboard focus at Requests after a record-review hand-off', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<RequestsPage account={createInitialAccount()} initialRequestId="request-transfer-2026" />))

    expect(document.activeElement).toBe(container.querySelector('#requests-title'))
    expect(container.querySelector('.request-detail')?.textContent).toContain('TRF-2026-004512')

    await act(async () => root.unmount())
    container.remove()
  })

  it('renders acknowledgement evidence and recoverable rejection in the existing Requests detail', () => {
    const account = createInitialAccount()
    const missing = renderToStaticMarkup(<RequestsPage account={account} initialRequestId="request-correction-2026" onCitizenAction={noop} />)
    expect(missing).toContain('Submitted')
    expect(missing).not.toContain('Request Not Confirmed')
    expect(missing).not.toContain('Check Existing Request')

    const rejected = {
      ...account.requests[0], id: 'request-rejected', state: 'rejected' as const,
      rejection: { originalRemark: 'Supporting wage month does not match selected contribution.', plainLanguageMeaning: 'The evidence points to a different month.', mismatch: 'Evidence says May 2026; request says June 2026.', correctableBy: 'Member', evidenceNeeded: ['June 2026 wage record'], recoveryAction: 'prepare' as const, requiresFreshSubmission: false },
    }
    const rejection = renderToStaticMarkup(<RequestsPage account={{ ...account, requests: [rejected] }} initialRequestId={rejected.id} onCitizenAction={noop} />)
    expect(rejection).toContain('Original rejection remark')
    expect(rejection).toContain('Evidence says May 2026; request says June 2026.')
    expect(rejection).toContain('A fresh submission is not required')
    expect(rejection).toContain('Prepare correction')
  })

  it('prefills the contextual contribution review without unrelated categories or re-entry', async () => {
    const account = createInitialAccount()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<ServicesPage account={account} initialService="grievance" initialEmploymentId="vertex" initialContributionId="vertex-2026-08" onSubmitTransfer={noop} onSubmitClaim={noop} onSubmitPanVerification={noop} onSubmitCorrection={noop} onSubmitGrievance={noop} onViewRequests={noop} />))

    await clickButton('Continue')
    expect(container.textContent).toContain('Salary MonthAugust 2026')
    expect(container.textContent).toContain('Employer PF Not Recorded')
    expect(container.querySelector<HTMLInputElement>('#grievance-support')?.value).toContain('Employer contribution record')
    expect(container.textContent).not.toContain('TXN-VTX-2026-08-0908')
    expect(container.textContent).not.toContain('Transfer Delay')
    expect(container.querySelector<HTMLSelectElement>('#grievance-category')?.disabled).toBe(true)

    await act(async () => root.unmount())
    container.remove()
  })

  it('shows a submitted transfer as in progress without offering a duplicate action', () => {
    const account = submitTransfer(createInitialAccount(), '2026-08-28')
    const services = renderToStaticMarkup(
      <ServicesPage account={account} initialService="transfer" onSubmitTransfer={noop} onSubmitClaim={noop} onSubmitPanVerification={noop} onSubmitCorrection={noop} onSubmitGrievance={noop} onViewRequests={noop} />,
    )
    const passbook = renderToStaticMarkup(
      <PassbookPage account={account} initialView="employers" initialContextId="harbor" onGenerateStatement={noop} onRaiseContributionGrievance={noop} onStartTransfer={noop} />,
    )

    expect(services).toContain('Transfer Already in Progress')
    expect(services).toContain('Track Request')
    expect(passbook).toContain('Transfer Is in Progress')
    expect(passbook).not.toContain('>Transfer Previous PF</button>')
  })

  it('renders editable account capabilities and both legal pages', () => {
    const account = addGeneratedReport(createInitialAccount(), { id: 'report-ready', name: 'EPFO Passbook Transactions', periodLabel: 'All Time', startsOn: '2018-08-01', endsOn: '2026-08-28', format: 'pdf', state: 'ready', requestedOn: '2026-08-28', generatedOn: '2026-08-28', expiresOn: '2026-11-26', deliveryState: 'not-requested' })
    const accountHtml = renderToStaticMarkup(<AccountPage account={account} onUpdateContact={noop} onUpdateCommunicationPreferences={noop} onDownloadReport={noop} onStartPanVerification={noop} onNavigateLegal={noop} />)
    const terms = renderToStaticMarkup(<LegalPage page="terms" onBack={noop} onNavigate={noop} />)
    const privacy = renderToStaticMarkup(<LegalPage page="privacy" onBack={noop} onNavigate={noop} />)

    expect(accountHtml).toContain('Add Email ID')
    expect(accountHtml).toContain('Edit Mobile Number')
    expect(accountHtml).toContain('KYC and Verification')
    expect(accountHtml).toContain('Generated Reports')
    expect(accountHtml).toContain('Add Nominee')
    expect(accountHtml).toContain('Your profile information is used to match your EPFO member record.')
    expect(accountHtml).toContain('Father’s/Husband’s name')
    expect(accountHtml).toContain('Cannot be changed after UAN activation')
    expect(accountHtml).toContain('Change Photograph')
    expect(accountHtml).toContain('profile-photo-card')
    expect(accountHtml).toContain('profile-updated-panel')
    expect(accountHtml).toContain('src/assets/ade4f4eb-8a5e-4290-b28f-f12b5db4ebb9.png')
    expect(accountHtml).toContain('account-report-actions')
    expect(accountHtml).not.toContain('Passport Photograph')
    expect(accountHtml).toContain('Photograph requirements')
    expect(accountHtml).toContain('JPEG or PNG')
    expect(accountHtml).toContain('Edit profile')
    expect(accountHtml).not.toContain('Choose photograph')
    expect(accountHtml).toContain('Contact Details')
    expect(accountHtml).toContain('Review the verification status of your identity and bank details.')
    expect(accountHtml).toContain('Download reports within 90 days of generation.')
    expect(accountHtml).toContain('PAN is associated with this account and needs verification.')
    expect(accountHtml).toContain('Unverified')
    expect(accountHtml).not.toContain('read-only in this prototype')
    expect(accountHtml).not.toContain('Mock delivery recorded')
    expect(accountHtml).not.toContain('synthetic account')
    expect(accountHtml).not.toContain('Member account')
    expect(accountHtml).not.toContain('Login and Security Settings')
    expect(accountHtml).not.toContain('Last password change')
    expect(accountHtml).not.toContain('Change password')
    expect(accountHtml).not.toContain('Legal and Privacy')
    expect(accountHtml).toContain('Save Preferences</button>')
    expect(accountHtml).toContain('disabled=""')
    expect(terms).toContain('Terms of Use')
    expect(privacy).toContain('Privacy Policy')
  })

  it('renders a saved legacy profile safely when an older date is absent', () => {
    const account = createInitialAccount()
    delete (account.member as Partial<typeof account.member>).profileUpdatedOn

    const html = renderToStaticMarkup(<AccountPage account={account} onUpdateContact={noop} onUpdateCommunicationPreferences={noop} onDownloadReport={noop} onNavigateLegal={noop} />)

    expect(html).toContain('Profile Last Updated</p><p class="ux4g-alert-message"><time>Not available')
    expect(html).toContain('Profile and Account')
  })

  it('reveals photo instructions on demand and allows only the intended profile fields to be edited', async () => {
    const onUpdateProfile = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<AccountPage account={createInitialAccount()} onUpdateContact={noop} onUpdateProfile={onUpdateProfile} onUpdateCommunicationPreferences={noop} onDownloadReport={noop} onNavigateLegal={noop} />))

    const photoInput = container.querySelector<HTMLInputElement>('input[type="file"]')
    const click = vi.spyOn(photoInput!, 'click')
    await act(async () => buttonNamed('Change Photograph')?.click())
    expect(click).toHaveBeenCalledOnce()
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain('JPEG or PNG')

    await act(async () => buttonNamed('Edit profile')?.click())
    expect(container.querySelector('#profile-name')).not.toBeNull()
    expect(container.querySelector('#profile-uan')).not.toBeNull()
    expect(container.querySelector('#profile-permanent-address')).not.toBeNull()
    expect(container.querySelector('#profile-current-address')).not.toBeNull()
    expect(container.querySelector('#profile-father-name')).toBeNull()
    expect(container.querySelector('#profile-relationship')).toBeNull()
    expect(container.querySelector('#profile-international-worker')).toBeNull()
    expect(container.querySelector('#profile-differently-abled')).toBeNull()

    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click())
    expect(onUpdateProfile).toHaveBeenCalledOnce()
    expect(onUpdateProfile.mock.calls[0]?.[0]).toMatchObject({ name: 'Arjun Mehta', uan: createInitialAccount().member.uan })

    await act(async () => root.unmount())
    container.remove()
  })

  it('edits and verifies only one contact channel at a time', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const onUpdateContact = vi.fn()
    await act(async () => root.render(<AccountPage account={createInitialAccount()} onUpdateContact={onUpdateContact} onUpdateCommunicationPreferences={noop} onDownloadReport={noop} onNavigateLegal={noop} />))

    const edit = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Add Email ID')
    await act(async () => edit?.click())
    expect(container.querySelector('#account-mobile')).toBeNull()
    expect(container.querySelector('#account-email')).not.toBeNull()
    expect(container.querySelectorAll<HTMLInputElement>('input[name="contact-channel"]')[1]?.checked).toBe(true)

    const mobileChoice = container.querySelectorAll<HTMLInputElement>('input[name="contact-channel"]')[0]
    await act(async () => mobileChoice?.click())
    expect(container.querySelector('#account-mobile')).not.toBeNull()
    expect(container.querySelector('#account-email')).toBeNull()

    const mobileInput = container.querySelector<HTMLInputElement>('#account-mobile')
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      valueSetter?.call(mobileInput, '123')
      mobileInput?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('Enter exactly 10 digits.')

    const emailChoice = container.querySelectorAll<HTMLInputElement>('input[name="contact-channel"]')[1]
    await act(async () => emailChoice.click())
    expect(container.querySelector('#account-mobile')).toBeNull()
    expect(container.querySelector('#account-email')).not.toBeNull()

    const emailInput = container.querySelector<HTMLInputElement>('#account-email')
    await act(async () => {
      valueSetter?.call(emailInput, 'not-an-email')
      emailInput?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('Enter a valid email address.')
    await act(async () => {
      valueSetter?.call(emailInput, 'member@example.in')
      emailInput?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('Use an email address you can access. We will send the verification code there.')

    await act(async () => container.querySelector<HTMLFormElement>('.contact-editor')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(container.textContent).toContain('Email OTP verification required')
    expect(container.textContent).toContain('A one-time password was sent to member@example.in.')

    const otpInput = container.querySelector<HTMLInputElement>('#contact-otp')
    await act(async () => {
      valueSetter?.call(otpInput, '123456')
      otpInput?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector<HTMLFormElement>('.contact-editor')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(container.textContent).toContain('Review your change')

    await clickButton('Save Contact Details')
    expect(onUpdateContact).toHaveBeenCalledWith(expect.objectContaining({ type: 'email', value: 'member@example.in' }))

    await act(async () => root.unmount())
    container.remove()
  })

  it('stores and renders multiple synthetic nominees whose shares total 100%', () => {
    const account = saveNominees(createInitialAccount(), [
      { id: 'nominee-kavya', name: 'Kavya Mehta', relationship: 'spouse', address: '12 Lake View Road, Bengaluru', bankAccountNumber: '123456789012', ifscCode: 'HDFC0001234', sharePercentage: 60, updatedOn: '2026-08-28' },
      { id: 'nominee-rohan', name: 'Rohan Mehta', relationship: 'child', address: '12 Lake View Road, Bengaluru', bankAccountNumber: '987654321098', ifscCode: 'SBIN0005678', sharePercentage: 40, updatedOn: '2026-08-28' },
    ])
    const html = renderToStaticMarkup(<AccountPage account={account} onUpdateContact={noop} onUpdateCommunicationPreferences={noop} onDownloadReport={noop} onNavigateLegal={noop} />)

    expect(account.member.nominees[0]?.name).toBe('Kavya Mehta')
    expect(html).toContain('Kavya Mehta')
    expect(account.member.nominees.reduce((sum, nominee) => sum + nominee.sharePercentage, 0)).toBe(100)
    expect(html).toContain('60% share')
    expect(html).toContain('40% share')
  })

  it('labels a pending PAN record as pending verification', () => {
    const account = createInitialAccount()
    account.kyc = account.kyc.map((record) => record.type === 'pan' ? { ...record, state: 'pending' as const } : record)
    const html = renderToStaticMarkup(<AccountPage account={account} onUpdateContact={noop} onUpdateCommunicationPreferences={noop} onDownloadReport={noop} onNavigateLegal={noop} />)

    expect(html).toContain('Pending Verification')
  })

  it('completes the transfer service flow and returns a trackable request', async () => {
    let account = createTransferEligibleAccount()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <ServicesPage
        account={account}
        initialService="transfer"
        onSubmitTransfer={(submittedOn, sourceMemberId) => {
          account = submitTransfer(account, submittedOn, sourceMemberId)
          return account.requests.find((request) => request.type === 'transfer')
        }}
        onSubmitClaim={noop}
        onSubmitPanVerification={noop}
        onSubmitCorrection={noop}
        onSubmitGrievance={noop}
        onViewRequests={noop}
      />,
    ))

    expect(container.textContent).toContain('Select a Previous Employment')
    await clickButton('Continue')
    await clickButton('Continue')
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click())
    await clickButton('Confirm and Submit Transfer')
    expect(container.textContent).toContain('Request Filed')
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
        initialContributionId="vertex-2026-08"
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

    expect(container.textContent).toContain('Grievance Attempt Saved')
    expect(container.textContent).toContain('Request ID')
    expect(account.requests.find((request) => request.contributionId === 'vertex-2026-08')?.reference).toMatch(/^GRV-/)
    await act(async () => root.unmount())
    container.remove()
  })
})
