import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AccountState, MemberRequest } from '../domain/types'
import './service-pages.css'

export type ServiceId = 'transfer' | 'claim' | 'kyc' | 'correction' | 'grievance'

export interface ServicesPageProps {
  account: AccountState
  initialService?: ServiceId
  initialEmploymentId?: string
  initialContributionId?: string
  onSubmitTransfer: (submittedOn: string) => MemberRequest | void
  onSubmitClaim: (input: { submittedOn: string; amount: number; title: string }) => MemberRequest | void
  onSubmitPanVerification: (submittedOn: string) => void
  onSubmitCorrection: (input: { submittedOn: string; employmentId: string; field: string; proposedValue: string }) => MemberRequest | void
  onSubmitGrievance: (input: { submittedOn: string; employmentId: string; contributionId?: string; category: string; description: string }) => MemberRequest | void
  onViewRequests?: (requestId?: string) => void
  onManageNomination?: () => void
}

type FlowStep = 'explain' | 'details' | 'review' | 'outcome'

const today = () => new Date().toISOString().slice(0, 10)
const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const serviceNames: Record<ServiceId, string> = {
  transfer: 'Transfer Previous PF', claim: 'Claims & Withdrawals', kyc: 'KYC & Verification',
  correction: 'Correct Employment Records', grievance: 'Raise a Grievance',
}

const serviceCopy: Record<ServiceId, { description: string; action: string }> = {
  transfer: { description: 'Move an eligible balance from a previous Member ID to your current PF account.', action: 'View service' },
  claim: { description: 'Choose a claim type, check the information available, and submit it for review.', action: 'View service' },
  kyc: { description: 'Review Aadhaar, PAN and bank verification used for online member services.', action: 'View service' },
  correction: { description: 'Request a correction when an employment record does not match your documents.', action: 'View service' },
  grievance: { description: 'Ask EPFO to review a contribution or service issue and track the response.', action: 'View service' },
}

function StatusTag({ state }: { state: 'ready' | 'verified' | 'pending' | 'unverified' | 'available' }) {
  const tone = state === 'verified' || state === 'ready' || state === 'available' ? 'success' : state === 'pending' ? 'info' : 'warning'
  const label = state === 'unverified' ? 'Needs Verification' : state[0].toUpperCase() + state.slice(1)
  return <span className={`ux4g-tag-filled-${tone} ux4g-tag-s`}>{label}</span>
}

function Field({ label, children, error, help, id, kind = 'select' }: { label: string; children: React.ReactNode; error?: string; help?: string; id: string; kind?: 'input' | 'textarea' | 'select' }) {
  const messageId = `${id}-${error ? 'error' : 'help'}`
  const classes = kind === 'input' ? `service-field ux4g-input-container ux4g-input-md ${error ? 'ux4g-input-error' : 'ux4g-input-default'}` : kind === 'textarea' ? `service-field ux4g-textarea ux4g-textarea-md ${error ? 'ux4g-textarea-error' : 'ux4g-textarea-default'}` : 'service-field'
  return <div className={classes}><label className={kind === 'textarea' ? 'ux4g-textarea-label' : undefined} htmlFor={id}>{label}</label>{children}{(error || help) && <p id={messageId} className={error ? 'service-field-error' : 'service-field-help'} role={error ? 'alert' : undefined}>{error ?? help}</p>}</div>
}

function FlowProgress({ service, step }: { service: ServiceId; step: FlowStep }) {
  const active = { explain: 0, details: 1, review: 2, outcome: 3 }[step]
  const labels = ['Understand', 'Your Details', 'Review', 'Outcome']
  return <div className="service-progress-wrap">
    <p className="service-progress-current">Step {active + 1} of {labels.length} · {labels[active]}</p>
    <ol className="service-progress" aria-label={`${serviceNames[service]} progress`}>
      {labels.map((label, index) => <li key={label} className={index < active ? 'is-complete' : index === active ? 'is-current' : ''} aria-current={index === active ? 'step' : undefined}><span className="service-progress-step-number">{index + 1}</span><span className="service-progress-label">{label}</span></li>)}
    </ol>
  </div>
}

