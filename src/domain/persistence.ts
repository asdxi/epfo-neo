import { createInitialAccount } from './data'
import type { AccountState } from './types'

export const ACCOUNT_STORAGE_KEY = 'epfo-neo-account-v3'
export const AUTHENTICATION_STORAGE_KEY = 'epfo-neo-authenticated-v1'

function removeSyntheticCopy(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\bsynthetic\s*/gi, '')
  if (Array.isArray(value)) return value.map(removeSyntheticCopy)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, removeSyntheticCopy(item)]))
  return value
}

const employerNameChanges: Record<string, string> = {
  'Northstar Consumer Technologies': 'Stark Industries',
  'BlueKite Digital Services': 'Dunder Mifflin Paper Co.',
  'Harbor Foods India': 'Waystar Royco',
  'Vertex Mobility': 'Pied Piper',
}

function updateSavedPortalCopy(value: unknown): unknown {
  if (typeof value === 'string') {
    const employerUpdated = Object.entries(employerNameChanges).reduce((copy, [before, after]) => copy.replaceAll(before, after), value)
    return employerUpdated
      .replaceAll('Employer contribution record received by Neo', 'Employer contribution record')
      .replaceAll('Submitted from Neo', 'Submission Attempted')
      .replaceAll('Neo recorded the submission attempt, but ', '')
      .replaceAll('Member portal receipt', 'Member Portal Receipt')
      .replaceAll('EPFO acknowledgement', 'EPFO Acknowledgement')
      .replaceAll('Employer review', 'Employer Review')
      .replaceAll('Transfer processing', 'Transfer Processing')
      .replaceAll('Member portal', 'Member Portal')
      .replaceAll('Grievance portal', 'Grievance Portal')
      .replaceAll('Claims portal', 'Claims Portal')
      .replace(/^a portal receipt/, 'A portal receipt')
  }
  if (Array.isArray(value)) return value.map(updateSavedPortalCopy)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, updateSavedPortalCopy(item)]))
  return value
}

export function loadPersistedAccount(storage: Pick<Storage, 'getItem'>): AccountState {
  const stored = storage.getItem(ACCOUNT_STORAGE_KEY)
  if (!stored) return createInitialAccount()
  try {
    const parsed = JSON.parse(stored) as Partial<AccountState>
    if (parsed.version !== 3 || !parsed.member || !parsed.ledger || !Array.isArray(parsed.requests) || !Array.isArray(parsed.member.nominees)) return createInitialAccount()
    const defaults = createInitialAccount()
    const member = parsed.member
    const exceptions = Array.isArray(parsed.exceptions)
      ? parsed.exceptions.map((exception) => {
          const fallback = defaults.exceptions.find((item) => item.id === exception.id)
          return {
            ...fallback,
            ...exception,
            issueSnapshot: exception.issueSnapshot ?? fallback?.issueSnapshot,
          }
        })
      : defaults.exceptions
    return updateSavedPortalCopy(removeSyntheticCopy({
      ...defaults,
      ...parsed,
      member: {
        ...defaults.member,
        ...member,
        mobile: { ...defaults.member.mobile, ...member.mobile },
        email: { ...defaults.member.email, ...member.email },
        communicationPreferences: { ...defaults.member.communicationPreferences, ...member.communicationPreferences },
      },
      kyc: Array.isArray(parsed.kyc) ? parsed.kyc : defaults.kyc,
      employments: Array.isArray(parsed.employments) ? parsed.employments : defaults.employments,
      employmentGaps: Array.isArray(parsed.employmentGaps) ? parsed.employmentGaps : defaults.employmentGaps,
      exceptions,
      generatedReports: Array.isArray(parsed.generatedReports) ? parsed.generatedReports : defaults.generatedReports,
    })) as AccountState
  } catch {
    return createInitialAccount()
  }
}

export function persistAccount(storage: Pick<Storage, 'setItem'>, account: AccountState): void {
  storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account))
}

export function clearPersistedAccount(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(ACCOUNT_STORAGE_KEY)
}

export function loadPersistedAuthentication(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(AUTHENTICATION_STORAGE_KEY) === 'true'
}

export function persistAuthentication(storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(AUTHENTICATION_STORAGE_KEY, 'true')
}

export function clearPersistedAuthentication(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(AUTHENTICATION_STORAGE_KEY)
}
