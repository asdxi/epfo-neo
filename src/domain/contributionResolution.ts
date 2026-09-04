import { formatDate, formatMoney, formatWageMonth } from './calculations'
import type { AccountState, ContributionDiscrepancyCategory, ContributionResolution, Money } from './types'

const labels: Record<ContributionDiscrepancyCategory, string> = {
  'missing-contribution': 'Contribution not recorded',
  'incorrect-amount': 'Recorded amount differs from expected record',
  'wrong-employer': 'Contribution linked to the wrong employer',
  'incorrect-wage-month': 'Contribution linked to the wrong Wage Month',
  'late-recording': 'Contribution recorded late',
  'inconsistent-epf-eps-component': 'EPF or EPS component is incomplete',
}

const differs = (recorded: Money | null, expected: Money | null) =>
  recorded !== null && expected !== null && recorded !== expected

export function deriveContributionResolution(account: AccountState, contributionId: string): ContributionResolution | undefined {
  const contribution = account.ledger.contributions.find((item) => item.id === contributionId)
  const expectation = contribution?.expectedRecord
  const employment = account.employments.find((item) => item.id === contribution?.employmentId)
  const expectedEmployment = account.employments.find((item) => item.id === expectation?.employmentId)
  if (!contribution || !expectation || !employment || !expectedEmployment) return undefined

  const recordedComponents = [
    { label: 'Employee EPF', amount: contribution.employeeEpf },
    { label: 'Employer EPF', amount: contribution.employerEpf },
    { label: 'EPS', amount: contribution.eps },
  ]
  const expectedComponents = [
    { label: 'Employee EPF', amount: expectation.employeeEpf },
    { label: 'Employer EPF', amount: expectation.employerEpf },
    { label: 'EPS', amount: expectation.eps },
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
  const recordedEpf = (contribution.employeeEpf ?? 0) + (contribution.employerEpf ?? 0)
  const memberImpact = category === 'late-recording'
    ? 'The contribution is complete and recorded. No correction is required.'
    : `${formatMoney(recordedEpf)} of EPF is currently recorded for this Wage Month. Review is needed before any remaining effect can be confirmed.`

  return {
    category,
    validCategories,
    categoryLabel: labels[category],
    expectedComponents,
    recordedComponents,
    expectedEmployer: expectedEmployment.employer,
    expectedWageMonth: expectation.wageMonth,
    expectationBasis: expectation.basis,
    references: [contribution.transactionReference, expectation.reference].filter((item): item is string => Boolean(item)),
    evidenceHeld: expectation.evidenceHeld,
    evidenceMemberMayNeed: expectation.evidenceMemberMayNeed,
    preparedDescription: `${labels[category]} for ${expectedEmployment.employer}, Wage Month ${formatWageMonth(expectation.wageMonth)}. Recorded on ${formatDate(contribution.recordedOn)}. ${recordedComponents.map((item) => `${item.label}: ${item.amount === null ? 'not recorded' : formatMoney(item.amount)}`).join('; ')}.`,
    responsibleParty: category === 'late-recording' ? 'none' : 'member',
    memberImpact,
  }
}

export const contributionDiscrepancyLabel = (category: ContributionDiscrepancyCategory) => labels[category]
