import { useState } from 'react'
import './feature-pages.css'

export type AttentionTone = 'success' | 'warning' | 'info' | 'error'

export interface JourneyEmployment {
  id: string
  employer: string
  dates: string
  provider: string
  memberId: string
  employeeEpf: number
  employerEpf: number | null
  eps: number | null
  interest: number | null
  transfersIn?: number
  transferNote?: string
  status: string
  statusTone: AttentionTone
  confidence: 'Complete' | 'Partial' | 'Unavailable'
  confidenceNote?: string
  current?: boolean
}

export interface MoneySummary {
  closingBalance: number
  employeeContributions: number
  employerContributions: number
  interest: number
  transfersIn: number
  transfersOut: number
  withdrawals: number
  pensionService: string
}

export interface MonthlyContribution {
  id: string
  month: string
  pfWage: number | null
  employeeEpf: number | null
  employerEpf: number | null
  eps: number | null
  received: 'Received' | 'Pending' | 'Missing'
  message: string
  needsAttention?: boolean
}

export interface ActionItem {
  id: string
  title: string
  description: string
  status?: string
  tone?: AttentionTone
}

export interface TrackerStep {
  label: string
  detail?: string
  state: 'completed' | 'current' | 'upcoming'
}

export interface Tracker {
  title: string
  steps: TrackerStep[]
  message: string
  actionLabel?: string
  actionId?: string
}

const money = (amount: number | null | undefined) =>
  amount === null || amount === undefined
    ? 'Not available'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

const toneClass = (tone: AttentionTone = 'info') => `ux4g-badge-icon-${tone} ux4g-badge-m`

function DataState({ label, tone = 'info' }: { label: string; tone?: AttentionTone }) {
  return <span className={toneClass(tone)}>{label}</span>
}

export function JourneyPage({ employments }: { employments: JourneyEmployment[] }) {
  return (
    <section className="feature-page" aria-labelledby="journey-title">
      <header className="feature-heading">
        <p className="feature-eyebrow">Employment record</p>
        <h1 id="journey-title">My journey</h1>
        <p>See your EPF-covered employment and how your PF money moved. A gap only means no EPF-covered employment is recorded.</p>
      </header>

      <ol className="ux4g-journey-timeline ux4g-journey-timeline--vertical feature-journey-list" aria-label="Employment timeline">
        {employments.map((employment) => (
          <li className="ux4g-journey-step" key={employment.id}>
            <article className="ux4g-journey-card ux4g-journey-card--standard feature-journey-card">
              <div className="feature-row feature-row--between">
                <div>
                  <p className="ux4g-journey-date">{employment.dates}</p>
                  <h2 className="ux4g-journey-title">{employment.employer}</h2>
                </div>
                <DataState label={employment.current ? 'Current' : employment.status} tone={employment.statusTone} />
              </div>
              <p className="ux4g-journey-description">PF provider: {employment.provider}</p>
              <dl className="feature-metric-grid">
                <div><dt>Employee EPF</dt><dd>{money(employment.employeeEpf)}</dd></div>
                <div><dt>Employer EPF</dt><dd>{money(employment.employerEpf)}</dd></div>
                <div><dt>EPS</dt><dd>{money(employment.eps)}</dd></div>
                <div><dt>Interest</dt><dd>{money(employment.interest)}</dd></div>
              </dl>
              {employment.transfersIn !== undefined && (
                <p className="feature-transfer"><strong>{money(employment.transfersIn)} transferred in</strong>{employment.transferNote ? ` · ${employment.transferNote}` : ''}</p>
              )}
              <details className="ux4g-accordion ux4g-accordion-bordered feature-details">
                <summary>Record details</summary>
                <div className="feature-details-content">
                  <p><strong>Member ID:</strong> {employment.memberId}</p>
                  <p><strong>Historical statement:</strong> {employment.confidence}</p>
                  {employment.confidenceNote && <p>{employment.confidenceNote}</p>}
                </div>
              </details>
            </article>
          </li>
        ))}
      </ol>
      <aside className="ux4g-alert ux4g-alert-info feature-alert" aria-label="What this timeline shows">
        <div className="ux4g-alert-content"><p className="ux4g-alert-title">EPF and EPS are different</p><p className="ux4g-alert-message">EPF is money in your provident fund. EPS is a pension service record and is not added to your EPF balance.</p></div>
      </aside>
    </section>
  )
}

