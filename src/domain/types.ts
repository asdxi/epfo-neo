/** Authoritative v0.2 domain contract. All data is fictional and monetary values are whole INR. */
export type Money = number

export type DataAvailability = 'complete' | 'partial' | 'unavailable'
export type EstablishmentType = 'epfo' | 'exempted-pf-trust'
export type EmploymentStatus = 'current' | 'closed' | 'transferred' | 'balance-remaining'
export type VerificationState = 'verified' | 'pending' | 'unverified'
export type ContributionStatus =
  | 'recorded-correctly'
  | 'recorded-late'
  | 'amount-needs-review'
  | 'missing-contribution'
  | 'awaiting-record'

export type RequestType = 'claim' | 'transfer' | 'correction' | 'grievance' | 'exit'
export type RequestState = 'submitted' | 'in-progress' | 'action-required' | 'completed'
export type ReportFormat = 'pdf' | 'excel'
export type ReportState = 'preparing' | 'ready' | 'failed' | 'expired'
export type AttentionPriority = 'action-required' | 'in-progress' | 'good-to-know'
export type NoticeAttachment = 'pdf' | 'none'

export interface ContactChannel {
  value: string
  verified: boolean
  updatedOn: string
}

export interface Nominee {
  id: string
  name: string
  relationship: 'parent' | 'spouse' | 'child' | 'other'
  address: string
  bankAccountNumber: string
  ifscCode: string
  sharePercentage: number
  updatedOn: string
}

export interface Member {
  id: string
  name: string
  uan: string
  dateOfBirth: string
  mobile: ContactChannel
  email: ContactChannel
  fatherOrHusbandName: string
  relationship: 'father' | 'husband'
  internationalWorker: boolean
  educationalQualification: 'na' | 'primary' | 'secondary' | 'senior-secondary' | 'diploma' | 'graduate' | 'postgraduate' | 'doctorate' | 'post-doctorate'
  maritalStatus: 'married' | 'unmarried' | 'widow-widower' | 'divorcee'
  permanentAddress: string
  currentAddress: string
  differentlyAbled: boolean
  passportPhotoUrl: string
  profileUpdatedOn: string
  communicationPreferences: {
    contributionRecorded: boolean
    requestUpdates: boolean
    reportReady: boolean
  }
  nominees: Nominee[]
}

export interface KycRecord {
  type: 'aadhaar' | 'pan' | 'bank'
  state: VerificationState
  maskedValue: string
  updatedOn: string
  explanation: string
}

export interface Employment {
  id: string
  employer: string
  establishmentType: EstablishmentType
  memberId: string
  joinedOn: string
  exitedOn?: string
  status: EmploymentStatus
  dataAvailability: DataAvailability
  dataAvailabilityNote?: string
}

export interface EmploymentGap {
  startsOn: string
  endsOn: string
  label: 'No EPF-covered employment recorded'
}

export interface ContributionRecord {
  id: string
  employmentId: string
  memberId: string
  wageMonth: string
  recordedOn: string | null
  pfWage: Money | null
  employeeEpf: Money | null
  employerEpf: Money | null
  eps: Money | null
  status: ContributionStatus
  explanation: string
}

export interface InterestCredit {
  id: string
  memberId: string
  financialYear: string
  creditedOn: string
  amount: Money
  kind: 'official-credit'
}

export interface EstimatedInterestAccrual {
  id: string
  memberId: string
  calculatedThrough: string
  amount: Money
  kind: 'estimate'
  explanation: string
}

export interface TransferRecord {
  id: string
  fromMemberId: string
  toMemberId: string
  amount: Money
  initiatedOn: string
  completedOn?: string
  state: 'pending' | 'submitted' | 'processing' | 'completed'
  source: EstablishmentType
  explanation: string
}

export interface WithdrawalRecord {
  id: string
  memberId: string
  claimReference: string
  processedOn: string
  amount: Money
  state: 'completed'
  explanation: string
}

export interface RequestEvent {
  id: string
  label: string
  date: string | null
  state: 'completed' | 'current' | 'upcoming'
  explanation?: string
}

export interface MemberRequest {
  id: string
  type: RequestType
  service: string
  reference: string
  title: string
  state: RequestState
  submittedOn: string
  updatedOn: string
  amount?: Money
  employmentId?: string
  contributionId?: string
  nextExpectedStep: string
  citizenAction?: string
  timeline: RequestEvent[]
}

