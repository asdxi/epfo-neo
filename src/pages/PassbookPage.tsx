import { useMemo, useState } from 'react'
import {
  accountReconciliation, contributionNeedsAttention, employerSummaries,
  formatDate, formatMoney, formatWageMonth, ledgerTransactions,
  totalDepositedForContribution, totalEpfBalance, totalEpsContributions,
} from '../domain/calculations'
import type { AccountState, ContributionRecord, LedgerTransaction, ReportFormat } from '../domain/types'
import './financial-pages.css'

export type PassbookView = 'overview' | 'contributions' | 'employers' | 'transactions'
export type PassbookRange = '6-months' | '1-year' | '2-years' | '5-years' | 'all-time' | 'custom'
export interface StatementRequest { range: PassbookRange; periodLabel: string; startsOn: string; endsOn: string; format: ReportFormat }
export interface PassbookPageProps {
  account: AccountState
  initialView?: PassbookView
  initialContextId?: string
  onGenerateStatement: (request: StatementRequest) => void
  onRaiseContributionGrievance: (contribution: ContributionRecord) => void
  onStartTransfer: (employmentId: string) => void
}

const views: ReadonlyArray<{ id: PassbookView; label: string }> = [
  { id: 'overview', label: 'Overview' }, { id: 'contributions', label: 'Contributions' },
  { id: 'employers', label: 'Employers' }, { id: 'transactions', label: 'Transactions' },
]
const rangeOptions: ReadonlyArray<{ id: PassbookRange; label: string; months?: number }> = [
  { id: '6-months', label: '6 Months', months: 6 }, { id: '1-year', label: '1 Year', months: 12 },
  { id: '2-years', label: '2 Years', months: 24 }, { id: '5-years', label: '5 Years', months: 60 },
  { id: 'all-time', label: 'All Time' }, { id: 'custom', label: 'Custom Range' },
]
const contributionStatus = (status: ContributionRecord['status']) => ({
  'recorded-correctly': ['Recorded Correctly', 'ux4g-tag-filled-success'],
  'recorded-late': ['Recorded Late', 'ux4g-tag-filled-info'],
  'amount-needs-review': ['Amount Needs Review', 'ux4g-tag-filled-warning'],
  'missing-contribution': ['Missing Contribution', 'ux4g-tag-filled-error'],
  'awaiting-record': ['Awaiting Record', 'ux4g-tag-filled-neutral'],
}[status])
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
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10)
}
const providerLabel = (type: AccountState['employments'][number]['establishmentType']) => type === 'exempted-pf-trust' ? 'Employer PF Trust' : 'EPFO'

function StatusTag({ record }: { record: ContributionRecord }) {
  const [label, className] = contributionStatus(record.status)
  return <span className={`ux4g-tag ${className} ux4g-tag-s`}>{label}</span>
}

