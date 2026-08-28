import type { ContributionRecord } from './types'

export const normalizeMobile = (value: string): string => value.replace(/\D/g, '').slice(0, 10)
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/

export function validateIndianMobile(value: string): string | null {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) return 'Enter digits only.'
  if (normalized.length !== 10) return 'Enter exactly 10 digits.'
  if (!INDIAN_MOBILE_PATTERN.test(normalized)) return 'Enter a valid Indian mobile number beginning with 6, 7, 8 or 9.'
  return null
}

export function validateEmail(value: string): string | null {
  const normalized = value.trim()
  if (!normalized) return 'Enter an email address.'
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return 'Enter a valid email address.'
  return null
}

export function validateContribution(record: ContributionRecord): string[] {
  const issues: string[] = []
  if (record.recordedOn === null && record.status !== 'awaiting-record' && record.status !== 'missing-contribution') issues.push('A recorded contribution needs a Recorded On date.')
  if (record.employeeEpf === null && record.status !== 'awaiting-record' && record.status !== 'missing-contribution') issues.push('Employee EPF is unavailable.')
  if (record.employerEpf === null && record.status !== 'awaiting-record' && record.status !== 'missing-contribution' && record.status !== 'amount-needs-review') issues.push('Employer EPF is unavailable.')
  if (record.eps === null && record.status !== 'awaiting-record' && record.status !== 'missing-contribution') issues.push('EPS is unavailable.')
  if ([record.employeeEpf, record.employerEpf, record.eps, record.pfWage].some((amount) => amount !== null && amount < 0)) issues.push('Contribution amounts cannot be negative.')
  if (!/^\d{4}-\d{2}$/.test(record.wageMonth)) issues.push('Wage Month must use YYYY-MM format.')
  return issues
}