export function MoneyPage({ summary, contributions }: { summary: MoneySummary; contributions: MonthlyContribution[] }) {
  const [selectedId, setSelectedId] = useState(contributions[0]?.id ?? '')
  const selected = contributions.find((contribution) => contribution.id === selectedId) ?? contributions[0]
  const rows = [
    ['Employee contributions', summary.employeeContributions],
    ['Employer EPF contributions', summary.employerContributions],
    ['Interest credited', summary.interest],
    ['Transfers in', summary.transfersIn],
    ['Transfers out', -summary.transfersOut],
    ['Withdrawals', -summary.withdrawals],
  ]

  return (
    <section className="feature-page" aria-labelledby="money-title">
      <header className="feature-heading">
        <p className="feature-eyebrow">Your provident fund</p>
        <h1 id="money-title">My money</h1>
        <p>Every amount below is calculated from the recorded EPF transactions.</p>
      </header>
      <article className="ux4g-card ux4g-card-solid feature-balance-card">
        <div className="ux4g-card-body">
          <p className="feature-eyebrow">Current EPF balance</p>
          <p className="feature-balance">{money(summary.closingBalance)}</p>
          <p>Money accumulated in your provident fund account.</p>
        </div>
      </article>
      <section className="feature-section" aria-labelledby="breakdown-title">
        <h2 id="breakdown-title">How this balance was created</h2>
        <dl className="ux4g-card ux4g-card-outline feature-ledger">
          {rows.map(([label, amount]) => <div className="feature-ledger-row" key={label as string}><dt>{label}</dt><dd className={(amount as number) < 0 ? 'feature-negative' : ''}>{money(amount as number)}</dd></div>)}
          <div className="feature-ledger-row feature-ledger-total"><dt>Current EPF balance</dt><dd>{money(summary.closingBalance)}</dd></div>
        </dl>
      </section>
      <article className="ux4g-alert ux4g-alert-info feature-alert">
        <div className="ux4g-alert-content"><p className="ux4g-alert-title">Your pension service</p><p className="ux4g-alert-message">{summary.pensionService}. EPS is pension-related service and is shown separately from EPF money.</p></div>
      </article>
      <section className="feature-section" aria-labelledby="contribution-title">
        <div className="feature-row feature-row--between"><div><h2 id="contribution-title">Monthly contributions</h2><p>Choose a month to inspect what was recorded.</p></div></div>
        <div className="feature-month-list" role="list" aria-label="Contribution months">
          {contributions.map((contribution) => (
            <button className={`ux4g-btn ux4g-btn-md ${selected?.id === contribution.id ? 'ux4g-btn-primary' : 'ux4g-btn-outline-primary'}`} type="button" key={contribution.id} onClick={() => setSelectedId(contribution.id)} aria-pressed={selected?.id === contribution.id}>
              {contribution.month}{contribution.needsAttention ? ' · needs attention' : ''}
            </button>
          ))}
        </div>
        {selected && <ContributionDetail contribution={selected} />}
      </section>
    </section>
  )
}

function ContributionDetail({ contribution }: { contribution: MonthlyContribution }) {
  const stateTone: AttentionTone = contribution.needsAttention ? 'warning' : contribution.received === 'Received' ? 'success' : 'info'
  return <article className="ux4g-card ux4g-card-outline feature-contribution-detail" aria-live="polite">
    <div className="ux4g-card-body"><div className="feature-row feature-row--between"><h3>{contribution.month}</h3><DataState label={contribution.needsAttention ? 'Needs attention' : contribution.received} tone={stateTone} /></div>
      <dl className="feature-metric-grid">
        <div><dt>PF wage reported</dt><dd>{money(contribution.pfWage)}</dd></div>
        <div><dt>Employee EPF</dt><dd>{money(contribution.employeeEpf)}</dd></div>
        <div><dt>Employer EPF</dt><dd>{money(contribution.employerEpf)}</dd></div>
        <div><dt>EPS</dt><dd>{money(contribution.eps)}</dd></div>
      </dl>
      <p className={contribution.needsAttention ? 'feature-warning-text' : ''}>{contribution.message}</p>
    </div>
  </article>
}

export function ActionsPage({ actions, kycStatus, tracker, onAction }: { actions: ActionItem[]; kycStatus: string; tracker: Tracker; onAction?: (id: string) => void }) {
  return <section className="feature-page" aria-labelledby="actions-title">
    <header className="feature-heading"><p className="feature-eyebrow">Get things done</p><h1 id="actions-title">Actions</h1><p>Choose what you want to do. We will explain the next step in plain language.</p></header>
    <article className="ux4g-alert ux4g-alert-warning feature-alert" aria-label="KYC needs attention"><div className="ux4g-alert-content"><p className="ux4g-alert-title">KYC status: {kycStatus}</p><p className="ux4g-alert-message">Verify your identity details to help claims and transfers move without interruption.</p></div><div className="ux4g-alert-actions"><button type="button" className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-md" onClick={() => onAction?.('kyc')}>Review KYC</button></div></article>
    <div className="feature-action-grid">
      {actions.map((action) => <article className="ux4g-card ux4g-card-outline feature-action-card" key={action.id}><div className="ux4g-card-body"><h2 className="ux4g-card-title">{action.title}</h2><p>{action.description}</p>{action.status && <DataState label={action.status} tone={action.tone} />}</div><div className="ux4g-card-footer"><button type="button" className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" onClick={() => onAction?.(action.id)}>Start or check status</button></div></article>)}
    </div>
    <TrackerCard tracker={tracker} onAction={onAction} />
  </section>
}

function TrackerCard({ tracker, onAction }: { tracker: Tracker; onAction?: (id: string) => void }) {
  return <section className="feature-section" aria-labelledby="tracker-title"><article className="ux4g-card ux4g-card-outline feature-tracker"><div className="ux4g-card-body"><p className="feature-eyebrow">In progress</p><h2 id="tracker-title">{tracker.title}</h2><ol className="ux4g-status-pipeline" aria-label={`${tracker.title} status`}>
    {tracker.steps.map((step) => <li className={`ux4g-status-pipeline-step ux4g-status-pipeline-${step.state}`} key={step.label}><div className="ux4g-status-pipeline-content"><strong>{step.label}</strong>{step.detail && <span>{step.detail}</span>}</div></li>)}
  </ol><p className="feature-tracker-message">{tracker.message}</p>{tracker.actionLabel && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => tracker.actionId && onAction?.(tracker.actionId)}>{tracker.actionLabel}</button>}</div></article></section>
}
