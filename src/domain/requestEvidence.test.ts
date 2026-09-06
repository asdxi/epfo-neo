import { describe, expect, it } from 'vitest'
import { createInitialAccount } from './data'
import { requestEvidenceSummary, requestStateLabel } from './requestEvidence'
import { prepareOrCheckExistingRequest, submitCorrection, submitTransfer } from './state'
import { deriveTransferPreflight } from './transferPreflight'

describe('request evidence continuity', () => {
  it('uses the terminal stage as the latest update when completed stages share a date', () => {
    const account = createInitialAccount()
    const claim = account.requests.find((request) => request.id === 'request-claim-2022')!
    const grievance = account.requests.find((request) => request.id === 'request-grievance-2023')!

    expect(claim.timeline.map((event) => event.label)).toEqual([
      'Request Filed', 'EPFO Review', 'Transfer to Verified Bank Account', 'Request Completed',
    ])
    expect(requestEvidenceSummary(claim).latestConfirmedEvent).toMatchObject({ label: 'Request Completed', date: '2022-08-19' })
    expect(grievance.timeline.map((event) => event.label)).toEqual([
      'Request Filed', 'EPFO Review', 'Response Provided', 'Request Completed',
    ])
    expect(requestEvidenceSummary(grievance).latestConfirmedEvent).toMatchObject({ label: 'Request Completed', date: '2023-12-18' })
  })

  it('keeps the seeded transfer and correction lifecycles ordered with unstarted stages undated', () => {
    const account = createInitialAccount()
    const transfer = account.requests.find((request) => request.id === 'request-transfer-2026')!
    const correction = account.requests.find((request) => request.id === 'request-correction-2026')!

    expect(transfer.timeline.map((event) => event.label)).toEqual([
      'Request Filed', 'EPFO Acknowledgement', 'Employment Record Verification', 'Transfer Processing', 'Transfer Completed',
    ])
    expect(transfer.timeline.slice(3).map((event) => event.date)).toEqual([null, null])
    expect(requestEvidenceSummary(transfer).latestConfirmedEvent).toMatchObject({ label: 'Employment Record Verification', date: '2026-06-24' })
    expect(correction.timeline.map((event) => event.label)).toEqual([
      'Request Filed', 'EPFO Acknowledgement', 'Employer Review', 'Request Completed',
    ])
    expect(correction.timeline.slice(1).map((event) => event.date)).toEqual([null, null, null])
    expect(requestEvidenceSummary(correction).latestConfirmedEvent).toMatchObject({ label: 'Request Filed', date: '2026-06-22' })
  })

  it('generates the complete manual transfer lifecycle', () => {
    const account = createInitialAccount()
    const eligible = {
      ...account,
      requests: account.requests.filter((request) => request.type !== 'transfer'),
      ledger: { ...account.ledger, transfers: account.ledger.transfers.filter((transfer) => transfer.initiationMethod !== 'manual') },
      exceptions: account.exceptions.map((item) => item.kind === 'previous-balance' ? { ...item, state: 'open' as const, relatedRequestId: undefined } : item),
    }

    expect(deriveTransferPreflight(eligible).state).toBe('manual-required')
    const request = submitTransfer(eligible, '2026-09-06').requests[0]
    expect(request.timeline.map((event) => event.label)).toEqual([
      'Request Filed', 'EPFO Acknowledgement', 'Employment Record Verification', 'Transfer Processing', 'Transfer Completed',
    ])
    expect(request.timeline.map((event) => event.label).join(' ')).not.toMatch(/Member Portal|Submission Attempted/)
  })

  it('generates the complete correction lifecycle and next step', () => {
    const account = createInitialAccount()
    const request = submitCorrection(account, {
      submittedOn: '2026-09-06', employmentId: account.employments[0].id, field: 'Date of Joining', proposedValue: '2022-01-01',
    }).requests[0]

    expect(request.timeline.map((event) => event.label)).toEqual([
      'Request Filed', 'EPFO Acknowledgement', 'Employer Review', 'Request Completed',
    ])
    expect(request.nextExpectedStep).toBe('EPFO will acknowledge the request before it moves to employer review.')
    expect(request.timeline.map((event) => event.label).join(' ')).not.toMatch(/Member Portal|Submission Attempted/)
  })

  it('distinguishes an attempt with no receipt from an acknowledged request in progress', () => {
    const account = createInitialAccount()
    const attempted = account.requests.find((request) => request.id === 'request-correction-2026')!
    const acknowledged = account.requests.find((request) => request.id === 'request-transfer-2026')!

    expect(requestStateLabel(attempted)).toBe('Submitted')
    expect(requestEvidenceSummary(attempted).firstMissingAcknowledgement).toBeUndefined()
    expect(requestStateLabel(acknowledged)).toBe('In Progress')
    expect(requestEvidenceSummary(acknowledged).latestConfirmedEvent?.label).toBe('Employment Record Verification')
  })

  it('checks an existing attempt without creating or acknowledging another request', () => {
    const account = createInitialAccount()
    const beforeIds = account.requests.map((request) => request.id)
    const checked = prepareOrCheckExistingRequest(account, 'request-correction-2026', '2026-09-04')
    const request = checked.requests.find((item) => item.id === 'request-correction-2026')!

    expect(checked.requests.map((item) => item.id)).toEqual(beforeIds)
    expect(requestEvidenceSummary(request).firstMissingAcknowledgement).toBeUndefined()
    expect(request.citizenAction).toContain('no new request was created')
  })

  it('prepares a recoverable rejection on the same request', () => {
    const account = createInitialAccount()
    const rejected = { ...account.requests[0], id: 'request-rejected', state: 'rejected' as const, rejection: { originalRemark: 'Supporting salary month does not match selected contribution.', plainLanguageMeaning: 'The attached evidence points to a different month.', mismatch: 'Evidence says May 2026; request says June 2026.', correctableBy: 'Member', evidenceNeeded: ['June 2026 wage record'], recoveryAction: 'prepare' as const, requiresFreshSubmission: false } }
    account.requests = [rejected]

    const prepared = prepareOrCheckExistingRequest(account, rejected.id, '2026-09-04').requests[0]
    expect(prepared.id).toBe(rejected.id)
    expect(prepared.recoveryPreparedOn).toBe('2026-09-04')
    expect(prepared.rejection?.recoveryAction).toBe('resume')
    expect(prepared.rejection?.requiresFreshSubmission).toBe(false)
  })
})
