import { describe, expect, it } from 'vitest'
import { totalEpfBalance, totalEpsServiceMonths } from './calculations'
import { createInitialAccount } from './data'
import { activeRecordIssues, deriveRecordIssues } from './issues'
import { completeTransferResolution, submitGrievance } from './state'

describe('PF record issue derivation', () => {
  it('derives the two record issues in principal order without including KYC', () => {
    const issues = deriveRecordIssues(createInitialAccount())

    expect(issues).toHaveLength(2)
    expect(issues.map((issue) => issue.type)).toEqual(['pending-transfer', 'contribution-record'])
    expect(issues.map((issue) => issue.id)).not.toContain('exception-pan')
  })

  it('traces the pending transfer without moving or double-counting EPF', () => {
    const account = createInitialAccount()
    const issue = deriveRecordIssues(account)[0]

    expect(totalEpfBalance(account)).toBe(482_650)
    expect(issue).toMatchObject({
      affectedAmount: 38_450,
      status: 'in-progress',
      responsibleParty: 'epfo',
      currentStage: 'Employment Record Verification',
      resolutionAction: { availability: 'available', kind: 'track-request', contextId: 'request-transfer-2026' },
    })
    expect(issue.financialImpact).toContain('included once')
    expect(issue.calculationTrail.map((line) => line.amount)).toEqual([38_450, 444_200, 482_650])
    expect(issue.pensionServiceImpact).toContain('not transferred or added as cash')
    expect(issue.identityRisk).toBeUndefined()
  })

  it('keeps the June missing amount unavailable and EPS separate', () => {
    const issue = deriveRecordIssues(createInitialAccount())[1]

    expect(issue.affectedAmount).toBeUndefined()
    expect(issue.supportingRecords).toContainEqual(expect.objectContaining({ label: 'Wage Month', value: 'June 2026' }))
    expect(issue.supportingRecords).toContainEqual(expect.objectContaining({ label: 'Recorded On', value: '8 July 2026' }))
    expect(issue.supportingRecords).toContainEqual(expect.objectContaining({ label: 'Employer EPF', value: 'Not recorded' }))
    expect(issue.pensionServiceImpact).toContain('₹1,250')
    expect(issue.resolutionAction).toMatchObject({ availability: 'available', kind: 'raise-grievance' })
  })

  it('moves the contribution issue to EPFO tracking after a grievance is submitted', () => {
    const before = createInitialAccount()
    const serviceMonths = totalEpsServiceMonths(before)
    const after = submitGrievance(before, { submittedOn: '2026-09-03', employmentId: 'vertex', contributionId: 'vertex-2026-06', category: 'Contribution Amount Needs Review', description: 'Please review the employer EPF amount shown as not recorded.' })
    const issue = deriveRecordIssues(after)[1]

    expect(issue.status).toBe('in-progress')
    expect(issue.responsibleParty).toBe('member')
    expect(issue.resolutionAction).toMatchObject({ availability: 'available', kind: 'track-request' })
    expect(issue.currentStage).toBe('Grievance portal receipt')
    expect(totalEpfBalance(after)).toBe(482_650)
    expect(totalEpsServiceMonths(after)).toBe(serviceMonths)
  })

  it('offers the transfer action before a request exists', () => {
    const account = createInitialAccount()
    account.requests = account.requests.filter((request) => request.type !== 'transfer')
    account.ledger.transfers = account.ledger.transfers.filter((transfer) => transfer.id !== 'transfer-harbor-vertex-2026-06-18')
    account.exceptions = account.exceptions.map((exception) => exception.kind === 'previous-balance' ? { ...exception, state: 'open', relatedRequestId: undefined, currentResponsibleParty: 'member' } : exception)

    expect(deriveRecordIssues(account)[0]).toMatchObject({
      status: 'action-required',
      currentStage: 'Ready to start',
      responsibleParty: 'member',
      resolutionAction: { availability: 'available', kind: 'start-transfer', contextId: 'harbor' },
    })
  })

  it('represents resolved, unavailable and empty states without dead actions', () => {
    const resolved = createInitialAccount()
    resolved.exceptions = resolved.exceptions.map((exception) => exception.kind === 'previous-balance' || exception.kind === 'contribution-review' ? { ...exception, state: 'resolved' } : exception)
    expect(activeRecordIssues(resolved)).toEqual([])
    expect(deriveRecordIssues(resolved).every((issue) => issue.resolutionAction.availability === 'not-required')).toBe(true)

    const unavailable = createInitialAccount()
    unavailable.ledger.transfers = unavailable.ledger.transfers.filter((transfer) => transfer.id !== 'transfer-harbor-vertex-2026-06-18')
    expect(deriveRecordIssues(unavailable)[0]).toMatchObject({ status: 'unavailable', resolutionAction: { availability: 'unavailable' } })

    const empty = createInitialAccount()
    empty.exceptions = empty.exceptions.filter((exception) => exception.kind === 'kyc-review')
    expect(deriveRecordIssues(empty)).toEqual([])
  })

  it('shows a multiple-UAN risk only when an explicit confirmed record supports it', () => {
    const account = createInitialAccount()
    const transfer = account.ledger.transfers.find((item) => item.id === 'transfer-harbor-vertex-2026-06-18')!
    transfer.uanEvidence = { sourceUan: '100000654321', destinationUan: account.member.uan, confirmation: 'confirmed', explanation: 'The source employment is linked to a second confirmed synthetic UAN reference.' }

    expect(deriveRecordIssues(account)[0].identityRisk).toMatchObject({ label: 'Possible multiple-UAN record' })
    transfer.uanEvidence.confirmation = 'unconfirmed'
    expect(deriveRecordIssues(account)[0].identityRisk).toBeUndefined()
  })

  it('keeps a completed transfer in issue history while removing it from active review', () => {
    const completed = completeTransferResolution(createInitialAccount(), 'transfer-harbor-vertex-2026-06-18', '2026-09-04')
    const historical = deriveRecordIssues(completed)[0]

    expect(activeRecordIssues(completed).map((issue) => issue.id)).not.toContain(historical.id)
    expect(historical).toMatchObject({ status: 'resolved', responsibleParty: 'none', currentStage: 'Completed' })
    expect(historical.finding).toContain('posted once')
    expect(historical.financialImpact).toContain('no longer included')
  })
})
