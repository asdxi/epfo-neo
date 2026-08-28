import { useState, type FormEvent } from 'react'
import { DEMO_OTP } from '../domain/demoCredentials'
import type { AccountState, GeneratedReport, Member } from '../domain/types'
import { normalizeMobile, validateEmail, validateIndianMobile } from '../domain/validation'
import './service-pages.css'

export interface AccountPageProps {
  account: AccountState
  onUpdateContact: (input: { type: 'mobile' | 'email'; value: string; updatedOn: string }) => void
  onUpdateCommunicationPreferences: (preferences: Member['communicationPreferences']) => void
  onDownloadReport: (report: GeneratedReport) => void
  onManageNomination?: () => void
  onStartPanVerification?: () => void
  onNavigateLegal: (page: 'terms' | 'privacy') => void
  onSignOutOtherSessions?: () => void
}

type ContactStep = 'read' | 'edit' | 'otp' | 'review' | 'saved'

const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const maskMobile = (value: string) => `${value.slice(0, 2)}••• •${value.slice(-4)}`
const maskEmail = (value: string) => { const [name, domain = ''] = value.split('@'); return `${name.slice(0, Math.min(7, Math.max(1, name.length - 3)))}•••@${domain}` }
const kycLabel = { aadhaar: 'Aadhaar Status', pan: 'PAN Status', bank: 'Bank Verification' } as const
const titleCase = (value: string) => value.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')

export function AccountPage(props: AccountPageProps) {
  const { account } = props
  const [preferences, setPreferences] = useState(account.member.communicationPreferences)
  const [preferencesSaved, setPreferencesSaved] = useState(false)
  const savePreferences = () => { props.onUpdateCommunicationPreferences(preferences); setPreferencesSaved(true) }
  return <section className="service-page account-page" aria-labelledby="account-title">
    <header className="service-page-heading"><p className="service-eyebrow">Member account</p><h1 id="account-title">Account</h1><p>Manage your details, verification, reports, preferences and sign-in security in one place.</p></header>
    <AccountSection title="Personal Details" description="Identity details are read-only in this prototype."><dl className="account-detail-list"><div><dt>Full Name</dt><dd>{account.member.name}</dd></div><div><dt>Universal Account Number (UAN)</dt><dd>{account.member.uan.replace(/(\d{4})(?=\d)/g, '$1 ')}</dd></div><div><dt>Date of Birth</dt><dd>{formatDate(account.member.dateOfBirth)}</dd></div></dl></AccountSection>
    <AccountSection title="Contact Details" description="Verified details remain masked until you choose to edit them."><ContactEditor {...props} /></AccountSection>
    <AccountSection title="KYC and Verification" description="Each record has its own status and processing state."><div className="account-kyc-list">{account.kyc.map((record) => <div key={record.type} className="account-kyc-item"><div><strong>{kycLabel[record.type]}</strong><span>{record.maskedValue}</span><small>{record.explanation}</small></div><div><span className={`ux4g-tag-filled-${record.state === 'verified' ? 'success' : record.state === 'pending' ? 'info' : 'warning'} ux4g-tag-s`}>{titleCase(record.state)}</span>{record.type === 'pan' && record.state === 'unverified' && props.onStartPanVerification && <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm" type="button" onClick={props.onStartPanVerification}>Verify PAN</button>}</div></div>)}</div></AccountSection>
    <AccountSection title="Nomination" description="Nomination is an account capability and is separate from the five primary services."><div className="account-inline-state"><div><strong>Nomination Details Unavailable</strong><p>No nomination record is available in this synthetic account. This is not the same as a confirmed zero or not-applicable state.</p></div>{props.onManageNomination && <button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={props.onManageNomination}>Manage Nomination</button>}</div></AccountSection>
    <AccountSection title="Communication Preferences" description="Choose which mocked account notifications are recorded as enabled."><div className="account-preferences">
      <PreferenceSwitch label="Contribution Recorded" description="Notify me when a monthly contribution is recorded." checked={preferences.contributionRecorded} onChange={(checked) => { setPreferences((value) => ({ ...value, contributionRecorded: checked })); setPreferencesSaved(false) }} />
      <PreferenceSwitch label="Request Updates" description="Notify me when a tracked request changes status." checked={preferences.requestUpdates} onChange={(checked) => { setPreferences((value) => ({ ...value, requestUpdates: checked })); setPreferencesSaved(false) }} />
      <PreferenceSwitch label="Report Ready" description="Notify me when a generated report is ready." checked={preferences.reportReady} onChange={(checked) => { setPreferences((value) => ({ ...value, reportReady: checked })); setPreferencesSaved(false) }} />
      <div className="account-section-actions"><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={savePreferences}>Save Preferences</button>{preferencesSaved && <span className="account-saved-message" role="status">Communication Preferences Updated</span>}</div>
    </div></AccountSection>
    <AccountSection title="Generated Reports" description="Passbook reports remain available for 90 days after generation."><GeneratedReports reports={account.generatedReports} onDownload={props.onDownloadReport} /></AccountSection>
    <AccountSection title="Login and Security Settings" description="This prototype uses mobile OTP and never collects real EPFO credentials."><dl className="account-detail-list"><div><dt>Sign-in Method</dt><dd>Mobile One-Time Password</dd></div><div><dt>Verified Mobile</dt><dd>{maskMobile(account.member.mobile.value)}</dd></div><div><dt>Last Credential Update</dt><dd>{formatDate(account.member.mobile.updatedOn)}</dd></div></dl>{props.onSignOutOtherSessions && <div className="account-section-actions"><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={props.onSignOutOtherSessions}>Sign Out Other Sessions</button></div>}</AccountSection>
    <AccountSection title="Legal and Privacy" description="Read how this proof of concept handles synthetic information."><div className="account-legal-links"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => props.onNavigateLegal('terms')}>Terms of Use</button><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => props.onNavigateLegal('privacy')}>Privacy Policy</button></div></AccountSection>
  </section>
}

function AccountSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const id = `account-${title.toLowerCase().replaceAll(' ', '-')}`
  return <section className="account-section" aria-labelledby={id}><header><h2 id={id}>{title}</h2><p>{description}</p></header>{children}</section>
}

