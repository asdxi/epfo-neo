import { useEffect, useState, type FormEvent } from 'react'
import { DEMO_OTP } from '../domain/demoCredentials'
import { OtpResend } from '../components/OtpResend'
import type { ToastMessage } from '../components/Toast'
import type { AccountState, MemberRequest } from '../domain/types'
import { contributionDiscrepancyLabel, deriveContributionResolution } from '../domain/contributionResolution'
import { employerSummaries, formatWageMonth, totalEpfBalance } from '../domain/calculations'
import { deriveTransferCandidates } from '../domain/transferPreflight'
import { fullWithdrawalReasons, partialWithdrawalReasons, type WithdrawalKind, type WithdrawalReason } from './withdrawalOptions'
import './service-pages.css'

export type ServiceId = 'transfer' | 'claim' | 'kyc' | 'correction' | 'grievance' | 'exit'

export interface ServicesPageProps {
  account: AccountState
  initialService?: ServiceId
  initialEmploymentId?: string
  initialContributionId?: string
  onSubmitTransfer: (submittedOn: string, sourceMemberId: string) => MemberRequest | void
  onSubmitClaim: (input: { submittedOn: string; amount: number; title: string }) => MemberRequest | void
  onSubmitPanVerification: (submittedOn: string) => void
  onSubmitCorrection: (input: { submittedOn: string; employmentId: string; field: string; proposedValue: string }) => MemberRequest | void
  onSubmitGrievance: (input: { submittedOn: string; employmentId: string; contributionId?: string; category: string; description: string }) => MemberRequest | void
  onSubmitExit?: (input: { submittedOn: string; employmentId: string; exitedOn: string; reason: string }) => MemberRequest | void
  onViewRequests?: (requestId?: string) => void
  onManageNomination?: () => void
  onServiceChange?: (service: ServiceId | undefined) => void
  onNotify?: (toast: Omit<ToastMessage, 'id'>) => void
}

type FlowStep = 'explain' | 'details' | 'review' | 'verify' | 'outcome'

const today = () => new Date().toISOString().slice(0, 10)
const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const serviceNames: Record<ServiceId, string> = {
  transfer: 'Transfer Previous PF', claim: 'Withdrawal Claim', kyc: 'KYC & Verification',
  correction: 'Correct Employment Records', grievance: 'Raise a Grievance', exit: 'Mark Exit',
}

const serviceCopy: Record<ServiceId, { description: string; action: string }> = {
  transfer: { description: 'Move an eligible balance from a previous Member ID to your current PF account.', action: 'View Service' },
  claim: { description: 'Check your eligibility and request an eligible withdrawal from your EPF balance', action: 'View Service' },
  kyc: { description: 'Review Aadhaar, PAN and bank verification used for online member services.', action: 'View Service' },
  correction: { description: 'Request a correction when an employment record does not match your documents.', action: 'View Service' },
  grievance: { description: 'Ask EPFO to review a contribution, transfer, claim or employment-record issue', action: 'View Service' },
  exit: { description: 'Record the last working day for a previous employment when it is missing. This can support PF transfers and withdrawal claims.', action: 'Mark Exit' },
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
  const labels = service === 'exit' ? ['Understand', 'Enter Details', 'Review', 'Complete'] : ['Understand', 'Your Details', 'Review', 'Complete']
  const active = service === 'exit' ? { explain: 0, details: 1, review: 2, verify: 3, outcome: 3 }[step] : { explain: 0, details: 1, review: 2, verify: 2, outcome: 3 }[step]
  return <div className="service-progress-wrap">
    <p className="service-progress-current">Step {active + 1} of {labels.length} · {labels[active]}</p>
    <ol className="service-progress" aria-label={`${serviceNames[service]} progress`}>
      {labels.map((label, index) => <li key={label} className={index < active ? 'is-complete' : index === active ? 'is-current' : ''} aria-current={index === active ? 'step' : undefined}><span className="service-progress-step-number">{index + 1}</span><span className="service-progress-label">{label}</span></li>)}
    </ol>
  </div>
}

