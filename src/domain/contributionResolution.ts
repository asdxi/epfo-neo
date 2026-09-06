import { formatDate, formatMoney, formatWageMonth } from './calculations'
import { contributionComponentLabel, contributionDiscrepancyLabel } from './issueContent'
import type { AccountState, ContributionDiscrepancyCategory, ContributionResolution, Money } from './types'

const differs = (recorded: Money | null, expected: Money | null) =>
  recorded !== null && expected !== null && recorded !== expected

export function deriveContributionResolution(account: AccountState, contributionId: string): ContributionResolution | undefined {
  const contribution = account.ledger.contributions.find((item) => item.id === contributionId)
  const expectation = contribution?.expectedRecord
  const employment = account.employments.find((item) => item.id === contribution?.employmentId)
  const expectedEmployment = account.employments.find((item) => item.id === expectation?.employmentId)
  if (!contribution || !expectation || !employment || !expectedEmployment) return undefined

  const recordedComponents = [
    { code: 'employee-epf' as const, amount: contribution.employeeEpf },
    { code: 'voluntary-epf' as const, amount: contribution.voluntaryEpf },
    { code: 'employer-epf' as const, amount: contribution.employerEpf },
    { code: 'eps' as const, amount: contribution.eps },
  ]
  const expectedComponents = [
    { code: 'employee-epf' as const, amount: expectation.employeeEpf },
    { code: 'voluntary-epf' as const, amount: expectation.voluntaryEpf },
    { code: 'employer-epf' as const, amount: expectation.employerEpf },
    { code: 'eps' as const, amount: expectation.eps },
  ]
  const allRecordedMissing = recordedComponents.every((item) => item.amount === null)
  const someRecordedMissing = !allRecordedMissing && recordedComponents.some((item) => item.amount === null)
  const complete = recordedComponents.every((item) => item.amount !== null)
  const amountMismatch = recordedComponents.some((item, index) => differs(item.amount, expectedComponents[index].amount))
  const validCategories: ContributionDiscrepancyCategory[] = []

  if (allRecordedMissing) validCategories.push('missing-contribution')
  if (someRecordedMissing) validCategories.push('inconsistent-epf-eps-component')
  if (complete && amountMismatch) validCategories.push('incorrect-amount')
  if (expectation.employmentId !== contribution.employmentId) validCategories.push('wrong-employer')
  if (expectation.wageMonth !== contribution.wageMonth) validCategories.push('incorrect-wage-month')
  if (contribution.status === 'recorded-late' && complete && !amountMismatch) validCategories.push('late-recording')
  if (validCategories.length === 0) return undefined

  const category = validCategories[0]
  const missingComponents = recordedComponents
    .filter((item, index) => item.amount === null && expectedComponents[index].amount !== null)
    .map((item) => item.code)
  const recordedEpfComponents = [contribution.employeeEpf, contribution.voluntaryEpf, contribution.employerEpf]
    .filter((amount): amount is number => amount !== null)
  const recordedEpf = recordedEpfComponents.length > 0
    ? recordedEpfComponents.reduce((total, amount) => total + amount, 0)
    : null
  const memberImpact = category === 'late-recording'
    ? 'The contribution is complete and recorded. No correction is required.'
    : recordedEpf === null
      ? 'EPF is not recorded for this Salary Month. Review is needed before any effect can be confirmed.'
      : `${formatMoney(recordedEpf)} of EPF is currently recorded for this Salary Month. Review is needed before any remaining effect can be confirmed.`

  return {
    category,
    validCategories,
    categoryLabel: contributionDiscrepancyLabel(category),
    expectedComponents,
    recordedComponents,
    missingComponents,
    expectedEmployer: expectedEmployment.employer,
    expectedWageMonth: expectation.wageMonth,
    expectationBasis: expectation.basis,
    references: [contribution.transactionReference, expectation.reference].filter((item): item is string => Boolean(item)),
    evidenceHeld: expectation.evidenceHeld,
    evidenceMemberMayNeed: expectation.evidenceMemberMayNeed,
    preparedDescription: `${contributionDiscrepancyLabel(category)} for ${expectedEmployment.employer}, Salary Month ${formatWageMonth(expectation.wageMonth)}. Recorded on ${formatDate(contribution.recordedOn)}. ${recordedComponents.map((item) => `${contributionComponentLabel(item.code)}: ${item.amount === null ? 'not recorded' : formatMoney(item.amount)}`).join('; ')}.`,
    responsibleParty: category === 'late-recording' ? 'none' : 'member',
    memberImpact,
  }
}

export { contributionDiscrepancyLabel } from './issueContent'
