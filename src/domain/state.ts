import type { AccountState, MemberRequest, RequestState } from './types'

const requestNumber = (account: AccountState, type: MemberRequest['type']): string => {
  const prefix = { claim: 'CLM', transfer: 'TRF', correction: 'COR', grievance: 'GRV' }[type]
  const number = account.requests.filter((request) => request.type === type).length + 1
  return `${prefix}-2026-${String(1000 + number).padStart(6, '0')}`
}

const withRequest = (account: AccountState, request: MemberRequest): AccountState => ({
  ...account,
  requests: [request, ...account.requests],
})

export function submitTransfer(account: AccountState, submittedOn: string): AccountState {
  const exception = account.exceptions.find((item) => item.kind === 'previous-balance')
  if (!exception || exception.state !== 'open' || !exception.employmentId || !exception.amount) return account
  const source = account.employments.find((item) => item.id === exception.employmentId)
  const destination = account.employments.find((item) => item.status === 'current')
  if (!source || !destination) return account
  const requestId = `request-transfer-${submittedOn}`
  const reference = requestNumber(account, 'transfer')
  const request: MemberRequest = {
    id: requestId, type: 'transfer', service: 'Transfer Previous PF', reference,
    title: `Transfer from ${source.employer}`, state: 'submitted', submittedOn, updatedOn: submittedOn,
    amount: exception.amount, employmentId: source.id,
    nextExpectedStep: 'The previous employer will verify the employment record. No action is required right now.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Submitted', date: submittedOn, state: 'completed' },
      { id: `${requestId}-employer`, label: 'Previous Employer Verification', date: null, state: 'current', explanation: 'The previous employer is expected to verify the employment record.' },
      { id: `${requestId}-processing`, label: 'EPFO Processing', date: null, state: 'upcoming' },
      { id: `${requestId}-funds`, label: 'Funds Transferred', date: null, state: 'upcoming' },
      { id: `${requestId}-complete`, label: 'Completed', date: null, state: 'upcoming' },
    ],
  }
  return withRequest({
    ...account,
    ledger: {
      ...account.ledger,
      transfers: [...account.ledger.transfers, {
        id: `transfer-harbor-vertex-${submittedOn}`,
        fromMemberId: source.memberId,
        toMemberId: destination.memberId,
        amount: exception.amount,
        initiatedOn: submittedOn,
        state: 'submitted',
        source: source.establishmentType,
        explanation: 'This transfer request is submitted. The balance remains under the previous Member ID until the transfer completes.',
      }],
    },
    exceptions: account.exceptions.map((item) => item.id === exception.id ? { ...item, state: 'in-progress', relatedRequestId: requestId } : item),
  }, request)
}

export function submitGrievance(account: AccountState, input: { submittedOn: string; employmentId: string; contributionId?: string; category: string; description: string }): AccountState {
  const reference = requestNumber(account, 'grievance')
  const requestId = `request-grievance-${reference}`
  const request: MemberRequest = {
    id: requestId, type: 'grievance', service: 'Raise a Grievance', reference,
    title: input.category, state: 'submitted', submittedOn: input.submittedOn, updatedOn: input.submittedOn,
    employmentId: input.employmentId, contributionId: input.contributionId,
    nextExpectedStep: 'EPFO will review the record and post an update to this request.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Grievance Submitted', date: input.submittedOn, state: 'completed', explanation: input.description },
      { id: `${requestId}-review`, label: 'EPFO Review', date: null, state: 'current' },
      { id: `${requestId}-response`, label: 'Response Provided', date: null, state: 'upcoming' },
    ],
  }
  const next = withRequest(account, request)
  return {
    ...next,
    exceptions: next.exceptions.map((item) => item.contributionId === input.contributionId ? { ...item, state: 'in-progress', relatedRequestId: requestId } : item),
  }
}

export function submitClaim(account: AccountState, input: { submittedOn: string; amount: number; title: string }): AccountState {
  const reference = requestNumber(account, 'claim')
  const requestId = `request-claim-${reference}`
  return withRequest(account, {
    id: requestId, type: 'claim', service: 'Claims & Withdrawals', reference,
    title: input.title, state: 'submitted', submittedOn: input.submittedOn, updatedOn: input.submittedOn,
    amount: input.amount,
    nextExpectedStep: 'EPFO will review the declaration and verified bank details.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Submitted', date: input.submittedOn, state: 'completed' },
      { id: `${requestId}-review`, label: 'Eligibility and Record Review', date: null, state: 'current' },
      { id: `${requestId}-payment`, label: 'Payment to Verified Bank', date: null, state: 'upcoming' },
    ],
  })
}

export function submitCorrection(account: AccountState, input: { submittedOn: string; employmentId: string; field: string; proposedValue: string }): AccountState {
  const reference = requestNumber(account, 'correction')
  const requestId = `request-correction-${reference}`
  const employment = account.employments.find((item) => item.id === input.employmentId)
  return withRequest(account, {
    id: requestId, type: 'correction', service: 'Correct Employment Records', reference,
    title: `${input.field} correction for ${employment?.employer ?? 'employment record'}`,
    state: 'submitted', submittedOn: input.submittedOn, updatedOn: input.submittedOn, employmentId: input.employmentId,
    nextExpectedStep: 'The employer is expected to verify the proposed value before EPFO review.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Correction Submitted', date: input.submittedOn, state: 'completed', explanation: `Proposed value: ${input.proposedValue}` },
      { id: `${requestId}-employer`, label: 'Awaiting Employer Verification', date: null, state: 'current' },
      { id: `${requestId}-epfo`, label: 'EPFO Review', date: null, state: 'upcoming' },
    ],
  })
}

export function submitPanVerification(account: AccountState, submittedOn: string): AccountState {
  return {
    ...account,
    kyc: account.kyc.map((item) => item.type === 'pan' ? { ...item, state: 'pending', updatedOn: submittedOn, explanation: 'PAN verification is processing in this synthetic account.' } : item),
    exceptions: account.exceptions.map((item) => item.kind === 'kyc-review' && item.kycType === 'pan' ? { ...item, state: 'in-progress' } : item),
  }
}

export function updateContact(account: AccountState, input: { type: 'mobile' | 'email'; value: string; updatedOn: string }): AccountState {
  return {
    ...account,
    member: {
      ...account.member,
      [input.type]: { value: input.value.trim(), verified: true, updatedOn: input.updatedOn },
    },
  }
}

export function updateCommunicationPreference(account: AccountState, preference: keyof AccountState['member']['communicationPreferences'], value: boolean): AccountState {
  return {
    ...account,
    member: {
      ...account.member,
      communicationPreferences: { ...account.member.communicationPreferences, [preference]: value },
    },
  }
}

export function addGeneratedReport(account: AccountState, report: AccountState['generatedReports'][number]): AccountState {
  return { ...account, generatedReports: [report, ...account.generatedReports] }
}

export function markReportReady(account: AccountState, reportId: string, generatedOn: string): AccountState {
  return {
    ...account,
    generatedReports: account.generatedReports.map((report) => report.id === reportId ? { ...report, state: 'ready', generatedOn } : report),
  }
}

export function transitionRequest(account: AccountState, requestId: string, state: RequestState, updatedOn: string): AccountState {
  return {
    ...account,
    requests: account.requests.map((request) => request.id === requestId ? { ...request, state, updatedOn } : request),
  }
}