function Outcome({ request, title, message, onViewRequests, alertClass = 'ux4g-alert-success', className = '' }: { request?: MemberRequest; title: string; message: string; onViewRequests?: (requestId?: string) => void; alertClass?: string; className?: string }) {
  return <div className={`ux4g-alert ${alertClass} service-outcome ${className}`.trim()} role="status">
    <div className="ux4g-alert-content"><h3 className="ux4g-alert-title">{title}</h3><p className="ux4g-alert-message">{message}</p>
      {request && <dl className="service-outcome-reference"><div><dt>Request ID</dt><dd>{request.reference}</dd></div><div><dt>Request Date</dt><dd>{formatDate(request.submittedOn)}</dd></div></dl>}
      {request && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onViewRequests?.(request.id)}>Track in Requests</button>}
    </div>
  </div>
}

export function ServicesPage(props: ServicesPageProps) {
  const { initialService, onServiceChange } = props
  const [service, setService] = useState<ServiceId | null>(initialService ?? null)
  const [step, setStep] = useState<FlowStep>('explain')
  const choose = (next: ServiceId) => {
    window.history.pushState({ ...window.history.state, epfoService: next, depth: Number(window.history.state?.depth ?? 0) + 1 }, '', `/services?service=${next}`)
    setService(next)
    onServiceChange?.(next)
    setStep('explain')
    window.scrollTo({ top: 0 })
  }
  useEffect(() => {
    const restoreServiceView = (event: PopStateEvent) => {
      const nextService = event.state?.epfoService
      setService((Object.keys(serviceNames) as ServiceId[]).includes(nextService) ? nextService : null)
      onServiceChange?.((Object.keys(serviceNames) as ServiceId[]).includes(nextService) ? nextService : undefined)
      setStep('explain')
      window.scrollTo({ top: 0 })
    }

    window.addEventListener('popstate', restoreServiceView)
    return () => window.removeEventListener('popstate', restoreServiceView)
  }, [initialService, onServiceChange])
  return <section className="service-page services-page" aria-labelledby="services-title">
    {!service ? <>
      <header className="service-page-heading"><h1 id="services-title">Services</h1><p>Manage claims, transfers, verification and record updates.</p></header>
      <div className="service-catalogue">
        {(Object.keys(serviceNames) as ServiceId[]).filter((id) => id !== 'exit').map((id) => <article className="service-catalogue-item" key={id}><div><h2>{serviceNames[id]}</h2><p>{serviceCopy[id].description}</p></div><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => choose(id)}>{serviceCopy[id].action}</button></article>)}
      </div>
      <section className="service-danger-zone" aria-labelledby="service-danger-zone-title">
        <div><h2 id="service-danger-zone-title">Mark Exit</h2><p>{serviceCopy.exit.description}</p></div>
        <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md service-exit-action" type="button" onClick={() => choose('exit')}>{serviceCopy.exit.action}</button>
      </section>
    </> : <>
      <header className="service-page-heading"><h1 id="services-title">{serviceNames[service]}</h1><p>{serviceCopy[service].description}</p></header>
      <FlowProgress service={service} step={step} />
      {service === 'transfer' && <TransferFlow {...props} step={step} setStep={setStep} />}
      {service === 'claim' && <ClaimFlow {...props} step={step} setStep={setStep} />}
      {service === 'kyc' && <KycFlow {...props} step={step} setStep={setStep} />}
      {service === 'correction' && <CorrectionFlow {...props} step={step} setStep={setStep} />}
      {service === 'grievance' && <GrievanceFlow {...props} step={step} setStep={setStep} />}
      {service === 'exit' && <ExitFlow {...props} step={step} setStep={setStep} />}
    </>}
  </section>
}

type FlowProps = ServicesPageProps & { step: FlowStep; setStep: (step: FlowStep) => void }

function FlowActions({ step, setStep, onConfirm, confirmLabel = 'Confirm and Submit', disabled = false }: { step: FlowStep; setStep: (step: FlowStep) => void; onConfirm?: () => void; confirmLabel?: string; disabled?: boolean }) {
  if (step === 'outcome') return null
  const previous: Record<Exclude<FlowStep, 'explain'>, FlowStep> = { details: 'explain', review: 'details', verify: 'review', outcome: 'verify' }
  return <div className="service-flow-actions">{step !== 'explain' && <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep(previous[step])}>Back</button>}<button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" disabled={disabled} onClick={() => step === 'review' ? onConfirm?.() : setStep(step === 'explain' ? 'details' : 'review')}>{step === 'review' ? confirmLabel : 'Continue'}</button></div>
}

