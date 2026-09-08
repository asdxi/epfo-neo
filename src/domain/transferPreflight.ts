import { reconcileMemberId } from './calculations'
import type { AccountState, Employment, Money } from './types'

export type TransferPreflightResult =
  | { state: 'no-previous-balance'; sourceMemberId?: string; destinationMemberId?: string; amount: 0 }
  | { state: 'automatic-completed'; transferId: string; amount: Money; sourceMemberId: string; destinationMemberId: string }
  | { state: 'automatic-in-progress'; transferId: string; amount: Money; sourceMemberId: string; destinationMemberId: string }
  | { state: 'existing-manual-request'; requestId: string; transferId?: string; amount: Money; sourceMemberId: string; destinationMemberId: string }
  | { state: 'manual-required'; amount: Money; sourceMemberId: string; destinationMemberId: string }
  | { state: 'blocked-record-or-identity'; reason: string; sourceMemberId?: string; destinationMemberId?: string }

export interface TransferCandidate {
  employment: Employment
  result: TransferPreflightResult
}

const currentEmployment = (account: AccountState): Employment | undefined =>
  account.employments.find((employment) => employment.status === 'current')

export function deriveTransferPreflight(account: AccountState): TransferPreflightResult {
  const exception = account.exceptions.find((item) => item.kind === 'previous-balance')
  const source = exception?.employmentId ? account.employments.find((item) => item.id === exception.employmentId) : undefined
  const destination = currentEmployment(account)
  if (!source || !destination) return { state: 'blocked-record-or-identity', reason: 'The previous or current employment record is unavailable.' }

  const sourceBalance = reconcileMemberId(account, source.memberId).closingBalance
  const transfers = account.ledger.transfers.filter((transfer) => transfer.fromMemberId === source.memberId && transfer.toMemberId === destination.memberId)
  if (transfers.some((transfer) => transfer.uanEvidence?.confirmation === 'unconfirmed')) {
    return { state: 'blocked-record-or-identity', reason: 'Correct the UAN linkage for the previous employment record first.', sourceMemberId: source.memberId, destinationMemberId: destination.memberId }
  }
  const automaticInProgress = transfers.find((transfer) => transfer.initiationMethod === 'automatic' && transfer.state !== 'completed')
  if (automaticInProgress) return { state: 'automatic-in-progress', transferId: automaticInProgress.id, amount: automaticInProgress.amount, sourceMemberId: source.memberId, destinationMemberId: destination.memberId }
  const manual = transfers.find((transfer) => transfer.initiationMethod === 'manual' && transfer.state !== 'completed')
  const request = account.requests.find((item) => item.type === 'transfer' && item.state !== 'completed' && (item.id === manual?.relatedRequestId || item.employmentId === source.id))
  if (manual && request) return { state: 'existing-manual-request', requestId: request.id, transferId: manual.id, amount: manual.amount, sourceMemberId: source.memberId, destinationMemberId: destination.memberId }
  if (request) return { state: 'existing-manual-request', requestId: request.id, amount: request.amount ?? sourceBalance, sourceMemberId: source.memberId, destinationMemberId: destination.memberId }
  const automatic = transfers.find((transfer) => transfer.initiationMethod === 'automatic' && transfer.state === 'completed')
  if (automatic && sourceBalance <= 0) return { state: 'automatic-completed', transferId: automatic.id, amount: automatic.amount, sourceMemberId: source.memberId, destinationMemberId: destination.memberId }
  if (sourceBalance <= 0) return { state: 'no-previous-balance', sourceMemberId: source.memberId, destinationMemberId: destination.memberId, amount: 0 }
  return { state: 'manual-required', amount: exception?.amount ?? sourceBalance, sourceMemberId: source.memberId, destinationMemberId: destination.memberId }
}

export function deriveTransferCandidates(account: AccountState): TransferCandidate[] {
  const destination = currentEmployment(account)
  if (!destination) return []
  return account.employments.filter((employment) => employment.id !== destination.id).flatMap<TransferCandidate>((employment): TransferCandidate[] => {
    const balance = reconcileMemberId(account, employment.memberId).closingBalance
    const transfers = account.ledger.transfers.filter((transfer) => transfer.fromMemberId === employment.memberId && transfer.toMemberId === destination.memberId)
    const openTransfer = transfers.find((transfer) => transfer.state !== 'completed')
    const openRequest = account.requests.find((request) => request.type === 'transfer' && request.state !== 'completed' && (request.employmentId === employment.id || request.id === openTransfer?.relatedRequestId))
    const completedAutomatic = transfers.find((transfer) => transfer.state === 'completed' && transfer.initiationMethod === 'automatic')
    if (openRequest) return [
      { employment, result: { state: 'existing-manual-request', requestId: openRequest.id, transferId: openTransfer?.id, amount: openRequest.amount ?? balance, sourceMemberId: employment.memberId, destinationMemberId: destination.memberId } },
      ...(completedAutomatic ? [{ employment, result: { state: 'automatic-completed' as const, transferId: completedAutomatic.id, amount: completedAutomatic.amount, sourceMemberId: employment.memberId, destinationMemberId: destination.memberId } }] : []),
    ]
    if (openTransfer?.initiationMethod === 'automatic') return [{ employment, result: { state: 'automatic-in-progress', transferId: openTransfer.id, amount: openTransfer.amount, sourceMemberId: employment.memberId, destinationMemberId: destination.memberId } }]
    if (balance <= 0) return completedAutomatic ? [{ employment, result: { state: 'automatic-completed', transferId: completedAutomatic.id, amount: completedAutomatic.amount, sourceMemberId: employment.memberId, destinationMemberId: destination.memberId } }] : []
    return [{ employment, result: { state: 'manual-required', amount: balance, sourceMemberId: employment.memberId, destinationMemberId: destination.memberId } }]
  })
}
