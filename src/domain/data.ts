import type {
  AccountState,
  ContributionRecord,
  Employment,
  InterestCredit,
} from './types'
import { RECORD_ISSUE_RULE_VERSION } from './issues'
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

const recordedDate = (wageMonth: string): string => {
  const [year, month] = wageMonth.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 8))
  return next.toISOString().slice(0, 10)
}

const contributionSeries = (
  employment: Employment,
  first: string,
  last: string,
): ContributionRecord[] => {
  const months = monthsBetween(first, last)
  return months.map((wageMonth) => ({
    id: `${employment.id}-${wageMonth}`,
    employmentId: employment.id,
    memberId: employment.memberId,
    wageMonth,
    recordedOn: recordedDate(wageMonth),
    pfWage: 15_000,
    employeeEpf: 1_800,
    voluntaryEpf: 0,
    employerEpf: 550,
    eps: 1_250,
    status: 'recorded-correctly',
    explanation: 'The employee EPF, employer EPF and EPS amounts are recorded for this salary month.',
  }))
}

const employments: Employment[] = [
  {
    id: 'northstar',
    employer: 'Stark Industries',
    establishmentType: 'exempted-pf-trust',
    memberId: 'SDS/PF-TRUST/001842',
    joinedOn: '2018-08-01',
    exitedOn: '2019-06-30',
    status: 'transferred',
    dataAvailability: 'complete',
    pfAccounts: [
      { entity: 'Stark Defence Systems', provider: 'exempted-pf-trust', accountNumber: 'SDS/PF-TRUST/001842' },
      { entity: 'Stark IT Services', provider: 'epfo', accountNumber: 'DL/SIS/0027816' },
      { entity: 'Stark Digital Platforms', provider: 'epfo', accountNumber: 'DL/SDP/0041903' },
    ],
  },
  {
    id: 'bluekite',
    employer: 'Dunder Mifflin Paper Co.',
    establishmentType: 'epfo',
    memberId: 'DL/BLK/0019274',
    joinedOn: '2019-07-01',
    exitedOn: '2022-12-31',
    status: 'transferred',
    dataAvailability: 'complete',
  },
  {
    id: 'harbor',
    employer: 'Waystar Royco',
    establishmentType: 'epfo',
    memberId: 'KA/HFI/0031849',
    joinedOn: '2023-01-01',
    exitedOn: '2024-06-30',
    status: 'balance-remaining',
    dataAvailability: 'complete',
  },
  {
    id: 'vertex',
    employer: 'Pied Piper',
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
    pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: 550, eps: 1_250, status: 'recorded-correctly',
    explanation: 'Employee EPF is ₹1,800, VPF is ₹1,200, employer EPF is ₹550 and EPS is ₹1,250.',
  },
  {
    id: 'vertex-2026-04', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-04', recordedOn: '2026-05-12',
    pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: 550, eps: 1_250, status: 'recorded-late',
    explanation: 'This contribution is complete, including ₹1,200 VPF. It was recorded later than usual.',
    transactionReference: 'TXN-VTX-2026-04-0512',
    expectedRecord: { employmentId: vertex.id, wageMonth: '2026-04', pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: 550, eps: 1_250, basis: 'Employer contribution record', reference: 'ECR-VTX-2026-04', evidenceHeld: ['Employer contribution record', 'Recorded ledger transaction'], evidenceMemberMayNeed: [] },
  },
  {
    id: 'vertex-2026-05', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-05', recordedOn: '2026-06-08',
    pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: 550, eps: 1_250, status: 'recorded-correctly',
    explanation: 'Employee EPF is ₹1,800, VPF is ₹1,200, employer EPF is ₹550 and EPS is ₹1,250.',
  },
  {
    id: 'vertex-2026-06', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-06', recordedOn: '2026-07-08',
    pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: 550, eps: 1_250, status: 'recorded-correctly',
    explanation: 'Employee EPF is ₹1,800, VPF is ₹1,200, employer EPF is ₹550 and EPS is ₹1,250.',
  },
  {
    id: 'vertex-2026-07', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-07', recordedOn: '2026-08-08',
    pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: 550, eps: 1_250, status: 'recorded-correctly',
    explanation: 'Employee EPF is ₹1,800, VPF is ₹1,200, employer EPF is ₹550 and EPS is ₹1,250.',
  },
  {
    id: 'vertex-2026-08', employmentId: vertex.id, memberId: vertex.memberId, wageMonth: '2026-08', recordedOn: '2026-09-08',
    pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: null, eps: 1_250, status: 'amount-needs-review',
    explanation: 'The employer EPF amount is not currently recorded. This does not establish why the amount is missing.',
    transactionReference: 'TXN-VTX-2026-08-0908',
    expectedRecord: { employmentId: vertex.id, wageMonth: '2026-08', pfWage: 15_000, employeeEpf: 1_800, voluntaryEpf: 1_200, employerEpf: 550, eps: 1_250, basis: 'Employer contribution record', reference: 'ECR-VTX-2026-08', evidenceHeld: ['Employer contribution record', 'Recorded ledger transaction'], evidenceMemberMayNeed: ['August 2026 payslip or employer PF contribution statement'] },
  },
]

