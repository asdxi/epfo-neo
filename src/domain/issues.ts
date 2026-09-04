import { formatDate, formatMoney, formatWageMonth, reconcileMemberId, totalEpfBalance } from './calculations'
import { deriveContributionResolution } from './contributionResolution'
import type {
  AccountException,
  AccountState,
  RecordIssue,
  RecordIssueAction,
  RecordIssueEvent,
  RecordIssueResponsibleParty,
  RecordIssueStatus,
} from './types'

const partyLabels: Record<RecordIssueResponsibleParty, string> = {
  member: 'You',
  'source-employer': 'Previous employer',
  'destination-employer': 'Current employer',
  epfo: 'EPFO',
  none: 'No action owner',
}

const issueStatus = (exception: AccountException, evidenceAvailable: boolean): RecordIssueStatus => {
  if (exception.state === 'resolved') return 'resolved'
  if (!evidenceAvailable) return 'unavailable'
  return exception.state === 'in-progress' ? 'in-progress' : 'action-required'
}

const requestEvents = (account: AccountState, requestId?: string): RecordIssueEvent[] => {
  const request = account.requests.find((item) => item.id === requestId)
  return request?.timeline.map((event) => ({ id: event.id, label: event.label, date: event.date, detail: event.explanation })) ?? []
}

const lastConfirmedRequestEvent = (events: RecordIssueEvent[]): RecordIssueEvent | undefined =>
  [...events].filter((event) => event.date !== null).sort((first, second) => (second.date ?? '').localeCompare(first.date ?? ''))[0]

function unavailableIssue(exception: AccountException, type: RecordIssue['type'], missingRecord: string): RecordIssue {
  return {
    id: exception.id,
    type,
    status: exception.state === 'resolved' ? 'resolved' : 'unavailable',
    finding: exception.title,
    supportingRecords: [],
    affectedAmount: exception.amount,
    affectedService: type === 'pending-transfer' ? 'EPF transfer and pension-service record' : 'Monthly contribution record',
    financialImpact: `The financial effect cannot be confirmed because ${missingRecord} is unavailable.`,
    pensionServiceImpact: 'The pension-service effect cannot be confirmed from the available record.',
    responsibleParty: 'none',
    responsiblePartyLabel: partyLabels.none,
    currentStage: 'Record unavailable',
    lastConfirmedEvent: { id: `${exception.id}-unavailable`, label: 'Supporting record unavailable', date: null },
    recommendedNextAction: 'Return later when the supporting record is available.',
    resolutionAction: { availability: 'unavailable', label: 'Action unavailable', reason: `No action can be started until ${missingRecord} is available.` },
    chronology: [],
    calculationTrail: [],
  }
}