function Outcome({ request, title, message, onViewRequests }: { request?: MemberRequest; title: string; message: string; onViewRequests?: (requestId?: string) => void }) {
  return <div className="ux4g-alert ux4g-alert-success service-outcome" role="status">
    <div className="ux4g-alert-content"><h3 className="ux4g-alert-title">{title}</h3><p className="ux4g-alert-message">{message}</p>
      {request && <dl className="service-outcome-reference"><div><dt>Reference Number</dt><dd>{request.reference}</dd></div><div><dt>Submitted On</dt><dd>{formatDate(request.submittedOn)}</dd></div></dl>}
      {request && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onViewRequests?.(request.id)}>Track in Requests</button>}
    </div>
  </div>
}

export function ServicesPage(props: ServicesPageProps) {
  const [service, setService] = useState<ServiceId | null>(props.initialService ?? null)
  const [step, setStep] = useState<FlowStep>('explain')
  const initialHistoryEntryCreated = useRef(false)
  const choose = (next: ServiceId) => {
    window.history.pushState({ ...window.history.state, epfoService: next }, '')
    setService(next)
    setStep('explain')
    window.scrollTo({ top: 0 })
  }
  const returnToCatalogue = () => window.history.back()

  useEffect(() => {
    if (props.initialService && !initialHistoryEntryCreated.current) {
      window.history.pushState({ ...window.history.state, epfoService: props.initialService }, '')
      initialHistoryEntryCreated.current = true
    }

    const restoreServiceView = (event: PopStateEvent) => {
      const nextService = event.state?.epfoService
      setService((Object.keys(serviceNames) as ServiceId[]).includes(nextService) ? nextService : null)
      setStep('explain')
      window.scrollTo({ top: 0 })
    }

    window.addEventListener('popstate', restoreServiceView)
    return () => window.removeEventListener('popstate', restoreServiceView)
  }, [props.initialService])
  return <section className="service-page services-page" aria-labelledby="services-title">
    {!service ? <>
      <header className="service-page-heading"><h1 id="services-title">Services</h1><p>Choose a service to see what you need and what happens next.</p></header>
      <aside className="ux4g-alert ux4g-alert-info service-nomination-panel"><div className="ux4g-alert-content"><div className="service-nomination-copy"><p className="ux4g-alert-title">Manage nomination in Account</p><p className="ux4g-alert-message">Add or update nominee details and confirm how the total share is divided.</p></div><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={props.onManageNomination}>{props.account.member.nominees.length > 0 ? 'Update Nominees' : 'Add Nominee'}</button></div></aside>
      <div className="service-catalogue">
        {(Object.keys(serviceNames) as ServiceId[]).map((id) => <article className="service-catalogue-item" key={id}><div><h2>{serviceNames[id]}</h2><p>{serviceCopy[id].description}</p></div><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => choose(id)}>{serviceCopy[id].action}</button></article>)}
      </div>
    </> : <>
      <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm service-back-button" type="button" onClick={returnToCatalogue}>← Back to Services</button>
      <header className="service-page-heading"><h1 id="services-title">{serviceNames[service]}</h1><p>{serviceCopy[service].description}</p></header>
      <FlowProgress service={service} step={step} />
      {service === 'transfer' && <TransferFlow {...props} step={step} setStep={setStep} />}
      {service === 'claim' && <ClaimFlow {...props} step={step} setStep={setStep} />}
      {service === 'kyc' && <KycFlow {...props} step={step} setStep={setStep} />}
      {service === 'correction' && <CorrectionFlow {...props} step={step} setStep={setStep} />}
      {service === 'grievance' && <GrievanceFlow {...props} step={step} setStep={setStep} />}
    </>}
  </section>
}

type FlowProps = ServicesPageProps & { step: FlowStep; setStep: (step: FlowStep) => void }

function FlowActions({ step, setStep, onConfirm, confirmLabel = 'Confirm and Submit', disabled = false }: { step: FlowStep; setStep: (step: FlowStep) => void; onConfirm?: () => void; confirmLabel?: string; disabled?: boolean }) {
  if (step === 'outcome') return null
  const previous: Record<Exclude<FlowStep, 'explain'>, FlowStep> = { details: 'explain', review: 'details', outcome: 'review' }
  return <div className="service-flow-actions">{step !== 'explain' && <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep(previous[step])}>Back</button>}<button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" disabled={disabled} onClick={() => step === 'review' ? onConfirm?.() : setStep(step === 'explain' ? 'details' : 'review')}>{step === 'review' ? confirmLabel : 'Continue'}</button></div>
}

