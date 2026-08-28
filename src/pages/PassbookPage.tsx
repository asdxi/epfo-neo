import { useMemo, useState } from 'react'
import {
  accountReconciliation, employerSummaries,
  formatDate, formatMoney, formatWageMonth, ledgerTransactions,
  totalEpfBalance, totalEpsContributions,
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
  contribution: 'Contribution', 'official-interest': 'Official Interest', 'estimated-interest': 'Estimated Interest',
  'transfer-in': 'Transfer In', 'transfer-out': 'Transfer Out', withdrawal: 'Withdrawal',
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

export function PassbookPage(props: PassbookPageProps) {
  const { account, initialView = 'overview', initialContextId, onGenerateStatement, onStartTransfer } = props
  const initialEmployer = account.employments.some((item) => item.id === initialContextId) ? initialContextId : undefined
  const initialContribution = account.ledger.contributions.some((item) => item.id === initialContextId) ? initialContextId : undefined
  const contextView = views.find((item) => item.id === initialContextId)?.id
  const inferredView: PassbookView = initialEmployer ? 'employers' : contextView ?? initialView
  const [view, setView] = useState(inferredView)
  const [selectedEmployerId, setSelectedEmployerId] = useState(initialEmployer ?? account.employments.find((item) => item.status === 'current')?.id ?? '')
  const [transactionEmployer, setTransactionEmployer] = useState('all')
  const [transactionType, setTransactionType] = useState('all')
  const [transactionRange, setTransactionRange] = useState<PassbookRange>('6-months')
  const [transactionStart, setTransactionStart] = useState('')
  const [transactionEnd, setTransactionEnd] = useState('')
  const [transactionsRequested, setTransactionsRequested] = useState(false)
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
    && (transactionType === 'all' || item.type === transactionType)
    && (item.date ?? '') >= `${transactionPeriod.start}-01`
    && (item.date ?? '') <= endOfMonth(transactionPeriod.end),
  ) : [], [account, transactionEmployer, transactionType, transactionPeriod.start, transactionPeriod.end, transactionPeriodReady])

  const changeView = (next: PassbookView) => {
    setView(next)
    requestAnimationFrame(() => document.getElementById(`passbook-panel-${next}`)?.focus())
  }
  const handleTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length
    changeView(views[nextIndex].id)
    requestAnimationFrame(() => document.querySelectorAll<HTMLButtonElement>('.financial-tabs [role="tab"]')[nextIndex]?.focus())
  }
  const downloadTransactions = (format: ReportFormat) => {
    if (!transactionPeriodReady) return
    onGenerateStatement({ range: transactionRange, periodLabel: rangeOptions.find((item) => item.id === transactionRange)?.label ?? 'Selected Period', startsOn: `${transactionPeriod.start}-01`, endsOn: endOfMonth(transactionPeriod.end), format, transactionIds: transactions.map((item) => item.id) })
    setFormatDialogOpen(false)
  }
  const updateTransactionFilter = (update: () => void) => { update(); setTransactionsRequested(false); setTransactionPage(1) }

  return <section className="financial-page passbook-page" aria-labelledby="passbook-title">
    <header className="financial-heading"><h1 id="passbook-title">Passbook</h1><p>See your balance, recent contributions, employer totals and ledger activity.</p></header>
    <article className="ux4g-card ux4g-card-solid ux4g-card-vertical passbook-balance-card" aria-labelledby="passbook-balance-title"><div className="ux4g-card-body"><h2 className="home-balance-title" id="passbook-balance-title">Current EPF Balance</h2><p className="financial-balance">{formatMoney(totalEpfBalance(account))}</p><p>Across all recorded PF accounts.</p></div></article>
    <nav className="ux4g-tab ux4g-tab-underline ux4g-tab-md financial-tabs" aria-label="Passbook views"><ul className="ux4g-tab-list" role="tablist">{views.map((item, index) => <li key={item.id} role="presentation"><button className={`ux4g-tab-item${view === item.id ? ' active' : ''}`} type="button" role="tab" tabIndex={view === item.id ? 0 : -1} aria-selected={view === item.id} aria-controls={`passbook-panel-${item.id}`} onKeyDown={(event) => handleTabKey(event, index)} onClick={() => changeView(item.id)}>{item.label}</button></li>)}</ul></nav>
    {view === 'overview' && <Overview account={account} contributions={recentContributions} highlightedContributionId={initialContribution} />}
    {view === 'employers' && <section className="passbook-panel" id="passbook-panel-employers" role="tabpanel" tabIndex={-1}><div className="financial-section-heading"><div><h2>Employers</h2><p>Totals are reconciled for each Member ID.</p></div></div>{summaries.length === 0 ? <Empty title="No Employer Records Available">Employer-level ledger records are unavailable in this account.</Empty> : <div className="employer-layout"><div className="employer-selector" role="list" aria-label="Employers">{summaries.map((summary) => <button key={summary.employment.id} type="button" className={selectedEmployerId === summary.employment.id ? 'selected' : ''} aria-pressed={selectedEmployerId === summary.employment.id} onClick={() => setSelectedEmployerId(summary.employment.id)}><strong>{summary.employment.employer}</strong><span className="employer-account-number">PF Account Number · {summary.employment.memberId}</span><span>{formatDate(summary.employment.joinedOn)} to {summary.employment.exitedOn ? formatDate(summary.employment.exitedOn) : 'Present'}</span><span>{formatMoney(summary.closingBalance)} closing balance</span></button>)}</div>{selectedEmployer && <EmployerDetail summary={selectedEmployer} onStartTransfer={onStartTransfer} />}</div>}</section>}
    {view === 'transactions' && <section className="passbook-panel" id="passbook-panel-transactions" role="tabpanel" tabIndex={-1}><div className="financial-section-heading"><div><h2>Transactions</h2><p>Filter your ledger, then download the transactions shown.</p></div></div><TransactionFilters account={account} employer={transactionEmployer} type={transactionType} range={transactionRange} start={transactionStart} end={transactionEnd} ready={transactionPeriodReady} canDownload={transactionPeriodReady} onEmployer={(value) => updateTransactionFilter(() => setTransactionEmployer(value))} onType={(value) => updateTransactionFilter(() => setTransactionType(value))} onRange={(value) => updateTransactionFilter(() => setTransactionRange(value))} onStart={(value) => updateTransactionFilter(() => setTransactionStart(value))} onEnd={(value) => updateTransactionFilter(() => setTransactionEnd(value))} onGenerate={() => { setTransactionPage(1); setTransactionsRequested(true) }} onDownload={() => setFormatDialogOpen(true)} />{transactionsRequested && (transactions.length === 0 ? <Empty title="No Transactions Match">No ledger activity matches these filters. Change a filter to continue.</Empty> : <TransactionTable account={account} transactions={transactions} page={transactionPage} onPageChange={setTransactionPage} />)}</section>}
    {formatDialogOpen && <DownloadFormatDialog onClose={() => setFormatDialogOpen(false)} onChoose={downloadTransactions} />}
  </section>
}

