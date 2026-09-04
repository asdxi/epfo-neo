import type {
  AccountState,
  AttentionItem,
  ContributionRecord,
  EmployerSummary,
  Employment,
  LedgerTransaction,
  Money,
  Reconciliation,
} from './types'

const sum = (values: ReadonlyArray<Money | null | undefined>): Money =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0)

export const epfAmountForContribution = (record: ContributionRecord): Money =>
  (record.employeeEpf ?? 0) + (record.employerEpf ?? 0)

export const totalDepositedForContribution = (record: ContributionRecord): Money =>
  epfAmountForContribution(record) + (record.eps ?? 0)

export function reconcileMemberId(account: AccountState, memberId: string): Reconciliation {
  const contributions = account.ledger.contributions.filter((item) => item.memberId === memberId)
  const employeeContributions = sum(contributions.map((item) => item.employeeEpf))
  const employerEpfContributions = sum(contributions.map((item) => item.employerEpf))
  const officialInterestCredits = sum(account.ledger.officialInterestCredits.filter((item) => item.memberId === memberId).map((item) => item.amount))
  const transfersIn = sum(account.ledger.transfers.filter((item) => item.toMemberId === memberId && item.state === 'completed').map((item) => item.amount))
  const transfersOut = sum(account.ledger.transfers.filter((item) => item.fromMemberId === memberId && item.state === 'completed').map((item) => item.amount))
  const withdrawals = sum(account.ledger.withdrawals.filter((item) => item.memberId === memberId).map((item) => item.amount))
  const openingBalance = 0

  return {
    openingBalance,
    employeeContributions,
    employerEpfContributions,
    officialInterestCredits,
    transfersIn,
    transfersOut,
    withdrawals,
    closingBalance: openingBalance + employeeContributions + employerEpfContributions + officialInterestCredits + transfersIn - transfersOut - withdrawals,
  }
}

export function totalEpfBalance(account: AccountState): Money {
  return sum(account.employments.map((employment) => reconcileMemberId(account, employment.memberId).closingBalance))
}

export function accountReconciliation(account: AccountState): Reconciliation {
  const summaries = account.employments.map((employment) => reconcileMemberId(account, employment.memberId))
  const result = summaries.reduce<Reconciliation>((totals, item) => ({
    openingBalance: totals.openingBalance + item.openingBalance,
    employeeContributions: totals.employeeContributions + item.employeeContributions,
    employerEpfContributions: totals.employerEpfContributions + item.employerEpfContributions,
    officialInterestCredits: totals.officialInterestCredits + item.officialInterestCredits,
    transfersIn: totals.transfersIn + item.transfersIn,
    transfersOut: totals.transfersOut + item.transfersOut,
    withdrawals: totals.withdrawals + item.withdrawals,
    closingBalance: totals.closingBalance + item.closingBalance,
  }), { openingBalance: 0, employeeContributions: 0, employerEpfContributions: 0, officialInterestCredits: 0, transfersIn: 0, transfersOut: 0, withdrawals: 0, closingBalance: 0 })
  return result
}

export function totalEpsContributions(account: AccountState): Money {
  return sum(account.ledger.contributions.map((item) => item.eps))
}

export function totalEpsServiceMonths(account: AccountState): number {
  return new Set(account.ledger.contributions.filter((item) => (item.eps ?? 0) > 0).map((item) => `${item.employmentId}:${item.wageMonth}`)).size
}

export function employerSummary(account: AccountState, employment: Employment): EmployerSummary {
  const reconciliation = reconcileMemberId(account, employment.memberId)
  const epsContributions = sum(account.ledger.contributions.filter((item) => item.employmentId === employment.id).map((item) => item.eps))
  const estimatedInterestAccrued = sum(account.ledger.estimatedInterestAccruals.filter((item) => item.memberId === employment.memberId).map((item) => item.amount))
  const relatedTransfer = account.ledger.transfers
    .filter((item) => item.fromMemberId === employment.memberId)
    .sort((a, b) => b.initiatedOn.localeCompare(a.initiatedOn))[0]
  const exception = account.exceptions.find((item) => item.kind === 'previous-balance' && item.employmentId === employment.id)
  const transferState = exception?.state === 'in-progress' ? 'submitted' : relatedTransfer?.state ?? 'not-applicable'
  return { ...reconciliation, employment, epsContributions, estimatedInterestAccrued, transferState }
}

