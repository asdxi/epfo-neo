import { describe, expect, it } from 'vitest'
import {
  accountReconciliation,
  contributionIsReconciled,
  deriveAttentionItems,
  employerSummaries,
  reconcileMemberId,
  totalEpfBalance,
  totalEpsContributions,
  totalEpsServiceMonths,
} from './calculations'
import { createInitialAccount } from './data'
import { ACCOUNT_STORAGE_KEY, AUTHENTICATION_STORAGE_KEY, clearPersistedAccount, clearPersistedAuthentication, loadPersistedAccount, loadPersistedAuthentication, persistAccount, persistAuthentication } from './persistence'
import { buildExcelStatement, buildPdfStatement, createReportRecord, isReportExpired } from './reports'
import { markReportReady, submitExit, submitGrievance, submitTransfer, transitionRequest } from './state'
import { validateContribution, validateEmail, validateIndianMobile } from './validation'

const createTransferEligibleAccount = () => {
  const account = createInitialAccount()
  account.requests = account.requests.filter((request) => request.type !== 'transfer')
  account.ledger.transfers = account.ledger.transfers.filter((transfer) => transfer.id !== 'transfer-harbor-vertex-2026-06-18')
  account.exceptions = account.exceptions.map((exception) => exception.kind === 'previous-balance' ? { ...exception, state: 'open', relatedRequestId: undefined } : exception)
  return account
}