function ContactEditor({ account, onUpdateContact }: AccountPageProps) {
  const [step, setStep] = useState<ContactStep>('read')
  const [mobile, setMobile] = useState(account.member.mobile.value)
  const [email, setEmail] = useState(account.member.email.value)
  const [otp, setOtp] = useState('')
  const [errors, setErrors] = useState<{ mobile?: string; email?: string; otp?: string }>({})
  const mobileChanged = mobile !== account.member.mobile.value
  const emailChanged = email.trim() !== account.member.email.value
  const validate = () => {
    const next = { mobile: mobileChanged ? validateIndianMobile(mobile) ?? undefined : undefined, email: emailChanged ? validateEmail(email) ?? undefined : undefined }
    if (!mobileChanged && !emailChanged) next.email = 'Change at least one contact detail to continue.'
    setErrors(next)
    if (!next.mobile && !next.email) setStep('otp')
  }
  const verifyOtp = (event: FormEvent) => { event.preventDefault(); if (otp !== DEMO_OTP) { setErrors({ otp: 'We could not verify this OTP. Check the code and try again.' }); return } setErrors({}); setStep('review') }
  const save = () => { const updatedOn = new Date().toISOString().slice(0, 10); if (mobileChanged) onUpdateContact({ type: 'mobile', value: mobile, updatedOn }); if (emailChanged) onUpdateContact({ type: 'email', value: email.trim(), updatedOn }); setStep('saved') }
  const reset = () => { setMobile(account.member.mobile.value); setEmail(account.member.email.value); setOtp(''); setErrors({}); setStep('read') }

  if (step === 'read') return <div className="contact-readonly"><div><span>Mobile Number</span><strong>{maskMobile(account.member.mobile.value)}</strong><span className="ux4g-tag-filled-success ux4g-tag-s">Verified</span></div><div><span>Email</span><strong>{maskEmail(account.member.email.value)}</strong><span className="ux4g-tag-filled-success ux4g-tag-s">Verified</span></div><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => setStep('edit')}>Edit Contact Details</button></div>
  if (step === 'saved') return <div className="ux4g-alert ux4g-alert-success" role="status"><div className="ux4g-alert-content"><p className="ux4g-alert-title">{mobileChanged && emailChanged ? 'Contact Details Updated' : mobileChanged ? 'Mobile Number Updated' : 'Email Address Updated'}</p><p className="ux4g-alert-message">The changed contact details are saved as verified in this synthetic account.</p><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={reset}>Done</button></div></div>
  if (step === 'otp') return <form className="contact-editor" onSubmit={verifyOtp}><div className="ux4g-alert ux4g-alert-info"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Verification Required</p><p className="ux4g-alert-message">A mocked OTP was sent to the existing verified contact channels.</p></div></div><div className="service-field"><label htmlFor="contact-otp">Six-Digit OTP</label><input id="contact-otp" className={`ux4g-input ux4g-input-md ${errors.otp ? 'ux4g-input-error' : ''}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrors({}) }} aria-invalid={Boolean(errors.otp)} aria-describedby={errors.otp ? 'contact-otp-error' : 'contact-otp-help'} />{errors.otp ? <p id="contact-otp-error" className="service-field-error" role="alert">{errors.otp}</p> : <p id="contact-otp-help" className="service-field-help">Enter the six-digit code sent for this verification.</p>}</div><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('edit')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Verify OTP</button></div></form>
  if (step === 'review') return <div className="contact-editor"><h3>Review Contact Changes</h3><dl className="service-review-list">{mobileChanged && <div><dt>Mobile Number</dt><dd>{maskMobile(mobile)}<small>Verified with demo OTP</small></dd></div>}{emailChanged && <div><dt>Email</dt><dd>{maskEmail(email)}<small>Verified with demo OTP</small></dd></div>}</dl><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('edit')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={save}>Save Contact Details</button></div></div>
  return <form className="contact-editor" onSubmit={(event) => { event.preventDefault(); validate() }} noValidate><div className="service-form-grid"><div className="service-field"><label htmlFor="account-mobile">Mobile Number</label><input id="account-mobile" className={`ux4g-input ux4g-input-md ${errors.mobile ? 'ux4g-input-error' : ''}`} type="tel" inputMode="numeric" value={mobile} onChange={(event) => { setMobile(normalizeMobile(event.target.value)); setErrors({}) }} aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? 'account-mobile-error' : 'account-mobile-help'} />{errors.mobile ? <p id="account-mobile-error" className="service-field-error" role="alert">{errors.mobile}</p> : <p id="account-mobile-help" className="service-field-help">Enter exactly 10 digits, beginning with 6, 7, 8 or 9.</p>}</div><div className="service-field"><label htmlFor="account-email">Email</label><input id="account-email" className={`ux4g-input ux4g-input-md ${errors.email ? 'ux4g-input-error' : ''}`} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors({}) }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'account-email-error' : 'account-email-help'} />{errors.email ? <p id="account-email-error" className="service-field-error" role="alert">{errors.email}</p> : <p id="account-email-help" className="service-field-help">We trim surrounding spaces before saving.</p>}</div></div><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={reset}>Cancel</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Validate and Send OTP</button></div></form>
}

function PreferenceSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="ux4g-switch ux4g-switch-md account-preference"><input className="ux4g-switch-input" type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="ux4g-switch-control"><span className="ux4g-switch-track"><span className="ux4g-switch-thumb" /></span></span><span className="ux4g-switch-content"><strong>{label}</strong><small>{description}</small></span></label>
}

function GeneratedReports({ reports, onDownload }: { reports: GeneratedReport[]; onDownload: (report: GeneratedReport) => void }) {
  if (reports.length === 0) return <div className="account-inline-state"><div><strong>No Generated Reports</strong><p>Create a statement from Passbook. Reports in preparation or ready to download will appear here.</p></div></div>
  return <div className="account-report-list">{reports.map((report) => <article key={report.id}><div><strong>{report.name}</strong><span>{report.periodLabel} · {report.format === 'pdf' ? 'PDF' : 'Excel'}</span><small>{report.state === 'preparing' ? `Requested ${formatDate(report.requestedOn)}` : report.generatedOn ? `Generated ${formatDate(report.generatedOn)} · Expires ${formatDate(report.expiresOn)}` : `Expires ${formatDate(report.expiresOn)}`}</small><small>{report.deliveryState === 'mock-sent-to-verified-email' ? 'Mock delivery recorded for verified email' : 'Email delivery not requested'}</small></div><div><span className={`ux4g-tag-filled-${report.state === 'ready' ? 'success' : report.state === 'preparing' ? 'info' : 'warning'} ux4g-tag-s`}>{titleCase(report.state)}</span><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm" type="button" disabled={report.state !== 'ready'} onClick={() => onDownload(report)}>Download</button></div></article>)}</div>
}