export function employerSummaries(account: AccountState): EmployerSummary[] {
  return account.employments.map((employment) => employerSummary(account, employment))
}

export function currentEmployment(account: AccountState): Employment {
  const employment = account.employments.find((item) => item.status === 'current')
  if (!employment) throw new Error('Account must contain one current employment.')
  return employment
}

export function latestRecordedContribution(account: AccountState): ContributionRecord | undefined {
  return [...account.ledger.contributions]
    .filter((item) => item.recordedOn)
    .sort((a, b) => (b.recordedOn ?? '').localeCompare(a.recordedOn ?? ''))[0]
}

export function contributionNeedsAttention(record: ContributionRecord): boolean {
  return record.status === 'amount-needs-review' || record.status === 'missing-contribution'
}

export function contributionIsReconciled(record: ContributionRecord): boolean {
  if (record.status === 'awaiting-record') return true
  if (record.employeeEpf === null || record.employerEpf === null || record.eps === null) return false
  if (record.pfWage === null) return record.status !== 'amount-needs-review' && record.status !== 'missing-contribution'
  return record.employeeEpf + record.employerEpf + record.eps >= 0
}

export function deriveAttentionItems(account: AccountState): AttentionItem[] {
  const items: AttentionItem[] = account.exceptions
    .filter((exception) => exception.state !== 'resolved')
    .map((exception): AttentionItem => {
      if (exception.kind === 'previous-balance') {
        return exception.state === 'in-progress'
          ? { id: exception.id, priority: 'in-progress', title: 'Previous PF Transfer', explanation: `${formatMoney(exception.amount ?? 0)} is being processed.`, actionLabel: 'Track Transfer', route: 'requests', contextId: exception.relatedRequestId }
          : { id: exception.id, priority: 'action-required', title: 'Previous PF balance', explanation: `${formatMoney(exception.amount ?? 0)} remains with Harbor Foods.`, actionLabel: 'Transfer Balance', route: 'services', contextId: 'transfer' }
      }
      if (exception.kind === 'contribution-review') {
        return { id: exception.id, priority: 'action-required', title: 'June contribution', explanation: 'Employee EPF and EPS are recorded. Employer EPF is not recorded.', actionLabel: 'Review Contribution', route: 'passbook', contextId: exception.contributionId }
      }
      const kycLabel = (exception.kycType ?? 'pan').toUpperCase()
      return { id: exception.id, priority: exception.state === 'in-progress' ? 'in-progress' : 'action-required', title: `${kycLabel} verification`, explanation: 'Not yet complete.', actionLabel: exception.state === 'in-progress' ? 'View Status' : `Verify ${kycLabel}`, route: 'account', contextId: exception.kycType }
    })

  if (items.length < 3) {
    const latest = [...account.ledger.contributions]
      .filter((item) => item.status === 'recorded-correctly')
      .sort((a, b) => (b.recordedOn ?? '').localeCompare(a.recordedOn ?? ''))[0]
    if (latest) {
      items.push({
        id: `recorded-${latest.id}`,
        priority: 'good-to-know',
        title: 'Latest Contribution Recorded',
        explanation: `Wage month: ${formatWageMonth(latest.wageMonth)}. Recorded on: ${formatDate(latest.recordedOn)}.`,
        actionLabel: 'View Contribution',
        route: 'passbook',
        contextId: latest.id,
      })
    }
  }

  const rank = { 'action-required': 0, 'in-progress': 1, 'good-to-know': 2 }
  return items.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 3)
}

const employmentForMemberId = (account: AccountState, memberId: string): Employment => {
  const employment = account.employments.find((item) => item.memberId === memberId)
  if (!employment) throw new Error(`No employment found for Member ID ${memberId}`)
  return employment
}