describe('v0.2 financial reconciliation', () => {
  it('reconciles the headline balance from the underlying ledger', () => {
    const account = createInitialAccount()
    expect(totalEpfBalance(account)).toBe(482_650)
    expect(accountReconciliation(account).closingBalance).toBe(482_650)
  })

  it('reconciles every employer total with its Member ID transactions', () => {
    const account = createInitialAccount()
    const summaries = employerSummaries(account)
    expect(summaries.map((item) => item.closingBalance)).toEqual([0, 0, 38_450, 444_200])
    for (const summary of summaries) {
      expect(summary).toMatchObject(reconcileMemberId(account, summary.employment.memberId))
      expect(summary.closingBalance).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps employee EPF, employer EPF and EPS separate', () => {
    const account = createInitialAccount()
    const reconciliation = accountReconciliation(account)
    expect(reconciliation.employeeContributions).toBe(310_200)
    expect(reconciliation.employerEpfContributions).toBe(94_233)
    expect(totalEpsContributions(account)).toBe(93_750)
    expect(totalEpsServiceMonths(account)).toBe(75)
    expect(totalEpfBalance(account)).not.toBe(482_650 + 93_750)
  })

  it('moves completed transfers without creating money', () => {
    const account = createInitialAccount()
    const reconciliation = accountReconciliation(account)
    expect(reconciliation.transfersIn).toBe(722_050)
    expect(reconciliation.transfersOut).toBe(722_050)
    expect(reconciliation.transfersIn - reconciliation.transfersOut).toBe(0)
  })

  it('does not move money when the transfer request is only submitted', () => {
    const account = createTransferEligibleAccount()
    const submitted = submitTransfer(account, '2026-08-28')
    expect(totalEpfBalance(submitted)).toBe(totalEpfBalance(account))
    expect(reconcileMemberId(submitted, 'KA/HFI/0031849').closingBalance).toBe(38_450)
    expect(submitted.ledger.transfers.at(-1)?.state).toBe('submitted')
  })

  it('subtracts completed withdrawals and includes only official interest credits', () => {
    const account = createInitialAccount()
    const reconciliation = accountReconciliation(account)
    expect(reconciliation.withdrawals).toBe(45_000)
    expect(reconciliation.officialInterestCredits).toBe(123_217)
    expect(account.ledger.estimatedInterestAccruals[0].amount).toBe(6_480)
    expect(totalEpfBalance(account)).toBe(482_650)
  })
})

describe('record integrity and validation', () => {
  it('stores Wage Month and Recorded On as distinct values', () => {
    const record = createInitialAccount().ledger.contributions.find((item) => item.id === 'vertex-2026-05')!
    expect(record.wageMonth).toBe('2026-05')
    expect(record.recordedOn).toBe('2026-06-08')
    expect(record.wageMonth).not.toBe(record.recordedOn?.slice(0, 7))
  })

  it('surfaces a contribution with an unavailable employer EPF amount', () => {
    const record = createInitialAccount().ledger.contributions.find((item) => item.id === 'vertex-2026-06')!
    expect(record.employerEpf).toBeNull()
    expect(record.status).toBe('amount-needs-review')
    expect(contributionIsReconciled(record)).toBe(false)
    expect(validateContribution(record)).toEqual([])
  })

  it('validates Indian mobile numbers and email addresses', () => {
    for (const mobile of ['6876543210', '7876543210', '8876543210', '9876543210']) expect(validateIndianMobile(mobile)).toBeNull()
    expect(validateIndianMobile('3876543210')).toMatch(/beginning/)
    expect(validateIndianMobile('5876543210')).toMatch(/beginning/)
    expect(validateIndianMobile('987654321')).toMatch(/exactly 10/)
    expect(validateIndianMobile('98abc')).toMatch(/digits only/)
    expect(validateEmail(' arjun@example.in ')).toBeNull()
    expect(validateEmail('arjun@invalid')).toMatch(/valid email/)
  })
})

describe('derived attention and connected request state', () => {
  it('derives attention items from account exceptions', () => {
    const attention = deriveAttentionItems(createInitialAccount())
    expect(attention).toHaveLength(3)
    expect(attention.filter((item) => item.priority === 'action-required')).toHaveLength(2)
    expect(attention.map((item) => item.title)).toContain('Previous PF Transfer')
    expect(attention).toContainEqual(expect.objectContaining({ title: 'June contribution', explanation: 'Employee EPF and EPS are recorded. Employer EPF is not recorded.' }))
  })

  it('creates a transfer request and updates the related attention surface', () => {
    const account = submitTransfer(createTransferEligibleAccount(), '2026-08-28')
    const request = account.requests.find((item) => item.type === 'transfer')!
    expect(request.reference).toMatch(/^TRF-/)
    expect(request.state).toBe('submitted')
    expect(deriveAttentionItems(account)).toContainEqual(expect.objectContaining({ title: 'Previous PF Transfer', priority: 'in-progress', contextId: request.id }))
    expect(submitTransfer(account, '2026-08-28').requests.filter((item) => item.type === 'transfer')).toHaveLength(1)
  })

  it('creates and transitions a contribution grievance', () => {
    const account = submitGrievance(createInitialAccount(), { submittedOn: '2026-08-28', employmentId: 'vertex', contributionId: 'vertex-2026-06', category: 'Contribution Amount Needs Review', description: 'Please review the employer EPF amount.' })
    const grievance = account.requests.find((item) => item.contributionId === 'vertex-2026-06')!
    expect(grievance.reference).toMatch(/^GRV-/)
    expect(account.exceptions.find((item) => item.contributionId === 'vertex-2026-06')?.state).toBe('in-progress')
    expect(transitionRequest(account, grievance.id, 'in-progress', '2026-08-29').requests.find((item) => item.id === grievance.id)?.state).toBe('in-progress')
  })

  it('expires generated reports after 90 days', () => {
    const report = createReportRecord({ id: 'report-1', periodLabel: '1 Year', startsOn: '2025-08-01', endsOn: '2026-08-28', format: 'pdf', requestedOn: '2026-08-28', background: false, deliverToEmail: false })
    expect(report.expiresOn).toBe('2026-11-26')
    expect(isReportExpired(report, '2026-11-26')).toBe(false)
    expect(isReportExpired(report, '2026-11-27')).toBe(true)
  })

  it('builds real PDF and Excel-compatible statement payloads', () => {
    const account = createInitialAccount()
    const pdfReport = createReportRecord({ id: 'report-pdf', periodLabel: '1 Year', startsOn: '2025-08-01', endsOn: '2026-08-28', format: 'pdf', requestedOn: '2026-08-28', background: false, deliverToEmail: false })
    const excelReport = { ...pdfReport, id: 'report-excel', format: 'excel' as const }
    expect(new TextDecoder().decode(buildPdfStatement(account, pdfReport))).toMatch(/^%PDF-1\.4/)
    expect(new TextDecoder().decode(buildPdfStatement(account, pdfReport))).toContain('%%EOF')
    expect(buildExcelStatement(account, excelReport)).toContain('<?mso-application progid="Excel.Sheet"?>')
    expect(buildExcelStatement(account, excelReport)).toContain('Wage Month')
  })

  it('paginates an all-time PDF without dropping contribution rows', () => {
    const account = createInitialAccount()
    const report = createReportRecord({ id: 'report-all-pdf', periodLabel: 'All Time', startsOn: '2018-08-01', endsOn: '2026-08-28', format: 'pdf', requestedOn: '2026-08-28', background: false, deliverToEmail: false })
    const contents = new TextDecoder().decode(buildPdfStatement(account, report))
    expect(contents.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1)
    expect(contents).toContain('Northstar Consumer Tech')
    expect(contents).toContain('Vertex Mobility')
    expect(contents).toContain('Page 1 of')
    expect(contents).toContain(`Page ${contents.match(/\/Type \/Page\b/g)?.length} of`)
  })

  it('moves a background report from preparing to ready', () => {
    const account = createInitialAccount()
    const report = createReportRecord({ id: 'report-all', periodLabel: 'All Time', startsOn: '2018-08-01', endsOn: '2026-08-28', format: 'pdf', requestedOn: '2026-08-28', background: true, deliverToEmail: true })
    const ready = markReportReady({ ...account, generatedReports: [report] }, report.id, '2026-08-28').generatedReports[0]
    expect(ready.state).toBe('ready')
    expect(ready.generatedOn).toBe('2026-08-28')
  })

  it('persists and restores the connected account state safely', () => {
    let stored: string | null = null
    const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value } }
    const submitted = submitTransfer(createTransferEligibleAccount(), '2026-08-28')
    persistAccount(storage, submitted)
    expect(loadPersistedAccount(storage).requests.find((item) => item.type === 'transfer')?.state).toBe('submitted')
    stored = '{invalid json'
    expect(loadPersistedAccount(storage).version).toBe(3)
  })

  it('hydrates incomplete version 3 saved accounts before rendering', () => {
    const account = createInitialAccount()
    const incomplete = structuredClone(account) as Partial<typeof account>
    delete (incomplete.member as Partial<typeof account.member>).email
    const storage = { getItem: () => JSON.stringify(incomplete) }

    expect(loadPersistedAccount(storage).member.email.value).toBe(account.member.email.value)
  })

  it('clears only the persisted account key when resetting the demo', () => {
    const removed: string[] = []
    clearPersistedAccount({ removeItem: (key) => { removed.push(key) } })
    expect(removed).toEqual([ACCOUNT_STORAGE_KEY])
  })

  it('persists authentication across reloads and clears it on sign out', () => {
    let authenticated: string | null = null
    const storage = {
      getItem: () => authenticated,
      setItem: (_key: string, value: string) => { authenticated = value },
      removeItem: (key: string) => { if (key === AUTHENTICATION_STORAGE_KEY) authenticated = null },
    }

    expect(loadPersistedAuthentication(storage)).toBe(false)
    persistAuthentication(storage)
    expect(loadPersistedAuthentication(storage)).toBe(true)
    clearPersistedAuthentication(storage)
    expect(loadPersistedAuthentication(storage)).toBe(false)
    expect(AUTHENTICATION_STORAGE_KEY).not.toBe(ACCOUNT_STORAGE_KEY)
  })

  it('records an Aadhaar-verified exit request against the selected employment', () => {
    const account = createInitialAccount()
    const updated = submitExit(account, { submittedOn: '2026-08-28', employmentId: 'harbor', exitedOn: '2024-06-30', reason: 'Cessation (short service) – any other reason' })
    const request = updated.requests[0]
    expect(request.type).toBe('exit')
    expect(request.employmentId).toBe('harbor')
    expect(request.reference).toMatch(/^EXT-2026-/)
    expect(request.timeline[0].explanation).toContain('2024-06-30')
  })

  it('removes stale synthetic wording from persisted member-facing copy', () => {
    const account = createInitialAccount()
    account.kyc[0] = { ...account.kyc[0], explanation: 'Aadhaar is verified for this synthetic account.' }
    const storage = { getItem: () => JSON.stringify(account) }
    expect(loadPersistedAccount(storage).kyc[0].explanation).toBe('Aadhaar is verified for this account.')
  })
})