function deriveTransferIssue(account: AccountState, exception: AccountException): RecordIssue {
  const source = account.employments.find((item) => item.id === exception.employmentId)
  const transfer = account.ledger.transfers
    .filter((item) => item.relatedRequestId === exception.relatedRequestId || (item.fromMemberId === source?.memberId && item.amount === exception.amount))
    .sort((first, second) => second.initiatedOn.localeCompare(first.initiatedOn))[0]
  const destination = account.employments.find((item) => item.memberId === transfer?.toMemberId)
    ?? account.employments.find((item) => item.status === 'current')
  const amount = transfer?.amount ?? exception.amount
  if (!source || !destination || amount === undefined || (exception.state !== 'open' && !transfer)) return unavailableIssue(exception, 'pending-transfer', 'the linked transfer record')

  const request = account.requests.find((item) => item.id === exception.relatedRequestId)
  const chronology = requestEvents(account, request?.id)
  const currentEvent = request?.timeline.find((event) => event.state === 'current')
  const lastEvent = lastConfirmedRequestEvent(chronology) ?? {
    id: transfer ? `${transfer.id}-initiated` : `${exception.id}-balance`,
    label: transfer ? 'Transfer started' : 'Previous balance recorded',
    date: transfer?.initiatedOn ?? source.exitedOn ?? null,
    detail: transfer?.explanation ?? exception.explanation,
  }
  const status = issueStatus(exception, true)
  const completed = transfer?.state === 'completed' || status === 'resolved'
  const responsibleParty = status === 'resolved' ? 'none' : (exception.currentResponsibleParty ?? 'epfo')
  const sourceBalance = reconcileMemberId(account, source.memberId).closingBalance
  const destinationBalance = reconcileMemberId(account, destination.memberId).closingBalance
  const action: RecordIssueAction = status === 'resolved'
    ? { availability: 'not-required', label: 'No further action needed' }
    : request
      ? { availability: 'available', kind: 'track-request', label: 'Track transfer', contextId: request.id }
      : exception.state === 'open'
        ? { availability: 'available', kind: 'start-transfer', label: 'Start transfer', contextId: source.id }
        : { availability: 'unavailable', label: 'Tracking unavailable', reason: 'The linked request is not available yet.' }

  return {
    id: exception.id,
    type: 'pending-transfer',
    status,
    finding: completed
      ? `${formatMoney(amount)} was transferred from ${source.employer} and posted once to ${destination.employer}.`
      : exception.state === 'open'
      ? `${formatMoney(amount)} is still recorded under ${source.employer} and is ready to transfer to ${destination.employer}.`
      : `${formatMoney(amount)} is still recorded under ${source.employer} while its transfer to ${destination.employer} is in progress.`,
    supportingRecords: [
      { kind: 'employment', id: source.id, label: 'Source employer', value: `${source.employer} · ${source.memberId}` },
      { kind: 'employment', id: destination.id, label: 'Destination employer', value: `${destination.employer} · ${destination.memberId}` },
      ...(transfer ? [{ kind: 'transfer' as const, id: transfer.id, label: 'Transfer amount', value: formatMoney(amount) }] : [{ kind: 'employment' as const, id: source.id, label: 'Balance ready to transfer', value: formatMoney(amount) }]),
      ...(request ? [{ kind: 'request' as const, id: request.id, label: 'Request reference', value: request.reference }] : []),
    ],
    affectedAmount: amount,
    affectedService: 'EPF transfer and pension-service continuity',
    financialImpact: completed
      ? `${formatMoney(amount)} is no longer included under ${source.employer}; it is posted once under ${destination.employer}.`
      : `${formatMoney(amount)} is included once in the recorded EPF balance under ${source.employer}. It has not also been added to ${destination.employer}.`,
    pensionServiceImpact: exception.pensionServiceImpact ?? 'The linked pension-service consequence is not available.',
    responsibleParty,
    responsiblePartyLabel: partyLabels[responsibleParty],
    currentStage: status === 'resolved' ? 'Completed' : (currentEvent?.label ?? request?.nextExpectedStep ?? (exception.state === 'open' ? 'Ready to start' : 'Transfer submitted')),
    lastConfirmedEvent: lastEvent,
    recommendedNextAction: status === 'resolved' ? 'No further action is needed.' : request?.nextExpectedStep ?? 'Start the transfer from the previous employment record.',
    resolutionAction: action,
    chronology: chronology.length > 0 ? chronology : [lastEvent],
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

function deriveContributionIssue(account: AccountState, exception: AccountException): RecordIssue {
  const contribution = account.ledger.contributions.find((item) => item.id === exception.contributionId)
  const employment = account.employments.find((item) => item.id === (contribution?.employmentId ?? exception.employmentId))
  if (!contribution || !employment) return unavailableIssue(exception, 'contribution-record', 'the linked contribution record')

  const request = account.requests.find((item) => item.id === exception.relatedRequestId)
  const discrepancy = deriveContributionResolution(account, contribution.id)
  const status = issueStatus(exception, true)
  const responsibleParty = status === 'resolved' ? 'none' : (exception.currentResponsibleParty ?? (status === 'in-progress' ? 'epfo' : 'member'))
  const chronology = [
    { id: `${contribution.id}-recorded`, label: 'Contribution entry recorded', date: contribution.recordedOn, detail: contribution.explanation },
    ...requestEvents(account, request?.id),
  ]
  const lastEvent = lastConfirmedRequestEvent(chronology) ?? chronology[0]
  const action: RecordIssueAction = status === 'resolved'
    ? { availability: 'not-required', label: 'No further action needed' }
    : request
      ? { availability: 'available', kind: 'track-request', label: 'Track review request', contextId: request.id }
      : { availability: 'available', kind: 'raise-grievance', label: 'Ask EPFO to review', contextId: contribution.id }
  const recordedEpf = (contribution.employeeEpf ?? 0) + (contribution.employerEpf ?? 0)

  return {
    id: exception.id,
    type: 'contribution-record',
    status,
    finding: discrepancy?.categoryLabel ?? `The contribution for ${formatWageMonth(contribution.wageMonth)} needs review.`,
    supportingRecords: [
      { kind: 'employment', id: employment.id, label: 'Employer', value: `${employment.employer} · ${employment.memberId}` },
      { kind: 'contribution', id: contribution.id, label: 'Wage Month', value: formatWageMonth(contribution.wageMonth) },
      { kind: 'contribution', id: contribution.id, label: 'Recorded On', value: formatDate(contribution.recordedOn) },
      { kind: 'contribution', id: contribution.id, label: 'Employee EPF', value: contribution.employeeEpf === null ? 'Not recorded' : formatMoney(contribution.employeeEpf) },
      { kind: 'contribution', id: contribution.id, label: 'Employer EPF', value: contribution.employerEpf === null ? 'Not recorded' : formatMoney(contribution.employerEpf) },
      { kind: 'contribution', id: contribution.id, label: 'EPS', value: contribution.eps === null ? 'Not recorded' : formatMoney(contribution.eps) },
      ...(contribution.transactionReference ? [{ kind: 'contribution' as const, id: contribution.id, label: 'Transaction reference', value: contribution.transactionReference }] : []),
      ...(contribution.expectedRecord ? [{ kind: 'contribution' as const, id: contribution.id, label: 'Expectation reference', value: contribution.expectedRecord.reference }] : []),
      ...(request ? [{ kind: 'request' as const, id: request.id, label: 'Review request', value: request.reference }] : []),
    ],
    affectedService: 'Monthly EPF contribution record',
    financialImpact: `${formatMoney(recordedEpf)} of EPF is recorded for this wage month. Because the employer EPF amount is not recorded, the remaining effect cannot be quantified.`,
    pensionServiceImpact: contribution.eps === null
      ? 'The EPS entry is not available for this wage month.'
      : `${formatMoney(contribution.eps)} is recorded toward pension service for this wage month. EPS is not a cash balance.`,
    responsibleParty,
    responsiblePartyLabel: partyLabels[responsibleParty],
    currentStage: status === 'resolved' ? 'Resolved' : request?.timeline.find((event) => event.state === 'current')?.label ?? 'Member review needed',
    lastConfirmedEvent: lastEvent,
    recommendedNextAction: status === 'resolved' ? 'No further action is needed.' : request?.nextExpectedStep ?? 'Ask EPFO to review the missing employer EPF amount and track the response.',
    resolutionAction: action,
    chronology,
    calculationTrail: [
      { label: 'Employee EPF recorded', amount: contribution.employeeEpf ?? 0 },
      ...(contribution.employerEpf === null ? [] : [{ label: 'Employer EPF recorded', amount: contribution.employerEpf }]),
      { label: 'EPF recorded for this wage month', amount: recordedEpf },
    ],
    discrepancy,
  }
}

export function deriveRecordIssues(account: AccountState): RecordIssue[] {
  const issues = account.exceptions.flatMap((exception) => {
    if (exception.kind === 'previous-balance') return [deriveTransferIssue(account, exception)]
    if (exception.kind === 'contribution-review') return [deriveContributionIssue(account, exception)]
    return []
  })
  const rank: Record<RecordIssue['type'], number> = { 'pending-transfer': 0, 'contribution-record': 1 }
  return issues.sort((first, second) => rank[first.type] - rank[second.type])
}

export const activeRecordIssues = (account: AccountState): RecordIssue[] =>
  deriveRecordIssues(account).filter((issue) => issue.status !== 'resolved')
