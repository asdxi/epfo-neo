import { useEffect, useRef } from 'react'
import { formatDate, formatMoney, formatWageMonth } from '../domain/calculations'
import {
  contributionComponentLabel,
  issueActionContent,
  issueContentFor,
  issueStageLabel,
  issueStatusLabel,
  pensionServiceStateLabel,
  responsiblePartyLabel,
} from '../domain/issueContent'
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

const statusClassName: Record<RecordIssue['status'], string> = {
  'action-required': 'ux4g-tag-filled-warning',
  'in-progress': 'ux4g-tag-filled-info',
  resolved: 'ux4g-tag-filled-success',
  unavailable: 'ux4g-tag-filled-neutral',
}

const confirmedDate = (value: string | null | undefined) => value ? formatDate(value) : 'Not confirmed'

const stageLabel = (issue: RecordIssue): string => {
  if (issue.currentStage.code === 'SOURCE_EVENT') return issue.currentStage.label ?? 'Not confirmed'
  return issueStageLabel(issue.currentStage.code)
}

export function RecordReviewPage({ account, onBack, onTrackRequest, onStartTransfer, onRaiseContributionGrievance }: RecordReviewPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const issues = deriveRecordIssues(account)

  useEffect(() => { headingRef.current?.focus() }, [])

  const performAction = (action: RecordIssueAction) => {
    if (action.availability !== 'available') return
    if (action.code === 'TRACK_TRANSFER' || action.code === 'TRACK_CONTRIBUTION_REVIEW' || action.code === 'CHECK_EXISTING_ATTEMPT' || action.code === 'RECOVER_REQUEST') onTrackRequest(action.contextId)
    if (action.code === 'START_TRANSFER') onStartTransfer(action.contextId)
    if (action.code === 'RAISE_CONTRIBUTION_GRIEVANCE') {
      const contribution = account.ledger.contributions.find((item) => item.id === action.contextId)
      if (contribution) onRaiseContributionGrievance(contribution)
    }
  }

  return <section className="financial-page record-review-page" aria-labelledby="record-review-title">
    <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-lg record-review-back" type="button" onClick={onBack}>← Back</button>
    <header className="financial-heading">
      <h1 id="record-review-title" ref={headingRef} tabIndex={-1}>Needs Attention</h1>
      <p>Review items that need action or are still in progress.</p>
    </header>

    {issues.length === 0
      ? <div className="ux4g-empty-state record-review-empty" role="status"><div className="ux4g-empty-state-content"><h2>No Items Need Attention</h2><p>No transfer or contribution issues are currently recorded.</p></div></div>
      : <ol className="record-issue-list">{issues.map((issue, index) => <li key={issue.id}><IssueDetail issue={issue} principal={index === 0} onAction={performAction} /></li>)}</ol>}
  </section>
}

function IssueDetail({ issue, principal, onAction }: { issue: RecordIssue; principal: boolean; onAction: (action: RecordIssueAction) => void }) {
  const content = issueContentFor(issue.code)
  const actionContent = issueActionContent(issue.actionCode)
  return <article className={`record-issue ${principal ? 'record-issue--principal' : ''}`} aria-labelledby={`${issue.id}-title`}>
    <header className="record-issue-heading">
      <div className="record-issue-labels">{principal && <span className="record-issue-principal">Primary Issue</span>}<span className={`ux4g-tag ${statusClassName[issue.status]} ux4g-tag-s`}>{issueStatusLabel(issue.status)}</span></div>
      <h2 id={`${issue.id}-title`}>{content.label}</h2>
      <p>{content.shortExplanation}</p>
    </header>

    {issue.facts.kind === 'transfer' && <TransferIssueSummary issue={issue} />}
    {issue.facts.kind === 'contribution' && <ContributionIssueSummary issue={issue} />}
    {issue.facts.kind === 'unavailable' && <div className="record-unavailable" role="status"><strong>Source Record Not Available</strong><p>The {issue.facts.missingSource} record needed for this review is not available. No financial or pension result has been assumed.</p></div>}

    {issue.identityRisk && <div className="ux4g-alert ux4g-alert-warning record-impact" role="note"><div className="ux4g-alert-content"><p className="ux4g-alert-title">{issue.identityRisk.label}</p><p className="ux4g-alert-message">{issue.identityRisk.explanation}</p><p className="ux4g-alert-message">This is an identity-linking risk, not evidence of a second balance.</p></div></div>}

    <footer className="record-issue-action">
      <div><h3>What You Can Do Now</h3><p>{actionContent.explanation}</p></div>
      {issue.action.availability === 'available'
        ? <button className="ux4g-btn ux4g-btn-primary ux4g-btn-lg" type="button" onClick={() => onAction(issue.action)}>{actionContent.label}</button>
        : issue.action.availability === 'unavailable'
          ? <div className="record-action-unavailable" role="status"><strong>{actionContent.label}</strong><span>{actionContent.explanation}</span></div>
          : <span className="ux4g-tag ux4g-tag-filled-success ux4g-tag-s">{actionContent.label}</span>}
    </footer>
  </article>
}

