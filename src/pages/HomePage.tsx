import {
  currentEmployment,
  employerSummaries,
  formatDate,
  formatMoney,
  formatWageMonth,
  latestRecordedContribution,
  totalDepositedForContribution,
  totalEpfBalance,
  totalEpsContributions,
  totalEpsServiceMonths,
} from '../domain/calculations'
import { activeRecordIssues } from '../domain/issues'
import { demoNotices } from '../domain/notices'
import type { AccountState, Employment } from '../domain/types'
import './financial-pages.css'

export type FinancialRoute = 'passbook' | 'services' | 'requests' | 'account'
export type CoreServiceId = 'transfer' | 'claims' | 'kyc' | 'correction' | 'grievance'

export interface HomePageProps {
  account: AccountState
  onNavigate: (route: FinancialRoute, contextId?: string) => void
  onOpenService: (service: CoreServiceId, contextId?: string) => void
  onReviewIssues: () => void
}

const providerLabel = (employment: Employment): string =>
  employment.establishmentType === 'exempted-pf-trust' ? 'Employer PF Trust' : 'EPFO'

const statusLabel = (status: Employment['status']): string => ({
  current: 'Current', closed: 'Closed', transferred: 'Transferred', 'balance-remaining': 'Balance Remaining',
})[status]

export function HomePage({ account, onNavigate, onReviewIssues }: HomePageProps) {
  const balance = totalEpfBalance(account)
  const employment = currentEmployment(account)
  const latestContribution = latestRecordedContribution(account)
  const recordIssues = activeRecordIssues(account)
  const employmentHistory = employerSummaries(account)
  const employmentTimeline = [...employmentHistory].reverse()
  const serviceMonths = totalEpsServiceMonths(account)
  const epsYears = Math.floor(serviceMonths / 12)
  const remainingMonths = serviceMonths % 12

  return (
    <section className="financial-page home-page" aria-labelledby="home-title">
      <header className="financial-heading">
        <h1 id="home-title">Welcome, {account.member.name.split(' ')[0]}</h1>
      </header>

      <div className="home-workspace">
        <article className="ux4g-card ux4g-card-solid ux4g-card-vertical home-balance" aria-labelledby="home-balance-title">
          <div className="ux4g-card-body">
            <div className="home-balance-primary">
              <h2 className="home-balance-title" id="home-balance-title">Current EPF Balance</h2>
              <p className="financial-balance">{formatMoney(balance)}</p>
            </div>
            <p>Includes all recorded PF accounts. EPS is separate.</p>
            <div className="home-balance-actions">
              <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onNavigate('passbook', 'overview')}>View Passbook</button>
              <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => onNavigate('passbook', 'explain-balance')}>How This Is Calculated</button>
            </div>
          </div>
          <div className="home-pension-summary">
            <div><span>EPS Service</span><strong>{epsYears} {epsYears === 1 ? 'year' : 'years'} {remainingMonths} {remainingMonths === 1 ? 'month' : 'months'}</strong></div>
            <div><span>EPS Contributions</span><strong>{formatMoney(totalEpsContributions(account))}</strong></div>
            <p>EPS is separate from your EPF balance.</p>
          </div>
        </article>

        <aside className="home-attention" aria-labelledby="attention-title">
          <div className="home-attention-inner">
            <div className="financial-section-heading"><h2 id="attention-title">Needs Attention</h2></div>
            {recordIssues.length === 0 ? (
              <div className="ux4g-alert ux4g-alert-success" role="status"><div className="ux4g-alert-content"><p className="ux4g-alert-title">You’re All Caught Up</p><p className="ux4g-alert-message">No action is required from you.</p></div></div>
            ) : <div className="attention-list"><div className="attention-item"><h3>{recordIssues.length} PF record {recordIssues.length === 1 ? 'issue' : 'issues'}</h3><p>See what is recorded, what each issue affects, and who must act next.</p><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-lg" type="button" onClick={onReviewIssues}>Review {recordIssues.length} {recordIssues.length === 1 ? 'issue' : 'issues'}</button></div></div>}
            <NoticeBoard />
          </div>
        </aside>

        <div className="home-main-sections">
          <div className="home-current-grid">
            <article className="financial-panel current-employment-panel" aria-labelledby="current-employment-title">
              <div className="financial-panel-heading"><p className="financial-eyebrow">Current Employment</p><h2 id="current-employment-title">{employment.employer}</h2></div>
              <dl className="compact-description-list"><div><dt>Joined</dt><dd>{formatDate(employment.joinedOn)}</dd></div><div><dt>PF Provider</dt><dd>{providerLabel(employment)}</dd></div></dl>
              <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md home-panel-action" type="button" onClick={() => onNavigate('passbook', employment.id)}>View Employment</button>
            </article>
            <article className="financial-panel" aria-labelledby="latest-contribution-title">
              <p className="financial-eyebrow">Latest Contribution</p>
              {latestContribution ? <><h2 id="latest-contribution-title">{formatMoney(totalDepositedForContribution(latestContribution))}</h2><p className="latest-contribution-total">Total currently recorded for this wage month</p><StatusTag status={latestContribution.status} /><dl className="compact-description-list"><div><dt>Wage Month</dt><dd>{formatWageMonth(latestContribution.wageMonth)}</dd></div><div><dt>Recorded On</dt><dd>{formatDate(latestContribution.recordedOn)}</dd></div><div><dt>Employee EPF</dt><dd>{formatMoney(latestContribution.employeeEpf ?? 0)}</dd></div><div><dt>Employer EPF</dt><dd>{latestContribution.employerEpf === null ? 'Not recorded' : formatMoney(latestContribution.employerEpf)}</dd></div><div><dt>EPS Recorded</dt><dd>{formatMoney(latestContribution.eps ?? 0)}</dd></div></dl><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md home-panel-action" type="button" onClick={() => onNavigate('passbook', latestContribution.id)}>View Contribution</button></> : <div className="financial-empty" id="latest-contribution-title"><h2>No Contribution Recorded</h2></div>}
            </article>
          </div>

          <section className="financial-section" aria-labelledby="employment-history-title">
            <div className="financial-section-heading"><h2 id="employment-history-title">Employment History</h2><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => onNavigate('passbook', 'employers')}>View Employers</button></div>
            {employmentTimeline.length === 0 ? <div className="financial-empty"><h3>No Employment Records</h3><p>No EPF-covered employment is recorded.</p></div> : <ol className="employment-timeline">{employmentTimeline.map((summary, index) => { const item = summary.employment; const nextOlderEmployment = employmentTimeline[index + 1]?.employment; const gaps = nextOlderEmployment ? account.employmentGaps.filter((gap) => gap.startsOn > (nextOlderEmployment.exitedOn ?? nextOlderEmployment.joinedOn) && gap.endsOn < item.joinedOn) : []; return <li key={item.id}><button className="timeline-employment" type="button" onClick={() => onNavigate('passbook', item.id)}><span className="timeline-year">{item.joinedOn.slice(0, 4)}</span><span className="timeline-identity"><strong>{item.employer}</strong><span>{providerLabel(item)} · {statusLabel(item.status)}</span></span><span className="timeline-period">{formatDate(item.joinedOn)} to {item.exitedOn ? formatDate(item.exitedOn) : 'Present'}</span><span className="timeline-contribution"><span>EPF Contributions</span><strong>{formatMoney(summary.employeeContributions + summary.employerEpfContributions)}</strong></span></button>{gaps.map((gap) => <div className="timeline-gap" key={`${gap.startsOn}-${gap.endsOn}`}><strong>{gap.label}</strong><span>{formatDate(gap.startsOn)} to {formatDate(gap.endsOn)}</span></div>)}</li> })}</ol>}
          </section>

        </div>
      </div>
    </section>
  )
}

