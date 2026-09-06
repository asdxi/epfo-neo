import { reconcileMemberId } from './calculations'
import { RECORD_ISSUE_RULE_VERSION } from './issues'
import { deriveTransferPreflight } from './transferPreflight'
import type { AccountState, MemberRequest, Nominee, RequestState } from './types'

const requestNumber = (account: AccountState, type: MemberRequest['type']): string => {
  const prefix = { claim: 'CLM', transfer: 'TRF', correction: 'COR', grievance: 'GRV', exit: 'EXT' }[type]
  const number = account.requests.filter((request) => request.type === type).length + 1
  return `${prefix}-2026-${String(1000 + number).padStart(6, '0')}`
}

const withRequest = (account: AccountState, request: MemberRequest): AccountState => ({
  ...account,
  requests: [request, ...account.requests],
})

export function submitTransfer(account: AccountState, submittedOn: string): AccountState {
  const preflight = deriveTransferPreflight(account)
  if (preflight.state !== 'manual-required') return account
  const exception = account.exceptions.find((item) => item.kind === 'previous-balance')
  if (!exception || exception.state !== 'open' || !exception.employmentId || !exception.amount) return account
  const source = account.employments.find((item) => item.id === exception.employmentId)
  const destination = account.employments.find((item) => item.status === 'current')
  if (!source || !destination) return account
  const requestId = `request-transfer-${submittedOn}`
  const transferId = `transfer-${source.id}-${destination.id}-${submittedOn}`
  const reference = requestNumber(account, 'transfer')
  const request: MemberRequest = {
    id: requestId, type: 'transfer', service: 'Transfer Previous PF', reference,
    title: `Transfer from ${source.employer}`, state: 'submitted', submittedOn, updatedOn: submittedOn,
    amount: exception.amount, employmentId: source.id,
    channel: 'Member portal', currentResponsibleParty: 'member',
    nextExpectedStep: 'EPFO will acknowledge the request before it moves to employer review.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Request Filed', date: submittedOn, state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member' },
      { id: `${requestId}-ack`, label: 'EPFO Acknowledgement', date: null, state: 'upcoming', kind: 'epfo-acknowledgement', confirmation: 'expected', party: 'epfo' },
      { id: `${requestId}-employer`, label: 'Employment Record Verification', date: null, state: 'upcoming', kind: 'responsible-party-assignment', confirmation: 'expected', party: 'source-employer' },
      { id: `${requestId}-processing`, label: 'Transfer Processing', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
      { id: `${requestId}-completed`, label: 'Transfer Completed', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
    ],
  }
  return withRequest({
    ...account,
    ledger: {
      ...account.ledger,
      transfers: [...account.ledger.transfers, {
        id: transferId,
        fromMemberId: source.memberId,
        toMemberId: destination.memberId,
        amount: exception.amount,
        initiatedOn: submittedOn,
        state: 'submitted',
        source: source.establishmentType,
        initiationMethod: 'manual',
        relatedRequestId: requestId,
        pensionServiceState: exception.pensionServiceState ?? 'not-confirmed',
        explanation: 'This transfer request is submitted. The balance remains under the previous Member ID until the transfer completes.',
      }],
    },
    exceptions: account.exceptions.map((item) => item.id === exception.id ? {
      ...item,
      state: 'in-progress',
      relatedRequestId: requestId,
      currentResponsibleParty: 'member',
      issueSnapshot: {
        ruleVersion: RECORD_ISSUE_RULE_VERSION,
        sourceSnapshotAt: submittedOn,
        sourceRecordReferences: [
          { kind: 'employment', id: source.id },
          { kind: 'employment', id: destination.id },
          { kind: 'transfer', id: transferId },
          { kind: 'request', id: requestId },
        ],
      },
    } : item),
  }, request)
}

export function submitGrievance(account: AccountState, input: { submittedOn: string; employmentId: string; contributionId?: string; category: string; description: string }): AccountState {
  const reference = requestNumber(account, 'grievance')
  const requestId = `request-grievance-${reference}`
  const request: MemberRequest = {
    id: requestId, type: 'grievance', service: 'Raise a Grievance', reference,
    title: input.category, state: 'submitted', submittedOn: input.submittedOn, updatedOn: input.submittedOn,
    employmentId: input.employmentId, contributionId: input.contributionId,
    channel: 'Grievance portal', currentResponsibleParty: 'member',
    nextExpectedStep: 'EPFO will acknowledge the request before reviewing your record.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Request Filed', date: input.submittedOn, state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member', explanation: input.description },
      { id: `${requestId}-ack`, label: 'EPFO Acknowledgement', date: null, state: 'upcoming', kind: 'epfo-acknowledgement', confirmation: 'expected', party: 'epfo' },
      { id: `${requestId}-review`, label: 'EPFO Review', date: null, state: 'upcoming', kind: 'responsible-party-assignment', confirmation: 'expected', party: 'epfo' },
    ],
  }
  const next = withRequest(account, request)
  return {
    ...next,
    exceptions: next.exceptions.map((item) => item.contributionId === input.contributionId ? {
      ...item,
      state: 'in-progress',
      relatedRequestId: requestId,
      currentResponsibleParty: 'member',
      issueSnapshot: {
        ruleVersion: RECORD_ISSUE_RULE_VERSION,
        sourceSnapshotAt: input.submittedOn,
        sourceRecordReferences: [
          ...(item.issueSnapshot?.sourceRecordReferences ?? []),
          { kind: 'request', id: requestId },
        ],
      },
    } : item),
  }
}

