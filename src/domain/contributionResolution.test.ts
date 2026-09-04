import { describe, expect, it } from 'vitest'
import { createInitialAccount } from './data'
import { deriveContributionResolution } from './contributionResolution'

describe('contribution discrepancy resolution', () => {
  it('offers only the supported inconsistent-component category for June', () => {
    const resolution = deriveContributionResolution(createInitialAccount(), 'vertex-2026-06')!

    expect(resolution.validCategories).toEqual(['inconsistent-epf-eps-component'])
    expect(resolution.recordedComponents).toContainEqual({ label: 'Employer EPF', amount: null })
    expect(resolution.expectedComponents).toContainEqual({ label: 'Employer EPF', amount: 550 })
    expect(resolution.references).toEqual(['TXN-VTX-2026-06-0708', 'ECR-VTX-2026-06'])
    expect(resolution.preparedDescription).not.toMatch(/fraud|wrongdoing/i)
  })

  it('treats a late but complete contribution as valid and non-actionable', () => {
    const resolution = deriveContributionResolution(createInitialAccount(), 'vertex-2026-04')!

    expect(resolution.validCategories).toEqual(['late-recording'])
    expect(resolution.responsibleParty).toBe('none')
    expect(resolution.memberImpact).toContain('No correction is required')
  })

  it('derives missing, incorrect amount, wrong employer and wrong month only from explicit expectations', () => {
    const base = createInitialAccount()
    const template = base.ledger.contributions.find((item) => item.id === 'vertex-2026-06')!
    const cases = [
      { id: 'missing', patch: { employeeEpf: null, employerEpf: null, eps: null }, category: 'missing-contribution' },
      { id: 'amount', patch: { employeeEpf: 1_700, employerEpf: 550, eps: 1_250 }, category: 'incorrect-amount' },
      { id: 'employer', patch: { employmentId: 'harbor' }, category: 'wrong-employer' },
      { id: 'month', patch: { wageMonth: '2026-05' }, category: 'incorrect-wage-month' },
    ] as const

    for (const item of cases) {
      const account = createInitialAccount()
      account.ledger.contributions.push({ ...template, ...item.patch, id: item.id, status: item.id === 'missing' ? 'missing-contribution' : 'amount-needs-review' })
      expect(deriveContributionResolution(account, item.id)?.validCategories).toContain(item.category)
    }
  })
})