function StatusTag({ status }: { status: AccountState['ledger']['contributions'][number]['status'] }) {
  const value = {
    'recorded-correctly': ['Recorded', 'ux4g-tag-filled-success'],
    'recorded-late': ['Recorded Late', 'ux4g-tag-filled-info'],
    'amount-needs-review': ['Amount Needs Review', 'ux4g-tag-filled-warning'],
    'missing-contribution': ['Missing Contribution', 'ux4g-tag-filled-error'],
    'awaiting-record': ['Awaiting Record', 'ux4g-tag-filled-neutral'],
  }[status]
  return <span className={`ux4g-tag ${value[1]} ux4g-tag-s`}>{value[0]}</span>
}

function NoticeBoard() {
  return <section className="notice-board" aria-labelledby="notice-board-title">
    <div className="financial-section-heading"><h2 id="notice-board-title">Notices</h2></div>
    <div className="notice-board-list" aria-label="Notices, newest first" role="region" tabIndex={0}>
      {demoNotices.map((notice) => <article className="notice-card" key={notice.id}>
        <div className="notice-card__meta"><time dateTime={notice.publishedOn}>{formatDate(notice.publishedOn)}</time>{notice.isNew && <span className="ux4g-tag ux4g-tag-filled-info ux4g-tag-s">New</span>}</div>
        <h3>{notice.title}</h3>
        <p>{notice.body}</p>
        {notice.attachment === 'pdf' && <a className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm" href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" target="_blank" rel="noopener noreferrer">{notice.attachmentLabel}</a>}
      </article>)}
    </div>
  </section>
}