export function PassbookPage(props: PassbookPageProps) {
  const { account, initialView = 'overview', initialContextId, onGenerateStatement, onRaiseContributionGrievance, onStartTransfer } = props
  const initialEmployer = account.employments.some((item) => item.id === initialContextId) ? initialContextId : undefined
  const initialContribution = account.ledger.contributions.some((item) => item.id === initialContextId) ? initialContextId : undefined
  const contextView = views.find((item) => item.id === initialContextId)?.id
  const inferredView: PassbookView = initialEmployer ? 'employers' : initialContribution ? 'contributions' : contextView ?? initialView
  const [view, setView] = useState(inferredView)
  const [range, setRange] = useState<PassbookRange>('6-months')
  const [customStart, setCustomStart] = useState(''); const [customEnd, setCustomEnd] = useState('')
  const [selectedContributionId, setSelectedContributionId] = useState(initialContribution ?? '')
  const [selectedEmployerId, setSelectedEmployerId] = useState(initialEmployer ?? account.employments.find((item) => item.status === 'current')?.id ?? '')
  const [transactionEmployer, setTransactionEmployer] = useState('all'); const [transactionType, setTransactionType] = useState('all')
  const [transactionStatus, setTransactionStatus] = useState('all'); const [transactionStart, setTransactionStart] = useState(''); const [transactionEnd, setTransactionEnd] = useState('')
  const [statementRange, setStatementRange] = useState<PassbookRange>('6-months'); const [statementFormat, setStatementFormat] = useState<ReportFormat>('pdf')
  const [statementStart, setStatementStart] = useState(''); const [statementEnd, setStatementEnd] = useState('')
  const selectedPeriod = periodForRange(account, range, customStart, customEnd)
  const contributions = useMemo(() => [...account.ledger.contributions].filter((item) => (!selectedPeriod.start || item.wageMonth >= selectedPeriod.start) && (!selectedPeriod.end || item.wageMonth <= selectedPeriod.end)).sort((a, b) => b.wageMonth.localeCompare(a.wageMonth)), [account, selectedPeriod.start, selectedPeriod.end])
  const transactions = useMemo(() => ledgerTransactions(account).filter((item) => (transactionEmployer === 'all' || item.employmentId === transactionEmployer) && (transactionType === 'all' || item.type === transactionType) && (transactionStatus === 'all' || item.state === transactionStatus) && (!transactionStart || (item.date ?? '') >= transactionStart) && (!transactionEnd || (item.date ?? '') <= transactionEnd)), [account, transactionEmployer, transactionType, transactionStatus, transactionStart, transactionEnd])
  const summaries = employerSummaries(account)
  const selectedContribution = account.ledger.contributions.find((item) => item.id === selectedContributionId)
  const selectedEmployer = summaries.find((item) => item.employment.id === selectedEmployerId)
  const changeView = (next: PassbookView) => { setView(next); requestAnimationFrame(() => document.getElementById(`passbook-panel-${next}`)?.focus()) }
  const handleTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length
    changeView(views[nextIndex].id)
    requestAnimationFrame(() => document.querySelectorAll<HTMLButtonElement>('.financial-tabs [role="tab"]')[nextIndex]?.focus())
  }
  const submitStatement = () => {
    const period = periodForRange(account, statementRange, statementStart, statementEnd)
    if (!period.start || !period.end || period.start > period.end) return
    onGenerateStatement({ range: statementRange, periodLabel: rangeOptions.find((item) => item.id === statementRange)?.label ?? 'Selected Period', startsOn: `${period.start}-01`, endsOn: endOfMonth(period.end), format: statementFormat })
  }

  return <section className="financial-page passbook-page" aria-labelledby="passbook-title">
    <header className="financial-heading"><p className="financial-eyebrow">Your Provident Fund</p><h1 id="passbook-title">Passbook</h1><p>See where your EPF money is held, how it accumulated and when each record was received.</p></header>
    <nav className="ux4g-tab ux4g-tab-underline ux4g-tab-md financial-tabs" aria-label="Passbook views"><ul className="ux4g-tab-list" role="tablist">{views.map((item, index) => <li key={item.id} role="presentation"><button className={`ux4g-tab-item${view === item.id ? ' active' : ''}`} type="button" role="tab" tabIndex={view === item.id ? 0 : -1} aria-selected={view === item.id} aria-controls={`passbook-panel-${item.id}`} onKeyDown={(event) => handleTabKey(event, index)} onClick={() => changeView(item.id)}>{item.label}</button></li>)}</ul></nav>
    {view === 'overview' && <Overview account={account} />}
    {view === 'contributions' && <section className="passbook-panel" id="passbook-panel-contributions" role="tabpanel" tabIndex={-1}><div className="financial-section-heading"><div><h2>Monthly Contributions</h2><p>Wage Month is when the contribution applies. Recorded On is when it reached the ledger.</p></div></div><RangeFilters range={range} onRange={setRange} customStart={customStart} customEnd={customEnd} onCustomStart={setCustomStart} onCustomEnd={setCustomEnd} />{contributions.length === 0 ? <Empty title="No Contributions in This Range">Try another period. No contribution record is available for the selected range.</Empty> : <ContributionTable account={account} records={contributions} selectedId={selectedContributionId} onSelect={setSelectedContributionId} />}{selectedContribution && <ContributionDetail account={account} record={selectedContribution} onGrievance={onRaiseContributionGrievance} />}</section>}
    {view === 'employers' && <section className="passbook-panel" id="passbook-panel-employers" role="tabpanel" tabIndex={-1}><div className="financial-section-heading"><div><h2>Employers</h2><p>Each total is reconciled from the transactions attached to that Member ID.</p></div></div>{summaries.length === 0 ? <Empty title="No Employer Records Available">Employer-level ledger records are unavailable in this account.</Empty> : <div className="employer-layout"><div className="employer-selector" role="list" aria-label="Employers">{summaries.map((summary) => <button key={summary.employment.id} type="button" className={selectedEmployerId === summary.employment.id ? 'selected' : ''} aria-pressed={selectedEmployerId === summary.employment.id} onClick={() => setSelectedEmployerId(summary.employment.id)}><strong>{summary.employment.employer}</strong><span>{formatDate(summary.employment.joinedOn)} to {summary.employment.exitedOn ? formatDate(summary.employment.exitedOn) : 'Present'}</span><span>{formatMoney(summary.closingBalance)} closing balance</span></button>)}</div>{selectedEmployer && <EmployerDetail account={account} summary={selectedEmployer} onStartTransfer={onStartTransfer} />}</div>}</section>}
    {view === 'transactions' && <section className="passbook-panel" id="passbook-panel-transactions" role="tabpanel" tabIndex={-1}><div className="financial-section-heading"><div><h2>Transactions</h2><p>Chronological EPF ledger activity, including contributions, interest, transfers and withdrawals.</p></div></div><TransactionFilters account={account} employer={transactionEmployer} type={transactionType} status={transactionStatus} start={transactionStart} end={transactionEnd} onEmployer={setTransactionEmployer} onType={setTransactionType} onStatus={setTransactionStatus} onStart={setTransactionStart} onEnd={setTransactionEnd} />{transactions.length === 0 ? <Empty title="No Transactions Found">No ledger activity matches these filters. Clear or change a filter to continue.</Empty> : <TransactionList account={account} transactions={transactions} />}</section>}
    <section className="statement-panel financial-panel" aria-labelledby="statement-title"><div><p className="financial-eyebrow">Generated Reports</p><h2 id="statement-title">Generate a Passbook Statement</h2><p>Choose a period and file format. Larger reports may continue preparing in Generated Reports.</p></div><div className="statement-controls"><label>Period<select className="ux4g-table-select" value={statementRange} onChange={(event) => setStatementRange(event.target.value as PassbookRange)}>{rangeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>{statementRange === 'custom' && <><label>From<input className="ux4g-table-input" type="month" value={statementStart} onChange={(event) => setStatementStart(event.target.value)} /></label><label>To<input className="ux4g-table-input" type="month" value={statementEnd} onChange={(event) => setStatementEnd(event.target.value)} /></label></>}<label>Format<select className="ux4g-table-select" value={statementFormat} onChange={(event) => setStatementFormat(event.target.value as ReportFormat)}><option value="pdf">PDF</option><option value="excel">Excel</option></select></label><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={submitStatement}>Generate Statement</button></div></section>
  </section>
}