// Synthetic source records use monthly running balances and the notified annual
// EPF rates through FY 2024–25. Broken-period settlements use the last declared
// rate and stop before the transfer month. No FY 2025–26 credit is inferred.
const officialInterestCredits: InterestCredit[] = [
  { id: 'interest-northstar-2019', memberId: northstar.memberId, financialYear: '2018–19', creditedOn: '2019-03-31', amount: 356, annualRateBasisPoints: 865, monthlyBalanceTotal: 49_350, kind: 'official-credit' },
  { id: 'interest-northstar-settlement-2019', memberId: northstar.memberId, financialYear: '2019–20', creditedOn: '2019-07-24', amount: 414, annualRateBasisPoints: 865, monthlyBalanceTotal: 57_468, kind: 'official-credit' },
  { id: 'interest-bluekite-2020', memberId: bluekite.memberId, financialYear: '2019–20', creditedOn: '2020-03-31', amount: 1_975, annualRateBasisPoints: 850, monthlyBalanceTotal: 278_760, kind: 'official-credit' },
  { id: 'interest-bluekite-2021', memberId: bluekite.memberId, financialYear: '2020–21', creditedOn: '2021-03-31', amount: 5_127, annualRateBasisPoints: 850, monthlyBalanceTotal: 723_840, kind: 'official-credit' },
  { id: 'interest-bluekite-2022', memberId: bluekite.memberId, financialYear: '2021–22', creditedOn: '2022-03-31', amount: 7_585, annualRateBasisPoints: 810, monthlyBalanceTotal: 1_123_764, kind: 'official-credit' },
  { id: 'interest-bluekite-settlement-2023', memberId: bluekite.memberId, financialYear: '2022–23', creditedOn: '2023-01-28', amount: 6_130, annualRateBasisPoints: 810, monthlyBalanceTotal: 908_163, kind: 'official-credit' },
  { id: 'interest-harbor-2023', memberId: harbor.memberId, financialYear: '2022–23', creditedOn: '2023-03-31', amount: 1_390, annualRateBasisPoints: 815, monthlyBalanceTotal: 204_624, kind: 'official-credit' },
  { id: 'interest-harbor-2024', memberId: harbor.memberId, financialYear: '2023–24', creditedOn: '2024-03-31', amount: 9_913, annualRateBasisPoints: 825, monthlyBalanceTotal: 1_441_824, kind: 'official-credit' },
  { id: 'interest-harbor-2025', memberId: harbor.memberId, financialYear: '2024–25', creditedOn: '2025-03-31', amount: 12_604, annualRateBasisPoints: 825, monthlyBalanceTotal: 1_833_380, kind: 'official-credit' },
]

