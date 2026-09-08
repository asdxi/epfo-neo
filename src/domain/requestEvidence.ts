import type { MemberRequest, RequestEvent } from './types'

export interface RequestEvidenceSummary {
  latestConfirmedEvent?: RequestEvent
  firstMissingAcknowledgement?: RequestEvent
}

export function requestEvidenceSummary(request: MemberRequest): RequestEvidenceSummary {
  const confirmed = request.timeline
    .filter((event) => event.confirmation === 'confirmed' || (!event.confirmation && event.date !== null))
    .filter((event) => event.date !== null)
    .sort((first, second) => {
      const dateComparison = (second.date ?? '').localeCompare(first.date ?? '')
      return dateComparison || request.timeline.indexOf(second) - request.timeline.indexOf(first)
    })
  const firstMissingAcknowledgement = request.timeline.find((event) =>
    event.confirmation === 'missing' && (event.kind === 'channel-receipt' || event.kind === 'epfo-acknowledgement'))
  return { latestConfirmedEvent: confirmed[0], firstMissingAcknowledgement }
}

export const requestStateLabel = (request: MemberRequest): string => {
  if (request.state === 'submitted' || request.state === 'submission-attempted' || request.state === 'received') return 'Submitted'
  if (request.state === 'in-progress') return 'In Progress'
  if (request.state === 'action-required') return 'Action Required'
  if (request.state === 'rejected') return 'Rejected'
  return 'Completed'
}
