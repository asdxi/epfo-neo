import { describe, expect, it } from 'vitest'
import { arjunMehta } from './data'
import { balanceForEmployment, moneyBreakdown, pendingTransfers, reconcileEmployment, totalEpfBalance, totalEpsServiceMonths } from './calculations'

describe('EPF reconciliation', () => {
  it('reconciles every Member ID from recorded EPF transactions', () => {
    for (const employment of arjunMehta.employments) {
      const ledger = reconcileEmployment(employment)
      expect(ledger.closingBalance).toBe(balanceForEmployment(employment))
      expect(ledger.closingBalance).toBeGreaterThanOrEqual(0)
    }
  })

  it('does not add EPS contributions to the EPF balance', () => {
    expect(totalEpfBalance(arjunMehta)).toBe(482_650)
    expect(totalEpsServiceMonths(arjunMehta)).toBe(75)
    expect(totalEpfBalance(arjunMehta)).not.toBe(482_650 + 93_750)
  })

  it('does not post the pending remainder of the previous PF transfer', () => {
    const harbor = arjunMehta.employments.find(({ id }) => id === 'harbor')!
    expect(balanceForEmployment(harbor)).toBe(38_450)
    expect(pendingTransfers(arjunMehta)).toHaveLength(1)
    expect(pendingTransfers(arjunMehta)[0].amount).toBe(38_450)
  })

  it('surfaces the reported February discrepancy without inventing an EPF ledger entry', () => {
    expect(arjunMehta.contributionIssues).toEqual([expect.objectContaining({ month: '2026-02', state: 'needs-attention' })])
    expect(arjunMehta.employments.flatMap(({ contributions }) => contributions).some(({ month }) => month === '2026-02')).toBe(false)
  })

  it('makes the money movement explainable as a complete aggregate', () => {
    const totals = moneyBreakdown(arjunMehta)
    expect(totals.employeeContributions).toBe(310_200)
    expect(totals.employerEpfContributions).toBe(94_233)
    expect(totals.interest).toBe(123_217)
    expect(totals.withdrawals).toBe(45_000)
  })
})
