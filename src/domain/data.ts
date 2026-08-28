import type {
  AccountState,
  ContributionRecord,
  Employment,
  InterestCredit,
  Money,
} from './types'
import defaultProfilePhoto from '../assets/ade4f4eb-8a5e-4290-b28f-f12b5db4ebb9.png'

const monthsBetween = (first: string, last: string): string[] => {
  const [firstYear, firstMonth] = first.split('-').map(Number)
  const [lastYear, lastMonth] = last.split('-').map(Number)
  const months: string[] = []
  for (let year = firstYear, month = firstMonth; year < lastYear || (year === lastYear && month <= lastMonth);) {
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

const recordedDate = (wageMonth: string): string => {
  const [year, month] = wageMonth.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 8))
  return next.toISOString().slice(0, 10)
}

const contributionSeries = (
  employment: Employment,
  first: string,
  last: string,
  employeeTotal: Money,
  employerTotal: Money,
  epsTotal: Money,
): ContributionRecord[] => {
  const months = monthsBetween(first, last)
  const employees = apportioned(employeeTotal, months.length)
  const employers = apportioned(employerTotal, months.length)
  const eps = apportioned(epsTotal, months.length)
  return months.map((wageMonth, index) => ({
    id: `${employment.id}-${wageMonth}`,
    employmentId: employment.id,
    memberId: employment.memberId,
    wageMonth,
    recordedOn: recordedDate(wageMonth),
    pfWage: null,
    employeeEpf: employees[index],
    employerEpf: employers[index],
    eps: eps[index],
    status: 'recorded-correctly',
    explanation: 'The employee EPF, employer EPF and EPS amounts are recorded for this wage month.',
  }))
}

const employments: Employment[] = [
  {
    id: 'northstar',
    employer: 'Northstar Consumer Technologies',
    establishmentType: 'exempted-pf-trust',
    memberId: 'DL/NST/0001842',
    joinedOn: '2018-08-01',
    exitedOn: '2019-06-30',
    status: 'transferred',
    dataAvailability: 'partial',
    dataAvailabilityNote: 'EPFO has the transfer total and a partial trust statement. The original month-by-month trust ledger is not available in this account.',
  },
  {
    id: 'bluekite',
    employer: 'BlueKite Digital Services',
    establishmentType: 'epfo',
    memberId: 'DL/BLK/0019274',
    joinedOn: '2019-07-01',
    exitedOn: '2022-12-31',
    status: 'transferred',
    dataAvailability: 'complete',
  },
  {
    id: 'harbor',
    employer: 'Harbor Foods India',
    establishmentType: 'epfo',
    memberId: 'KA/HFI/0031849',
    joinedOn: '2023-01-01',
    exitedOn: '2024-06-30',
    status: 'balance-remaining',
    dataAvailability: 'complete',
  },
  {
    id: 'vertex',
    employer: 'Vertex Mobility',
    establishmentType: 'epfo',
    memberId: 'KA/VTX/0048291',
    joinedOn: '2026-03-01',
    status: 'current',
    dataAvailability: 'complete',
  },
]

const [northstar, bluekite, harbor, vertex] = employments

const vertexContributions: ContributionRecord[] = [
  {
    id: 'vertex-2026-03', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-03', recordedOn: '2026-04-08',
    pfWage: 15_000, employeeEpf: 1_800, employerEpf: 550, eps: 1_250, status: 'recorded-correctly',
    explanation: '₹1,250 was allocated to EPS. The remaining employer contribution of ₹550 was credited to EPF.',
  },
  {
    id: 'vertex-2026-04', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-04', recordedOn: '2026-05-12',
    pfWage: 15_000, employeeEpf: 1_800, employerEpf: 550, eps: 1_250, status: 'recorded-late',
    explanation: 'This contribution is complete. It was recorded later than the usual date for this account.',
  },
  {
    id: 'vertex-2026-05', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-05', recordedOn: '2026-06-08',
    pfWage: 15_000, employeeEpf: 1_800, employerEpf: 550, eps: 1_250, status: 'recorded-correctly',
    explanation: '₹1,250 was allocated to EPS. The remaining employer contribution of ₹550 was credited to EPF.',
  },
  {
    id: 'vertex-2026-06', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-06', recordedOn: '2026-07-08',
    pfWage: 15_000, employeeEpf: 1_800, employerEpf: null, eps: 1_250, status: 'amount-needs-review',
    explanation: 'The employer EPF amount is not currently recorded. This does not establish why the amount is missing.',
  },
]

