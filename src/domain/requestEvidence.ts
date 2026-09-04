import type { MemberRequest, RequestEvent } from './types'

export interface RequestEvidenceSummary {
  latestConfirmedEvent?: RequestEvent
  firstMissingAcknowledgement?: RequestEvent
}

export function requestEvidenceSummary(request: MemberRequest): RequestEvidenceSummary {
  const confirmed = request.timeline
    .filter((event) => event.confirmation === 'confirmed' || (!event.confirmation && event.date !== null))
    .filter((event) => event.date !== null)
    .sort((first, second) => (second.date ?? '').localeCompare(first.date ?? ''))
  const firstMissingAcknowledgement = request.timeline.find((event) =>
    event.confirmation === 'missing' && (event.kind === 'channel-receipt' || event.kind === 'epfo-acknowledgement'))
  return { latestConfirmedEvent: confirmed[0], firstMissingAcknowledgement }
}

export const requestStateLabel = (request: MemberRequest): string => {
  if (request.state === 'submitted' || request.state === 'submission-attempted') {
    const evidence = requestEvidenceSummary(request)
    return evidence.firstMissingAcknowledgement?.kind === 'channel-receipt' ? 'Submitted · receipt not confirmed' : 'Submitted'
  }
  if (request.state === 'received') return 'Received'
  if (request.state === 'in-progress') return 'Being processed'
  if (request.state === 'action-required') return 'Action required'
  if (request.state === 'rejected') return 'Rejected · recoverable'
  return 'Completed'
}
