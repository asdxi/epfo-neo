import { useEffect, useMemo, useState } from 'react'
import {
  accountReconciliation, employerSummaries,
  formatDate, formatMoney, formatWageMonth, ledgerTransactions,
  totalEpfBalance, totalEpsContributions, totalEpsServiceMonths,
} from '../domain/calculations'
import type { AccountState, ContributionRecord, LedgerTransaction, ReportFormat } from '../domain/types'
import './financial-pages.css'

export type PassbookView = 'overview' | 'employers' | 'transactions'
export type PassbookRange = '6-months' | '1-year' | '2-years' | '5-years' | 'all-time' | 'custom'
export interface StatementRequest { range: PassbookRange; periodLabel: string; startsOn: string; endsOn: string; format: ReportFormat; transactionIds: string[] }
export interface PassbookPageProps {
  account: AccountState
  initialView?: PassbookView
  initialContextId?: string
  onGenerateStatement: (request: StatementRequest) => void
  onRaiseContributionGrievance: (contribution: ContributionRecord) => void
  onStartTransfer: (employmentId: string) => void
}

const views: ReadonlyArray<{ id: PassbookView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'employers', label: 'Employers' },
  { id: 'transactions', label: 'Transactions' },
]
const rangeOptions: ReadonlyArray<{ id: PassbookRange; label: string; months?: number }> = [
  { id: '6-months', label: '6 Months', months: 6 }, { id: '1-year', label: '1 Year', months: 12 },
  { id: '2-years', label: '2 Years', months: 24 }, { id: '5-years', label: '5 Years', months: 60 },
  { id: 'all-time', label: 'All Time' }, { id: 'custom', label: 'Custom Range' },
]
const transactionTypeLabel: Record<LedgerTransaction['type'], string> = {
  contribution: 'Contribution', 'official-interest': 'Interest Credit', 'estimated-interest': 'Estimated Interest',
  'transfer-in': 'Transfer', 'transfer-out': 'Transfer', withdrawal: 'Withdrawal',
}
const transactionTypeTone: Record<LedgerTransaction['type'], string> = {
  contribution: 'success',
  'official-interest': 'info',
  'estimated-interest': 'neutral',
  'transfer-in': 'primary',
  'transfer-out': 'primary',
  withdrawal: 'warning',
}
const transactionTypeOptions = [
  { value: 'contribution', label: 'Contribution' },
  { value: 'official-interest', label: 'Interest Credit' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'withdrawal', label: 'Withdrawal' },
] as const
const transferMethodLabel = (transaction: LedgerTransaction, account: AccountState): string | undefined => {
  if (transaction.type !== 'transfer-in' && transaction.type !== 'transfer-out') return undefined
  const transferId = transaction.id.replace(/-(in|out)$/, '')
  const transfer = account.ledger.transfers.find((item) => item.id === transferId)
  return transfer?.initiationMethod === 'manual' ? 'Manual Transfer' : transfer?.initiationMethod === 'automatic' ? 'Automatic Transfer' : undefined
}
const transferStateLabel = (state: ReturnType<typeof employerSummaries>[number]['transferState']): string => ({
  ready: 'Transfer Ready', pending: 'Transfer Pending', submitted: 'Transfer Submitted',
  processing: 'Transfer in Progress', completed: 'Transfer Completed', 'not-applicable': 'Not Applicable',
})[state]
const formatNumericDate = (value: string): string => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(`${value}T00:00:00`))
const employerQuerySlug = (employer: string): string => employer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const paginationItems = (currentPage: number, pageCount: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> => {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (currentPage <= 3) return [1, 2, 3, 'ellipsis-end', pageCount]
  if (currentPage >= pageCount - 2) return [1, 'ellipsis-start', pageCount - 2, pageCount - 1, pageCount]
  return [1, 'ellipsis-start', currentPage, 'ellipsis-end', pageCount]
}
const subtractMonths = (month: string, count: number) => {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value - count, 1)).toISOString().slice(0, 7)
}
const periodForRange = (account: AccountState, range: PassbookRange, customStart: string, customEnd: string) => {
  const months = account.ledger.contributions.map((item) => item.wageMonth).sort()
  const first = months[0] ?? ''; const last = months.at(-1) ?? ''
  const duration = rangeOptions.find((item) => item.id === range)?.months
  return { start: range === 'custom' ? customStart : duration && last ? subtractMonths(last, duration - 1) : first, end: range === 'custom' ? customEnd : last }
}
const endOfMonth = (month: string) => {
  if (!month) return ''
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10)
}
const providerLabel = (type: AccountState['employments'][number]['establishmentType']) => type === 'exempted-pf-trust' ? 'Employer PF Trust' : 'EPFO'
const transactionsPerPage = 10
const desktopPassbookQuery = '(min-width: 64rem)'

const useDesktopPassbookLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia?.(desktopPassbookQuery).matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.(desktopPassbookQuery)
    if (!query) return
    const update = () => setIsDesktop(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return isDesktop
}

export function PassbookPage(props: PassbookPageProps) {
  const { account, initialView = 'overview', initialContextId, onGenerateStatement, onRaiseContributionGrievance, onStartTransfer } = props
  const initialEmployer = account.employments.find((item) => item.id === initialContextId || employerQuerySlug(item.employer) === initialContextId)?.id
  const initialContribution = account.ledger.contributions.some((item) => item.id === initialContextId) ? initialContextId : undefined
  const query = new URLSearchParams(window.location.search)
  const contextView = views.find((item) => item.id === initialContextId)?.id
  const inferredView: PassbookView = initialContribution ? 'transactions' : initialEmployer ? 'employers' : contextView ?? initialView
  const isDesktop = useDesktopPassbookLayout()
  const [view, setView] = useState<PassbookView>(() => isDesktop && inferredView === 'overview' ? 'employers' : inferredView)
  const effectiveView: PassbookView = isDesktop && view === 'overview' ? 'employers' : view
  const visibleViews = isDesktop ? views.filter((item) => item.id !== 'overview') : views
  const [selectedEmployerId, setSelectedEmployerId] = useState(initialEmployer ?? account.employments.find((item) => item.status === 'current')?.id ?? '')
  const [transactionEmployer, setTransactionEmployer] = useState(query.get('employer') ?? (initialContribution ? account.ledger.contributions.find((item) => item.id === initialContribution)?.employmentId ?? 'all' : 'all'))
  const [transactionType, setTransactionType] = useState(query.get('type') ?? (initialContribution ? 'contribution' : 'all'))
  const [transactionRange, setTransactionRange] = useState<PassbookRange>((query.get('period') as PassbookRange | null) ?? '6-months')
  const [transactionStart, setTransactionStart] = useState('')
  const [transactionEnd, setTransactionEnd] = useState('')
  const [transactionsRequested, setTransactionsRequested] = useState(query.get('load') === '1' || Boolean(initialContribution))
  const [transactionPage, setTransactionPage] = useState(1)
  const [formatDialogOpen, setFormatDialogOpen] = useState(false)
  const summaries = employerSummaries(account)
  const selectedEmployer = summaries.find((item) => item.employment.id === selectedEmployerId)
  const recentPeriod = periodForRange(account, '6-months', '', '')
  const recentContributions = [...account.ledger.contributions]
    .filter((item) => item.wageMonth >= recentPeriod.start && item.wageMonth <= recentPeriod.end)
    .sort((a, b) => b.wageMonth.localeCompare(a.wageMonth))
  const transactionPeriod = periodForRange(account, transactionRange, transactionStart, transactionEnd)
  const transactionPeriodReady = Boolean(transactionPeriod.start && transactionPeriod.end && transactionPeriod.start <= transactionPeriod.end)
  const transactions = useMemo(() => transactionPeriodReady ? ledgerTransactions(account).filter((item) =>
    (transactionEmployer === 'all' || item.employmentId === transactionEmployer)
    && (transactionType === 'all' || item.type === transactionType || (transactionType === 'transfers' && (item.type === 'transfer-in' || item.type === 'transfer-out')))
    && (item.wageMonth ?? item.date?.slice(0, 7) ?? '') >= transactionPeriod.start
    && (item.wageMonth ?? item.date?.slice(0, 7) ?? '') <= transactionPeriod.end,
  ) : [], [account, transactionEmployer, transactionType, transactionPeriod.start, transactionPeriod.end, transactionPeriodReady])

  useEffect(() => {
    const targetId = initialContribution ? `transaction-${initialContribution}` : initialEmployer ? `employer-detail-${initialEmployer}` : undefined
    if (!targetId) return
    const timeout = window.setTimeout(() => {
      const target = document.getElementById(targetId)
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      target?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [initialContribution, initialEmployer])

  const changeView = (next: PassbookView) => {
    window.history.pushState({ ...window.history.state, depth: Number(window.history.state?.depth ?? 0) + 1 }, '', `/passbook?view=${next}`)
    setView(next)
    requestAnimationFrame(() => document.getElementById(`passbook-panel-${next}`)?.focus())
  }
  const handleTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? visibleViews.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleViews.length) % visibleViews.length
    changeView(visibleViews[nextIndex].id)
    requestAnimationFrame(() => document.querySelectorAll<HTMLButtonElement>('.financial-tabs [role="tab"]')[nextIndex]?.focus())
  }
  const showCalculation = () => {
    if (view !== 'overview') changeView('overview')
    window.setTimeout(() => {
      const target = document.getElementById('balance-calculation-section')
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      target?.focus({ preventScroll: true })
    }, 0)
  }
  const downloadTransactions = (format: ReportFormat) => {
    if (!transactionPeriodReady) return
    onGenerateStatement({ range: transactionRange, periodLabel: rangeOptions.find((item) => item.id === transactionRange)?.label ?? 'Selected Period', startsOn: `${transactionPeriod.start}-01`, endsOn: endOfMonth(transactionPeriod.end), format, transactionIds: transactions.map((item) => item.id) })
    setFormatDialogOpen(false)
  }
  const updateTransactionFilter = (update: () => void) => { update(); setTransactionsRequested(false); setTransactionPage(1) }
  const selectEmployer = (employmentId: string) => {
    const employer = account.employments.find((item) => item.id === employmentId)
    const queryValue = employer ? employerQuerySlug(employer.employer) : employmentId
    window.history.pushState({ ...window.history.state, depth: Number(window.history.state?.depth ?? 0) + 1 }, '', `/passbook?view=employers&employment=${queryValue}`)
    setSelectedEmployerId(employmentId)
  }

  return <section className="financial-page passbook-page" aria-labelledby="passbook-title">
    <header className="financial-heading"><h1 id="passbook-title">Passbook</h1><p>Understand your balance calculation, recent contributions, and ledger</p></header>
    <div className="passbook-content-layout">
      <div className="passbook-tabbed-content">
    <article className="ux4g-card ux4g-card-solid ux4g-card-vertical passbook-balance-card" aria-labelledby="passbook-balance-title"><div className="ux4g-card-body"><h2 className="home-balance-title" id="passbook-balance-title">Current EPF Balance</h2><p className="financial-balance">{formatMoney(totalEpfBalance(account))}</p><p>Across all recorded PF accounts.</p><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md passbook-calculation-link" type="button" aria-controls="balance-calculation-section" onClick={showCalculation}>How This Is Calculated</button></div></article>
    <PensionSummary account={account} />
    <nav className="ux4g-tab ux4g-tab-underline ux4g-tab-md financial-tabs" aria-label="Passbook views"><ul className="ux4g-tab-list" role="tablist">{visibleViews.map((item, index) => <li key={item.id} role="presentation"><button className={`ux4g-tab-item${effectiveView === item.id ? ' active' : ''}`} type="button" role="tab" tabIndex={effectiveView === item.id ? 0 : -1} aria-selected={effectiveView === item.id} aria-controls={`passbook-panel-${item.id}`} onKeyDown={(event) => handleTabKey(event, index)} onClick={() => changeView(item.id)}>{item.label}</button></li>)}</ul></nav>
    {!isDesktop && effectiveView === 'overview' && <Overview account={account} contributions={recentContributions} highlightedContributionId={initialContribution} onRaiseContributionGrievance={onRaiseContributionGrievance} />}
    {effectiveView === 'employers' && <section className="passbook-panel" id="passbook-panel-employers" role="tabpanel" tabIndex={-1}><div className="financial-section-heading"><div><h2>PF Accounts</h2><p>Balance breakdown by job</p></div></div>{summaries.length === 0 ? <Empty title="No Employer Records Available">Employer-level ledger records are unavailable in this account.</Empty> : <div className="employer-layout"><div className="employer-selector" role="list" aria-label="Employers">{summaries.map((summary) => <button key={summary.employment.id} type="button" className={selectedEmployerId === summary.employment.id ? 'selected' : ''} aria-pressed={selectedEmployerId === summary.employment.id} onClick={() => selectEmployer(summary.employment.id)}><strong>{summary.employment.employer}</strong><span className="employer-account-number">{summary.employment.pfAccounts?.length ? `${summary.employment.pfAccounts.length} PF Accounts` : `Member ID · ${summary.employment.memberId}`}</span><span>{isDesktop ? formatNumericDate(summary.employment.joinedOn) : formatDate(summary.employment.joinedOn)} to {summary.employment.exitedOn ? isDesktop ? formatNumericDate(summary.employment.exitedOn) : formatDate(summary.employment.exitedOn) : 'Present'}</span><span className="employer-closing-balance">Closing Balance: {formatMoney(summary.closingBalance)}</span></button>)}</div>{selectedEmployer && <EmployerDetail summary={selectedEmployer} highlighted={selectedEmployer.employment.id === initialEmployer} onStartTransfer={onStartTransfer} />}</div>}</section>}
    {effectiveView === 'transactions' && <section className="passbook-panel" id="passbook-panel-transactions" role="tabpanel" tabIndex={-1}><div className="financial-section-heading"><div><h2>Transactions</h2><p>Filter, and view or download transactions over a period</p></div></div><TransactionFilters account={account} employer={transactionEmployer} type={transactionType} range={transactionRange} start={transactionStart} end={transactionEnd} ready={transactionPeriodReady} canDownload={transactionPeriodReady} onEmployer={(value) => updateTransactionFilter(() => setTransactionEmployer(value))} onType={(value) => updateTransactionFilter(() => setTransactionType(value))} onRange={(value) => updateTransactionFilter(() => setTransactionRange(value))} onStart={(value) => updateTransactionFilter(() => setTransactionStart(value))} onEnd={(value) => updateTransactionFilter(() => setTransactionEnd(value))} onGenerate={() => { setTransactionPage(1); setTransactionsRequested(true) }} onDownload={() => setFormatDialogOpen(true)} />{transactionsRequested && (transactions.length === 0 ? <Empty title="No Transactions Match">No ledger activity matches these filters. Change a filter to continue.</Empty> : <TransactionTable account={account} transactions={transactions} page={transactionPage} highlightedTransactionId={initialContribution} onPageChange={setTransactionPage} />)}</section>}
      </div>
      {isDesktop && <aside className="passbook-overview-rail" aria-label="Overview"><Overview account={account} contributions={recentContributions} highlightedContributionId={initialContribution} rail onRaiseContributionGrievance={onRaiseContributionGrievance} /></aside>}
    </div>
    {formatDialogOpen && <DownloadFormatDialog onClose={() => setFormatDialogOpen(false)} onChoose={downloadTransactions} />}
  </section>
}

function Empty({ title, children }: { title: string; children: string }) { return <div className="financial-empty"><h3>{title}</h3><p>{children}</p></div> }

function InfoTooltip({ id, label, children }: { id: string; label: string; children: string }) {
  return <span className="financial-info"><button className="financial-info-trigger" type="button" aria-describedby={id} aria-label={label}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="8" r="1.25" fill="currentColor" /><path d="M12 11v6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg></button><span id={id} className="financial-info-tooltip" role="tooltip">{children}</span></span>
}

function PensionSummary({ account }: { account: AccountState }) {
  const [expanded, setExpanded] = useState(false)
  const serviceMonths = totalEpsServiceMonths(account)
  const pensionDate = `${account.member.dateOfBirth.slice(0, 4) ? Number(account.member.dateOfBirth.slice(0, 4)) + 58 : ''}${account.member.dateOfBirth.slice(4)}`
  const serviceLabel = `${Math.floor(serviceMonths / 12)} years ${serviceMonths % 12} months`
  return <aside className="ux4g-alert ux4g-alert-info overview-eps eps-disclosure"><div className="eps-disclosure-header"><div className="eps-title-row"><p className="ux4g-alert-title">EPS</p><InfoTooltip id="eps-explanation" label="Explain EPS">EPS is separate from EPF and recorded toward pension.</InfoTooltip></div><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md eps-disclosure-toggle" type="button" aria-expanded={expanded} aria-controls="eps-disclosure-body" onClick={() => setExpanded((current) => !current)}>{expanded ? 'Hide Details' : 'View Details'}<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg></button></div><div className="eps-disclosure-body" id="eps-disclosure-body" hidden={!expanded}><div className="ux4g-alert-content"><p className="eps-contribution-total"><span>Accrued Pension Corpus Till Date</span><strong>{formatMoney(totalEpsContributions(account))}</strong></p><ul className="eps-rules"><li><strong>Your Service:</strong> {serviceLabel}.</li><li><strong>Before 10 Years of Service:</strong> After you leave EPF-covered employment, you may claim a one-time withdrawal benefit. EPFO calculates it from your EPS wages and completed service months—not from {formatMoney(totalEpsContributions(account))}. If you take it, these service years will no longer count toward a future pension.</li><li><strong>After 10 Years of Service:</strong> You cannot withdraw EPS as a lump sum. Your service is used to calculate a monthly pension.</li><li><strong>Pension at 58:</strong> You can claim a monthly pension from {formatDate(pensionDate)}. EPFO calculates it from your pensionable salary and total pension service.</li><li><strong>Early Pension from 50:</strong> After you leave EPF-covered employment, you may claim the monthly pension early. It is permanently reduced by 4% for each year before 58.</li><li><strong>Interest:</strong> EPS does not credit interest to this contribution record.</li></ul></div></div></aside>
}

function Overview({ account, contributions, highlightedContributionId, rail = false, onRaiseContributionGrievance }: { account: AccountState; contributions: ContributionRecord[]; highlightedContributionId?: string; rail?: boolean; onRaiseContributionGrievance: (contribution: ContributionRecord) => void }) {
  const value = accountReconciliation(account)
  const rows = [
    ['Employee EPF Contributions', value.employeeContributions],
    ['VPF Contributions', value.voluntaryContributions],
    ['Employer EPF Contributions', value.employerEpfContributions],
    ['Interest Credited', value.officialInterestCredits],
    ['Transfers In', value.transfersIn, 'PF received from earlier Member IDs.'],
    ['Transfers Out', -value.transfersOut, 'PF moved to later Member IDs.'],
    ['Withdrawals', -value.withdrawals],
  ] as const
  return <section className="passbook-panel" id="passbook-panel-overview" role={rail ? 'region' : 'tabpanel'} aria-label={rail ? 'Overview' : undefined} tabIndex={-1}>
    <section className="financial-section overview-recent" aria-labelledby="recent-contributions-title"><div className="financial-section-heading"><div><h2 id="recent-contributions-title">Recent Contributions</h2><p>EPF entries in the latest six months.</p></div></div>{contributions.length === 0 ? <Empty title="No Contributions Recorded">No contribution records are available for the last six months.</Empty> : <ol className="contribution-summary-grid">{contributions.map((record) => { const employer = account.employments.find((item) => item.id === record.employmentId); const highlighted = record.id === highlightedContributionId; return <li key={record.id} className={highlighted ? 'highlighted' : ''}><time dateTime={record.wageMonth}>{formatWageMonth(record.wageMonth)}</time><span className="contribution-employer">{employer?.employer ?? 'Employer Unavailable'}</span><div className="contribution-amount"><span>Employee EPF</span><strong>{record.employeeEpf === null ? <span className="record-missing-value">Not Recorded</span> : formatMoney(record.employeeEpf)}</strong></div><div className="contribution-amount"><span>VPF</span><strong>{record.voluntaryEpf === null ? <span className="record-missing-value">Not Recorded</span> : formatMoney(record.voluntaryEpf)}</strong></div><div className="contribution-amount"><span>Employer EPF</span><strong>{record.employerEpf === null ? <span className="record-missing-value">Not Recorded</span> : formatMoney(record.employerEpf)}</strong></div><small>Recorded {formatDate(record.recordedOn)}</small>{highlighted && record.employerEpf === null && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-lg contribution-review-action" type="button" onClick={() => onRaiseContributionGrievance(record)}>Request Review</button>}</li> })}</ol>}</section>
    <section className="financial-panel overview-calculation" id="balance-calculation-section" aria-labelledby="balance-composition-title" tabIndex={-1}><h2 id="balance-composition-title">Current EPF Balance Calculation</h2><dl className="balance-composition">{rows.map(([label, amount, help]) => <div key={label}><dt><span>{label}</span>{help && <InfoTooltip id={`calculation-${label.toLowerCase().replaceAll(' ', '-')}`} label={`Explain ${label}`}>{help}</InfoTooltip>}</dt><dd>{formatMoney(amount)}</dd></div>)}<div className="balance-composition-total"><dt>Current EPF Balance</dt><dd>{formatMoney(value.closingBalance)}</dd></div></dl></section>
  </section>
}

function EmployerDetail({ summary, highlighted, onStartTransfer }: { summary: ReturnType<typeof employerSummaries>[number]; highlighted: boolean; onStartTransfer: (employmentId: string) => void }) {
  const employment = summary.employment
  const transferInProgress = summary.transferState === 'submitted' || summary.transferState === 'processing'
  const accounts = employment.pfAccounts ?? [{ entity: employment.employer, provider: employment.establishmentType, accountNumber: employment.memberId }]
  const metric = (label: string, amount: number, sign: '+' | '-', help?: string) => <div><dt><span>{label}</span>{help && <InfoTooltip id={`employer-${employment.id}-${label.toLowerCase().replaceAll(' ', '-')}`} label={`Explain ${label}`}>{help}</InfoTooltip>}</dt><dd>({sign}) {formatMoney(amount)}</dd></div>
  return <article className={`financial-panel employer-detail${highlighted ? ' context-target-highlight' : ''}`} id={`employer-detail-${employment.id}`} tabIndex={-1}><div className="financial-section-heading"><div><h3>{employment.employer}</h3><p>{formatDate(employment.joinedOn)} to {employment.exitedOn ? formatDate(employment.exitedOn) : 'Present'}</p></div>{summary.transferState !== 'not-applicable' && <span className="ux4g-tag ux4g-tag-filled-neutral ux4g-tag-s employer-transfer-tag">{transferStateLabel(summary.transferState)}</span>}</div><section className="employer-accounts" aria-labelledby={`employer-accounts-${employment.id}`}><h4 id={`employer-accounts-${employment.id}`}>PF Accounts ({accounts.length})</h4><ul>{accounts.map((account) => <li key={account.accountNumber}><strong>{account.entity}</strong><span>{providerLabel(account.provider)}</span><span className="employer-account-number">{account.accountNumber}</span></li>)}</ul></section>{employment.dataAvailability !== 'complete' && <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Historical Data {employment.dataAvailability === 'partial' ? 'Is Partial' : 'Is Unavailable'}</p><p className="ux4g-alert-message">{employment.dataAvailabilityNote ?? 'Some historical entries are not available in this account.'}</p></div></div>}<dl className="employer-metrics">{metric('Employee EPF Contributions', summary.employeeContributions, '+')}{metric('VPF Contributions', summary.voluntaryContributions, '+')}{metric('Employer EPF Contributions', summary.employerEpfContributions, '+')}{metric('EPS Contributions', summary.epsContributions, '+')}{metric('Interest Credited', summary.officialInterestCredits, '+')}{metric('Transfers In', summary.transfersIn, '+', 'PF received from earlier Member IDs.')}{metric('Transfers Out', summary.transfersOut, '-', 'PF moved to later Member IDs.')}{metric('Withdrawals', summary.withdrawals, '-')}<div className="employer-balance-total"><dt><span>Closing EPF Balance</span><InfoTooltip id={`employer-${employment.id}-closing-balance`} label="Explain Closing EPF Balance">PF remaining under this employer after recorded credits and debits.</InfoTooltip></dt><dd>{formatMoney(summary.closingBalance)}</dd></div></dl>{employment.status === 'balance-remaining' && !transferInProgress && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onStartTransfer(employment.id)}>Transfer Previous PF</button>}{transferInProgress && <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Transfer Is in Progress</p><p className="ux4g-alert-message">This balance remains here until the submitted transfer is processed.</p></div></div>}</article>
}

interface TransactionFiltersProps {
  account: AccountState; employer: string; type: string; range: PassbookRange; start: string; end: string; ready: boolean; canDownload: boolean
  onEmployer: (value: string) => void; onType: (value: string) => void; onRange: (value: PassbookRange) => void
  onStart: (value: string) => void; onEnd: (value: string) => void; onGenerate: () => void; onDownload: () => void
}
function TransactionFilters({ account, employer, type, range, start, end, ready, canDownload, onEmployer, onType, onRange, onStart, onEnd, onGenerate, onDownload }: TransactionFiltersProps) {
  return <div className="transaction-filter-panel"><div className="transaction-filters"><label>Employer<select className="ux4g-table-select" value={employer} onChange={(event) => onEmployer(event.target.value)}><option value="all">All Employers</option>{account.employments.map((item) => <option key={item.id} value={item.id}>{item.employer}</option>)}</select></label><label>Transaction Type<select className="ux4g-table-select" value={type} onChange={(event) => onType(event.target.value)}><option value="all">All Types</option>{transactionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Period<select className="ux4g-table-select" value={range} onChange={(event) => onRange(event.target.value as PassbookRange)}>{rangeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>{range === 'custom' && <><label>From<input className="ux4g-table-input" type="month" value={start} onChange={(event) => onStart(event.target.value)} /></label><label>To<input className="ux4g-table-input" type="month" value={end} onChange={(event) => onEnd(event.target.value)} /></label></>}</div><div className="transaction-actions"><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" disabled={!ready} onClick={onGenerate}>View Transactions</button><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md transaction-download" type="button" disabled={!canDownload} onClick={onDownload}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>Download</button></div></div>
}

function DownloadFormatDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (format: ReportFormat) => void }) {
  return <dialog className="download-format-dialog" aria-labelledby="download-format-title" onCancel={onClose} ref={(node) => { if (node && !node.open) node.showModal() }}><div><h2 id="download-format-title">Choose a File Format</h2><p>Download all transactions matching the current filters.</p></div><div className="download-format-actions"><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onChoose('pdf')}>Download PDF</button><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => onChoose('excel')}>Download Excel</button><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={onClose}>Cancel</button></div></dialog>
}

function TransactionTable({ account, transactions, page, highlightedTransactionId, onPageChange }: { account: AccountState; transactions: LedgerTransaction[]; page: number; highlightedTransactionId?: string; onPageChange: (page: number) => void }) {
  const pageCount = Math.ceil(transactions.length / transactionsPerPage)
  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * transactionsPerPage
  const pageTransactions = transactions.slice(startIndex, startIndex + transactionsPerPage)

  return <div className="transaction-results">
    <div className="transaction-table-scroll" tabIndex={0} role="region" aria-label="Transaction results table">
      <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows transaction-table">
        <caption className="visually-hidden">Filtered passbook transactions.</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Transaction</th><th scope="col">Employer</th><th scope="col">Type</th><th scope="col" className="transaction-amount-column">Employee EPF</th><th scope="col" className="transaction-amount-column">VPF</th><th scope="col" className="transaction-amount-column">Employer EPF</th><th scope="col" className="transaction-amount-column">EPF Total</th></tr></thead>
        <tbody>{pageTransactions.map((transaction) => { const employment = account.employments.find((item) => item.id === transaction.employmentId); const highlighted = transaction.id === highlightedTransactionId; const contribution = transaction.type === 'contribution'; const employeeEpf = typeof transaction.employeeEpf === 'number' ? formatMoney(transaction.employeeEpf) : <span className="record-missing-value">Not Recorded</span>; const voluntaryEpf = typeof transaction.voluntaryEpf === 'number' ? formatMoney(transaction.voluntaryEpf) : <span className="record-missing-value">Not Recorded</span>; const employerEpf = typeof transaction.employerEpf === 'number' ? formatMoney(transaction.employerEpf) : <span className="record-missing-value">Not Recorded</span>; const method = transferMethodLabel(transaction, account); return <tr key={transaction.id} id={`transaction-${transaction.id}`} className={highlighted ? 'context-target-highlight' : undefined} tabIndex={highlighted ? -1 : undefined}><td>{formatDate(transaction.date)}</td><td><span>{transaction.title}</span>{method && <small className="transaction-secondary-line">{method}</small>}</td><td>{employment?.employer ?? 'Employer Unavailable'}</td><td><span className={`ux4g-tag ux4g-tag-filled-${transactionTypeTone[transaction.type]} ux4g-tag-s`}>{transactionTypeLabel[transaction.type]}</span></td><td className="transaction-amount-column">{contribution ? employeeEpf : 'N/A'}</td><td className="transaction-amount-column">{contribution ? voluntaryEpf : 'N/A'}</td><td className="transaction-amount-column">{contribution ? employerEpf : 'N/A'}</td><td className="transaction-amount-column">{transaction.amount === null ? 'Unavailable' : formatMoney(transaction.amount)}</td></tr> })}</tbody>
      </table>
    </div>
    <div className="transaction-pagination-footer">
      <div className="transaction-pagination-summary" role="status">Showing {startIndex + 1}–{Math.min(startIndex + transactionsPerPage, transactions.length)} of {transactions.length} transactions</div>
      {pageCount > 1 && <nav className="ux4g-pagination transaction-pagination" aria-label="Transaction pages">
        <button className="ux4g-page-nav prev" type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous transaction page"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></button>
        {paginationItems(currentPage, pageCount).map((item) => typeof item === 'number' ? <button key={item} className={`ux4g-page-number${currentPage === item ? ' active' : ''}`} type="button" aria-current={currentPage === item ? 'page' : undefined} aria-label={`Transaction page ${item}`} onClick={() => onPageChange(item)}>{item}</button> : <span key={item} className="ux4g-page-number-more" aria-hidden="true">…</span>)}
        <button className="ux4g-page-nav next" type="button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)} aria-label="Next transaction page"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg></button>
      </nav>}
    </div>
  </div>
}
