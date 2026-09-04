import { describe, expect, it } from 'vitest'
import { createInitialAccount } from './data'
import { requestEvidenceSummary, requestStateLabel } from './requestEvidence'
import { prepareOrCheckExistingRequest } from './state'

describe('request evidence continuity', () => {
  it('distinguishes an attempt with no receipt from an acknowledged request in progress', () => {
    const account = createInitialAccount()
    const attempted = account.requests.find((request) => request.id === 'request-correction-2026')!
    const acknowledged = account.requests.find((request) => request.id === 'request-transfer-2026')!

    expect(requestStateLabel(attempted)).toBe('Submitted · receipt not confirmed')
    expect(requestEvidenceSummary(attempted).firstMissingAcknowledgement?.kind).toBe('channel-receipt')
    expect(requestStateLabel(acknowledged)).toBe('Being processed')
    expect(requestEvidenceSummary(acknowledged).latestConfirmedEvent?.label).toBe('Employment Record Verification')
  })

  it('checks an existing attempt without creating or acknowledging another request', () => {
    const account = createInitialAccount()
    const beforeIds = account.requests.map((request) => request.id)
    const checked = prepareOrCheckExistingRequest(account, 'request-correction-2026', '2026-09-04')
    const request = checked.requests.find((item) => item.id === 'request-correction-2026')!

    expect(checked.requests.map((item) => item.id)).toEqual(beforeIds)
    expect(requestEvidenceSummary(request).firstMissingAcknowledgement?.kind).toBe('channel-receipt')
    expect(request.citizenAction).toContain('no new request was created')
  })

  it('prepares a recoverable rejection on the same request', () => {
    const account = createInitialAccount()
    const rejected = { ...account.requests[0], id: 'request-rejected', state: 'rejected' as const, rejection: { originalRemark: 'Supporting wage month does not match selected contribution.', plainLanguageMeaning: 'The attached evidence points to a different month.', mismatch: 'Evidence says May 2026; request says June 2026.', correctableBy: 'Member', evidenceNeeded: ['June 2026 wage record'], recoveryAction: 'prepare' as const, requiresFreshSubmission: false } }
    account.requests = [rejected]

    const prepared = prepareOrCheckExistingRequest(account, rejected.id, '2026-09-04').requests[0]
    expect(prepared.id).toBe(rejected.id)
    expect(prepared.recoveryPreparedOn).toBe('2026-09-04')
    expect(prepared.rejection?.recoveryAction).toBe('resume')
    expect(prepared.rejection?.requiresFreshSubmission).toBe(false)
  })
})