function TransferFlow({ account, step, setStep, onSubmitTransfer, onViewRequests }: FlowProps) {
  const exception = account.exceptions.find((item) => item.kind === 'previous-balance')
  const source = account.employments.find((item) => item.id === exception?.employmentId)
  const destination = account.employments.find((item) => item.status === 'current')
  const aadhaar = account.kyc.find((item) => item.type === 'aadhaar')
  const bank = account.kyc.find((item) => item.type === 'bank')
  const [accepted, setAccepted] = useState(false)
  const [request, setRequest] = useState<MemberRequest>()
  const submit = () => { const result = onSubmitTransfer(today()); if (result) setRequest(result); setStep('outcome') }
  if (exception?.state === 'in-progress' && step !== 'outcome') return <div className="ux4g-alert ux4g-alert-info service-transfer-progress-alert"><div className="ux4g-alert-content"><div className="service-transfer-progress-copy"><p className="ux4g-alert-title">Transfer Is Already in Progress</p><p className="ux4g-alert-message">The balance remains under the previous Member ID until processing completes. Review its status and next expected step in Requests.</p></div><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => onViewRequests?.(exception.relatedRequestId)}>Track Transfer</button></div></div>
  if (!source || !destination || !exception?.amount) return <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">No Balance Is Ready to Transfer</p><p className="ux4g-alert-message">There is no open previous-balance item on this account.</p></div></div>
  return <article className="service-flow service-flow--hero">
    {step === 'explain' && <div className="service-flow-body"><h2>Move {formatMoney(exception.amount)} from {source.employer}</h2><p>The amount is currently recorded under Member ID {source.memberId}. The destination is your current {destination.employer} Member ID, {destination.memberId}.</p><div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">What Happens Next</p><p className="ux4g-alert-message">After submission, the previous employment record is verified and the transfer is processed. The money remains under the previous Member ID until completion. A transfer moves existing EPF money; it does not create a new contribution.</p></div></div><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <div className="service-flow-body"><h2>Readiness Checks</h2><ul className="service-check-list"><li><span>Aadhaar</span><StatusTag state={aadhaar?.state ?? 'unverified'} /></li><li><span>Bank Account</span><StatusTag state={bank?.state ?? 'unverified'} /></li><li><span>Previous Employment Record</span><StatusTag state="ready" /></li><li><span>Previous Member ID</span><StatusTag state="available" /></li><li><span>Current Member ID</span><StatusTag state="available" /></li></ul><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Transfer</h2><dl className="service-review-list"><div><dt>From</dt><dd>{source.employer}<small>{source.memberId}</small></dd></div><div><dt>To</dt><dd>{destination.employer}<small>{destination.memberId}</small></dd></div><div><dt>Amount</dt><dd>{formatMoney(exception.amount)}</dd></div></dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm that the Member IDs and employments shown above belong to this account.</span></label><FlowActions step={step} setStep={setStep} disabled={!accepted} onConfirm={submit} confirmLabel="Confirm and Submit Transfer" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Transfer Request Submitted" message={`${formatMoney(exception.amount)} remains under ${source.employer} while verification and processing take place. No action is required right now.`} onViewRequests={onViewRequests} /></div>}
  </article>
}

