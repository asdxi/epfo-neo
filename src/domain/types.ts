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
  | 'submission-attempted' | 'received' | 'rejected'
export type ReportFormat = 'pdf' | 'excel'
export type ReportState = 'preparing' | 'ready' | 'failed' | 'expired'
export type AttentionPriority = 'action-required' | 'in-progress' | 'good-to-know'
export type NoticeAttachment = 'pdf' | 'none'
export type TransferInitiationMethod = 'automatic' | 'manual'
export type TransferPreflightState =
  | 'no-previous-balance'
  | 'automatic-completed'
  | 'automatic-in-progress'
  | 'existing-manual-request'
  | 'manual-required'
  | 'blocked-record-or-identity'

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
  institutionName?: string
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
  pfAccounts?: Array<{
    entity: string
    provider: EstablishmentType
    accountNumber: string
  }>
}

export interface EmploymentGap {
  startsOn: string
  endsOn: string
  label: 'No EPF-Covered Employment Recorded'
}

export interface ContributionRecord {
  id: string
  employmentId: string
  memberId: string
  wageMonth: string
  recordedOn: string | null
  pfWage: Money | null
  employeeEpf: Money | null
  voluntaryEpf: Money | null
  employerEpf: Money | null
  eps: Money | null
  status: ContributionStatus
  explanation: string
  transactionReference?: string
  expectedRecord?: ContributionExpectation
}

export type ContributionDiscrepancyCategory =
  | 'missing-contribution'
  | 'incorrect-amount'
  | 'wrong-employer'
  | 'incorrect-wage-month'
  | 'late-recording'
  | 'inconsistent-epf-eps-component'

export interface ContributionExpectation {
  employmentId: string
  wageMonth: string
  pfWage: Money | null
  employeeEpf: Money | null
  voluntaryEpf: Money | null
  employerEpf: Money | null
  eps: Money | null
  basis: string
  reference: string
  evidenceHeld: string[]
  evidenceMemberMayNeed: string[]
}

export interface InterestCredit {
  id: string
  memberId: string
  financialYear: string
  creditedOn: string
  amount: Money
  annualRateBasisPoints: number
  monthlyBalanceTotal: Money
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
  initiationMethod: TransferInitiationMethod
  source: EstablishmentType
  explanation: string
  relatedRequestId?: string
  pensionServiceState?: 'linked-employment-record' | 'not-confirmed'
  uanEvidence?: {
    sourceUan: string
    destinationUan: string
    confirmation: 'confirmed' | 'unconfirmed'
    explanation: string
  }
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
  kind?: 'member-submission-attempt' | 'channel-receipt' | 'epfo-acknowledgement' | 'responsible-party-assignment' | 'bank-handoff' | 'resolution'
  confirmation?: 'confirmed' | 'missing' | 'expected'
  party?: RecordIssueResponsibleParty | 'bank' | 'portal'
  channel?: string
  reference?: string
}

export interface RequestRejection {
  originalRemark: string
  plainLanguageMeaning: string
  mismatch: string
  correctableBy: string
  evidenceNeeded: string[]
  recoveryAction: 'correct' | 'prepare' | 'resume' | 'escalate'
  requiresFreshSubmission: boolean
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
  channel?: string
  externalReference?: string
  currentResponsibleParty?: RecordIssueResponsibleParty
  rejection?: RequestRejection
  recoveryPreparedOn?: string
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
  pensionServiceState?: 'linked-employment-record' | 'not-confirmed'
  issueSnapshot?: RecordIssueSourceSnapshot
}

export type RecordIssueType = 'pending-transfer' | 'contribution-record'
export type RecordIssueStatus = 'action-required' | 'in-progress' | 'resolved' | 'unavailable'
export type RecordIssueResponsibleParty = 'member' | 'source-employer' | 'destination-employer' | 'epfo' | 'none'
export type RecordIssueCode =
  | 'TRANSFER_READY'
  | 'TRANSFER_IN_PROGRESS'
  | 'TRANSFER_COMPLETED'
  | 'CONTRIBUTION_COMPONENT_MISSING'
  | 'REQUEST_ACKNOWLEDGEMENT_MISSING'
  | 'REQUEST_REJECTED'
  | 'RECORD_UNAVAILABLE'
export type RecordIssueActionCode =
  | 'START_TRANSFER'
  | 'TRACK_TRANSFER'
  | 'RAISE_CONTRIBUTION_GRIEVANCE'
  | 'TRACK_CONTRIBUTION_REVIEW'
  | 'CHECK_EXISTING_ATTEMPT'
  | 'RECOVER_REQUEST'
  | 'NO_ACTION_REQUIRED'
  | 'ACTION_UNAVAILABLE'
