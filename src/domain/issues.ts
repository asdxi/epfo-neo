import { reconcileMemberId, totalEpfBalance } from './calculations'
import { deriveContributionResolution } from './contributionResolution'
import { requestEvidenceSummary } from './requestEvidence'
import type {
  AccountException,
  AccountState,
  JobChangeAttention,
  MemberRequest,
  RecordIssue,
  RecordIssueAction,
  RecordIssueActionCode,
  RecordIssueCode,
  RecordIssueEvent,
  RecordIssueResponsibleParty,
  RecordIssueSourceReference,
  RecordIssueStage,
  TransferRecord,
} from './types'

export const RECORD_ISSUE_RULE_VERSION = 'record-issue-rules/1.0.0' as const

const uniqueReferences = (references: RecordIssueSourceReference[]): RecordIssueSourceReference[] => {
  const seen = new Set<string>()
  return references.filter((reference) => {
    const key = `${reference.kind}:${reference.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const issueSnapshot = (
  exception: AccountException,
  fallbackAt: string | null,
  references: RecordIssueSourceReference[],
) => ({
  ruleVersion: exception.issueSnapshot?.ruleVersion ?? RECORD_ISSUE_RULE_VERSION,
  sourceSnapshotAt: exception.issueSnapshot?.sourceSnapshotAt ?? fallbackAt,
  sourceRecordReferences: uniqueReferences(references),
})

const requestEvents = (request?: MemberRequest): RecordIssueEvent[] => request?.timeline.map((event) => ({
  id: event.id,
  label: event.label,
  date: event.date,
  detail: event.explanation,
})) ?? []

const confirmedRequestEvent = (request?: MemberRequest): RecordIssueEvent | undefined => {
  const event = request ? requestEvidenceSummary(request).latestConfirmedEvent : undefined
  return event ? { id: event.id, label: event.label, date: event.date, detail: event.explanation } : undefined
}

const currentRequestStage = (request?: MemberRequest): RecordIssueStage | undefined => {
  const event = request?.timeline.find((item) => item.state === 'current')
  return event ? { code: 'SOURCE_EVENT', sourceEventId: event.id, label: event.label } : undefined
}

const actionFor = (code: RecordIssueActionCode, contextId?: string): RecordIssueAction => {
  if (code === 'NO_ACTION_REQUIRED') return { availability: 'not-required', code }
  if (code === 'ACTION_UNAVAILABLE' || !contextId) return { availability: 'unavailable', code: 'ACTION_UNAVAILABLE' }
  return { availability: 'available', code, contextId }
}

const requestClassification = (request?: MemberRequest): 'acknowledgement-missing' | 'rejected' | 'recorded' => {
  if (request?.state === 'rejected') return 'rejected'
  if (request && requestEvidenceSummary(request).firstMissingAcknowledgement) return 'acknowledgement-missing'
  return 'recorded'
}

const requestParty = (request?: MemberRequest): RecordIssueResponsibleParty | undefined => {
  const party = request?.timeline.find((event) => event.state === 'current')?.party
  if (party === 'member' || party === 'source-employer' || party === 'destination-employer' || party === 'epfo' || party === 'none') return party
  return request?.currentResponsibleParty
}

function unavailableIssue(
  exception: AccountException,
  type: RecordIssue['type'],
  missingSource: 'employment' | 'transfer' | 'contribution',
): RecordIssue {
  const persisted = exception.issueSnapshot
  const snapshot = issueSnapshot(exception, null, persisted?.sourceRecordReferences ?? [])
  const event = { id: `${exception.id}-source-snapshot`, label: 'Source snapshot recorded', date: snapshot.sourceSnapshotAt }
  return {
    id: exception.id,
    type,
    code: 'RECORD_UNAVAILABLE',
    ...snapshot,
    status: 'unavailable',
    facts: { kind: 'unavailable', missingSource },
    responsiblePartyCode: 'none',
    actionCode: 'ACTION_UNAVAILABLE',
    relatedRequestId: exception.relatedRequestId ?? null,
    currentStage: { code: 'RECORD_UNAVAILABLE', sourceEventId: null, label: null },
    lastConfirmedEvent: event,
    action: actionFor('ACTION_UNAVAILABLE'),
    chronology: [],
    calculationTrail: [],
  }
}

const transferForException = (
  account: AccountState,
  exception: AccountException,
  sourceMemberId: string,
  destinationMemberId: string,
): TransferRecord | undefined => account.ledger.transfers
  .filter((transfer) => {
    const requestMatch = Boolean(exception.relatedRequestId) && transfer.relatedRequestId === exception.relatedRequestId
    const factMatch = transfer.fromMemberId === sourceMemberId
      && transfer.toMemberId === destinationMemberId
      && exception.amount !== undefined
      && transfer.amount === exception.amount
    return requestMatch || factMatch
  })
  .sort((first, second) => second.initiatedOn.localeCompare(first.initiatedOn) || first.id.localeCompare(second.id))[0]

const transferIssueCode = (transfer: TransferRecord | undefined, request: MemberRequest | undefined, exception: AccountException): RecordIssueCode => {
  if (transfer?.state === 'completed') return 'TRANSFER_COMPLETED'
  if (request?.state === 'completed' || exception.state === 'resolved') return 'RECORD_UNAVAILABLE'
  const requestState = requestClassification(request)
  if (requestState === 'acknowledgement-missing') return 'REQUEST_ACKNOWLEDGEMENT_MISSING'
  if (requestState === 'rejected') return 'REQUEST_REJECTED'
  if (transfer) return 'TRANSFER_IN_PROGRESS'
  if (exception.state === 'open') return 'TRANSFER_READY'
  return 'RECORD_UNAVAILABLE'
}

const transferActionCode = (code: RecordIssueCode, request?: MemberRequest): RecordIssueActionCode => {
  if (code === 'TRANSFER_COMPLETED') return 'NO_ACTION_REQUIRED'
  if (code === 'TRANSFER_READY') return 'START_TRANSFER'
  if (code === 'REQUEST_ACKNOWLEDGEMENT_MISSING') return 'CHECK_EXISTING_ATTEMPT'
  if (code === 'REQUEST_REJECTED') return 'RECOVER_REQUEST'
  if (code === 'TRANSFER_IN_PROGRESS' && request) return 'TRACK_TRANSFER'
  return 'ACTION_UNAVAILABLE'
}

function deriveTransferIssue(account: AccountState, exception: AccountException): RecordIssue {
  const source = account.employments.find((employment) => employment.id === exception.employmentId)
  const destination = account.employments.find((employment) => employment.status === 'current')
  if (!source || !destination) return unavailableIssue(exception, 'pending-transfer', 'employment')

  const transfer = transferForException(account, exception, source.memberId, destination.memberId)
  const request = account.requests.find((item) => item.id === (transfer?.relatedRequestId ?? exception.relatedRequestId))
  const amount = transfer?.amount ?? exception.amount
  const code = transferIssueCode(transfer, request, exception)
  if (amount === undefined || code === 'RECORD_UNAVAILABLE') return unavailableIssue(exception, 'pending-transfer', 'transfer')

  const completed = code === 'TRANSFER_COMPLETED'
  const actionCode = transferActionCode(code, request)
  const status = completed ? 'resolved' : code === 'TRANSFER_IN_PROGRESS' ? 'in-progress' : 'action-required'
  const responsiblePartyCode: RecordIssueResponsibleParty = completed
    ? 'none'
    : code === 'TRANSFER_READY' || code === 'REQUEST_ACKNOWLEDGEMENT_MISSING'
      ? 'member'
      : requestParty(request) ?? exception.currentResponsibleParty ?? 'none'
  const sourceBalance = reconcileMemberId(account, source.memberId).closingBalance
  const destinationBalance = reconcileMemberId(account, destination.memberId).closingBalance
  const actualReferences: RecordIssueSourceReference[] = [
    { kind: 'employment', id: source.id },
    { kind: 'employment', id: destination.id },
    ...(transfer ? [{ kind: 'transfer' as const, id: transfer.id }] : []),
    ...(request ? [{ kind: 'request' as const, id: request.id }] : []),
  ]
  const fallbackSnapshot = transfer?.completedOn ?? confirmedRequestEvent(request)?.date ?? transfer?.initiatedOn ?? source.exitedOn ?? source.joinedOn
  const snapshot = issueSnapshot(exception, fallbackSnapshot, actualReferences)
  const fallbackEvent: RecordIssueEvent = completed
    ? { id: `${transfer?.id}-completed`, label: 'Transfer posted to destination', date: transfer?.completedOn ?? null }
    : transfer
      ? { id: `${transfer.id}-initiated`, label: 'Transfer started', date: transfer.initiatedOn }
      : { id: `${source.id}-balance`, label: 'Previous balance recorded', date: source.exitedOn ?? source.joinedOn }
  const latestEvent = confirmedRequestEvent(request) ?? fallbackEvent
  const chronology = requestEvents(request)
  const currentStage: RecordIssueStage = completed
    ? { code: 'COMPLETED', sourceEventId: null, label: null }
    : code === 'TRANSFER_READY'
      ? { code: 'READY_TO_START', sourceEventId: null, label: null }
      : currentRequestStage(request) ?? { code: 'SOURCE_EVENT', sourceEventId: transfer?.id ?? null, label: latestEvent.label }

  return {
    id: exception.id,
    type: 'pending-transfer',
    code,
    ...snapshot,
    status,
    facts: {
      kind: 'transfer',
      sourceEmployment: { id: source.id, employer: source.employer, memberId: source.memberId },
      destinationEmployment: { id: destination.id, employer: destination.employer, memberId: destination.memberId },
      transferId: transfer?.id ?? null,
      transferState: transfer?.state ?? 'ready',
      amount,
      currentlyCountedUnderEmploymentId: completed ? destination.id : source.id,
      addedToDestination: completed ? 'completed' : 'after-completion',
      duplicateAmountInTotal: false,
      pensionServiceState: transfer?.pensionServiceState ?? exception.pensionServiceState ?? 'not-confirmed',
    },
    responsiblePartyCode,
    actionCode,
    relatedRequestId: request?.id ?? null,
    currentStage,
    lastConfirmedEvent: latestEvent,
    action: actionFor(actionCode, actionCode === 'START_TRANSFER' ? source.id : request?.id),
    chronology: chronology.length > 0 ? chronology : [fallbackEvent],
    calculationTrail: [
      { label: `${source.employer} recorded EPF`, amount: sourceBalance },
      { label: `${destination.employer} recorded EPF`, amount: destinationBalance },
      { label: 'Total recorded EPF', amount: totalEpfBalance(account) },
    ],
    identityRisk: transfer?.uanEvidence?.confirmation === 'confirmed' && transfer.uanEvidence.sourceUan !== transfer.uanEvidence.destinationUan
      ? { label: 'Possible multiple-UAN record', explanation: transfer.uanEvidence.explanation }
      : undefined,
  }
}

const contributionIssueCode = (exception: AccountException, request?: MemberRequest): RecordIssueCode => {
  if (exception.state === 'resolved') return 'CONTRIBUTION_COMPONENT_MISSING'
  const requestState = requestClassification(request)
  if (requestState === 'acknowledgement-missing') return 'REQUEST_ACKNOWLEDGEMENT_MISSING'
  if (requestState === 'rejected') return 'REQUEST_REJECTED'
  return 'CONTRIBUTION_COMPONENT_MISSING'
}

function deriveContributionIssue(account: AccountState, exception: AccountException): RecordIssue {
  const contribution = account.ledger.contributions.find((item) => item.id === exception.contributionId)
  const employment = account.employments.find((item) => item.id === (contribution?.employmentId ?? exception.employmentId))
  if (!contribution || !employment) return unavailableIssue(exception, 'contribution-record', 'contribution')

  const discrepancy = deriveContributionResolution(account, contribution.id)
  if (!discrepancy) return unavailableIssue(exception, 'contribution-record', 'contribution')
  const request = account.requests.find((item) => item.id === exception.relatedRequestId)
  const code = contributionIssueCode(exception, request)
  const resolved = exception.state === 'resolved'
  const status = resolved ? 'resolved' : request && code === 'CONTRIBUTION_COMPONENT_MISSING' ? 'in-progress' : 'action-required'
  const actionCode: RecordIssueActionCode = resolved
    ? 'NO_ACTION_REQUIRED'
    : code === 'REQUEST_ACKNOWLEDGEMENT_MISSING'
      ? 'CHECK_EXISTING_ATTEMPT'
      : code === 'REQUEST_REJECTED'
        ? 'RECOVER_REQUEST'
        : request
          ? 'TRACK_CONTRIBUTION_REVIEW'
          : 'RAISE_CONTRIBUTION_GRIEVANCE'
  const responsiblePartyCode: RecordIssueResponsibleParty = resolved
    ? 'none'
    : code === 'REQUEST_ACKNOWLEDGEMENT_MISSING'
      ? 'member'
      : requestParty(request) ?? exception.currentResponsibleParty ?? 'member'
  const chronology = [
    { id: `${contribution.id}-recorded`, label: 'Contribution entry recorded', date: contribution.recordedOn, detail: contribution.explanation },
    ...requestEvents(request),
  ]
  const lastEvent = confirmedRequestEvent(request) ?? chronology[0]
  const references: RecordIssueSourceReference[] = [
    { kind: 'employment', id: employment.id },
    { kind: 'contribution', id: contribution.id },
    ...(request ? [{ kind: 'request' as const, id: request.id }] : []),
  ]
  const snapshot = issueSnapshot(exception, lastEvent.date ?? contribution.wageMonth, references)
  const components = discrepancy.recordedComponents.map((component, index) => ({
    code: component.code,
    expected: discrepancy.expectedComponents[index].amount,
    recorded: component.amount,
  }))
  const recordedEpfComponents = [contribution.employeeEpf, contribution.voluntaryEpf, contribution.employerEpf]
    .filter((amount): amount is number => amount !== null)
  const knownRecordedEpf = recordedEpfComponents.length > 0
    ? recordedEpfComponents.reduce((total, amount) => total + amount, 0)
    : null
  const currentStage: RecordIssueStage = resolved
    ? { code: 'RESOLVED', sourceEventId: null, label: null }
    : currentRequestStage(request) ?? { code: 'MEMBER_REVIEW', sourceEventId: null, label: null }

  return {
    id: exception.id,
    type: 'contribution-record',
    code,
    ...snapshot,
    status,
    facts: {
      kind: 'contribution',
      employment: { id: employment.id, employer: employment.employer, memberId: employment.memberId },
      contributionId: contribution.id,
      wageMonth: contribution.wageMonth,
      recordedOn: contribution.recordedOn,
      components,
      missingComponents: discrepancy.missingComponents,
      knownRecordedEpf,
    },
    responsiblePartyCode,
    actionCode,
    relatedRequestId: request?.id ?? null,
    currentStage,
    lastConfirmedEvent: lastEvent,
    action: actionFor(actionCode, request?.id ?? contribution.id),
    chronology,
    calculationTrail: [
      ...(contribution.employeeEpf === null ? [] : [{ label: 'Employee EPF recorded', amount: contribution.employeeEpf }]),
      ...(contribution.voluntaryEpf === null ? [] : [{ label: 'VPF recorded', amount: contribution.voluntaryEpf }]),
      ...(contribution.employerEpf === null ? [] : [{ label: 'Employer EPF recorded', amount: contribution.employerEpf }]),
      ...(knownRecordedEpf === null ? [] : [{ label: 'Known EPF recorded for this Salary Month', amount: knownRecordedEpf }]),
    ],
    discrepancy,
  }
}

const issueDedupeKey = (issue: RecordIssue): string => issue.facts.kind === 'transfer'
  ? `transfer:${issue.facts.sourceEmployment.memberId}:${issue.facts.destinationEmployment.memberId}:${issue.facts.amount}`
  : issue.facts.kind === 'contribution'
    ? `contribution:${issue.facts.contributionId}`
    : `unavailable:${issue.id}`

export function deriveRecordIssues(account: AccountState): RecordIssue[] {
  const candidates = account.exceptions.flatMap((exception) => {
    if (exception.kind === 'previous-balance') return [deriveTransferIssue(account, exception)]
    if (exception.kind === 'contribution-review') return [deriveContributionIssue(account, exception)]
    return []
  }).sort((first, second) => (second.sourceSnapshotAt ?? '').localeCompare(first.sourceSnapshotAt ?? '') || first.id.localeCompare(second.id))
  const deduped = new Map<string, RecordIssue>()
  for (const issue of candidates) if (!deduped.has(issueDedupeKey(issue))) deduped.set(issueDedupeKey(issue), issue)
  const rank: Record<RecordIssue['type'], number> = { 'pending-transfer': 0, 'contribution-record': 1 }
  return [...deduped.values()].sort((first, second) => rank[first.type] - rank[second.type] || first.id.localeCompare(second.id))
}

export const activeRecordIssues = (account: AccountState): RecordIssue[] =>
  deriveRecordIssues(account).filter((issue) => issue.status !== 'resolved')

export function deriveJobChangeAttention(account: AccountState): JobChangeAttention[] {
  const latestContribution = [...account.ledger.contributions]
    .sort((first, second) => second.wageMonth.localeCompare(first.wageMonth) || first.id.localeCompare(second.id))[0]
  const current = account.employments.find((employment) => employment.status === 'current')
    ?? account.employments.find((employment) => employment.id === latestContribution?.employmentId && !employment.exitedOn)
  if (!current) return []

  const transferIssues = deriveRecordIssues(account).filter((issue) => issue.facts.kind === 'transfer')
  const candidates = account.employments
    .filter((employment) => employment.id !== current.id && (
      employment.status === 'balance-remaining'
      || account.ledger.transfers.some((transfer) => transfer.fromMemberId === employment.memberId
        && transfer.toMemberId === current.memberId
        && transfer.state !== 'completed')
    ))
    .map((source): JobChangeAttention | undefined => {
      const amount = reconcileMemberId(account, source.memberId).closingBalance
      if (amount <= 0) return undefined
      const issue = transferIssues.find((candidate) => candidate.status !== 'resolved'
        && candidate.facts.kind === 'transfer'
        && candidate.facts.sourceEmployment.id === source.id
        && candidate.facts.destinationEmployment.id === current.id)
      const transfer = account.ledger.transfers
        .filter((item) => item.fromMemberId === source.memberId && item.toMemberId === current.memberId && item.state !== 'completed')
        .sort((first, second) => second.initiatedOn.localeCompare(first.initiatedOn) || first.id.localeCompare(second.id))[0]
      const request = account.requests.find((item) => item.id === transfer?.relatedRequestId)
      const requestState = requestClassification(request)
      const actionCode = issue?.actionCode
        ?? (requestState === 'acknowledgement-missing' ? 'CHECK_EXISTING_ATTEMPT'
          : requestState === 'rejected' ? 'RECOVER_REQUEST'
            : request ? 'TRACK_TRANSFER'
              : transfer ? 'ACTION_UNAVAILABLE'
                : 'START_TRANSFER')
      return {
        id: `job-change:${source.memberId}:${current.memberId}`,
        issueId: issue?.id ?? `job-change-${source.id}-${current.id}`,
        sourceEmployment: { id: source.id, employer: source.employer, memberId: source.memberId },
        destinationEmployment: { id: current.id, employer: current.employer, memberId: current.memberId },
        amount,
        actionCode,
        relatedRequestId: issue?.relatedRequestId ?? request?.id ?? null,
      }
    })
    .filter((item): item is JobChangeAttention => Boolean(item))
  return [...new Map(candidates.map((item) => [item.id, item])).values()]
    .sort((first, second) => first.sourceEmployment.id.localeCompare(second.sourceEmployment.id))
}
