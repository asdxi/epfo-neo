import { useEffect, useRef } from 'react'
import { formatDate, formatMoney } from '../domain/calculations'
import { deriveRecordIssues } from '../domain/issues'
import type { AccountState, ContributionRecord, RecordIssue, RecordIssueAction } from '../domain/types'
import './financial-pages.css'

export interface RecordReviewPageProps {
  account: AccountState
  onBack: () => void
  onTrackRequest: (requestId: string) => void
  onStartTransfer: (employmentId: string) => void
  onRaiseContributionGrievance: (contribution: ContributionRecord) => void
}

const statusPresentation: Record<RecordIssue['status'], { label: string; className: string }> = {
  'action-required': { label: 'Action required', className: 'ux4g-tag-filled-warning' },
  'in-progress': { label: 'In progress', className: 'ux4g-tag-filled-info' },
  resolved: { label: 'Resolved', className: 'ux4g-tag-filled-success' },
  unavailable: { label: 'Record unavailable', className: 'ux4g-tag-filled-neutral' },
}

export function RecordReviewPage({ account, onBack, onTrackRequest, onStartTransfer, onRaiseContributionGrievance }: RecordReviewPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const issues = deriveRecordIssues(account)

  useEffect(() => { headingRef.current?.focus() }, [])

  const performAction = (action: RecordIssueAction) => {
    if (action.availability !== 'available') return
    if (action.kind === 'track-request') onTrackRequest(action.contextId)
    if (action.kind === 'start-transfer') onStartTransfer(action.contextId)
    if (action.kind === 'raise-grievance') {
      const contribution = account.ledger.contributions.find((item) => item.id === action.contextId)
      if (contribution) onRaiseContributionGrievance(contribution)
    }
  }

  return <section className="financial-page record-review-page" aria-labelledby="record-review-title">
    <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-lg record-review-back" type="button" onClick={onBack}>← Back to Home</button>
    <header className="financial-heading">
      <h1 id="record-review-title" ref={headingRef} tabIndex={-1}>PF Record Review</h1>
      <p>Review what Neo found, the records behind it, and the next step for each issue.</p>
    </header>

    {issues.length === 0
      ? <div className="ux4g-empty-state record-review-empty" role="status"><div className="ux4g-empty-state-content"><h2>No PF Record Issues</h2><p>No transfer or contribution issues are currently recorded.</p></div></div>
      : <ol className="record-issue-list">{issues.map((issue, index) => <li key={issue.id}><IssueDetail issue={issue} principal={index === 0} onAction={performAction} /></li>)}</ol>}
  </section>
}

function IssueDetail({ issue, principal, onAction }: { issue: RecordIssue; principal: boolean; onAction: (action: RecordIssueAction) => void }) {
  const status = statusPresentation[issue.status]
  return <article className={`record-issue ${principal ? 'record-issue--principal' : ''}`} aria-labelledby={`${issue.id}-title`}>
    <header className="record-issue-heading">
      <div className="record-issue-labels">{principal && <span className="record-issue-principal">Primary issue</span>}<span className={`ux4g-tag ${status.className} ux4g-tag-s`}>{status.label}</span></div>
      <h2 id={`${issue.id}-title`}>{issue.finding}</h2>
    </header>

    <dl className="record-issue-facts">
      <div><dt>What it affects</dt><dd>{issue.affectedService}{issue.affectedAmount !== undefined && <strong>{formatMoney(issue.affectedAmount)}</strong>}</dd></div>
      <div><dt>Current stage</dt><dd>{issue.currentStage}</dd></div>
      <div><dt>Who must act</dt><dd>{issue.responsiblePartyLabel}</dd></div>
      <div><dt>Last confirmed</dt><dd>{issue.lastConfirmedEvent.label}<time dateTime={issue.lastConfirmedEvent.date ?? undefined}>{formatDate(issue.lastConfirmedEvent.date)}</time></dd></div>
    </dl>

    <div className="ux4g-alert ux4g-alert-info record-impact" role="note"><div className="ux4g-alert-content"><p className="ux4g-alert-title">How this affects your record</p><p className="ux4g-alert-message">{issue.financialImpact}</p><p className="ux4g-alert-message">{issue.pensionServiceImpact}</p></div></div>

    <details className="record-evidence" open={principal}>
      <summary>Records, dates and calculation</summary>
      <div className="record-evidence-content">
        <section aria-labelledby={`${issue.id}-records`}><h3 id={`${issue.id}-records`}>Supporting records</h3>{issue.supportingRecords.length > 0 ? <dl className="record-reference-list">{issue.supportingRecords.map((record, index) => <div key={`${record.kind}-${record.id}-${index}`}><dt>{record.label}</dt><dd>{record.value}</dd></div>)}</dl> : <p>Supporting records are unavailable.</p>}</section>
        {issue.calculationTrail.length > 0 && <section aria-labelledby={`${issue.id}-calculation`}><h3 id={`${issue.id}-calculation`}>Calculation trail</h3><dl className="record-calculation">{issue.calculationTrail.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{formatMoney(line.amount)}</dd></div>)}</dl></section>}
        {issue.chronology.length > 0 && <section aria-labelledby={`${issue.id}-chronology`}><h3 id={`${issue.id}-chronology`}>Chronology</h3><ol className="record-chronology">{issue.chronology.map((event) => <li key={event.id}><span aria-hidden="true" /><div><strong>{event.label}</strong><time dateTime={event.date ?? undefined}>{formatDate(event.date)}</time>{event.detail && <p>{event.detail}</p>}</div></li>)}</ol></section>}
      </div>
    </details>

    <footer className="record-issue-action">
      <div><h3>What you can do now</h3><p>{issue.recommendedNextAction}</p></div>
      {issue.resolutionAction.availability === 'available'
        ? <button className="ux4g-btn ux4g-btn-primary ux4g-btn-lg" type="button" onClick={() => onAction(issue.resolutionAction)}>{issue.resolutionAction.label}</button>
        : issue.resolutionAction.availability === 'unavailable'
          ? <div className="record-action-unavailable" role="status"><strong>{issue.resolutionAction.label}</strong><span>{issue.resolutionAction.reason}</span></div>
          : <span className="ux4g-tag ux4g-tag-filled-success ux4g-tag-s">{issue.resolutionAction.label}</span>}
    </footer>
  </article>
}
