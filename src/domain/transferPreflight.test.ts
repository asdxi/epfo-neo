import { createInitialAccount } from './data'
import { describe, expect, it } from 'vitest'
import { totalEpfBalance } from './calculations'
import { deriveTransferPreflight } from './transferPreflight'
import { submitTransfer } from './state'

describe('transfer preflight', () => {
  it('keeps initiation method explicit and identifies the existing manual request', () => {
    const account = createInitialAccount()
    expect(account.ledger.transfers.find((item) => item.amount === 128_894)?.initiationMethod).toBe('automatic')
    expect(account.ledger.transfers.find((item) => item.amount === 38_450)?.initiationMethod).toBe('manual')
    expect(deriveTransferPreflight(account)).toMatchObject({ state: 'existing-manual-request', amount: 38_450 })
  })

  it('does not change reconciled totals or double-count the remaining source balance', () => {
    const account = createInitialAccount()
    expect(totalEpfBalance(account)).toBe(188_094)
    expect(account.ledger.transfers.filter((item) => item.state === 'completed').reduce((sum, item) => sum + item.amount, 0)).toBe(256_651)
  })

  it('blocks duplicate submission and allows a manual-required fixture', () => {
    const account = createInitialAccount()
    expect(submitTransfer(account, '2026-09-06')).toBe(account)
    const eligible = { ...account, requests: account.requests.filter((request) => request.type !== 'transfer'), ledger: { ...account.ledger, transfers: account.ledger.transfers.filter((transfer) => transfer.initiationMethod !== 'manual') }, exceptions: account.exceptions.map((item) => item.kind === 'previous-balance' ? { ...item, state: 'open' as const, relatedRequestId: undefined } : item) }
    expect(deriveTransferPreflight(eligible)).toMatchObject({ state: 'manual-required', amount: 38_450 })
    expect(submitTransfer(eligible, '2026-09-06').requests.some((request) => request.type === 'transfer')).toBe(true)
  })
})
