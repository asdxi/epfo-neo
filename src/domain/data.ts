import type { Contribution, Employment, Money, Person } from './types'

const monthsBetween = (first: string, last: string): string[] => {
  const [firstYear, firstMonth] = first.split('-').map(Number)
  const [lastYear, lastMonth] = last.split('-').map(Number)
  const months: string[] = []
  for (let year = firstYear, month = firstMonth; year < lastYear || (year === lastYear && month <= lastMonth); ) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month === 13) {
      year += 1
      month = 1
    }
  }
  return months
}

const apportioned = (total: Money, count: number): Money[] => {
  const base = Math.floor(total / count)
  return Array.from({ length: count }, (_, index) => base + (index < total % count ? 1 : 0))
}

const monthlyContributions = (
  prefix: string,
  first: string,
  last: string,
  employeeTotal: Money,
  employerTotal: Money,
  epsTotal: Money,
): Contribution[] => {
  const months = monthsBetween(first, last)
  const employees = apportioned(employeeTotal, months.length)
  const employers = apportioned(employerTotal, months.length)
  const eps = apportioned(epsTotal, months.length)
  return months.map((month, index) => ({
    id: `${prefix}-${month}`,
    month,
    pfWage: null,
    employeeEpf: employees[index],
    employerEpf: employers[index],
    eps: eps[index],
    status: 'received',
  }))
}

const northstar = (): Employment => ({
  id: 'northstar',
  employer: 'Northstar Consumer Technologies',
  memberId: 'DL/NST/0001842',
  provider: 'employer-pf-trust',
  joinedOn: '2018-08-01',
  exitedOn: '2019-06-30',
  status: 'transferred',
  dataConfidence: 'partial',
  dataConfidenceNote: 'EPFO has transfer information for this employment, but the original monthly trust ledger is only available as a partial extract.',
  openingBalance: 0,
  contributions: monthlyContributions('nst', '2018-08', '2019-06', 27_000, 8_250, 13_750),
  interestCredits: [{ id: 'nst-interest-2019', creditedOn: '2019-06-30', financialYear: '2018–19', amount: 7_530, status: 'verified' }],
  transfers: [{ id: 'transfer-nst-blk', fromMemberId: 'DL/NST/0001842', toMemberId: 'DL/BLK/0019274', amount: 42_780, initiatedOn: '2019-07-05', completedOn: '2019-07-24', status: 'completed', source: 'employer-pf-trust', note: 'Trust-originated balance transferred to EPFO.' }],
  withdrawals: [],
  claims: [],
  epsService: { months: 11, contributions: 13_750, status: 'received', explanation: 'EPS is a pension service record, not an EPF cash balance.' },
})

const bluekite = (): Employment => ({
  id: 'bluekite', employer: 'BlueKite Digital Services', memberId: 'DL/BLK/0019274', provider: 'epfo', joinedOn: '2019-07-01', exitedOn: '2022-12-31', status: 'closed', dataConfidence: 'complete', openingBalance: 0,
  contributions: monthlyContributions('blk', '2019-07', '2022-12', 132_000, 40_333, 52_500),
  interestCredits: [
    { id: 'blk-interest-2020', creditedOn: '2020-03-31', financialYear: '2019–20', amount: 12_400, status: 'verified' },
    { id: 'blk-interest-2021', creditedOn: '2021-03-31', financialYear: '2020–21', amount: 17_500, status: 'verified' },
    { id: 'blk-interest-2022', creditedOn: '2022-03-31', financialYear: '2021–22', amount: 20_200, status: 'verified' },
    { id: 'blk-interest-2023', creditedOn: '2023-03-31', financialYear: '2022–23', amount: 23_707, status: 'verified' },
  ],
  transfers: [
    { id: 'transfer-nst-blk', fromMemberId: 'DL/NST/0001842', toMemberId: 'DL/BLK/0019274', amount: 42_780, initiatedOn: '2019-07-05', completedOn: '2019-07-24', status: 'completed', source: 'employer-pf-trust' },
    { id: 'transfer-blk-hfi', fromMemberId: 'DL/BLK/0019274', toMemberId: 'KA/HFI/0031849', amount: 243_920, initiatedOn: '2023-01-09', completedOn: '2023-01-28', status: 'completed', source: 'epfo' },
  ],
  withdrawals: [{ id: 'withdrawal-blk-2022', amount: 45_000, processedOn: '2022-08-19', status: 'withdrawn', claimId: 'claim-blk-2022' }],
  claims: [{ id: 'claim-blk-2022', kind: 'partial-withdrawal', submittedOn: '2022-08-05', amount: 45_000, status: 'completed', currentStatusMessage: 'Your partial withdrawal was completed.', nextStep: 'No action is needed.' }],
  epsService: { months: 42, contributions: 52_500, status: 'received', explanation: 'EPS contributions support pension service and are excluded from EPF balance.' },
})

