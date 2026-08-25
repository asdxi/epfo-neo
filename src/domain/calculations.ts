import type { Contribution, Employment, Money, Person, Reconciliation, Transfer } from './types'

const sum = (values: readonly Money[]): Money => values.reduce((total, value) => total + value, 0)

export function isPostedTransfer(transfer: Transfer): boolean {
  return transfer.status === 'completed'
}

export function reconcileEmployment(employment: Employment): Reconciliation {
  const employeeContributions = sum(employment.contributions.map(({ employeeEpf }) => employeeEpf))
  const employerEpfContributions = sum(
    employment.contributions.map(({ employerEpf }) => employerEpf ?? 0),
  )
  const interest = sum(employment.interestCredits.map(({ amount }) => amount))
  const transfersIn = sum(
    employment.transfers
      .filter((transfer) => transfer.toMemberId === employment.memberId && isPostedTransfer(transfer))
      .map(({ amount }) => amount),
  )
  const transfersOut = sum(
    employment.transfers
      .filter((transfer) => transfer.fromMemberId === employment.memberId && isPostedTransfer(transfer))
      .map(({ amount }) => amount),
  )
  const withdrawals = sum(employment.withdrawals.map(({ amount }) => amount))

  return {
    openingBalance: employment.openingBalance,
    employeeContributions,
    employerEpfContributions,
    interest,
    transfersIn,
    transfersOut,
    withdrawals,
    closingBalance:
      employment.openingBalance +
      employeeContributions +
      employerEpfContributions +
      interest +
      transfersIn -
      transfersOut -
      withdrawals,
  }
}

/** Returns the balance in each account; completed transfers are reflected only in their destination. */
export function balanceForEmployment(employment: Employment): Money {
  return reconcileEmployment(employment).closingBalance
}

/** Total EPF across all Member IDs. EPS contributions are intentionally excluded. */
export function totalEpfBalance(person: Person): Money {
  return sum(person.employments.map(balanceForEmployment))
}

export function totalEpsServiceMonths(person: Person): number {
  return person.employments.reduce((total, employment) => total + employment.epsService.months, 0)
}

export function pendingTransfers(person: Person): Transfer[] {
  return person.employments.flatMap((employment) =>
    employment.transfers.filter((transfer) => transfer.status === 'pending' || transfer.status === 'processing'),
  )
}

export function contributionStatus(contribution: Contribution): 'correct' | 'needs-attention' {
  return contribution.status === 'missing' || contribution.status === 'needs-attention'
    ? 'needs-attention'
    : 'correct'
}

export function moneyBreakdown(person: Person): Omit<Reconciliation, 'openingBalance' | 'closingBalance'> {
  return person.employments.reduce<Omit<Reconciliation, 'openingBalance' | 'closingBalance'>>(
    (totals, employment) => {
      const reconciliation = reconcileEmployment(employment)
      return {
        employeeContributions: totals.employeeContributions + reconciliation.employeeContributions,
        employerEpfContributions: totals.employerEpfContributions + reconciliation.employerEpfContributions,
        interest: totals.interest + reconciliation.interest,
        transfersIn: totals.transfersIn + reconciliation.transfersIn,
        transfersOut: totals.transfersOut + reconciliation.transfersOut,
        withdrawals: totals.withdrawals + reconciliation.withdrawals,
      }
    },
    { employeeContributions: 0, employerEpfContributions: 0, interest: 0, transfersIn: 0, transfersOut: 0, withdrawals: 0 },
  )
}