export function submitClaim(account: AccountState, input: { submittedOn: string; amount: number; title: string }): AccountState {
  const reference = requestNumber(account, 'claim')
  const requestId = `request-claim-${reference}`
  return withRequest(account, {
    id: requestId, type: 'claim', service: 'Claims & Withdrawals', reference,
    title: input.title, state: 'submitted', submittedOn: input.submittedOn, updatedOn: input.submittedOn,
    amount: input.amount,
    channel: 'Claims portal', currentResponsibleParty: 'member',
    nextExpectedStep: 'EPFO will review the claim before transferring it to your verified bank account.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Request Filed', date: input.submittedOn, state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member' },
      { id: `${requestId}-review`, label: 'EPFO Review', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
      { id: `${requestId}-payment`, label: 'Transfer to Verified Bank Account', date: null, state: 'upcoming', kind: 'bank-handoff', confirmation: 'expected', party: 'bank' },
      { id: `${requestId}-completed`, label: 'Request Completed', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
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
    channel: 'Member portal', currentResponsibleParty: 'member',
    nextExpectedStep: 'EPFO will acknowledge the request before it moves to employer review.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Request Filed', date: input.submittedOn, state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member', explanation: `Proposed value: ${input.proposedValue}` },
      { id: `${requestId}-ack`, label: 'EPFO Acknowledgement', date: null, state: 'upcoming', kind: 'epfo-acknowledgement', confirmation: 'expected', party: 'epfo' },
      { id: `${requestId}-employer`, label: 'Employer Review', date: null, state: 'upcoming', kind: 'responsible-party-assignment', confirmation: 'expected', party: 'source-employer' },
      { id: `${requestId}-completed`, label: 'Request Completed', date: null, state: 'upcoming', confirmation: 'expected', party: 'epfo' },
    ],
  })
}

export function submitPanVerification(account: AccountState, submittedOn: string): AccountState {
  return {
    ...account,
    kyc: account.kyc.map((item) => item.type === 'pan' ? { ...item, state: 'pending', updatedOn: submittedOn, explanation: 'PAN verification is in progress.' } : item),
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

export function updateMemberProfile(account: AccountState, input: Partial<AccountState['member']> & { updatedOn: string }): AccountState {
  const { updatedOn, ...changes } = input
  return { ...account, member: { ...account.member, ...changes, profileUpdatedOn: updatedOn } }
}

export function submitExit(account: AccountState, input: { submittedOn: string; employmentId: string; exitedOn: string; reason: string }): AccountState {
  const employment = account.employments.find((item) => item.id === input.employmentId)
  if (!employment) return account
  const reference = requestNumber(account, 'exit')
  const requestId = `request-exit-${reference}`
  return withRequest(account, {
    id: requestId, type: 'exit', service: 'Exit from EPFO Scheme', reference,
    title: `Exit details for ${employment.employer}`, state: 'submitted', submittedOn: input.submittedOn, updatedOn: input.submittedOn,
    employmentId: input.employmentId,
    channel: 'Member portal', currentResponsibleParty: 'member',
    nextExpectedStep: 'EPFO will acknowledge the request before reviewing the exit details.',
    timeline: [
      { id: `${requestId}-submitted`, label: 'Request Filed', date: input.submittedOn, state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member', explanation: `Date of exit: ${input.exitedOn}. Reason: ${input.reason}.` },
      { id: `${requestId}-ack`, label: 'EPFO Acknowledgement', date: null, state: 'upcoming', kind: 'epfo-acknowledgement', confirmation: 'expected', party: 'epfo' },
    ],
  })
}

export function saveNominees(account: AccountState, nominees: Nominee[]): AccountState {
  return { ...account, member: { ...account.member, nominees } }
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

export function prepareOrCheckExistingRequest(account: AccountState, requestId: string, updatedOn: string): AccountState {
  return {
    ...account,
    requests: account.requests.map((request) => {
      if (request.id !== requestId) return request
      if (request.rejection) return {
        ...request,
        updatedOn,
        recoveryPreparedOn: updatedOn,
        state: 'action-required',
        rejection: { ...request.rejection, recoveryAction: 'resume' },
        citizenAction: 'The known request details are ready. Resume this request when you are ready.',
        nextExpectedStep: 'Review the prepared correction, then resume this same request. No fresh submission is needed.',
      }
      return {
        ...request,
        updatedOn,
        citizenAction: `This attempt was checked on ${updatedOn}. The acknowledgement is still not confirmed; no new request was created.`,
      }
    }),
  }
}

export function completeTransferResolution(account: AccountState, transferId: string, completedOn: string): AccountState {
  const transfer = account.ledger.transfers.find((item) => item.id === transferId)
  if (!transfer || transfer.state === 'completed') return account
  const requestId = transfer.relatedRequestId
  const sourceWillBeEmpty = reconcileMemberId(account, transfer.fromMemberId).closingBalance === transfer.amount
  return {
    ...account,
    employments: account.employments.map((employment) => employment.memberId === transfer.fromMemberId && sourceWillBeEmpty
      ? { ...employment, status: 'transferred' }
      : employment),
    ledger: {
      ...account.ledger,
      transfers: account.ledger.transfers.map((item) => item.id === transferId
        ? { ...item, state: 'completed', completedOn, explanation: 'The transfer was completed and posted once to the destination Member ID.' }
        : item),
    },
    exceptions: account.exceptions.map((item) => requestId !== undefined && item.relatedRequestId === requestId
      ? {
          ...item,
          state: 'resolved',
          currentResponsibleParty: 'none',
          explanation: 'The transfer completed and the amount is posted only to the destination Member ID.',
          issueSnapshot: {
            ruleVersion: RECORD_ISSUE_RULE_VERSION,
            sourceSnapshotAt: completedOn,
            sourceRecordReferences: item.issueSnapshot?.sourceRecordReferences ?? [],
          },
        }
      : item),
    requests: account.requests.map((request) => request.id === requestId
      ? {
          ...request,
          state: 'completed',
          updatedOn: completedOn,
          currentResponsibleParty: 'none',
          nextExpectedStep: 'No action is required. The transfer is complete.',
          timeline: [...request.timeline.filter((event) => event.confirmation !== 'expected').map((event) => event.state === 'current' ? { ...event, state: 'completed' as const } : event), {
            id: `${request.id}-resolution`, label: 'Transfer Posted to Destination', date: completedOn, state: 'completed' as const,
            kind: 'resolution' as const, confirmation: 'confirmed' as const, party: 'epfo' as const,
          }],
        }
      : request),
  }
}
