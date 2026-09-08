import { createInitialAccount } from './data'
import { describe, expect, it } from 'vitest'
import { totalEpfBalance } from './calculations'
import { deriveTransferCandidates, deriveTransferPreflight } from './transferPreflight'
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

  it('keeps another previous Member ID eligible while one transfer is open', () => {
    const account = createInitialAccount()
    const secondEmployment = { ...account.employments[0], id: 'second-previous', employer: 'Acme Systems', memberId: 'KA/ACM/0099001', status: 'balance-remaining' as const }
    const withSecondSource = {
      ...account,
      employments: [secondEmployment, ...account.employments],
      ledger: {
        ...account.ledger,
        contributions: [{ ...account.ledger.contributions[0], id: 'acme-2025-01', employmentId: secondEmployment.id, memberId: secondEmployment.memberId, wageMonth: '2025-01', recordedOn: '2025-02-08', employeeEpf: 1_800, voluntaryEpf: 0, employerEpf: 550, eps: 1_250 }, ...account.ledger.contributions],
      },
    }
    const candidates = deriveTransferCandidates(withSecondSource)
    expect(candidates.find((item) => item.employment.memberId === 'KA/HFI/0031849')?.result.state).toBe('existing-manual-request')
    expect(candidates.find((item) => item.employment.memberId === secondEmployment.memberId)?.result.state).toBe('manual-required')
    const submitted = submitTransfer(withSecondSource, '2026-09-06', secondEmployment.memberId)
    expect(submitted.requests.some((request) => request.employmentId === secondEmployment.id)).toBe(true)
    expect(submitTransfer(submitted, '2026-09-07', secondEmployment.memberId)).toBe(submitted)
  })
})
