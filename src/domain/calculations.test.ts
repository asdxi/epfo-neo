import { describe, expect, it } from 'vitest'
import {
  accountReconciliation,
  contributionIsReconciled,
  deriveAttentionItems,
  employerSummaries,
  interestFromMonthlyBalances,
  ledgerTransactions,
  reconcileMemberId,
  totalEpfBalance,
  totalEpsContributions,
  totalEpsServiceMonths,
} from './calculations'
import { createInitialAccount } from './data'
import { deriveRecordIssues } from './issues'
import { ACCOUNT_STORAGE_KEY, AUTHENTICATION_STORAGE_KEY, clearPersistedAccount, clearPersistedAuthentication, loadPersistedAccount, loadPersistedAuthentication, persistAccount, persistAuthentication } from './persistence'
import { buildExcelStatement, buildPdfStatement, createReportRecord, isReportExpired } from './reports'
import { completeTransferResolution, markReportReady, submitExit, submitGrievance, submitTransfer, transitionRequest } from './state'
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
    expect(totalEpfBalance(account)).toBe(188_094)
    expect(accountReconciliation(account).closingBalance).toBe(188_094)
  })

  it('reconciles every employer total with its Member ID transactions', () => {
    const account = createInitialAccount()
    const summaries = employerSummaries(account)
    expect(summaries.map((item) => item.closingBalance)).toEqual([0, 0, 38_450, 149_644])
    for (const summary of summaries) {
      expect(summary).toMatchObject(reconcileMemberId(account, summary.employment.memberId))
      expect(summary.closingBalance).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps statutory employee EPF, VPF, employer EPF and EPS separate', () => {
    const account = createInitialAccount()
    const reconciliation = accountReconciliation(account)
    expect(reconciliation.employeeContributions).toBe(138_600)
    expect(reconciliation.voluntaryContributions).toBe(7_200)
    expect(reconciliation.employerEpfContributions).toBe(41_800)
    expect(totalEpsContributions(account)).toBe(96_250)
    expect(totalEpsServiceMonths(account)).toBe(77)
    expect(totalEpfBalance(account)).not.toBe(188_094 + 96_250)
  })

  it('uses the approved statutory split for every salary month and VPF only at Pied Piper', () => {
    const contributions = createInitialAccount().ledger.contributions
    expect(contributions).toHaveLength(77)

    for (const record of contributions) {
      expect(record).toMatchObject({ pfWage: 15_000, employeeEpf: 1_800, eps: 1_250 })
      expect(record.voluntaryEpf).toBe(record.employmentId === 'vertex' ? 1_200 : 0)
      expect(record.employerEpf).toBe(record.id === 'vertex-2026-08' ? null : 550)
    }
  })

  it('keeps every completed transfer equal to the source closing balance at that point', () => {
    const account = createInitialAccount()
    const completed = account.ledger.transfers.filter((transfer) => transfer.state === 'completed')
    expect(completed.map((transfer) => transfer.amount)).toEqual([26_620, 101_137, 128_894])
    expect(reconcileMemberId(account, 'SDS/PF-TRUST/001842')).toMatchObject({ employeeContributions: 19_800, employerEpfContributions: 6_050, officialInterestCredits: 770, transfersOut: 26_620, closingBalance: 0 })
    expect(reconcileMemberId(account, 'DL/BLK/0019274')).toMatchObject({ employeeContributions: 75_600, employerEpfContributions: 23_100, officialInterestCredits: 20_817, transfersIn: 26_620, transfersOut: 101_137, withdrawals: 45_000, closingBalance: 0 })
    expect(reconcileMemberId(account, 'KA/HFI/0031849')).toMatchObject({ employeeContributions: 32_400, employerEpfContributions: 9_900, officialInterestCredits: 23_907, transfersIn: 101_137, transfersOut: 128_894, closingBalance: 38_450 })
    expect(reconcileMemberId(account, 'KA/VTX/0048291')).toMatchObject({ employeeContributions: 10_800, voluntaryContributions: 7_200, employerEpfContributions: 2_750, transfersIn: 128_894, closingBalance: 149_644 })
  })

  it('moves completed transfers without creating money', () => {
    const account = createInitialAccount()
    const reconciliation = accountReconciliation(account)
    expect(reconciliation.transfersIn).toBe(256_651)
    expect(reconciliation.transfersOut).toBe(256_651)
    expect(reconciliation.transfersIn - reconciliation.transfersOut).toBe(0)
  })

  it('does not move money when the transfer request is only submitted', () => {
    const account = createTransferEligibleAccount()
    const submitted = submitTransfer(account, '2026-08-28')
    expect(totalEpfBalance(submitted)).toBe(totalEpfBalance(account))
    expect(reconcileMemberId(submitted, 'KA/HFI/0031849').closingBalance).toBe(38_450)
    expect(submitted.ledger.transfers.at(-1)?.state).toBe('submitted')
    const pendingEntries = ledgerTransactions(submitted).filter((item) => item.id.includes('transfer-harbor-vertex-2026-08-28'))
    expect(pendingEntries.map((item) => item.amount)).toEqual([0, 0])
    expect(pendingEntries[0].recordedDateExplanation).toContain('posted amount is zero')
  })

  it('posts a completed pending transfer only to the destination without changing the total', () => {
    const before = createInitialAccount()
    const completed = completeTransferResolution(before, 'transfer-harbor-vertex-2026-06-18', '2026-09-04')

    expect(reconcileMemberId(completed, 'KA/HFI/0031849').closingBalance).toBe(0)
    expect(reconcileMemberId(completed, 'KA/VTX/0048291').closingBalance).toBe(188_094)
    expect(totalEpfBalance(completed)).toBe(188_094)
    expect(completed.requests.find((request) => request.id === 'request-transfer-2026')?.state).toBe('completed')
  })

  it('subtracts completed withdrawals and includes only official interest credits', () => {
    const account = createInitialAccount()
    const reconciliation = accountReconciliation(account)
    expect(reconciliation.withdrawals).toBe(45_000)
    expect(reconciliation.officialInterestCredits).toBe(45_494)
    expect(account.ledger.estimatedInterestAccruals).toEqual([])
    expect(totalEpfBalance(account)).toBe(188_094)
  })

  it('recomputes every credited interest amount from its persisted audit facts', () => {
    const credits = createInitialAccount().ledger.officialInterestCredits
    for (const credit of credits) {
      expect(interestFromMonthlyBalances(credit.monthlyBalanceTotal, credit.annualRateBasisPoints)).toBe(credit.amount)
    }
  })
})