const officialInterestCredits: InterestCredit[] = [
  { id: 'interest-northstar-2019', memberId: northstar.memberId, financialYear: '2018–19', creditedOn: '2019-06-30', amount: 7_530, kind: 'official-credit' },
  { id: 'interest-bluekite-2020', memberId: bluekite.memberId, financialYear: '2019–20', creditedOn: '2020-03-31', amount: 12_400, kind: 'official-credit' },
  { id: 'interest-bluekite-2021', memberId: bluekite.memberId, financialYear: '2020–21', creditedOn: '2021-03-31', amount: 17_500, kind: 'official-credit' },
  { id: 'interest-bluekite-2022', memberId: bluekite.memberId, financialYear: '2021–22', creditedOn: '2022-03-31', amount: 20_200, kind: 'official-credit' },
  { id: 'interest-bluekite-2023', memberId: bluekite.memberId, financialYear: '2022–23', creditedOn: '2023-03-31', amount: 23_707, kind: 'official-credit' },
  { id: 'interest-harbor-2024', memberId: harbor.memberId, financialYear: '2023–24', creditedOn: '2024-03-31', amount: 18_600, kind: 'official-credit' },
  { id: 'interest-harbor-2025', memberId: harbor.memberId, financialYear: '2024–25', creditedOn: '2025-03-31', amount: 23_280, kind: 'official-credit' },
]