export function ledgerTransactions(account: AccountState): LedgerTransaction[] {
  const transactions: LedgerTransaction[] = account.ledger.contributions.map((record) => ({
    id: record.id,
    date: record.recordedOn,
    wageMonth: record.wageMonth,
    memberId: record.memberId,
    employmentId: record.employmentId,
    type: 'contribution',
    amount: epfAmountForContribution(record),
    state: record.status,
    title: `Contribution for ${formatWageMonth(record.wageMonth)}`,
    explanation: record.explanation,
    recordedDateExplanation: record.recordedOn ? 'Recorded On is when the ledger received this entry. It is different from the Wage Month the contribution relates to.' : 'This contribution is still awaiting a recorded date.',
    needsAttention: contributionNeedsAttention(record),
  }))

  for (const credit of account.ledger.officialInterestCredits) {
    const employment = employmentForMemberId(account, credit.memberId)
    transactions.push({ id: credit.id, date: credit.creditedOn, memberId: credit.memberId, employmentId: employment.id, type: 'official-interest', amount: credit.amount, state: 'officially-credited', title: `Official Interest Credit ${credit.financialYear}`, explanation: 'This amount is an official ledger credit and is included in the EPF balance.', recordedDateExplanation: 'The date shown is the date of the official interest credit in this ledger.', needsAttention: false })
  }

  for (const estimate of account.ledger.estimatedInterestAccruals) {
    const employment = employmentForMemberId(account, estimate.memberId)
    transactions.push({ id: estimate.id, date: estimate.calculatedThrough, memberId: estimate.memberId, employmentId: employment.id, type: 'estimated-interest', amount: estimate.amount, state: 'estimate-not-credited', title: 'Estimated Interest Accrued', explanation: estimate.explanation, recordedDateExplanation: 'Calculated Through is an estimate date, not an official credit date.', needsAttention: false })
  }

  for (const transfer of account.ledger.transfers) {
    const from = employmentForMemberId(account, transfer.fromMemberId)
    const to = employmentForMemberId(account, transfer.toMemberId)
    transactions.push({ id: `${transfer.id}-out`, date: transfer.completedOn ?? transfer.initiatedOn, memberId: transfer.fromMemberId, employmentId: from.id, type: 'transfer-out', amount: transfer.state === 'completed' ? -transfer.amount : 0, state: transfer.state, title: `Transfer to ${to.employer}`, explanation: transfer.explanation, recordedDateExplanation: transfer.completedOn ? 'This is the date the transfer completed.' : `This is the date the ${formatMoney(transfer.amount)} transfer was started. The posted amount is zero because the money has not moved yet.`, needsAttention: transfer.state !== 'completed' })
    transactions.push({ id: `${transfer.id}-in`, date: transfer.completedOn ?? transfer.initiatedOn, memberId: transfer.toMemberId, employmentId: to.id, type: 'transfer-in', amount: transfer.state === 'completed' ? transfer.amount : 0, state: transfer.state, title: `Transfer from ${from.employer}`, explanation: transfer.explanation, recordedDateExplanation: transfer.completedOn ? 'This is the date the transfer completed.' : 'This is the date the transfer was started. The money has not moved yet.', needsAttention: false })
  }

  for (const withdrawal of account.ledger.withdrawals) {
    const employment = employmentForMemberId(account, withdrawal.memberId)
    transactions.push({ id: withdrawal.id, date: withdrawal.processedOn, memberId: withdrawal.memberId, employmentId: employment.id, type: 'withdrawal', amount: -withdrawal.amount, state: withdrawal.state, title: 'Completed Partial Withdrawal', explanation: withdrawal.explanation, recordedDateExplanation: 'This is the date the completed withdrawal reduced the EPF balance.', needsAttention: false })
  }

  return transactions.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

export const formatMoney = (value: Money): string => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(value)

export const formatDate = (value: string | null | undefined): string => value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
  : 'Not recorded'

export const formatWageMonth = (value: string): string =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))

export const maskMobile = (mobile: string): string => `${mobile.slice(0, 2)}••• ••${mobile.slice(-4)}`

export const maskEmail = (email: string): string => {
  const [name, domain] = email.split('@')
  return `${name.slice(0, Math.min(7, name.length))}•••@${domain}`
}