export interface GeneratedReport {
  id: string
  name: string
  periodLabel: string
  startsOn: string
  endsOn: string
  format: ReportFormat
  state: ReportState
  requestedOn: string
  generatedOn: string | null
  expiresOn: string
  deliveryState: 'not-requested' | 'mock-sent-to-verified-email'
  transactionIds?: string[]
}

export interface AccountException {
  id: string
  kind: 'previous-balance' | 'contribution-review' | 'kyc-review'
  state: 'open' | 'in-progress' | 'resolved'
  title: string
  explanation: string
  amount?: Money
  employmentId?: string
  contributionId?: string
  kycType?: KycRecord['type']
  relatedRequestId?: string
  currentResponsibleParty?: RecordIssueResponsibleParty
  pensionServiceImpact?: string
}

export type RecordIssueType = 'pending-transfer' | 'contribution-record'
export type RecordIssueStatus = 'action-required' | 'in-progress' | 'resolved' | 'unavailable'
export type RecordIssueResponsibleParty = 'member' | 'source-employer' | 'destination-employer' | 'epfo' | 'none'

export interface RecordIssueReference {
  kind: 'employment' | 'contribution' | 'transfer' | 'request'
  id: string
  label: string
  value: string
}

export interface RecordIssueEvent {
  id: string
  label: string
  date: string | null
  detail?: string
}

export type RecordIssueAction =
  | { availability: 'available'; kind: 'start-transfer' | 'track-request' | 'raise-grievance'; label: string; contextId: string }
  | { availability: 'unavailable'; label: string; reason: string }
  | { availability: 'not-required'; label: string }

export interface RecordIssueCalculationLine {
  label: string
  amount: Money
}

export interface RecordIssue {
  id: string
  type: RecordIssueType
  status: RecordIssueStatus
  finding: string
  supportingRecords: RecordIssueReference[]
  affectedAmount?: Money
  affectedService: string
  financialImpact: string
  pensionServiceImpact: string
  responsibleParty: RecordIssueResponsibleParty
  responsiblePartyLabel: string
  currentStage: string
  lastConfirmedEvent: RecordIssueEvent
  recommendedNextAction: string
  resolutionAction: RecordIssueAction
  chronology: RecordIssueEvent[]
  calculationTrail: RecordIssueCalculationLine[]
}

export interface Ledger {
  contributions: ContributionRecord[]
  officialInterestCredits: InterestCredit[]
  estimatedInterestAccruals: EstimatedInterestAccrual[]
  transfers: TransferRecord[]
  withdrawals: WithdrawalRecord[]
}

export interface AccountState {
  version: 3
  member: Member
  kyc: KycRecord[]
  employments: Employment[]
  employmentGaps: EmploymentGap[]
  ledger: Ledger
  exceptions: AccountException[]
  requests: MemberRequest[]
  generatedReports: GeneratedReport[]
}

export interface Reconciliation {
  openingBalance: Money
  employeeContributions: Money
  employerEpfContributions: Money
  officialInterestCredits: Money
  transfersIn: Money
  transfersOut: Money
  withdrawals: Money
  closingBalance: Money
}

export interface EmployerSummary extends Reconciliation {
  employment: Employment
  epsContributions: Money
  estimatedInterestAccrued: Money
  transferState: TransferRecord['state'] | 'not-applicable'
}

export interface AttentionItem {
  id: string
  priority: AttentionPriority
  title: string
  explanation: string
  actionLabel: string
  route: 'passbook' | 'services' | 'requests' | 'account'
  contextId?: string
}

export interface MemberNotice {
  id: string
  title: string
  body: string
  publishedOn: string
  isNew: boolean
  attachment: NoticeAttachment
  attachmentLabel?: string
}

export interface LedgerTransaction {
  id: string
  date: string | null
  wageMonth?: string
  memberId: string
  employmentId: string
  type: 'contribution' | 'official-interest' | 'estimated-interest' | 'transfer-in' | 'transfer-out' | 'withdrawal'
  amount: Money | null
  state: string
  title: string
  explanation: string
  recordedDateExplanation: string
  needsAttention: boolean
}
