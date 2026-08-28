import { createInitialAccount } from './data'
import type { AccountState } from './types'

export const ACCOUNT_STORAGE_KEY = 'epfo-neo-account-v3'

export function loadPersistedAccount(storage: Pick<Storage, 'getItem'>): AccountState {
  const stored = storage.getItem(ACCOUNT_STORAGE_KEY)
  if (!stored) return createInitialAccount()
  try {
    const parsed = JSON.parse(stored) as Partial<AccountState>
    if (parsed.version !== 3 || !parsed.member || !parsed.ledger || !Array.isArray(parsed.requests) || !Array.isArray(parsed.member.nominees)) return createInitialAccount()
    return parsed as AccountState
  } catch {
    return createInitialAccount()
  }
}

export function persistAccount(storage: Pick<Storage, 'setItem'>, account: AccountState): void {
  storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account))
}
