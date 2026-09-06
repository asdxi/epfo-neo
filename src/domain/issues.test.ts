import { describe, expect, it } from 'vitest'
import { reconcileMemberId, totalEpfBalance, totalEpsServiceMonths } from './calculations'
import { createInitialAccount } from './data'
import { activeRecordIssues, deriveRecordIssues, RECORD_ISSUE_RULE_VERSION } from './issues'
import { completeTransferResolution, submitGrievance } from './state'
import {
  acknowledgementMissingScenario,
  contributionComponentMissingScenario,
  noActiveIssueScenario,
  rejectedRequestScenario,
  transferCompletedScenario,
  transferInProgressScenario,
  transferReadyScenario,
  unavailableSourceScenario,
} from '../test-fixtures/reconciliationScenarios'

const transferIssue = (account = createInitialAccount()) => deriveRecordIssues(account).find((issue) => issue.type === 'pending-transfer')!
const contributionIssue = (account = createInitialAccount()) => deriveRecordIssues(account).find((issue) => issue.type === 'contribution-record')!

describe('PF record issue derivation', () => {
  it('derives the two record issues in principal order without including KYC', () => {
    const issues = deriveRecordIssues(createInitialAccount())

    expect(issues).toHaveLength(2)
    expect(issues.map((issue) => issue.type)).toEqual(['pending-transfer', 'contribution-record'])
    expect(issues.map((issue) => issue.code)).toEqual(['TRANSFER_IN_PROGRESS', 'CONTRIBUTION_COMPONENT_MISSING'])
    expect(issues.map((issue) => issue.id)).not.toContain('exception-pan')
  })

  it('traces the pending transfer without moving or double-counting EPF', () => {
    const account = createInitialAccount()
    const issue = transferIssue(account)

    expect(totalEpfBalance(account)).toBe(188_094)
    expect(issue).toMatchObject({
      code: 'TRANSFER_IN_PROGRESS',
      ruleVersion: RECORD_ISSUE_RULE_VERSION,
      sourceSnapshotAt: '2026-06-24',
      status: 'in-progress',
      responsiblePartyCode: 'epfo',
      actionCode: 'TRACK_TRANSFER',
      relatedRequestId: 'request-transfer-2026',
      currentStage: { code: 'SOURCE_EVENT', label: 'Employment Record Verification' },
      action: { availability: 'available', code: 'TRACK_TRANSFER', contextId: 'request-transfer-2026' },
    })
    expect(issue.facts).toMatchObject({
      kind: 'transfer',
      amount: 38_450,
      sourceEmployment: { employer: 'Waystar Royco' },
      destinationEmployment: { employer: 'Pied Piper' },
      currentlyCountedUnderEmploymentId: 'harbor',
      addedToDestination: 'after-completion',
      duplicateAmountInTotal: false,
      pensionServiceState: 'linked-employment-record',
    })
    expect(issue.calculationTrail.map((line) => line.amount)).toEqual([38_450, 149_644, 188_094])
  })

  it('keeps the August missing amount unavailable and EPS separate', () => {
    const issue = contributionIssue()

    expect(issue.code).toBe('CONTRIBUTION_COMPONENT_MISSING')
    expect(issue.facts).toMatchObject({
      kind: 'contribution',
      wageMonth: '2026-08',
      recordedOn: '2026-09-08',
      missingComponents: ['employer-epf'],
      knownRecordedEpf: 3_000,
    })
    if (issue.facts.kind !== 'contribution') throw new Error('Expected contribution facts')
    expect(issue.facts.components).toContainEqual({ code: 'employer-epf', expected: 550, recorded: null })
    expect(issue.facts.components).toContainEqual({ code: 'eps', expected: 1_250, recorded: 1_250 })
    expect(issue.action).toMatchObject({ availability: 'available', code: 'RAISE_CONTRIBUTION_GRIEVANCE' })
    expect(issue.calculationTrail.map((line) => line.label)).not.toContain('Employer EPF recorded')
  })

  it('does not convert an entirely missing EPF component set to zero', () => {
    const account = createInitialAccount()
    const contribution = account.ledger.contributions.find((item) => item.id === 'vertex-2026-08')!
    contribution.employeeEpf = null
    contribution.voluntaryEpf = null
    contribution.employerEpf = null
    const issue = contributionIssue(account)

    expect(issue.facts).toMatchObject({ kind: 'contribution', knownRecordedEpf: null })
    expect(issue.calculationTrail).not.toContainEqual(expect.objectContaining({ amount: 0 }))
  })

  it('moves the contribution issue to checking the same request when acknowledgement is missing', () => {
    const before = createInitialAccount()
    const serviceMonths = totalEpsServiceMonths(before)
    const after = submitGrievance(before, { submittedOn: '2026-09-08', employmentId: 'vertex', contributionId: 'vertex-2026-08', category: 'Contribution Amount Needs Review', description: 'Please review the employer EPF amount shown as not recorded.' })
    const issue = contributionIssue(after)

    expect(issue.code).toBe('CONTRIBUTION_COMPONENT_MISSING')
    expect(totalEpfBalance(after)).toBe(188_094)
    expect(totalEpsServiceMonths(after)).toBe(serviceMonths)
  })

  it('offers the transfer action before a request exists without matching an unrelated completed transfer', () => {
    const issue = transferIssue(transferReadyScenario())

    expect(issue).toMatchObject({
      code: 'TRANSFER_READY',
      status: 'action-required',
      responsiblePartyCode: 'member',
      action: { availability: 'available', code: 'START_TRANSFER', contextId: 'harbor' },
      currentStage: { code: 'READY_TO_START' },
    })
    expect(issue.facts).toMatchObject({ kind: 'transfer', amount: 38_450, transferId: null, transferState: 'ready' })
    expect(JSON.stringify(issue)).not.toContain('435350')
  })

  it('represents resolved, unavailable and empty states without dead actions', () => {
    const noActive = noActiveIssueScenario()
    expect(activeRecordIssues(noActive)).toEqual([])
    expect(deriveRecordIssues(noActive).every((issue) => issue.action.availability === 'not-required')).toBe(true)

    const unavailable = transferIssue(unavailableSourceScenario())
    expect(unavailable).toMatchObject({ code: 'RECORD_UNAVAILABLE', status: 'unavailable', action: { availability: 'unavailable', code: 'ACTION_UNAVAILABLE' } })
    expect(unavailable.facts).toEqual({ kind: 'unavailable', missingSource: 'transfer' })

    const empty = createInitialAccount()
    empty.exceptions = empty.exceptions.filter((exception) => exception.kind === 'kyc-review')
    expect(deriveRecordIssues(empty)).toEqual([])
  })

  it('shows a multiple-UAN risk only when an explicit confirmed record supports it', () => {
    const account = createInitialAccount()
    const transfer = account.ledger.transfers.find((item) => item.id === 'transfer-harbor-vertex-2026-06-18')!
    transfer.uanEvidence = { sourceUan: '100000654321', destinationUan: account.member.uan, confirmation: 'confirmed', explanation: 'The source employment is linked to a second confirmed synthetic UAN reference.' }

    expect(transferIssue(account).identityRisk).toMatchObject({ label: 'Possible multiple-UAN record' })
    transfer.uanEvidence.confirmation = 'unconfirmed'
    expect(transferIssue(account).identityRisk).toBeUndefined()
  })

  it('keeps a completed transfer in issue history while removing it from active review', () => {
    const completed = completeTransferResolution(createInitialAccount(), 'transfer-harbor-vertex-2026-06-18', '2026-09-04')
    const historical = transferIssue(completed)

    expect(activeRecordIssues(completed).map((issue) => issue.id)).not.toContain(historical.id)
    expect(historical).toMatchObject({ code: 'TRANSFER_COMPLETED', status: 'resolved', responsiblePartyCode: 'none', actionCode: 'NO_ACTION_REQUIRED', currentStage: { code: 'COMPLETED' } })
    expect(historical.facts).toMatchObject({ kind: 'transfer', currentlyCountedUnderEmploymentId: 'vertex', addedToDestination: 'completed', duplicateAmountInTotal: false })
    expect(reconcileMemberId(completed, 'KA/HFI/0031849').closingBalance).toBe(0)
    expect(reconcileMemberId(completed, 'KA/VTX/0048291').closingBalance).toBe(188_094)
  })

  it.each([
    ['ready', transferReadyScenario, 'pending-transfer', 'TRANSFER_READY', 'action-required', 'START_TRANSFER'],
    ['in progress', transferInProgressScenario, 'pending-transfer', 'TRANSFER_IN_PROGRESS', 'in-progress', 'TRACK_TRANSFER'],
    ['acknowledgement missing', acknowledgementMissingScenario, 'pending-transfer', 'REQUEST_ACKNOWLEDGEMENT_MISSING', 'action-required', 'CHECK_EXISTING_ATTEMPT'],
    ['rejected', rejectedRequestScenario, 'pending-transfer', 'REQUEST_REJECTED', 'action-required', 'RECOVER_REQUEST'],
    ['completed', transferCompletedScenario, 'pending-transfer', 'TRANSFER_COMPLETED', 'resolved', 'NO_ACTION_REQUIRED'],
    ['component missing', contributionComponentMissingScenario, 'contribution-record', 'CONTRIBUTION_COMPONENT_MISSING', 'action-required', 'RAISE_CONTRIBUTION_GRIEVANCE'],
    ['unavailable', unavailableSourceScenario, 'pending-transfer', 'RECORD_UNAVAILABLE', 'unavailable', 'ACTION_UNAVAILABLE'],
  ] as const)('classifies the %s scenario deterministically', (_name, createScenario, type, code, status, actionCode) => {
    const account = createScenario()
    const issue = deriveRecordIssues(account).find((item) => item.type === type)!
    expect({ code: issue.code, status: issue.status, actionCode: issue.actionCode }).toEqual({ code, status, actionCode })
    expect(issue.ruleVersion).toBe(RECORD_ISSUE_RULE_VERSION)
    expect(issue.sourceRecordReferences.every((reference) => Boolean(reference.kind && reference.id))).toBe(true)
  })

  it('returns stable facts without mutating or reading the runtime clock', () => {
    const account = createInitialAccount()
    const before = structuredClone(account)
    const first = deriveRecordIssues(account)
    const second = deriveRecordIssues(structuredClone(account))

    expect(second).toEqual(first)
    expect(account).toEqual(before)
    expect(first.map((issue) => issue.sourceSnapshotAt)).toEqual(['2026-06-24', '2026-09-08'])
  })
})
