import type {
  ContributionComponentCode,
  ContributionDiscrepancyCategory,
  RecordIssueActionCode,
  RecordIssueCode,
  RecordIssueResponsibleParty,
  RecordIssueStageCode,
  RecordIssueStatus,
} from './types'

export const ISSUE_CONTENT_CATALOGUE_VERSION = 'record-issue-content/1.0.0' as const

export interface IssueContentCatalogue {
  version: string
  issues: Record<RecordIssueCode, { label: string; shortExplanation: string }>
  statuses: Record<RecordIssueStatus, string>
  actions: Record<RecordIssueActionCode, { label: string; explanation: string }>
  responsibleParties: Record<RecordIssueResponsibleParty, string>
  contributionComponents: Record<ContributionComponentCode, string>
  contributionDiscrepancies: Record<ContributionDiscrepancyCategory, string>
  pensionServiceStates: Record<'linked-employment-record' | 'not-confirmed', string>
  stages: Record<Exclude<RecordIssueStageCode, 'SOURCE_EVENT'>, string>
}

export const issueContentCatalogue: IssueContentCatalogue = {
  version: ISSUE_CONTENT_CATALOGUE_VERSION,
  issues: {
    TRANSFER_READY: { label: 'Pending PF Transfer', shortExplanation: 'Your previous PF is ready to transfer.' },
    TRANSFER_IN_PROGRESS: { label: 'Pending PF Transfer', shortExplanation: 'Your PF transfer is still being processed.' },
    TRANSFER_COMPLETED: { label: 'PF Transfer Completed', shortExplanation: 'Your PF transfer is complete.' },
    CONTRIBUTION_COMPONENT_MISSING: { label: 'Employer PF Not Recorded', shortExplanation: 'Employer PF is missing from this contribution.' },
    REQUEST_ACKNOWLEDGEMENT_MISSING: { label: 'Request Not Confirmed', shortExplanation: 'A receipt or acknowledgement is not available.' },
    REQUEST_REJECTED: { label: 'Request Needs Correction', shortExplanation: 'This request was rejected and can be corrected.' },
    RECORD_UNAVAILABLE: { label: 'Record Unavailable', shortExplanation: 'A required record is unavailable.' },
  },
  statuses: {
    'action-required': 'Action Required',
    'in-progress': 'In Progress',
    resolved: 'Resolved',
    unavailable: 'Record Unavailable',
  },
  actions: {
    START_TRANSFER: { label: 'Start Transfer', explanation: 'Review the previous PF record, then start the transfer.' },
    TRACK_TRANSFER: { label: 'Track Transfer', explanation: 'Open the existing transfer request to see its latest update.' },
    RAISE_CONTRIBUTION_GRIEVANCE: { label: 'Request Review', explanation: 'Raise a grievance to request a review.' },
    TRACK_CONTRIBUTION_REVIEW: { label: 'Track Review Request', explanation: 'Open the existing contribution review request.' },
    CHECK_EXISTING_ATTEMPT: { label: 'Check Existing Attempt', explanation: 'Check the existing attempt before starting again.' },
    RECOVER_REQUEST: { label: 'Correct This Request', explanation: 'Review the rejection and continue with the same request.' },
    NO_ACTION_REQUIRED: { label: 'No Action Needed', explanation: 'This issue is kept in your history.' },
    ACTION_UNAVAILABLE: { label: 'Action Unavailable', explanation: 'An action cannot be offered until the record is available.' },
  },
  responsibleParties: {
    member: 'You',
    'source-employer': 'Previous Employer',
    'destination-employer': 'Current Employer',
    epfo: 'EPFO',
    none: 'No Action Needed',
  },
  contributionComponents: {
    'employee-epf': 'Employee EPF',
    'voluntary-epf': 'VPF',
    'employer-epf': 'Employer EPF',
    eps: 'EPS',
  },
  contributionDiscrepancies: {
    'missing-contribution': 'Contribution Not Recorded',
    'incorrect-amount': 'Recorded Amount Does Not Match',
    'wrong-employer': 'Wrong Employer',
    'incorrect-wage-month': 'Wrong Salary Month',
    'late-recording': 'Contribution Recorded Late',
    'inconsistent-epf-eps-component': 'Employer PF Not Recorded',
  },
  pensionServiceStates: {
    'linked-employment-record': 'Linked Employment Record Included',
    'not-confirmed': 'Not Confirmed for This Transfer',
  },
  stages: {
    READY_TO_START: 'Ready to Start',
    COMPLETED: 'Completed',
    RESOLVED: 'Resolved',
    MEMBER_REVIEW: 'Member Review Needed',
    RECORD_UNAVAILABLE: 'Record Unavailable',
  },
}

export const issueContentFor = (code: RecordIssueCode, catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.issues[code]
export const issueActionContent = (code: RecordIssueActionCode, catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.actions[code]
export const issueStatusLabel = (status: RecordIssueStatus, catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.statuses[status]
export const responsiblePartyLabel = (party: RecordIssueResponsibleParty, catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.responsibleParties[party]
export const contributionComponentLabel = (component: ContributionComponentCode, catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.contributionComponents[component]
export const contributionDiscrepancyLabel = (category: ContributionDiscrepancyCategory, catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.contributionDiscrepancies[category]
export const pensionServiceStateLabel = (state: 'linked-employment-record' | 'not-confirmed', catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.pensionServiceStates[state]
export const issueStageLabel = (code: Exclude<RecordIssueStageCode, 'SOURCE_EVENT'>, catalogue: IssueContentCatalogue = issueContentCatalogue) => catalogue.stages[code]