const harbor = (): Employment => ({
  id: 'harbor', employer: 'Harbor Foods India', memberId: 'KA/HFI/0031849', provider: 'epfo', joinedOn: '2023-01-01', exitedOn: '2024-06-30', status: 'needs-attention', dataConfidence: 'complete', openingBalance: 0,
  contributions: monthlyContributions('hfi', '2023-01', '2024-06', 144_000, 44_000, 22_500),
  interestCredits: [
    { id: 'hfi-interest-2024', creditedOn: '2024-03-31', financialYear: '2023–24', amount: 18_600, status: 'verified' },
    { id: 'hfi-interest-2025', creditedOn: '2025-03-31', financialYear: '2024–25', amount: 23_280, status: 'verified' },
  ],
  transfers: [
    { id: 'transfer-blk-hfi', fromMemberId: 'DL/BLK/0019274', toMemberId: 'KA/HFI/0031849', amount: 243_920, initiatedOn: '2023-01-09', completedOn: '2023-01-28', status: 'completed', source: 'epfo' },
    { id: 'transfer-hfi-vtx-completed', fromMemberId: 'KA/HFI/0031849', toMemberId: 'KA/VTX/0048291', amount: 435_350, initiatedOn: '2026-03-08', completedOn: '2026-04-01', status: 'completed', source: 'epfo', note: 'Part of this previous balance has been transferred.' },
    { id: 'transfer-hfi-vtx-pending', fromMemberId: 'KA/HFI/0031849', toMemberId: 'KA/VTX/0048291', amount: 38_450, initiatedOn: '2026-04-02', status: 'pending', source: 'epfo', note: 'EPFO is processing the remaining previous PF balance.' },
  ],
  withdrawals: [], claims: [{ id: 'claim-transfer-hfi-vtx', kind: 'pf-transfer', submittedOn: '2026-03-08', amount: 38_450, status: 'processing', currentStatusMessage: 'EPFO is processing the remaining transfer.', nextStep: 'You do not need to do anything right now.' }],
  epsService: { months: 18, contributions: 22_500, status: 'received', explanation: 'EPS is recorded separately as pension service.' },
})

const vertex = (): Employment => ({
  id: 'vertex', employer: 'Vertex Mobility', memberId: 'KA/VTX/0048291', provider: 'epfo', joinedOn: '2026-03-01', status: 'current', dataConfidence: 'complete', openingBalance: 0,
  contributions: [
    { id: 'vtx-2026-03', month: '2026-03', pfWage: 15_000, employeeEpf: 1_800, employerEpf: 550, eps: 1_250, status: 'received' },
    { id: 'vtx-2026-04', month: '2026-04', pfWage: 15_000, employeeEpf: 1_800, employerEpf: 550, eps: 1_250, status: 'received' },
    { id: 'vtx-2026-05', month: '2026-05', pfWage: 15_000, employeeEpf: 1_800, employerEpf: 550, eps: 1_250, status: 'received' },
    { id: 'vtx-2026-06', month: '2026-06', pfWage: 15_000, employeeEpf: 1_800, employerEpf: null, eps: 1_250, status: 'needs-attention', note: 'Employer EPF contribution is not currently recorded.' },
  ],
  interestCredits: [],
  transfers: [{ id: 'transfer-hfi-vtx-completed', fromMemberId: 'KA/HFI/0031849', toMemberId: 'KA/VTX/0048291', amount: 435_350, initiatedOn: '2026-03-08', completedOn: '2026-04-01', status: 'completed', source: 'epfo' }],
  withdrawals: [], claims: [],
  epsService: { months: 4, contributions: 5_000, status: 'received', explanation: 'EPS is a pension service record, not an additional EPF balance.' },
})

/** One entirely fictional member and ledger, intentionally local to this prototype. */
export const arjunMehta: Person = {
  name: 'Arjun Mehta', uan: '100000123456',
  kyc: [
    { type: 'aadhaar', status: 'verified', message: 'Aadhaar is verified.' },
    { type: 'pan', status: 'verified', message: 'PAN is verified.' },
    { type: 'bank-account', status: 'needs-attention', message: 'Your bank details need verification before a claim can proceed.', actionLabel: 'Fix bank details' },
  ],
  employments: [northstar(), bluekite(), harbor(), vertex()],
  employmentGaps: [{ type: 'no-epf-covered-employment-recorded', startsOn: '2024-07-01', endsOn: '2026-02-28', label: 'No EPF-covered employment recorded' }],
  contributionIssues: [
    {
      employmentId: 'vertex', memberId: 'KA/VTX/0048291', month: '2026-02', state: 'needs-attention',
      message: 'Employer EPF contribution is not currently recorded. This reported month sits before the current employment start date and needs review.',
    },
  ],
}

/** A reported issue is kept distinct from the ledger until its employment linkage is resolved. */
export const february2026Discrepancy = arjunMehta.contributionIssues[0]