function TransferIssueSummary({ issue }: { issue: RecordIssue }) {
  if (issue.facts.kind !== 'transfer') return null
  const facts = issue.facts
  const countedEmployment = facts.currentlyCountedUnderEmploymentId === facts.sourceEmployment.id ? facts.sourceEmployment : facts.destinationEmployment
  return <>
    <div className="record-transfer-identity">
      <p className="record-transfer-route"><span>{facts.sourceEmployment.employer}</span><span aria-hidden="true">→</span><span>{facts.destinationEmployment.employer}</span></p>
      <p className="record-transfer-amount">{formatMoney(facts.amount)}</p>
    </div>
    <dl className="record-issue-facts record-issue-facts--transfer">
      <div><dt>Current Stage</dt><dd>{stageLabel(issue)}</dd></div>
      <div><dt>Responsible Party</dt><dd>{responsiblePartyLabel(issue.responsiblePartyCode)}</dd></div>
      <div><dt>Last Confirmed Event</dt><dd>{issue.lastConfirmedEvent.label}<time dateTime={issue.lastConfirmedEvent.date ?? undefined}>{confirmedDate(issue.lastConfirmedEvent.date)}</time></dd></div>
    </dl>
    <section className="record-balance-treatment" aria-labelledby={`${issue.id}-balance-treatment`}><h3 id={`${issue.id}-balance-treatment`}>Balance Treatment</h3><dl><div><dt>Currently Counted Under</dt><dd>{countedEmployment.employer}</dd></div><div><dt>Added to {facts.destinationEmployment.employer}</dt><dd>{facts.addedToDestination === 'after-completion' ? 'After Completion' : 'Completed'}</dd></div><div><dt>Duplicate Amount in Total</dt><dd>{facts.duplicateAmountInTotal ? 'Yes' : 'No'}</dd></div></dl></section>
    <section className="record-pension-service" aria-labelledby={`${issue.id}-pension-service`}><h3 id={`${issue.id}-pension-service`}>Pension Service</h3><dl><div><dt>State</dt><dd>{pensionServiceStateLabel(facts.pensionServiceState)}</dd></div></dl><p>EPS is a service record. It is not transferred as cash.</p></section>
  </>
}

function ContributionIssueSummary({ issue }: { issue: RecordIssue }) {
  if (issue.facts.kind !== 'contribution') return null
  const facts = issue.facts
  const missing = facts.missingComponents.map((component) => contributionComponentLabel(component))
  return <>
    <dl className="record-issue-facts record-issue-facts--contribution">
      <div><dt>Employer</dt><dd>{facts.employment.employer}</dd></div>
      <div><dt>Salary Month</dt><dd>{formatWageMonth(facts.wageMonth)}</dd></div>
      <div><dt>Recorded On</dt><dd>{confirmedDate(facts.recordedOn)}</dd></div>
      <div><dt>Missing Amount</dt><dd>{missing.length > 0 ? missing.join(', ') : 'Not confirmed'}</dd></div>
      <div><dt>Responsible Party</dt><dd>{responsiblePartyLabel(issue.responsiblePartyCode)}</dd></div>
      <div><dt>Current Stage</dt><dd>{stageLabel(issue)}</dd></div>
    </dl>
    <section className="record-component-comparison" aria-labelledby={`${issue.id}-comparison`}><div className="record-section-heading"><div><h3 id={`${issue.id}-comparison`}>Expected and Recorded PF</h3><p>{issue.discrepancy?.expectationBasis}</p></div></div><div className="record-component-grid"><div><h4>Expected Amounts</h4><dl>{facts.components.map((component) => <div key={component.code}><dt>{contributionComponentLabel(component.code)}</dt><dd>{component.expected === null ? 'Not confirmed' : formatMoney(component.expected)}</dd></div>)}</dl></div><div><h4>Recorded Amounts</h4><dl>{facts.components.map((component) => <div key={component.code}><dt>{contributionComponentLabel(component.code)}</dt><dd>{component.recorded === null ? <span className="record-missing-value">Not Recorded</span> : formatMoney(component.recorded)}</dd></div>)}</dl></div></div></section>
  </>
}
