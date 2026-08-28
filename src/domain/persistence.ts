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

export function loadPersistedAccount(storage: Pick<Storage, 'getItem'>): AccountState {
  const stored = storage.getItem(ACCOUNT_STORAGE_KEY)
  if (!stored) return createInitialAccount()
  try {
    const parsed = JSON.parse(stored) as Partial<AccountState>
    if (parsed.version !== 3 || !parsed.member || !parsed.ledger || !Array.isArray(parsed.requests) || !Array.isArray(parsed.member.nominees)) return createInitialAccount()
    return removeSyntheticCopy(parsed) as AccountState
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