function Empty({ title, children }: { title: string; children: string }) { return <div className="financial-empty"><h3>{title}</h3><p>{children}</p></div> }

function Overview({ account }: { account: AccountState }) {
  const value = accountReconciliation(account); const estimated = account.ledger.estimatedInterestAccruals.reduce((sum, item) => sum + item.amount, 0)
  const rows = [['Employee Contributions', value.employeeContributions], ['Employer EPF Contributions', value.employerEpfContributions], ['Interest Officially Credited', value.officialInterestCredits], ['Transfers In', value.transfersIn], ['Transfers Out', -value.transfersOut], ['Withdrawals', -value.withdrawals]] as const
  return <section className="passbook-panel" id="passbook-panel-overview" role="tabpanel" tabIndex={-1}><article className="ux4g-card ux4g-card-solid ux4g-card-vertical passbook-balance-card"><div className="ux4g-card-body"><p className="financial-eyebrow">Current EPF Balance</p><p className="financial-balance">{formatMoney(totalEpfBalance(account))}</p><p>Reconciled from the recorded EPF ledger below.</p></div></article><div className="overview-grid"><section className="financial-panel" aria-labelledby="balance-composition-title"><h2 id="balance-composition-title">Balance Composition</h2><dl className="balance-composition">{rows.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{formatMoney(amount)}</dd></div>)}<div className="balance-composition-total"><dt>Current EPF Balance</dt><dd>{formatMoney(value.closingBalance)}</dd></div></dl><details className="financial-explanation"><summary>Explain This Balance</summary><p>Employee contributions plus employer EPF contributions, official interest and completed transfers in, minus completed transfers out and withdrawals, form the current EPF balance. Transfers move existing EPF money and do not create new contributions.</p></details></section><aside className="ux4g-alert ux4g-alert-info overview-eps"><div className="ux4g-alert-content"><p className="ux4g-alert-title">EPS Is Shown Separately</p><p className="ux4g-alert-message">{formatMoney(totalEpsContributions(account))} in EPS contributions is recorded as pension service. It is not part of the withdrawable EPF balance.</p></div></aside></div><article className="financial-panel estimate-panel"><div><p className="financial-eyebrow">Calculated Estimate</p><h2>Estimated Interest Accrued</h2><p>This amount is not part of the official EPF balance until an official credit is recorded.</p></div><strong>{estimated ? formatMoney(estimated) : 'No estimate available'}</strong></article></section>
}