export const initialAccount: AccountState = {
  version: 6,
  member: {
    id: 'member-arjun-mehta',
    name: 'Arjun Mehta',
    uan: '100000123456',
    dateOfBirth: '1993-11-14',
    mobile: { value: '9876543210', verified: true, updatedOn: '2026-03-01' },
    email: { value: '', verified: false, updatedOn: '' },
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
    { type: 'bank', state: 'verified', maskedValue: '•••• 7314', institutionName: 'HDFC Bank', updatedOn: '2026-03-02', explanation: 'This bank account is verified for online services.' },
  ],
  employments,
  employmentGaps: [{ startsOn: '2024-07-01', endsOn: '2026-02-28', label: 'No EPF-Covered Employment Recorded' }],
  ledger: {
    contributions: [
      ...contributionSeries(northstar, '2018-08', '2019-06'),
      ...contributionSeries(bluekite, '2019-07', '2022-12'),
      ...contributionSeries(harbor, '2023-01', '2024-06'),
      ...vertexContributions,
    ],
    officialInterestCredits,
    estimatedInterestAccruals: [],
    transfers: [
      { id: 'transfer-northstar-bluekite', fromMemberId: northstar.memberId, toMemberId: bluekite.memberId, amount: 26_620, initiatedOn: '2019-07-05', completedOn: '2019-07-24', state: 'completed', initiationMethod: 'automatic', source: 'exempted-pf-trust', explanation: 'The PF trust transferred the recorded closing balance to the EPFO-linked Member ID.' },
      { id: 'transfer-bluekite-harbor', fromMemberId: bluekite.memberId, toMemberId: harbor.memberId, amount: 101_137, initiatedOn: '2023-01-09', completedOn: '2023-01-28', state: 'completed', initiationMethod: 'automatic', source: 'epfo', explanation: 'The previous EPF balance moved to the next Member ID. This did not create a new contribution.' },
      { id: 'transfer-harbor-vertex-partial', fromMemberId: harbor.memberId, toMemberId: vertex.memberId, amount: 128_894, initiatedOn: '2026-03-08', completedOn: '2026-04-01', state: 'completed', initiationMethod: 'automatic', source: 'epfo', explanation: 'Completed automatically after your new employment was linked to your UAN.' },
      { id: 'transfer-harbor-vertex-2026-06-18', fromMemberId: harbor.memberId, toMemberId: vertex.memberId, amount: 38_450, initiatedOn: '2026-06-18', state: 'submitted', initiationMethod: 'manual', source: 'epfo', relatedRequestId: 'request-transfer-2026', pensionServiceState: 'linked-employment-record', explanation: 'This transfer is in employment record verification. The balance remains under the previous Member ID until completion.' },
    ],
    withdrawals: [{ id: 'withdrawal-bluekite-2022', memberId: bluekite.memberId, claimReference: 'CLM-2022-18421', processedOn: '2022-08-19', amount: 45_000, state: 'completed', explanation: 'A completed partial withdrawal reduced this Member ID balance.' }],
  },
  exceptions: [
    { id: 'exception-previous-balance', kind: 'previous-balance', state: 'in-progress', title: 'Previous PF Balance Transfer Is in Progress', explanation: '₹38,450 remains under Waystar Royco while the transfer is processed.', amount: 38_450, employmentId: harbor.id, relatedRequestId: 'request-transfer-2026', currentResponsibleParty: 'epfo', pensionServiceState: 'linked-employment-record', issueSnapshot: { ruleVersion: RECORD_ISSUE_RULE_VERSION, sourceSnapshotAt: '2026-06-24', sourceRecordReferences: [{ kind: 'employment', id: harbor.id }, { kind: 'employment', id: vertex.id }, { kind: 'transfer', id: 'transfer-harbor-vertex-2026-06-18' }, { kind: 'request', id: 'request-transfer-2026' }] } },
    { id: 'exception-august-contribution', kind: 'contribution-review', state: 'open', title: 'August Contribution Needs Review', explanation: 'The employer EPF amount is not currently recorded.', contributionId: 'vertex-2026-08', employmentId: vertex.id, currentResponsibleParty: 'member', issueSnapshot: { ruleVersion: RECORD_ISSUE_RULE_VERSION, sourceSnapshotAt: '2026-09-08', sourceRecordReferences: [{ kind: 'employment', id: vertex.id }, { kind: 'contribution', id: 'vertex-2026-08' }] } },
    { id: 'exception-pan', kind: 'kyc-review', state: 'open', title: 'PAN Verification Is Incomplete', explanation: 'Complete PAN verification to keep your account information ready.', kycType: 'pan' },
  ],
  requests: [
    {
      id: 'request-transfer-2026', type: 'transfer', service: 'Transfer Previous PF', reference: 'TRF-2026-004512', title: 'Previous PF Balance Transfer', state: 'in-progress', submittedOn: '2026-06-18', updatedOn: '2026-06-24', amount: 38_450, employmentId: harbor.id,
      nextExpectedStep: 'EPFO will acknowledge the request before it moves to employer review.',
      channel: 'Member portal', currentResponsibleParty: 'epfo',
      timeline: [
        { id: 'transfer-filed-2026', label: 'Request Filed', date: '2026-06-18', state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member' },
        { id: 'transfer-acknowledgement-2026', label: 'EPFO Acknowledgement', date: '2026-06-18', state: 'completed', kind: 'epfo-acknowledgement', confirmation: 'confirmed', party: 'epfo' },
        { id: 'transfer-verification-2026', label: 'Employment Record Verification', date: '2026-06-24', state: 'current', kind: 'responsible-party-assignment', confirmation: 'confirmed', party: 'epfo', explanation: 'Pending Verification from EPFO.' },
        { id: 'transfer-processing-2026', label: 'Transfer Processing', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
        { id: 'transfer-completed-2026', label: 'Transfer Completed', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
      ],
    },
    {
      id: 'request-correction-2026', type: 'correction', service: 'Correct Employment Records', reference: 'COR-2026-001173', title: 'Date of Exit Correction', state: 'submitted', submittedOn: '2026-06-22', updatedOn: '2026-06-22', employmentId: harbor.id,
      nextExpectedStep: 'EPFO will acknowledge the request before it moves to employer review.',
      channel: 'Member portal', currentResponsibleParty: 'member',
      timeline: [
        { id: 'correction-submitted-2026', label: 'Request Filed', date: '2026-06-22', state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member' },
        { id: 'correction-ack-2026', label: 'EPFO Acknowledgement', date: null, state: 'upcoming', kind: 'epfo-acknowledgement', confirmation: 'expected', party: 'epfo' },
        { id: 'correction-employer-review-2026', label: 'Employer Review', date: null, state: 'upcoming', kind: 'responsible-party-assignment', confirmation: 'expected', party: 'source-employer' },
        { id: 'correction-completed-2026', label: 'Request Completed', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
      ],
    },
    {
      id: 'request-claim-2022', type: 'claim', service: 'Claims & Withdrawals', reference: 'CLM-2022-18421', title: 'Partial Withdrawal', state: 'completed', submittedOn: '2022-08-05', updatedOn: '2022-08-19', amount: 45_000,
      nextExpectedStep: 'No action is required. The request is complete.',
      timeline: [
        { id: 'claim-submitted', label: 'Submitted', date: '2022-08-05', state: 'completed' },
        { id: 'claim-reviewed', label: 'EPFO Review', date: '2022-08-12', state: 'completed' },
        { id: 'claim-paid', label: 'Transfer to Verified Bank Account', date: '2022-08-19', state: 'completed', explanation: 'HDFC Bank · •••• 7314' },
        { id: 'claim-completed', label: 'Request Completed', date: '2022-08-19', state: 'completed' },
      ],
    },
    {
      id: 'request-grievance-2023', type: 'grievance', service: 'Raise a Grievance', reference: 'GRV-2023-009842', title: 'Contribution Record Clarification', state: 'completed', submittedOn: '2023-12-02', updatedOn: '2023-12-18', employmentId: harbor.id,
      nextExpectedStep: 'No action is required. The response is available in this request.',
      timeline: [
        { id: 'grievance-submitted', label: 'Request Filed', date: '2023-12-02', state: 'completed' },
        { id: 'grievance-reviewed', label: 'EPFO Review', date: '2023-12-11', state: 'completed' },
        { id: 'grievance-answered', label: 'Response Provided', date: '2023-12-18', state: 'completed' },
        { id: 'grievance-completed', label: 'Request Completed', date: '2023-12-18', state: 'completed' },
      ],
    },
  ],
  generatedReports: [],
}

/** Returns a fresh copy so browser persistence never mutates the seed. */
export const createInitialAccount = (): AccountState => structuredClone(initialAccount)