function Empty({ title, children }: { title: string; children: string }) { return <div className="financial-empty"><h3>{title}</h3><p>{children}</p></div> }

function Overview({ account, contributions, highlightedContributionId }: { account: AccountState; contributions: ContributionRecord[]; highlightedContributionId?: string }) {
  const value = accountReconciliation(account)
  const rows = [['Employee Contributions', value.employeeContributions], ['Employer EPF Contributions', value.employerEpfContributions], ['Interest Officially Credited', value.officialInterestCredits], ['Transfers In', value.transfersIn], ['Transfers Out', -value.transfersOut], ['Withdrawals', -value.withdrawals]] as const
  return <section className="passbook-panel" id="passbook-panel-overview" role="tabpanel" tabIndex={-1}><section className="financial-section" aria-labelledby="recent-contributions-title"><div className="financial-section-heading"><div><h2 id="recent-contributions-title">Recent Contributions</h2><p>Employee and employer EPF amounts recorded in the latest six-month period. EPS is shown separately.</p></div></div>{contributions.length === 0 ? <Empty title="No Contributions Recorded">No contribution records are available for the last six months.</Empty> : <ol className="contribution-summary-grid">{contributions.map((record) => { const employer = account.employments.find((item) => item.id === record.employmentId); return <li key={record.id} className={record.id === highlightedContributionId ? 'highlighted' : ''}><time dateTime={record.recordedOn ?? undefined}>{formatWageMonth(record.wageMonth)}</time><div className="contribution-amount"><span>Employee EPF</span><strong>{formatMoney(record.employeeEpf ?? 0)}</strong></div><small>Employer EPF: {record.employerEpf === null ? 'Not recorded' : formatMoney(record.employerEpf)}</small><span>{employer?.employer ?? 'Employer unavailable'}</span><small>Recorded {formatDate(record.recordedOn)}</small></li> })}</ol>}</section><div className="overview-grid"><section className="financial-panel" aria-labelledby="balance-composition-title"><h2 id="balance-composition-title">How Your Balance Adds Up</h2><dl className="balance-composition">{rows.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{formatMoney(amount)}</dd></div>)}<div className="balance-composition-total"><dt>Current EPF Balance</dt><dd>{formatMoney(value.closingBalance)}</dd></div></dl><details className="financial-explanation"><summary>How This Is Calculated</summary><ul><li>Added: employee EPF, employer EPF, credited interest and completed transfers in.</li><li>Subtracted: completed transfers out and withdrawals.</li><li>EPS is not included. Transfers move existing EPF money rather than creating contributions.</li></ul></details></section><aside className="ux4g-alert ux4g-alert-info overview-eps"><div className="ux4g-alert-content"><p className="ux4g-alert-title">EPS Is Separate</p><p className="ux4g-alert-message">{formatMoney(totalEpsContributions(account))} is recorded toward pension service and is not included in your EPF balance.</p></div></aside></div></section>
}