function ClaimFlow({ account, step, setStep, onSubmitClaim, onViewRequests }: FlowProps) {
  const [intent, setIntent] = useState('advance')
  const [amount, setAmount] = useState('25000')
  const [declaration, setDeclaration] = useState(false)
  const [request, setRequest] = useState<MemberRequest>()
  const bank = account.kyc.find((item) => item.type === 'bank')
  const numericAmount = Number(amount)
  const amountError = !Number.isFinite(numericAmount) || numericAmount <= 0 ? 'Enter an amount greater than zero.' : numericAmount > 25_000 ? 'Enter no more than ₹25,000.' : ''
  const ineligible = intent !== 'advance'
  const submit = () => { const result = onSubmitClaim({ submittedOn: today(), amount: numericAmount, title: 'PF Advance Request' }); if (result) setRequest(result); setStep('outcome') }
  return <article className="service-flow">{step === 'explain' && <div className="service-flow-body"><h2>Choose a Claim Intent</h2><p>Eligibility depends on the claim type and member circumstances. This account view can only pre-check the records it holds; EPFO review determines the outcome.</p><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <form className="service-flow-body" onSubmit={(event) => event.preventDefault()}><Field id="claim-intent" label="Claim intent"><select id="claim-intent" className="service-select" value={intent} onChange={(event) => setIntent(event.target.value)}><option value="advance">Request a PF Advance</option><option value="final">Final EPF Settlement</option><option value="pension">Pension-related Claim</option></select></Field>{ineligible ? <div className="ux4g-alert ux4g-alert-warning"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Cannot Be Submitted from This Account State</p><p className="ux4g-alert-message">The current employment record is active. There is not enough verified information to establish eligibility for this claim intent. Choose PF Advance to continue.</p></div></div> : <><div className="service-readiness-line"><span>Verified bank {bank?.maskedValue}</span><StatusTag state={bank?.state ?? 'unverified'} /></div><Field id="claim-amount" label="Amount requested" error={amountError} help="Amount available for this scenario: up to ₹25,000."><input id="claim-amount" className={`ux4g-input ux4g-input-md ${amountError ? 'ux4g-input-error' : ''}`} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(amountError)} aria-describedby={`claim-amount-${amountError ? 'error' : 'help'}`} /></Field></>}<FlowActions step={step} setStep={setStep} disabled={ineligible || Boolean(amountError)} /></form>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Claim</h2><dl className="service-review-list"><div><dt>Claim Type</dt><dd>PF Advance</dd></div><div><dt>Amount Requested</dt><dd>{formatMoney(numericAmount)}</dd></div><div><dt>Payment Account</dt><dd>{bank?.maskedValue ?? 'Unavailable'}<small>{bank?.state === 'verified' ? 'Verified' : 'Needs verification'}</small></dd></div></dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm the information shown is correct for this request.</span></label><FlowActions step={step} setStep={setStep} disabled={!declaration} onConfirm={submit} confirmLabel="Verify and Submit Claim" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Claim Submitted for Review" message={`${formatMoney(numericAmount)} has been requested. Payment is not guaranteed; the eligibility, declaration and verified bank details will be reviewed.`} onViewRequests={onViewRequests} /></div>}
  </article>
}

function KycFlow({ account, step, setStep, onSubmitPanVerification }: FlowProps) {
  const [pan, setPan] = useState('ARJPM4321K')
  const [consent, setConsent] = useState(false)
  const panError = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) ? '' : 'Enter a PAN in the format ABCDE1234F.'
  const submit = () => { onSubmitPanVerification(today()); setStep('outcome') }
  return <article className="service-flow">{step === 'explain' && <div className="service-flow-body"><h2>Verification Status</h2><div className="service-kyc-grid">{account.kyc.map((record) => <div key={record.type}><div><strong>{record.type === 'aadhaar' ? 'Aadhaar' : record.type === 'pan' ? 'PAN' : 'Bank Account'}</strong><span>{record.maskedValue}</span></div><StatusTag state={record.state} /></div>)}</div><p>Aadhaar and bank are already verified. PAN is the incomplete item available to complete in this flow.</p><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <form className="service-flow-body" onSubmit={(event) => event.preventDefault()}><h2>Enter PAN</h2><Field id="pan-number" label="Permanent Account Number (PAN)" error={panError} help="Use uppercase letters and numbers."><input id="pan-number" className={`ux4g-input ux4g-input-md ${panError ? 'ux4g-input-error' : ''}`} value={pan} maxLength={10} autoCapitalize="characters" onChange={(event) => setPan(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} aria-invalid={Boolean(panError)} aria-describedby={`pan-number-${panError ? 'error' : 'help'}`} /></Field><div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Verification Takes Time</p><p className="ux4g-alert-message">Submitting PAN changes its state to Pending. It is not shown as verified until processing completes.</p></div></div><FlowActions step={step} setStep={setStep} disabled={Boolean(panError)} /></form>}
    {step === 'review' && <div className="service-flow-body"><h2>Review PAN Submission</h2><dl className="service-review-list"><div><dt>PAN</dt><dd>{pan.slice(0, 3)}•••{pan.slice(-2)}</dd></div><div><dt>Next State</dt><dd>Pending Verification</dd></div></dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm this PAN belongs to the member in this account.</span></label><FlowActions step={step} setStep={setStep} disabled={!consent} onConfirm={submit} confirmLabel="Submit for Verification" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome title="PAN Verification Submitted" message="PAN is now pending verification. You can continue using services that do not require completed PAN verification." /></div>}
  </article>
}

