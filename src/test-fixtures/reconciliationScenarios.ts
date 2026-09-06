import { createInitialAccount } from '../domain/data'
import { completeTransferResolution } from '../domain/state'
import type { AccountState } from '../domain/types'

const transferException = (account: AccountState) => account.exceptions.find((item) => item.kind === 'previous-balance')!
const contributionException = (account: AccountState) => account.exceptions.find((item) => item.kind === 'contribution-review')!

export const transferReadyScenario = (): AccountState => {
  const account = createInitialAccount()
  account.requests = account.requests.filter((request) => request.id !== 'request-transfer-2026')
  account.ledger.transfers = account.ledger.transfers.filter((transfer) => transfer.id !== 'transfer-harbor-vertex-2026-06-18')
  const exception = transferException(account)
  exception.state = 'open'
  exception.relatedRequestId = undefined
  exception.currentResponsibleParty = 'member'
  exception.issueSnapshot = {
    ...exception.issueSnapshot!,
    sourceRecordReferences: [{ kind: 'employment', id: 'harbor' }, { kind: 'employment', id: 'vertex' }],
  }
  return account
}

export const transferInProgressScenario = (): AccountState => createInitialAccount()

export const acknowledgementMissingScenario = (): AccountState => {
  const account = createInitialAccount()
  const request = account.requests.find((item) => item.id === 'request-transfer-2026')!
  request.state = 'submission-attempted'
  request.updatedOn = '2026-06-18'
  request.currentResponsibleParty = 'member'
  request.externalReference = undefined
  request.timeline = [
    { id: 'transfer-attempt-2026', label: 'Submission Attempted', date: '2026-06-18', state: 'completed', kind: 'member-submission-attempt', confirmation: 'confirmed', party: 'member' },
    { id: 'transfer-receipt-2026', label: 'Member portal receipt', date: null, state: 'current', kind: 'channel-receipt', confirmation: 'missing', party: 'portal', channel: 'Member portal' },
    { id: 'transfer-acknowledgement-2026', label: 'EPFO acknowledgement', date: null, state: 'upcoming', kind: 'epfo-acknowledgement', confirmation: 'expected', party: 'epfo' },
  ]
  transferException(account).currentResponsibleParty = 'member'
  return account
}

export const rejectedRequestScenario = (): AccountState => {
  const account = createInitialAccount()
  const request = account.requests.find((item) => item.id === 'request-transfer-2026')!
  request.state = 'rejected'
  request.currentResponsibleParty = 'member'
  request.rejection = {
    originalRemark: 'Supporting salary month does not match selected contribution.',
    plainLanguageMeaning: 'The attached evidence points to a different month.',
    mismatch: 'Evidence says May 2026; request says June 2026.',
    correctableBy: 'Member',
    evidenceNeeded: ['June 2026 wage record'],
    recoveryAction: 'prepare',
    requiresFreshSubmission: false,
  }
  return account
}

export const transferCompletedScenario = (): AccountState => completeTransferResolution(
  createInitialAccount(),
  'transfer-harbor-vertex-2026-06-18',
  '2026-09-04',
)

export const contributionComponentMissingScenario = (): AccountState => createInitialAccount()

export const resolvedContributionScenario = (): AccountState => {
  const account = createInitialAccount()
  contributionException(account).state = 'resolved'
  contributionException(account).currentResponsibleParty = 'none'
  return account
}

export const unavailableSourceScenario = (): AccountState => {
  const account = createInitialAccount()
  account.ledger.transfers = account.ledger.transfers.filter((transfer) => transfer.id !== 'transfer-harbor-vertex-2026-06-18')
  return account
}

export const noActiveIssueScenario = (): AccountState => {
  const account = transferCompletedScenario()
  const exception = contributionException(account)
  exception.state = 'resolved'
  exception.currentResponsibleParty = 'none'
  return account
}