export type ContributionComponentCode = 'employee-epf' | 'voluntary-epf' | 'employer-epf' | 'eps'

export interface RecordIssueSourceReference {
  kind: 'employment' | 'contribution' | 'transfer' | 'request'
  id: string
}

export interface RecordIssueSourceSnapshot {
  ruleVersion: string
  sourceSnapshotAt: string | null
  sourceRecordReferences: RecordIssueSourceReference[]
}

export interface RecordIssueEvent {
  id: string
  label: string
  date: string | null
  detail?: string
}

export type RecordIssueStageCode = 'SOURCE_EVENT' | 'READY_TO_START' | 'COMPLETED' | 'RESOLVED' | 'MEMBER_REVIEW' | 'RECORD_UNAVAILABLE'

export interface RecordIssueStage {
  code: RecordIssueStageCode
  sourceEventId: string | null
  label: string | null
}

export type RecordIssueAction =
  | { availability: 'available'; code: Exclude<RecordIssueActionCode, 'NO_ACTION_REQUIRED' | 'ACTION_UNAVAILABLE'>; contextId: string }
  | { availability: 'unavailable'; code: 'ACTION_UNAVAILABLE' }
  | { availability: 'not-required'; code: 'NO_ACTION_REQUIRED' }

export interface RecordIssueCalculationLine {
  label: string
  amount: Money
}

export interface TransferIssueFacts {
  kind: 'transfer'
  sourceEmployment: { id: string; employer: string; memberId: string }
  destinationEmployment: { id: string; employer: string; memberId: string }
  transferId: string | null
  transferState: TransferRecord['state'] | 'ready'
  amount: Money
  currentlyCountedUnderEmploymentId: string
  addedToDestination: 'after-completion' | 'completed'
  duplicateAmountInTotal: false
  pensionServiceState: 'linked-employment-record' | 'not-confirmed'
}

export interface ContributionIssueFacts {
  kind: 'contribution'
  employment: { id: string; employer: string; memberId: string }
  contributionId: string
  wageMonth: string
  recordedOn: string | null
  components: Array<{ code: ContributionComponentCode; expected: Money | null; recorded: Money | null }>
  missingComponents: ContributionComponentCode[]
  knownRecordedEpf: Money | null
}

export interface UnavailableIssueFacts {
  kind: 'unavailable'
  missingSource: 'employment' | 'transfer' | 'contribution'
}

export type RecordIssueFacts = TransferIssueFacts | ContributionIssueFacts | UnavailableIssueFacts

export interface RecordIssue {
  id: string
  type: RecordIssueType
  code: RecordIssueCode
  ruleVersion: string
  sourceSnapshotAt: string | null
  status: RecordIssueStatus
  sourceRecordReferences: RecordIssueSourceReference[]
  facts: RecordIssueFacts
  responsiblePartyCode: RecordIssueResponsibleParty
  actionCode: RecordIssueActionCode
  relatedRequestId: string | null
  currentStage: RecordIssueStage
  lastConfirmedEvent: RecordIssueEvent
  action: RecordIssueAction
  chronology: RecordIssueEvent[]
  calculationTrail: RecordIssueCalculationLine[]
  identityRisk?: {
    label: string
    explanation: string
  }
  discrepancy?: ContributionResolution
}

export interface ContributionResolution {
  category: ContributionDiscrepancyCategory
  validCategories: ContributionDiscrepancyCategory[]
  categoryLabel: string
  expectedComponents: Array<{ code: ContributionComponentCode; amount: Money | null }>
  recordedComponents: Array<{ code: ContributionComponentCode; amount: Money | null }>
  missingComponents: ContributionComponentCode[]
  expectedEmployer: string
  expectedWageMonth: string
  expectationBasis: string
  references: string[]
  evidenceHeld: string[]
  evidenceMemberMayNeed: string[]
  preparedDescription: string
  responsibleParty: RecordIssueResponsibleParty
  memberImpact: string
}

export interface Ledger {
  contributions: ContributionRecord[]
  officialInterestCredits: InterestCredit[]
  estimatedInterestAccruals: EstimatedInterestAccrual[]
  transfers: TransferRecord[]
  withdrawals: WithdrawalRecord[]
}

export interface AccountState {
  version: 7
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
  voluntaryContributions: Money
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

export interface JobChangeAttention {
  id: string
  issueId: string
  sourceEmployment: { id: string; employer: string; memberId: string }
  destinationEmployment: { id: string; employer: string; memberId: string }
  amount: Money
  actionCode: RecordIssueActionCode
  relatedRequestId: string | null
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
  employeeEpf?: Money | null
  voluntaryEpf?: Money | null
  employerEpf?: Money | null
  state: string
  title: string
  explanation: string
  recordedDateExplanation: string
  needsAttention: boolean
}
