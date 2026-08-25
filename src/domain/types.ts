/** Domain types for the synthetic EPF member journey. Monetary amounts are whole INR. */
export type Money = number

export type DataState =
  | 'verified'
  | 'unverified'
  | 'received'
  | 'missing'
  | 'pending'
  | 'transferred'
  | 'withdrawn'
  | 'unavailable'
  | 'not-applicable'
  | 'needs-attention'

export type DataConfidence = 'complete' | 'partial' | 'unavailable'
export type PFProvider = 'epfo' | 'employer-pf-trust'
export type EmploymentStatus = 'current' | 'closed' | 'transferred' | 'needs-attention'
export type TransferStatus = 'completed' | 'pending' | 'processing'
export type ClaimStatus = 'completed' | 'processing' | 'action-required' | 'withdrawn'

export interface Contribution {
  id: string
  month: string // YYYY-MM
  pfWage: Money | null
  employeeEpf: Money
  employerEpf: Money | null
  eps: Money | null
  status: DataState
  note?: string
}

export interface InterestCredit {
  id: string
  creditedOn: string
  financialYear: string
  amount: Money
  status: Extract<DataState, 'verified' | 'received'>
}

export interface Transfer {
  id: string
  fromMemberId: string
  toMemberId: string
  amount: Money
  initiatedOn: string
  completedOn?: string
  status: TransferStatus
  source: PFProvider
  note?: string
}

export interface Withdrawal {
  id: string
  amount: Money
  processedOn: string
  status: Extract<DataState, 'withdrawn'>
  claimId: string
}

export interface Claim {
  id: string
  kind: 'partial-withdrawal' | 'pf-transfer'
  submittedOn: string
  amount: Money
  status: ClaimStatus
  currentStatusMessage: string
  nextStep: string
}

export interface KycRecord {
  type: 'aadhaar' | 'pan' | 'bank-account'
  status: Extract<DataState, 'verified' | 'unverified' | 'needs-attention'>
  message: string
  actionLabel?: string
}

export interface EpsService {
  months: number
  contributions: Money
  status: DataState
  explanation: string
}

export interface Employment {
  id: string
  employer: string
  memberId: string
  provider: PFProvider
  joinedOn: string
  exitedOn?: string
  status: EmploymentStatus
  dataConfidence: DataConfidence
  dataConfidenceNote?: string
  openingBalance: Money
  contributions: Contribution[]
  interestCredits: InterestCredit[]
  transfers: Transfer[]
  withdrawals: Withdrawal[]
  claims: Claim[]
  epsService: EpsService
}

export interface EmploymentGap {
  type: 'no-epf-covered-employment-recorded'
  startsOn: string
  endsOn: string
  label: string
}

export interface Person {
  name: string
  uan: string
  kyc: KycRecord[]
  employments: Employment[]
  employmentGaps: EmploymentGap[]
  contributionIssues: ContributionIssue[]
}

export interface Reconciliation {
  openingBalance: Money
  employeeContributions: Money
  employerEpfContributions: Money
  interest: Money
  transfersIn: Money
  transfersOut: Money
  withdrawals: Money
  closingBalance: Money
}

export interface ContributionIssue {
  employmentId: string
  memberId: string
  month: string
  message: string
  state: DataState
}