export const initialAccount: AccountState = {
  version: 3,
  member: {
    id: 'member-arjun-mehta',
    name: 'Arjun Mehta',
    uan: '100000123456',
    dateOfBirth: '1993-11-14',
    mobile: { value: '9876543210', verified: true, updatedOn: '2026-03-01' },
    email: { value: 'arjun.mehta@example.in', verified: true, updatedOn: '2026-03-01' },
    fatherOrHusbandName: 'Ramesh Mehta',
    relationship: 'father',
    internationalWorker: false,
    educationalQualification: 'graduate',
    maritalStatus: 'married',
    permanentAddress: '42 Lake View Road, Indiranagar, Bengaluru, Karnataka 560038',
    currentAddress: '42 Lake View Road, Indiranagar, Bengaluru, Karnataka 560038',
    differentlyAbled: false,
    passportPhotoUrl: defaultProfilePhoto,
    profileUpdatedOn: '2026-04-08',
    nominees: [],
    communicationPreferences: { contributionRecorded: true, requestUpdates: true, reportReady: true },
  },
  kyc: [
    { type: 'aadhaar', state: 'verified', maskedValue: '•••• •••• 4821', updatedOn: '2026-02-12', explanation: 'Aadhaar is verified.' },
    { type: 'pan', state: 'pending', maskedValue: 'ARJ•••21K', updatedOn: '2026-02-12', explanation: 'PAN verification is in progress.' },
    { type: 'bank', state: 'verified', maskedValue: '•••• 7314', updatedOn: '2026-03-02', explanation: 'This bank account is verified for online services.' },
  ],
  employments,
  employmentGaps: [{ startsOn: '2024-07-01', endsOn: '2026-02-28', label: 'No EPF-covered employment recorded' }],
  ledger: {
    contributions: [
      ...contributionSeries(northstar, '2018-08', '2019-06', 27_000, 8_250, 13_750),
      ...contributionSeries(bluekite, '2019-07', '2022-12', 132_000, 40_333, 52_500),
      ...contributionSeries(harbor, '2023-01', '2024-06', 144_000, 44_000, 22_500),
      ...vertexContributions,
    ],
    officialInterestCredits,
    estimatedInterestAccruals: [{
      id: 'estimate-vertex-2026', memberId: vertex.memberId, calculatedThrough: '2026-07-31', amount: 6_480, kind: 'estimate',
      explanation: 'This is an estimate for explanation only. It is not included in the official EPF balance until credited.',
    }],
    transfers: [
      { id: 'transfer-northstar-bluekite', fromMemberId: northstar.memberId, toMemberId: bluekite.memberId, amount: 42_780, initiatedOn: '2019-07-05', completedOn: '2019-07-24', state: 'completed', source: 'exempted-pf-trust', explanation: 'The PF trust transferred the recorded closing balance to the EPFO-linked Member ID.' },
      { id: 'transfer-bluekite-harbor', fromMemberId: bluekite.memberId, toMemberId: harbor.memberId, amount: 243_920, initiatedOn: '2023-01-09', completedOn: '2023-01-28', state: 'completed', source: 'epfo', explanation: 'The previous EPF balance moved to the next Member ID. This did not create a new contribution.' },
      { id: 'transfer-harbor-vertex-partial', fromMemberId: harbor.memberId, toMemberId: vertex.memberId, amount: 435_350, initiatedOn: '2026-03-08', completedOn: '2026-04-01', state: 'completed', source: 'epfo', explanation: 'Part of the Harbor Foods India balance was transferred to the current Member ID.' },
      { id: 'transfer-harbor-vertex-2026-06-18', fromMemberId: harbor.memberId, toMemberId: vertex.memberId, amount: 38_450, initiatedOn: '2026-06-18', state: 'processing', source: 'epfo', explanation: 'This transfer is being processed. The balance remains under the previous Member ID until completion.' },
    ],
    withdrawals: [{ id: 'withdrawal-bluekite-2022', memberId: bluekite.memberId, claimReference: 'CLM-2022-18421', processedOn: '2022-08-19', amount: 45_000, state: 'completed', explanation: 'A completed partial withdrawal reduced this Member ID balance.' }],
  },
  exceptions: [
    { id: 'exception-previous-balance', kind: 'previous-balance', state: 'in-progress', title: 'Previous PF Balance Transfer Is in Progress', explanation: '₹38,450 remains under Harbor Foods India while the transfer is processed.', amount: 38_450, employmentId: harbor.id, relatedRequestId: 'request-transfer-2026' },
    { id: 'exception-june-contribution', kind: 'contribution-review', state: 'open', title: 'June Contribution Needs Review', explanation: 'The employer EPF amount is not currently recorded.', contributionId: 'vertex-2026-06', employmentId: vertex.id },
    { id: 'exception-pan', kind: 'kyc-review', state: 'open', title: 'PAN Verification Is Incomplete', explanation: 'Complete PAN verification to keep your account information ready.', kycType: 'pan' },
  ],
  requests: [
    {
      id: 'request-transfer-2026', type: 'transfer', service: 'Transfer Previous PF', reference: 'TRF-2026-004512', title: 'Previous PF Balance Transfer', state: 'in-progress', submittedOn: '2026-06-18', updatedOn: '2026-06-24', amount: 38_450, employmentId: harbor.id,
      nextExpectedStep: 'EPFO will verify the previous employment record and process the transfer.',
      timeline: [
        { id: 'transfer-submitted-2026', label: 'Submitted', date: '2026-06-18', state: 'completed' },
        { id: 'transfer-verification-2026', label: 'Employment Record Verification', date: '2026-06-24', state: 'current' },
        { id: 'transfer-processing-2026', label: 'Transfer Processing', date: null, state: 'upcoming' },
      ],
    },
    {
      id: 'request-correction-2026', type: 'correction', service: 'Correct Employment Records', reference: 'COR-2026-001173', title: 'Date of Exit Correction', state: 'submitted', submittedOn: '2026-06-22', updatedOn: '2026-06-22', employmentId: harbor.id,
      nextExpectedStep: 'The employer will review the requested correction and supporting information.',
      timeline: [
        { id: 'correction-submitted-2026', label: 'Submitted', date: '2026-06-22', state: 'completed' },
        { id: 'correction-employer-review-2026', label: 'Employer Review', date: null, state: 'upcoming' },
        { id: 'correction-record-update-2026', label: 'Record Update', date: null, state: 'upcoming' },
      ],
    },
    {
      id: 'request-claim-2022', type: 'claim', service: 'Claims & Withdrawals', reference: 'CLM-2022-18421', title: 'Partial Withdrawal', state: 'completed', submittedOn: '2022-08-05', updatedOn: '2022-08-19', amount: 45_000,
      nextExpectedStep: 'No action is required. The request is complete.',
      timeline: [
        { id: 'claim-submitted', label: 'Submitted', date: '2022-08-05', state: 'completed' },
        { id: 'claim-reviewed', label: 'Reviewed', date: '2022-08-12', state: 'completed' },
        { id: 'claim-paid', label: 'Paid to Verified Bank', date: '2022-08-19', state: 'completed' },
      ],
    },
    {
      id: 'request-grievance-2023', type: 'grievance', service: 'Raise a Grievance', reference: 'GRV-2023-009842', title: 'Contribution Record Clarification', state: 'completed', submittedOn: '2023-12-02', updatedOn: '2023-12-18', employmentId: harbor.id,
      nextExpectedStep: 'No action is required. The response is available in this request.',
      timeline: [
        { id: 'grievance-submitted', label: 'Grievance Submitted', date: '2023-12-02', state: 'completed' },
        { id: 'grievance-reviewed', label: 'EPFO Review', date: '2023-12-11', state: 'completed' },
        { id: 'grievance-answered', label: 'Response Provided', date: '2023-12-18', state: 'completed' },
      ],
    },
  ],
  generatedReports: [],
}

/** Returns a fresh copy so browser persistence never mutates the seed. */
export const createInitialAccount = (): AccountState => structuredClone(initialAccount)