describe('record integrity and validation', () => {
  it('stores Salary Month and Recorded On as distinct values', () => {
    const record = createInitialAccount().ledger.contributions.find((item) => item.id === 'vertex-2026-05')!
    expect(record.wageMonth).toBe('2026-05')
    expect(record.recordedOn).toBe('2026-06-08')
    expect(record.wageMonth).not.toBe(record.recordedOn?.slice(0, 7))
  })

  it('surfaces a contribution with an unavailable employer EPF amount', () => {
    const record = createInitialAccount().ledger.contributions.find((item) => item.id === 'vertex-2026-08')!
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
    expect(attention).toContainEqual(expect.objectContaining({ title: 'August Contribution', explanation: 'Employee EPF, VPF and EPS are recorded. Employer EPF is not recorded.' }))
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
    const account = submitGrievance(createInitialAccount(), { submittedOn: '2026-09-08', employmentId: 'vertex', contributionId: 'vertex-2026-08', category: 'Contribution Amount Needs Review', description: 'Please review the employer EPF amount.' })
    const grievance = account.requests.find((item) => item.contributionId === 'vertex-2026-08')!
    expect(grievance.reference).toMatch(/^GRV-/)
    expect(account.exceptions.find((item) => item.contributionId === 'vertex-2026-08')?.state).toBe('in-progress')
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
    expect(buildExcelStatement(account, excelReport)).toContain('Salary Month')
    expect(buildExcelStatement(account, excelReport)).toContain('VPF')
  })

  it('paginates an all-time PDF without dropping contribution rows', () => {
    const account = createInitialAccount()
    const report = createReportRecord({ id: 'report-all-pdf', periodLabel: 'All Time', startsOn: '2018-08-01', endsOn: '2026-08-28', format: 'pdf', requestedOn: '2026-08-28', background: false, deliverToEmail: false })
    const contents = new TextDecoder().decode(buildPdfStatement(account, report))
    expect(contents.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1)
    expect(contents).toContain('Stark Industries')
    expect(contents).toContain('Pied Piper')
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
    const loaded = loadPersistedAccount(storage)
    expect(loaded.requests.find((item) => item.type === 'transfer')?.state).toBe('submitted')
    expect(loaded.exceptions.find((item) => item.kind === 'previous-balance')?.issueSnapshot).toMatchObject({ ruleVersion: 'record-issue-rules/1.0.0', sourceSnapshotAt: '2026-08-28' })
    expect(deriveRecordIssues(loaded)[0].code).toBe('TRANSFER_IN_PROGRESS')
    stored = '{invalid json'
    expect(loadPersistedAccount(storage).version).toBe(9)
  })

  it('hydrates incomplete version 9 saved accounts before rendering', () => {
    const account = createInitialAccount()
    const incomplete = structuredClone(account) as Partial<typeof account>
    delete (incomplete.member as Partial<typeof account.member>).email
    const storage = { getItem: () => JSON.stringify(incomplete) }

    expect(loadPersistedAccount(storage).member.email.value).toBe(account.member.email.value)
  })

  it('resets older saved ledgers so VPF is never inferred during migration', () => {
    const oldAccount = { ...createInitialAccount(), version: 8 }
    const storage = { getItem: () => JSON.stringify(oldAccount) }
    const loaded = loadPersistedAccount(storage)

    expect(loaded.version).toBe(9)
    expect(loaded.ledger.contributions.every((record) => record.voluntaryEpf !== undefined)).toBe(true)
    expect(totalEpfBalance(loaded)).toBe(188_094)
  })

  it('updates employer names and portal voice in saved demo data', () => {
    const account = createInitialAccount()
    account.employments[0].employer = 'Stark Industries'
    account.employments[2].employer = 'Waystar Royco'
    account.requests[0].timeline[0].label = 'Submitted from Neo'
    const storage = { getItem: () => JSON.stringify(account) }

    const loaded = loadPersistedAccount(storage)
    expect(loaded.employments[0].employer).toBe('Stark Industries')
    expect(loaded.employments[2].employer).toBe('Waystar Royco')
    expect(loaded.requests[0].timeline[0].label).toBe('Request Filed')
  })

  it('clears only the persisted account key when resetting the demo', () => {
    const removed: string[] = []
    clearPersistedAccount({ removeItem: (key) => { removed.push(key) } })
    expect(removed).toEqual([ACCOUNT_STORAGE_KEY])
  })

  it('restores the intended deterministic hero state after clearing persisted account data', () => {
    let stored: string | null = null
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value },
      removeItem: (key: string) => { if (key === ACCOUNT_STORAGE_KEY) stored = null },
    }
    persistAccount(storage, completeTransferResolution(createInitialAccount(), 'transfer-harbor-vertex-2026-06-18', '2026-09-04'))
    expect(deriveRecordIssues(loadPersistedAccount(storage))[0].code).toBe('TRANSFER_COMPLETED')

    clearPersistedAccount(storage)
    const reset = loadPersistedAccount(storage)
    expect(totalEpfBalance(reset)).toBe(188_094)
    expect(deriveRecordIssues(reset).map((issue) => issue.code)).toEqual(['TRANSFER_IN_PROGRESS', 'CONTRIBUTION_COMPONENT_MISSING'])
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