function EmployerDetail({ summary, onStartTransfer }: { summary: ReturnType<typeof employerSummaries>[number]; onStartTransfer: (employmentId: string) => void }) {
  const employment = summary.employment
  const transferInProgress = summary.transferState === 'submitted' || summary.transferState === 'processing'
  return <article className="financial-panel employer-detail"><div className="financial-section-heading"><div><h3>{employment.employer}</h3><p className="employer-account-number">PF Account Number · {employment.memberId}</p><p>{formatDate(employment.joinedOn)} to {employment.exitedOn ? formatDate(employment.exitedOn) : 'Present'} · {providerLabel(employment.establishmentType)}</p></div><span className="ux4g-tag ux4g-tag-filled-neutral ux4g-tag-s">{summary.transferState === 'not-applicable' ? 'No Transfer Needed' : `Transfer ${summary.transferState}`}</span></div>{employment.dataAvailability !== 'complete' && <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Historical Data {employment.dataAvailability === 'partial' ? 'Is Partial' : 'Is Unavailable'}</p><p className="ux4g-alert-message">{employment.dataAvailabilityNote ?? 'Some historical entries are not available in this account.'}</p></div></div>}<dl className="employer-metrics"><div><dt>Employee Contributions</dt><dd>{formatMoney(summary.employeeContributions)}</dd></div><div><dt>Employer EPF Contributions</dt><dd>{formatMoney(summary.employerEpfContributions)}</dd></div><div><dt>EPS Contributions</dt><dd>{formatMoney(summary.epsContributions)}</dd></div><div><dt>Interest Credited</dt><dd>{formatMoney(summary.officialInterestCredits)}</dd></div><div><dt>Transfers In</dt><dd>{formatMoney(summary.transfersIn)}</dd></div><div><dt>Transfers Out</dt><dd>{formatMoney(summary.transfersOut)}</dd></div><div><dt>Withdrawals</dt><dd>{formatMoney(summary.withdrawals)}</dd></div><div><dt>Closing EPF Balance</dt><dd>{formatMoney(summary.closingBalance)}</dd></div></dl>{employment.status === 'balance-remaining' && !transferInProgress && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onStartTransfer(employment.id)}>Transfer Previous PF</button>}{transferInProgress && <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Transfer Is in Progress</p><p className="ux4g-alert-message">This balance remains here until the submitted transfer is processed.</p></div></div>}</article>
}

