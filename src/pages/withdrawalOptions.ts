export type WithdrawalKind = 'advance' | 'final'
export type WithdrawalReason = string

export const partialWithdrawalReasons = [
  'Illness', 'Marriage', 'Education', 'Purchase of House/Flat/Plot', 'Construction of House',
  'Renovation or Addition', 'Repayment of Housing Loan', 'Natural Calamity', 'Physically Handicapped',
  'One Year Before Retirement',
] as const

export const fullWithdrawalReasons = [
  'Leaving Employment / Resignation', 'Retirement', 'Permanent Relocation Abroad', 'Permanent Disability',
  'Retrenchment', 'Voluntary Retirement',
] as const
