import { describe, expect, it } from 'vitest'
import { deriveJobChangeAttention } from './issues'
import {
  acknowledgementMissingScenario,
  transferCompletedScenario,
  transferInProgressScenario,
  transferReadyScenario,
} from '../test-fixtures/reconciliationScenarios'

describe('deterministic job-change awareness', () => {
  it.each([
    ['ready balance', transferReadyScenario, 'START_TRANSFER'],
    ['active request', transferInProgressScenario, 'TRACK_TRANSFER'],
    ['missing acknowledgement', acknowledgementMissingScenario, 'CHECK_EXISTING_ATTEMPT'],
  ] as const)('routes the %s state from source records', (_name, createScenario, actionCode) => {
    const attention = deriveJobChangeAttention(createScenario())
    expect(attention).toHaveLength(1)
    expect(attention[0]).toMatchObject({
      id: 'job-change:KA/HFI/0031849:KA/VTX/0048291',
      sourceEmployment: { employer: 'Waystar Royco' },
      destinationEmployment: { employer: 'Pied Piper' },
      amount: 38_450,
      actionCode,
    })
  })

  it('accepts a current contribution as the current-employer signal', () => {
    const account = transferInProgressScenario()
    account.employments = account.employments.map((employment) => employment.id === 'vertex' ? { ...employment, status: 'closed' as const } : employment)
    expect(deriveJobChangeAttention(account)).toHaveLength(1)
  })

  it('keeps awareness active when the prior employment is closed but a transfer is pending', () => {
    const account = transferInProgressScenario()
    account.employments = account.employments.map((employment) => employment.id === 'harbor' ? { ...employment, status: 'closed' as const } : employment)

    expect(deriveJobChangeAttention(account)).toMatchObject([{ actionCode: 'TRACK_TRANSFER', amount: 38_450 }])
  })

  it('does not activate without a current employer signal', () => {
    const account = transferInProgressScenario()
    account.employments = account.employments.map((employment) => employment.id === 'vertex' ? { ...employment, status: 'closed' as const, exitedOn: '2026-07-31' } : employment)
    expect(deriveJobChangeAttention(account)).toEqual([])
  })

  it('removes active attention after the completed posting while retaining issue history', () => {
    const account = transferCompletedScenario()
    expect(deriveJobChangeAttention(account)).toEqual([])
  })

  it('deduplicates repeated exception records and never falls back to a zero amount', () => {
    const account = transferInProgressScenario()
    const duplicate = structuredClone(account.exceptions.find((exception) => exception.kind === 'previous-balance')!)
    duplicate.id = 'duplicate-previous-balance'
    duplicate.amount = undefined
    account.exceptions.push(duplicate)

    const attention = deriveJobChangeAttention(account)
    expect(attention).toHaveLength(1)
    expect(attention[0].amount).toBe(38_450)
    expect(attention[0].amount).not.toBe(0)
  })
})