interface TransactionFiltersProps {
  account: AccountState; employer: string; type: string; range: PassbookRange; start: string; end: string; ready: boolean; canDownload: boolean
  onEmployer: (value: string) => void; onType: (value: string) => void; onRange: (value: PassbookRange) => void
  onStart: (value: string) => void; onEnd: (value: string) => void; onGenerate: () => void; onDownload: () => void
}
function TransactionFilters({ account, employer, type, range, start, end, ready, canDownload, onEmployer, onType, onRange, onStart, onEnd, onGenerate, onDownload }: TransactionFiltersProps) {
  return <div className="transaction-filter-panel"><div className="transaction-filters"><label>Employer<select className="ux4g-table-select" value={employer} onChange={(event) => onEmployer(event.target.value)}><option value="all">All Employers</option>{account.employments.map((item) => <option key={item.id} value={item.id}>{item.employer}</option>)}</select></label><label>Transaction Type<select className="ux4g-table-select" value={type} onChange={(event) => onType(event.target.value)}><option value="all">All Types</option>{Object.entries(transactionTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Period<select className="ux4g-table-select" value={range} onChange={(event) => onRange(event.target.value as PassbookRange)}>{rangeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>{range === 'custom' && <><label>From<input className="ux4g-table-input" type="month" value={start} onChange={(event) => onStart(event.target.value)} /></label><label>To<input className="ux4g-table-input" type="month" value={end} onChange={(event) => onEnd(event.target.value)} /></label></>}</div><div className="transaction-actions"><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" disabled={!ready} onClick={onGenerate}>View Transactions</button><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md transaction-download" type="button" disabled={!canDownload} onClick={onDownload}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>Download</button></div></div>
}

function DownloadFormatDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (format: ReportFormat) => void }) {
  return <dialog className="download-format-dialog" aria-labelledby="download-format-title" onCancel={onClose} ref={(node) => { if (node && !node.open) node.showModal() }}><div><h2 id="download-format-title">Choose a File Format</h2><p>Download all transactions matching the current filters.</p></div><div className="download-format-actions"><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onChoose('pdf')}>Download PDF</button><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => onChoose('excel')}>Download Excel</button><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={onClose}>Cancel</button></div></dialog>
}

function TransactionTable({ account, transactions, page, onPageChange }: { account: AccountState; transactions: LedgerTransaction[]; page: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.ceil(transactions.length / transactionsPerPage)
  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * transactionsPerPage
  const pageTransactions = transactions.slice(startIndex, startIndex + transactionsPerPage)

  return <div className="transaction-results">
    <div className="transaction-table-scroll" tabIndex={0} role="region" aria-label="Transaction results table">
      <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows transaction-table">
        <caption className="visually-hidden">Filtered passbook transactions</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Transaction</th><th scope="col">Employer</th><th scope="col">Type</th><th scope="col" className="transaction-amount-column">Amount</th></tr></thead>
        <tbody>{pageTransactions.map((transaction) => { const employment = account.employments.find((item) => item.id === transaction.employmentId); return <tr key={transaction.id}><td>{formatDate(transaction.date)}</td><td>{transaction.title}</td><td>{employment?.employer ?? 'Employer unavailable'}</td><td><span className="ux4g-tag ux4g-tag-filled-neutral ux4g-tag-s">{transactionTypeLabel[transaction.type]}</span></td><td className="transaction-amount-column">{transaction.amount === null ? 'Unavailable' : formatMoney(transaction.amount)}</td></tr> })}</tbody>
      </table>
    </div>
    <div className="transaction-pagination-summary" role="status">Showing {startIndex + 1}–{Math.min(startIndex + transactionsPerPage, transactions.length)} of {transactions.length} transactions</div>
    {pageCount > 1 && <nav className="ux4g-pagination transaction-pagination" aria-label="Transaction pages">
      <button className="ux4g-pagination-prev" type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous transaction page">Previous</button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} className={currentPage === pageNumber ? 'active' : ''} type="button" aria-current={currentPage === pageNumber ? 'page' : undefined} aria-label={`Transaction page ${pageNumber}`} onClick={() => onPageChange(pageNumber)}>{pageNumber}</button>)}
      <button className="ux4g-pagination-next" type="button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)} aria-label="Next transaction page">Next</button>
    </nav>}
  </div>
}