function RangeFilters({ range, onRange, customStart, customEnd, onCustomStart, onCustomEnd }: { range: PassbookRange; onRange: (value: PassbookRange) => void; customStart: string; customEnd: string; onCustomStart: (value: string) => void; onCustomEnd: (value: string) => void }) {
  return <div className="filter-stack"><div className="range-buttons" aria-label="Contribution period">{rangeOptions.map((option) => <button type="button" className={`ux4g-btn ux4g-btn-sm ${range === option.id ? 'ux4g-btn-tonal-primary' : 'ux4g-btn-text-neutral'}`} key={option.id} aria-pressed={range === option.id} onClick={() => onRange(option.id)}>{option.label}</button>)}</div>{range === 'custom' && <div className="custom-range"><label>From<input className="ux4g-table-input" type="month" value={customStart} onChange={(event) => onCustomStart(event.target.value)} /></label><label>To<input className="ux4g-table-input" type="month" value={customEnd} onChange={(event) => onCustomEnd(event.target.value)} /></label></div>}</div>
}

function ContributionTable({ account, records, selectedId, onSelect }: { account: AccountState; records: ContributionRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="responsive-table"><table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows contribution-table"><caption className="visually-hidden">Monthly contribution records</caption><thead><tr><th>Wage Month</th><th>Recorded On</th><th>Employer</th><th>PF Wage</th><th>Employee EPF</th><th>Employer EPF</th><th>EPS</th><th>Total Deposited</th><th>Status</th><th>Explanation</th><th><span className="visually-hidden">Action</span></th></tr></thead><tbody>{records.map((record) => {
    const employer = account.employments.find((item) => item.id === record.employmentId)
    const cells: [string, string][] = [
      ['Wage Month', formatWageMonth(record.wageMonth)],
      ['Recorded On', formatDate(record.recordedOn)],
      ['Employer', employer?.employer ?? 'Unavailable'],
      ['PF Wage', record.pfWage === null ? 'Unavailable' : formatMoney(record.pfWage)],
      ['Employee EPF', record.employeeEpf === null ? 'Missing' : formatMoney(record.employeeEpf)],
      ['Employer EPF', record.employerEpf === null ? 'Missing' : formatMoney(record.employerEpf)],
      ['EPS', record.eps === null ? 'Missing' : formatMoney(record.eps)],
      ['Total Deposited', formatMoney(totalDepositedForContribution(record))],
    ]
    return <tr key={record.id} className={selectedId === record.id ? 'selected-row' : ''}>{cells.map(([label, value]) => <td key={label} data-label={label}>{value}</td>)}<td data-label="Status"><StatusTag record={record} /></td><td data-label="Explanation">{record.explanation}</td><td><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm" type="button" onClick={() => onSelect(record.id)} aria-expanded={selectedId === record.id}>View Details</button></td></tr>
  })}</tbody></table></div>
}

function ContributionDetail({ account, record, onGrievance }: { account: AccountState; record: ContributionRecord; onGrievance: (record: ContributionRecord) => void }) {
  const employer = account.employments.find((item) => item.id === record.employmentId)
  return <article className="ux4g-card ux4g-card-outline ux4g-card-vertical contribution-detail" aria-live="polite"><div className="ux4g-card-body"><div className="financial-section-heading"><div><p className="financial-eyebrow">Contribution Detail</p><h3>{formatWageMonth(record.wageMonth)}</h3><p>{employer?.employer ?? 'Employer unavailable'}</p></div><StatusTag record={record} /></div><div className="date-distinction"><div><span>Wage Month</span><strong>{formatWageMonth(record.wageMonth)}</strong><small>When the contribution applies</small></div><div><span>Recorded On</span><strong>{formatDate(record.recordedOn)}</strong><small>When the ledger received the entry</small></div></div><p>{record.explanation}</p>{contributionNeedsAttention(record) && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onGrievance(record)}>Raise a Grievance</button>}</div></article>
}