function TransferFlow({ account, step, setStep, onSubmitTransfer, onViewRequests }: FlowProps) {
  const candidates = deriveTransferCandidates(account)
  const destination = account.employments.find((item) => item.status === 'current')
  const aadhaar = account.kyc.find((item) => item.type === 'aadhaar')
  const bank = account.kyc.find((item) => item.type === 'bank')
  const selectable = candidates.filter((candidate) => candidate.result.state !== 'automatic-completed')
  const [sourceMemberId, setSourceMemberId] = useState(selectable.find((candidate) => candidate.result.state === 'manual-required')?.employment.memberId ?? selectable[0]?.employment.memberId ?? '')
  const candidate = candidates.find((item) => item.employment.memberId === sourceMemberId)
  const source = candidate?.employment
  const amount = candidate && 'amount' in candidate.result ? candidate.result.amount : 0
  const [accepted, setAccepted] = useState(false)
  const [request, setRequest] = useState<MemberRequest>()
  const submit = () => { if (!source) return; const result = onSubmitTransfer(today(), source.memberId); if (result) setRequest(result); setStep('outcome') }
  if (!source || !destination || !candidate) return <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">No Transfer Action Is Needed</p><p className="ux4g-alert-message">There is no previous PF balance requiring transfer.</p></div></div>
  if (step === 'explain') return <div className="transfer-explain-layout">
    <aside className="ux4g-alert ux4g-alert-info transfer-automatic-nudge" aria-label="Automatic transfer information"><div className="ux4g-alert-content"><p className="ux4g-alert-message">Eligible PF balances are usually transferred automatically. Use this service when a previous balance has not been transferred.</p></div></aside>
    <article className="service-flow service-flow--hero transfer-selection-card"><div className="service-flow-body"><h2>Select a Previous Employment</h2><Field id="transfer-source" label="Source Employment"><select id="transfer-source" className="service-select" value={sourceMemberId} onChange={(event) => { setSourceMemberId(event.target.value); setAccepted(false) }}>{selectable.map((item) => <option key={item.employment.memberId} value={item.employment.memberId}>{item.employment.employer} · {item.employment.memberId}</option>)}</select></Field>{candidate.result.state === 'existing-manual-request' ? <div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Transfer Already in Progress</p><p className="ux4g-alert-message">A transfer request for this employment is already being processed.</p><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => onViewRequests?.(candidate.result.state === 'existing-manual-request' ? candidate.result.requestId : undefined)}>Track Request</button></div></div> : <><p>{formatMoney(amount)} is recorded under this Member ID. The destination is {destination.employer}, {destination.memberId}.</p><div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">What Happens Next</p><p className="ux4g-alert-message">The previous employment record and Member IDs will be used to process the transfer. The money remains under the source Member ID until completion.</p></div></div><FlowActions step={step} setStep={setStep} /></>} {candidates.some((item) => item.result.state === 'automatic-completed') && <p className="service-transfer-history">Earlier eligible balances shown in your record were transferred automatically.</p>}</div></article>
  </div>
  return <article className="service-flow service-flow--hero">
    {step === 'details' && <div className="service-flow-body"><h2>Readiness Checks</h2><ul className="service-check-list"><li><span>Aadhaar</span><StatusTag state={aadhaar?.state ?? 'unverified'} /></li><li><span>Bank Account</span><StatusTag state={bank?.state ?? 'unverified'} /></li><li><span>Previous Employment Record</span><StatusTag state="ready" /></li><li><span>Previous Member ID</span><StatusTag state="available" /></li><li><span>Current Member ID</span><StatusTag state="available" /></li></ul><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Transfer</h2><dl className="service-review-list"><div><dt>From</dt><dd>{source.employer}<small>{source.memberId}</small></dd></div><div><dt>To</dt><dd>{destination.employer}<small>{destination.memberId}</small></dd></div><div><dt>Amount</dt><dd>{formatMoney(amount)}</dd></div></dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm that the Member IDs and employments shown above belong to this account.</span></label><FlowActions step={step} setStep={setStep} disabled={!accepted} onConfirm={submit} confirmLabel="Confirm and Submit Transfer" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Request Filed" message={`${formatMoney(amount)} remains under ${source.employer} until the transfer completes. Track this request in Requests.`} onViewRequests={onViewRequests} alertClass="ux4g-alert-info" /></div>}
  </article>
}

function ClaimFlow({ account, step, setStep, onSubmitClaim, onViewRequests }: FlowProps) {
  const [intent, setIntent] = useState<WithdrawalKind>('advance')
  const [reason, setReason] = useState<WithdrawalReason>(partialWithdrawalReasons[0])
  const [employmentId, setEmploymentId] = useState(account.employments.find((employment) => employment.status === 'current')?.id ?? account.employments.at(-1)?.id ?? '')
  const [amount, setAmount] = useState('25000')
  const [declaration, setDeclaration] = useState(false)
  const [request, setRequest] = useState<MemberRequest>()
  const employment = account.employments.find((item) => item.id === employmentId)
  const selectedSummary = employment ? employerSummaries(account).find((item) => item.employment.id === employment.id) : undefined
  const bank = account.kyc.find((item) => item.type === 'bank')
  const hasIncompleteKyc = account.kyc.some((item) => item.state !== 'verified')
  const unemploymentMonths = employment?.exitedOn ? Math.max(0, (new Date(`${today()}T00:00:00`).getFullYear() - new Date(`${employment.exitedOn}T00:00:00`).getFullYear()) * 12 + new Date(`${today()}T00:00:00`).getMonth() - new Date(`${employment.exitedOn}T00:00:00`).getMonth()) : 0
  const fullSettlementEligible = Boolean(employment?.exitedOn && unemploymentMonths >= 12)
  const balanceForClaim = intent === 'final' ? selectedSummary?.closingBalance ?? 0 : totalEpfBalance(account)
  const maximumAmount = Math.max(0, Math.floor(intent === 'final' ? balanceForClaim : balanceForClaim * 0.75))
  const reasonOptions = intent === 'final' ? fullWithdrawalReasons : partialWithdrawalReasons
  const kycSummary = account.kyc.map((record) => `${record.type === 'aadhaar' ? 'Aadhaar' : record.type === 'pan' ? 'PAN' : 'Bank'} ${record.state === 'verified' ? 'verified' : 'needs verification'}`).join(' · ')
  const numericAmount = Number(amount)
  const amountError = !Number.isFinite(numericAmount) || numericAmount <= 0 ? 'Enter an amount greater than zero.' : numericAmount > maximumAmount ? `Enter no more than ${formatMoney(maximumAmount)}.` : ''
  const blockedFullWithdrawal = intent === 'final' && !fullSettlementEligible
  const submit = () => { const result = onSubmitClaim({ submittedOn: today(), amount: numericAmount, title: `${intent === 'advance' ? 'PF Advance' : 'Full PF Withdrawal'} · ${reason}` }); if (result) setRequest(result); setStep('outcome') }
  return <article className="service-flow">{step === 'explain' && <div className="service-flow-body"><h2>Choose a Withdrawal Type</h2><p>Start with the kind of withdrawal you need. The next step will show only the reasons that apply.</p><p>PF Advance is a partial withdrawal. Full PF Withdrawal is a final settlement of a selected, exited employment record.</p><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <form className="service-flow-body" onSubmit={(event) => event.preventDefault()}>{hasIncompleteKyc && <div className="ux4g-alert ux4g-alert-warning"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Demo KYC Allowance</p><p className="ux4g-alert-message">For this demo, you can continue filing this request. In the live EPFO portal, Aadhaar, PAN and bank KYC must be completed for online claims.</p></div></div>}<Field id="claim-intent" label="Withdrawal Type"><select id="claim-intent" className="service-select" value={intent} onChange={(event) => { const next = event.target.value as WithdrawalKind; setIntent(next); setReason(next === 'final' ? fullWithdrawalReasons[0] : partialWithdrawalReasons[0]); setAmount('') }}><option value="advance">PF Advance · Partial Withdrawal</option><option value="final">Full PF Withdrawal · Final Settlement</option></select></Field><Field id="claim-reason" label={intent === 'advance' ? 'Reason for PF Advance' : 'Reason for Full PF Withdrawal'}><select id="claim-reason" className="service-select" value={reason} onChange={(event) => setReason(event.target.value)}>{reasonOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>{intent === 'final' && <><Field id="claim-employment" label="Employment record"><select id="claim-employment" className="service-select" value={employmentId} onChange={(event) => setEmploymentId(event.target.value)}>{account.employments.map((item) => <option key={item.id} value={item.id}>{item.employer}{item.exitedOn ? ` · Exit ${formatDate(item.exitedOn)}` : ' · Current employment'}</option>)}</select></Field><div className="service-readiness-line"><span>{employment?.exitedOn ? `Exit date ${formatDate(employment.exitedOn)} · ${unemploymentMonths} month${unemploymentMonths === 1 ? '' : 's'} unemployed` : 'Current employment · no exit date recorded'}</span><StatusTag state={fullSettlementEligible ? 'available' : 'unverified'} /></div>{blockedFullWithdrawal && <div className="ux4g-alert ux4g-alert-warning"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Full Settlement Is Not Yet Eligible</p><p className="ux4g-alert-message">Select an employment that has been closed for at least 12 months. A current employment cannot be used for full settlement.</p></div></div>}</>}<div className="service-readiness-line"><span>KYC status · {kycSummary}</span></div><div className="service-readiness-line"><span>Maximum for this request {formatMoney(maximumAmount)}</span><StatusTag state={bank?.state ?? 'unverified'} /></div><Field id="claim-amount" label="Amount requested" error={amountError} help={intent === 'advance' ? `Up to 75% of the available EPF balance: ${formatMoney(maximumAmount)}.` : `Available for this employment: ${formatMoney(maximumAmount)}.`}><input id="claim-amount" className={`ux4g-input ux4g-input-md ${amountError ? 'ux4g-input-error' : ''}`} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(amountError)} aria-describedby={`claim-amount-${amountError ? 'error' : 'help'}`} /></Field><FlowActions step={step} setStep={setStep} disabled={blockedFullWithdrawal || Boolean(amountError)} /></form>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Withdrawal</h2><dl className="service-review-list"><div><dt>Withdrawal Type</dt><dd>{intent === 'advance' ? 'PF Advance · Partial Withdrawal' : 'Full PF Withdrawal · Final Settlement'}</dd></div><div><dt>Reason</dt><dd>{reason}</dd></div>{intent === 'final' && <div><dt>Employment</dt><dd>{employment?.employer ?? 'Unavailable'}<small>{employment?.exitedOn ? `Exit ${formatDate(employment.exitedOn)}` : 'Current employment'}</small></dd></div>}<div><dt>Amount Requested</dt><dd>{formatMoney(numericAmount)}</dd></div><div><dt>Payment Account</dt><dd>{bank?.maskedValue ?? 'Unavailable'}<small>{bank?.state === 'verified' ? 'Verified' : 'Needs verification'}</small></dd></div></dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm the information shown is correct for this request.</span></label><FlowActions step={step} setStep={setStep} disabled={!declaration} onConfirm={submit} confirmLabel="Verify and Submit Withdrawal" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Withdrawal Request Filed" message={`Your ${formatMoney(numericAmount)} ${intent === 'advance' ? 'PF Advance' : 'full withdrawal'} request is filed. Track its progress in Requests.`} onViewRequests={onViewRequests} alertClass="ux4g-alert-info" /></div>}
  </article>
}

function KycFlow({ account, step, setStep, onSubmitPanVerification, onNotify = () => undefined }: FlowProps) {
  const panRecord = account.kyc.find((record) => record.type === 'pan')
  const [consent, setConsent] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const submit = () => { onSubmitPanVerification(today()); setStep('outcome') }
  if (!panRecord) return null
  if (panRecord.state === 'pending' && step !== 'outcome') return <article className="service-flow"><div className="service-flow-body"><div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">PAN Verification Is Already In Progress</p><p className="ux4g-alert-message">A verification request for {panRecord.maskedValue} is already being processed.</p></div></div></div></article>
  return <article className="service-flow">{step === 'explain' && <div className="service-flow-body"><h2>Verification Status</h2><div className="service-kyc-grid">{account.kyc.map((record) => <div key={record.type}><div><strong>{record.type === 'aadhaar' ? 'Aadhaar' : record.type === 'pan' ? 'PAN' : 'Bank Account'}</strong><span>{record.maskedValue}</span></div><StatusTag state={record.state} /></div>)}</div><p>Confirm the PAN already associated with this account, then verify the mobile OTP before it is submitted.</p><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => setStep('details')}>Continue</button></div>}
    {step === 'details' && <div className="service-flow-body"><h2>Confirm PAN</h2><dl className="service-review-list"><div><dt>PAN</dt><dd>{panRecord.maskedValue}</dd></div></dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm this PAN belongs to me.</span></label><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('explain')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" disabled={!consent} onClick={() => setStep('verify')}>Continue</button></div></div>}
    {step === 'verify' && <form className="service-flow-body" onSubmit={(event) => { event.preventDefault(); if (otp !== DEMO_OTP) { setOtpError('We could not verify this OTP. Check the code and try again.'); return } setOtpError(''); setStep('review') }}><h2>Verify Mobile OTP</h2><p>A one-time password was sent to your registered mobile number.</p><Field id="pan-otp" label="Mobile OTP" error={otpError} help="Enter the six-digit demo OTP."><input id="pan-otp" className={`ux4g-input ux4g-input-md ${otpError ? 'ux4g-input-error' : ''}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError('') }} /></Field><OtpResend onResend={() => onNotify({ tone: 'success', title: 'OTP Sent', message: 'A new OTP was sent to your registered mobile number.' })} /><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('details')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Verify OTP</button></div></form>}
    {step === 'review' && <div className="service-flow-body"><h2>Review PAN Submission</h2><dl className="service-review-list"><div><dt>PAN</dt><dd>{panRecord.maskedValue}</dd></div><div><dt>Next State</dt><dd>Pending Verification</dd></div></dl><FlowActions step={step} setStep={setStep} onConfirm={submit} confirmLabel="Submit for Verification" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome title="PAN Verification Started" message="PAN verification is in progress." alertClass="ux4g-alert-info" /></div>}
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
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Correction Attempt Saved" message="Your attempt is saved. Track it in Requests to confirm receipt before employer review." onViewRequests={onViewRequests} alertClass="ux4g-alert-info" /></div>}
  </article>
}

function GrievanceFlow({ account, step, setStep, onSubmitGrievance, onViewRequests, initialEmploymentId, initialContributionId }: FlowProps) {
  const defaultContribution = initialContributionId ?? account.exceptions.find((item) => item.kind === 'contribution-review')?.contributionId ?? ''
  const relatedContribution = account.ledger.contributions.find((item) => item.id === defaultContribution)
  const [employmentId, setEmploymentId] = useState(initialEmploymentId ?? relatedContribution?.employmentId ?? account.employments.at(-1)?.id ?? '')
  const [contributionId, setContributionIdState] = useState(defaultContribution)
  const initialResolution = initialContributionId ? deriveContributionResolution(account, initialContributionId) : undefined
  const [category, setCategory] = useState(initialResolution?.categoryLabel ?? 'Contribution Amount Not Fully Recorded')
  const [description, setDescription] = useState(initialResolution?.preparedDescription ?? relatedContribution?.explanation ?? '')
  const [support, setSupport] = useState(initialResolution?.evidenceHeld.join('; ') ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [request, setRequest] = useState<MemberRequest>()
  const employment = account.employments.find((item) => item.id === employmentId)
  const contributions = account.ledger.contributions.filter((item) => item.employmentId === employmentId).slice(-12).reverse()
  const contextualResolution = contributionId ? deriveContributionResolution(account, contributionId) : undefined
  const setContributionId = (nextContributionId: string) => {
    setContributionIdState(nextContributionId)
    const nextResolution = nextContributionId ? deriveContributionResolution(account, nextContributionId) : undefined
    if (!nextResolution) return
    setCategory(nextResolution.categoryLabel)
    setDescription(nextResolution.preparedDescription)
    setSupport(nextResolution.evidenceHeld.join('; '))
  }
  const submit = () => { const result = onSubmitGrievance({ submittedOn: today(), employmentId, contributionId: contributionId || undefined, category, description: `${description}${support ? ` Supporting information: ${support}` : ''}` }); if (result) setRequest(result); setStep('outcome') }
  const invalid = description.trim().length < 20
  return <article className="service-flow service-flow--hero">{step === 'explain' && <div className="service-flow-body"><h2>Tell Us What Needs Review</h2><p>Choose the affected employment or transaction and describe what appears incorrect. Relevant account records will be attached to the request.</p><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <form className="service-flow-body" onSubmit={(event: FormEvent) => event.preventDefault()}>{contextualResolution ? <dl className="service-review-list"><div><dt>Employer</dt><dd>{employment?.employer}</dd></div><div><dt>Salary Month</dt><dd>{relatedContribution ? formatWageMonth(relatedContribution.wageMonth) : 'Not recorded'}</dd></div><div><dt>Issue</dt><dd>{contextualResolution.categoryLabel}</dd></div></dl> : <div className="service-form-grid"><Field id="grievance-employer" label="Affected Employment"><select id="grievance-employer" className="service-select" value={employmentId} onChange={(event) => { setEmploymentId(event.target.value); setContributionId('') }}>{account.employments.map((item) => <option key={item.id} value={item.id}>{item.employer}</option>)}</select></Field><Field id="grievance-transaction" label="Affected Contribution (Optional)"><select id="grievance-transaction" className="service-select" value={contributionId} onChange={(event) => setContributionId(event.target.value)}><option value="">Employment Record Generally</option>{contributions.map((item) => <option key={item.id} value={item.id}>{formatWageMonth(item.wageMonth)} · {item.status.replaceAll('-', ' ')}</option>)}</select></Field></div>}<Field id="grievance-category" label="Issue"><select id="grievance-category" className="service-select" value={category} onChange={(event) => setCategory(event.target.value)} disabled={Boolean(contextualResolution)}>{contextualResolution ? contextualResolution.validCategories.map((item) => <option key={item}>{contributionDiscrepancyLabel(item)}</option>) : <><option>Contribution Amount Not Fully Recorded</option><option>Contribution Not Recorded</option><option>Transfer Delay</option><option>Claim Status</option><option>Employment Record Issue</option></>}</select></Field><Field id="grievance-description" label="Issue Description" error={description && invalid ? 'Add at least 20 characters so the issue can be understood.' : undefined} help="Check the details and add any other facts. Do not enter real personal information."><textarea id="grievance-description" className="service-textarea" rows={5} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} aria-describedby={`grievance-description-${description && invalid ? 'error' : 'help'}`} /></Field><Field id="grievance-support" label="Records Included" help="These records will be included with your request. No file upload is needed."><input id="grievance-support" className="ux4g-input ux4g-input-md" value={support} readOnly={Boolean(contextualResolution)} onChange={(event) => setSupport(event.target.value)} /></Field><FlowActions step={step} setStep={setStep} disabled={invalid} /></form>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Grievance</h2><dl className="service-review-list"><div><dt>Employer</dt><dd>{employment?.employer}</dd></div><div><dt>Salary Month</dt><dd>{relatedContribution ? formatWageMonth(relatedContribution.wageMonth) : 'Not recorded'}</dd></div><div><dt>Issue</dt><dd>{category}</dd></div><div><dt>Description</dt><dd>{description}</dd></div>{support && <div><dt>Records Included</dt><dd>{support}</dd></div>}</dl><label className="ux4g-checkbox ux4g-checkbox-md"><input className="ux4g-checkbox-input" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I confirm this complaint accurately describes the record shown.</span></label><FlowActions step={step} setStep={setStep} disabled={!confirmed} onConfirm={submit} confirmLabel="Submit Grievance" /></div>}
    {step === 'outcome' && <div className="service-flow-body"><Outcome request={request} title="Grievance Attempt Saved" message="Your attempt is saved. A portal receipt and acknowledgement are not confirmed yet." onViewRequests={onViewRequests} alertClass="ux4g-alert-info" /></div>}
  </article>
}

function ExitFlow({ account, step, setStep, onSubmitExit, onViewRequests, onNotify = () => undefined }: FlowProps) {
  const mostRecentEmployment = [...account.employments].sort((first, second) => second.joinedOn.localeCompare(first.joinedOn))[0]
  const employmentId = mostRecentEmployment?.id ?? ''
  const [exitedOn, setExitedOn] = useState('')
  const [reason, setReason] = useState('')
  const [consent, setConsent] = useState(false)
  const [otp, setOtp] = useState('')
  const [request, setRequest] = useState<MemberRequest>()
  const employment = account.employments.find((item) => item.id === employmentId)
  const pendingExitRequest = account.requests.find((item) => item.type === 'exit' && item.state !== 'completed')
  const validDetails = Boolean(employment && exitedOn && reason && consent)
  const submit = () => {
    const result = onSubmitExit?.({ submittedOn: today(), employmentId, exitedOn, reason })
    if (result) setRequest(result)
    setStep('outcome')
  }
  if (step === 'outcome') return <div className="exit-submission-panel"><Outcome request={request} title="Mark Exit Request Saved" message="Your Mark Exit request is saved. Track it to confirm the recorded exit date before transferring or withdrawing PF." onViewRequests={onViewRequests} alertClass="ux4g-alert-info" /></div>
  if (pendingExitRequest) return <div className="service-pending-exit"><div className="ux4g-alert ux4g-alert-info" role="status"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Mark Exit Request Already Pending</p><p className="ux4g-alert-message">You already have a pending Mark Exit request. You cannot submit another request until this one is completed.</p><p className="service-pending-exit-reference">Reference Number: <strong>{pendingExitRequest.reference}</strong></p>{onViewRequests && <button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => onViewRequests(pendingExitRequest.id)}>Track in Requests</button>}</div></div></div>
  return <div className="service-flow service-flow--hero">
    {step === 'explain' && <div className="service-flow-body"><h2>Before you mark an exit</h2><p>Use Mark Exit to record the last working day for a previous employment when your employer has not recorded it. This does not close your EPFO membership or prevent you from joining a new employer later.</p><div className="ux4g-alert ux4g-alert-warning"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Check this date carefully</p><p className="ux4g-alert-message">The recorded date can affect PF transfers and withdrawal eligibility. Confirm it with your employer before continuing.</p></div></div><FlowActions step={step} setStep={setStep} /></div>}
    {step === 'details' && <div className="service-flow-body"><h2>Enter Mark Exit details</h2><Field id="exit-employment" label="Employment record"><select id="exit-employment" className="service-select" value={employmentId} disabled>{mostRecentEmployment && <option value={mostRecentEmployment.id}>{mostRecentEmployment.employer} · {mostRecentEmployment.memberId}</option>}</select></Field><div className="service-form-grid"><Field id="exit-date" label="Last working day / date of exit"><input id="exit-date" className="ux4g-input ux4g-input-md" type="date" value={exitedOn} onChange={(event) => setExitedOn(event.target.value)} /></Field><Field id="exit-reason" label="Reason for leaving employment"><select id="exit-reason" className="service-select" value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Select a reason</option><option>Retirement</option><option>Superannuation</option><option>Permanent disability</option><option>Cessation (short service) – any other reason</option></select></Field></div><label className="ux4g-checkbox ux4g-checkbox-md onboarding-consent"><input className="ux4g-checkbox-input" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content">I understand this records my last working day for this employment. I can join a new employer in future.</span></label><FlowActions step={step} setStep={setStep} disabled={!validDetails} /></div>}
    {step === 'review' && <div className="service-flow-body"><h2>Review Mark Exit details</h2><dl className="service-review-list"><div><dt>Employment</dt><dd>{employment?.employer}</dd></div><div><dt>Date of exit</dt><dd>{exitedOn ? formatDate(exitedOn) : 'Not entered'}</dd></div><div><dt>Reason</dt><dd>{reason}</dd></div></dl><div className="ux4g-alert ux4g-alert-warning"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Check the date carefully</p><p className="ux4g-alert-message">This date can be used for PF transfers and withdrawal claims. It may also be visible to your employer.</p></div></div><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('details')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => setStep('verify')}>Continue to Aadhaar OTP</button></div></div>}
    {step === 'verify' && <form className="service-flow-body" onSubmit={(event) => { event.preventDefault(); if (otp === '123456') submit() }}><h2>Verify with Aadhaar OTP</h2><p>An Aadhaar OTP is sent to the Aadhaar-linked mobile number on your account.</p><Field id="exit-otp" label="Aadhaar OTP" error={otp && otp !== '123456' ? 'Enter the six-digit Aadhaar OTP to continue.' : undefined}><input id="exit-otp" className="ux4g-input ux4g-input-md" inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field><OtpResend onResend={() => onNotify({ tone: 'success', title: 'OTP Sent', message: 'A new OTP was sent to your Aadhaar-linked mobile number.' })} /><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('review')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit" disabled={otp.length !== 6}>Verify and submit</button></div></form>}
  </div>
}