function CorrectionFlow({ account, step, setStep, onSubmitCorrection, onViewRequests, initialEmploymentId }: FlowProps) {
  const [employmentId, setEmploymentId] = useState(initialEmploymentId ?? account.employments.at(-1)?.id ?? '')
  const [field, setField] = useState('Date of Exit')
  const [proposedValue, setProposedValue] = useState('')
  const [reason, setReason] = useState('')
  const [support, setSupport] = useState('')
  const [request, setRequest] = useState<MemberRequest>()
  const employment = account.employments.find((item) => item.id === employmentId)
  const currentValue = field === 'Date of Joining' ? employment?.joinedOn : field === 'Date of Exit' ? employment?.exitedOn ?? 'Not recorded' : employment?.employer
  const submit = () => { const result = onSubmitCorrection({ submittedOn: today(), employmentId, field, proposedValue }); if (result) setRequest(result); setStep('outcome') }
  const invalid = !proposedValue.trim() || reason.trim().length < 10
  return <article className="service-flow">{step === 'explain' && <div className="service-flow-body"><h2>Correct a Recorded Employment Detail</h2><p>Select the employer and field, then provide the value you believe is correct. The employer is expected to verify it before EPFO review.</p><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <form className="service-flow-body" onSubmit={(event) => event.preventDefault()}><div className="service-form-grid"><Field id="correction-employer" label="Employer"><select id="correction-employer" className="service-select" value={employmentId} onChange={(event) => setEmploymentId(event.target.value)}>{account.employments.map((item) => <option key={item.id} value={item.id}>{item.employer}</option>)}</select></Field><Field id="correction-field" label="Field requiring correction"><select id="correction-field" className="service-select" value={field} onChange={(event) => setField(event.target.value)}><option>Date of Joining</option><option>Date of Exit</option><option>Employer Name</option></select></Field></div><div className="service-readonly-value"><span>Existing Value</span><strong>{currentValue}</strong></div><Field id="proposed-value" label="Proposed value" error={!proposedValue.trim() ? 'Enter the proposed value.' : undefined}><input id="proposed-value" className="ux4g-input ux4g-input-md" value={proposedValue} onChange={(event) => setProposedValue(event.target.value)} aria-invalid={!proposedValue.trim()} /></Field><Field id="correction-reason" label="Reason for correction" error={reason && reason.trim().length < 10 ? 'Add at least 10 characters so the request can be understood.' : undefined}><textarea id="correction-reason" className="service-textarea" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></Field><Field id="correction-support" label="Supporting information (optional)" help="Describe the record that supports this change. No real document is uploaded."><textarea id="correction-support" className="service-textarea" rows={3} value={support} onChange={(event) => setSupport(event.target.value)} /></Field><FlowActions step={step} setStep={setStep} disabled={invalid} /></form>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Correction Request</h2><dl className="service-review-list"><div><dt>Employer</dt><dd>{employment?.employer}</dd></div><div><dt>Field</dt><dd>{field}</dd></div><div><dt>Existing Value</dt><dd>{currentValue}</dd></div><div><dt>Proposed Value</dt><dd>{proposedValue}</dd></div><div><dt>Reason</dt><dd>{reason}</dd></div>{support && <div><dt>Supporting Information</dt><dd>{support}</dd></div>}</dl><FlowActions step={step} setStep={setStep} onConfirm={submit} confirmLabel="Submit Correction Request" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Correction Request Submitted" message="The request is awaiting employer verification. The recorded value does not change until the process is completed." onViewRequests={onViewRequests} /></div>}
  </article>
}

function GrievanceFlow({ account, step, setStep, onSubmitGrievance, onViewRequests, initialEmploymentId, initialContributionId }: FlowProps) {
  const defaultContribution = initialContributionId ?? account.exceptions.find((item) => item.kind === 'contribution-review')?.contributionId ?? ''
  const relatedContribution = account.ledger.contributions.find((item) => item.id === defaultContribution)
  const [employmentId, setEmploymentId] = useState(initialEmploymentId ?? relatedContribution?.employmentId ?? account.employments.at(-1)?.id ?? '')
  const [contributionId, setContributionId] = useState(defaultContribution)
  const [category, setCategory] = useState('Contribution Amount Not Fully Recorded')
  const [description, setDescription] = useState(relatedContribution?.explanation ?? '')
  const [support, setSupport] = useState('June 2026 contribution record from this passbook')
  const [confirmed, setConfirmed] = useState(false)
  const [request, setRequest] = useState<MemberRequest>()
  const employment = account.employments.find((item) => item.id === employmentId)
  const contributions = account.ledger.contributions.filter((item) => item.employmentId === employmentId).slice(-12).reverse()
  const submit = () => { const result = onSubmitGrievance({ submittedOn: today(), employmentId, contributionId: contributionId || undefined, category, description: `${description}${support ? ` Supporting information: ${support}` : ''}` }); if (result) setRequest(result); setStep('outcome') }
  const invalid = description.trim().length < 20
  return <article className="service-flow service-flow--hero">{step === 'explain' && <div className="service-flow-body"><h2>Get a Trackable Response</h2><p>Use a grievance when a contribution or member service issue needs review. In the next step, choose the employment or transaction you want EPFO to review.</p><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <form className="service-flow-body" onSubmit={(event: FormEvent) => event.preventDefault()}><div className="service-form-grid"><Field id="grievance-employer" label="Affected employment"><select id="grievance-employer" className="service-select" value={employmentId} onChange={(event) => { setEmploymentId(event.target.value); setContributionId('') }}>{account.employments.map((item) => <option key={item.id} value={item.id}>{item.employer}</option>)}</select></Field><Field id="grievance-transaction" label="Affected contribution (optional)"><select id="grievance-transaction" className="service-select" value={contributionId} onChange={(event) => setContributionId(event.target.value)}><option value="">Employment record generally</option>{contributions.map((item) => <option key={item.id} value={item.id}>{item.wageMonth} | {item.status.replaceAll('-', ' ')}</option>)}</select></Field></div><Field id="grievance-category" label="Issue category"><select id="grievance-category" className="service-select" value={category} onChange={(event) => setCategory(event.target.value)}><option>Contribution Amount Not Fully Recorded</option><option>Contribution Not Recorded</option><option>Transfer Delay</option><option>Claim Status</option><option>Employment Record Issue</option></select></Field><Field id="grievance-description" label="Describe the issue" error={description && invalid ? 'Add at least 20 characters so the issue can be understood.' : undefined} help="State what the record shows and what you expected. Do not include real personal data."><textarea id="grievance-description" className="service-textarea" rows={5} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} aria-describedby={`grievance-description-${description && invalid ? 'error' : 'help'}`} /></Field><Field id="grievance-support" label="Supporting record note (optional)" help="A mocked note is attached to this prototype request; no external file is uploaded."><input id="grievance-support" className="ux4g-input ux4g-input-md" value={support} onChange={(event) => setSupport(event.target.value)} /></Field><FlowActions step={step} setStep={setStep} disabled={invalid} /></form>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Grievance</h2><dl className="service-review-list"><div><dt>Employment</dt><dd>{employment?.employer}</dd></div><div><dt>Record</dt><dd>{contributionId || 'Employment record generally'}</dd></div><div><dt>Category</dt><dd>{category}</dd></div><div><dt>Description</dt><dd>{description}</dd></div>{support && <div><dt>Supporting Record</dt><dd>{support}</dd></div>}</dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm this complaint accurately describes the record shown.</span></label><FlowActions step={step} setStep={setStep} disabled={!confirmed} onConfirm={submit} confirmLabel="Submit Grievance" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Grievance Submitted" message="Your ticket has been created. EPFO review is the next expected step, and updates will appear in Requests." onViewRequests={onViewRequests} /></div>}
  </article>
}