function EmployerDetail({ account, summary, onStartTransfer }: { account: AccountState; summary: ReturnType<typeof employerSummaries>[number]; onStartTransfer: (employmentId: string) => void }) {
  const employment = summary.employment
  const entries = ledgerTransactions(account).filter((item) => item.employmentId === employment.id)
  const transferInProgress = summary.transferState === 'submitted' || summary.transferState === 'processing'
  return <article className="financial-panel employer-detail"><div className="financial-section-heading"><div><p className="financial-eyebrow">Employer Ledger</p><h3>{employment.employer}</h3><p>{formatDate(employment.joinedOn)} to {employment.exitedOn ? formatDate(employment.exitedOn) : 'Present'} · {providerLabel(employment.establishmentType)}</p></div><span className="ux4g-tag ux4g-tag-filled-neutral ux4g-tag-s">{summary.transferState === 'not-applicable' ? 'No Transfer Needed' : `Transfer ${summary.transferState}`}</span></div>{employment.dataAvailability !== 'complete' && <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Historical Data {employment.dataAvailability === 'partial' ? 'Is Partial' : 'Is Unavailable'}</p><p className="ux4g-alert-message">{employment.dataAvailabilityNote ?? 'Some historical entries are not available in this account.'}</p></div></div>}<dl className="employer-metrics"><div><dt>Employee Contributions</dt><dd>{formatMoney(summary.employeeContributions)}</dd></div><div><dt>Employer EPF Contributions</dt><dd>{formatMoney(summary.employerEpfContributions)}</dd></div><div><dt>EPS Contributions</dt><dd>{formatMoney(summary.epsContributions)}</dd></div><div><dt>Interest Credited</dt><dd>{formatMoney(summary.officialInterestCredits)}</dd></div><div><dt>Transfers In</dt><dd>{formatMoney(summary.transfersIn)}</dd></div><div><dt>Transfers Out</dt><dd>{formatMoney(summary.transfersOut)}</dd></div><div><dt>Withdrawals</dt><dd>{formatMoney(summary.withdrawals)}</dd></div><div><dt>Closing EPF Balance</dt><dd>{formatMoney(summary.closingBalance)}</dd></div></dl>{employment.status === 'balance-remaining' && !transferInProgress && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onStartTransfer(employment.id)}>Transfer Previous PF</button>}{transferInProgress && <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Transfer Is in Progress</p><p className="ux4g-alert-message">This balance remains here until the submitted transfer is processed.</p></div></div>}<h4>Complete Ledger History</h4>{entries.length === 0 ? <Empty title="No Ledger Entries Available">Transactions for this employment are unavailable.</Empty> : <TransactionList account={account} transactions={entries} />}</article>
}

interface TransactionFiltersProps {
  account: AccountState; employer: string; type: string; status: string; start: string; end: string
  onEmployer: (value: string) => void; onType: (value: string) => void; onStatus: (value: string) => void
  onStart: (value: string) => void; onEnd: (value: string) => void
}
function TransactionFilters({ account, employer, type, status, start, end, onEmployer, onType, onStatus, onStart, onEnd }: TransactionFiltersProps) {
  const statuses = [...new Set(ledgerTransactions(account).map((item) => item.state))].sort()
  return <div className="transaction-filters"><label>Employer<select className="ux4g-table-select" value={employer} onChange={(event) => onEmployer(event.target.value)}><option value="all">All Employers</option>{account.employments.map((item) => <option key={item.id} value={item.id}>{item.employer}</option>)}</select></label><label>Transaction Type<select className="ux4g-table-select" value={type} onChange={(event) => onType(event.target.value)}><option value="all">All Types</option>{Object.entries(transactionTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Status<select className="ux4g-table-select" value={status} onChange={(event) => onStatus(event.target.value)}><option value="all">All Statuses</option>{statuses.map((item) => <option value={item} key={item}>{item.replaceAll('-', ' ')}</option>)}</select></label><label>From<input className="ux4g-table-input" type="date" value={start} onChange={(event) => onStart(event.target.value)} /></label><label>To<input className="ux4g-table-input" type="date" value={end} onChange={(event) => onEnd(event.target.value)} /></label></div>
}

function TransactionList({ account, transactions }: { account: AccountState; transactions: LedgerTransaction[] }) {
  return <ol className="transaction-list">{transactions.map((transaction) => { const employment = account.employments.find((item) => item.id === transaction.employmentId); return <li key={transaction.id}><div className="transaction-summary"><div><span className="ux4g-tag ux4g-tag-filled-neutral ux4g-tag-s">{transactionTypeLabel[transaction.type]}</span><h4>{transaction.title}</h4><p>{employment?.employer ?? 'Employer unavailable'} · {formatDate(transaction.date)}</p></div><strong>{transaction.amount === null ? 'Unavailable' : formatMoney(transaction.amount)}</strong></div><details className="financial-explanation"><summary>Understand This Transaction</summary><dl><div><dt>What Is This?</dt><dd>{transaction.explanation}</dd></div><div><dt>Why Was It Recorded on This Date?</dt><dd>{transaction.recordedDateExplanation}</dd></div><div><dt>Does It Need My Attention?</dt><dd>{transaction.needsAttention ? 'Yes. Review the related record and use the available next action.' : 'No action is required from you for this transaction.'}</dd></div></dl></details></li> })}</ol>
}
