import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DEMO_OTP } from '../domain/demoCredentials'
import type { AccountState, GeneratedReport, Member, Nominee } from '../domain/types'
import { normalizeMobile, validateEmail, validateIndianMobile } from '../domain/validation'
import './service-pages.css'

export interface AccountPageProps {
  account: AccountState
  onUpdateContact: (input: { type: 'mobile' | 'email'; value: string; updatedOn: string }) => void
  onUpdateProfile?: (input: Partial<Member> & { updatedOn: string }) => void
  onUpdateCommunicationPreferences: (preferences: Member['communicationPreferences']) => void
  onDownloadReport: (report: GeneratedReport) => void
  onSaveNominees?: (nominees: Nominee[]) => void
  focusSection?: 'nomination'
  onStartPanVerification?: () => void
  onNavigateLegal: (page: 'terms' | 'privacy') => void
  onSignOutOtherSessions?: () => void
}

type ContactStep = 'read' | 'edit' | 'otp' | 'review' | 'saved'
type ContactChannel = 'mobile' | 'email'

const formatDate = (value?: string) => {
  const date = value ? new Date(`${value}T00:00:00`) : undefined
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Not available'
}
const maskMobile = (value: string) => `${value.slice(0, 2)}••• •${value.slice(-4)}`
const maskEmail = (value: string) => {
  if (!value.trim()) return 'Not added'
  const [name, domain = ''] = value.split('@')
  return `${name.slice(0, Math.min(7, Math.max(1, name.length - 3)))}•••@${domain}`
}
const kycLabel = { aadhaar: 'Aadhaar Status', pan: 'PAN Status', bank: 'Bank Verification' } as const
const titleCase = (value: string) => value.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')

export function AccountPage(props: AccountPageProps) {
  const { account } = props
  const [preferences, setPreferences] = useState(account.member.communicationPreferences)
  const [preferencesSaved, setPreferencesSaved] = useState(false)
  const preferencesChanged = Object.entries(preferences).some(([key, value]) => value !== account.member.communicationPreferences[key as keyof Member['communicationPreferences']])
  const savePreferences = () => { props.onUpdateCommunicationPreferences(preferences); setPreferencesSaved(true) }
  useEffect(() => {
    if (props.focusSection === 'nomination') document.getElementById('account-nomination')?.scrollIntoView({ block: 'start' })
  }, [props.focusSection])
  return <section className="service-page account-page" aria-labelledby="account-title">
    <header className="service-page-heading"><h1 id="account-title">Profile and account</h1><p>Review your profile, contact details and account preferences.</p></header>
    <section className="account-section profile-section" aria-labelledby="account-profile"><header><div><h2 id="account-profile">Profile</h2><p>Your profile information is used to match your EPFO member record.</p></div><h3 className="profile-photo-desktop-title" id="profile-photo-title">Passport Photograph</h3></header><ProfileOverview account={account} onUpdateProfile={props.onUpdateProfile} /></section>
    <AccountSection title="Contact Details" description="Add or change your contact details. Every update requires Aadhaar OTP verification."><ContactEditor {...props} /></AccountSection>
    <AccountSection title="KYC and Verification" description="Review the verification status of your identity and bank details."><div className="account-kyc-list">{account.kyc.map((record) => <div key={record.type} className="account-kyc-item"><div><strong>{kycLabel[record.type]}</strong><span>{record.maskedValue}</span><small>{record.explanation}</small></div><div><span className={`ux4g-tag-filled-${record.state === 'verified' ? 'success' : record.state === 'pending' ? 'info' : 'warning'} ux4g-tag-s`}>{record.state === 'pending' ? 'Pending Verification' : titleCase(record.state)}</span>{record.type === 'pan' && record.state === 'unverified' && props.onStartPanVerification && <button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={props.onStartPanVerification}>Verify PAN</button>}</div></div>)}</div></AccountSection>
    <AccountSection title="Nomination"><NominationEditor nominees={account.member.nominees} onSaveNominees={props.onSaveNominees} /></AccountSection>
    <AccountSection title="Communication Preferences" description="Choose which account notifications you receive."><div className="account-preferences">
      <PreferenceSwitch label="Contribution Recorded" description="Notify me when a monthly contribution is recorded." checked={preferences.contributionRecorded} onChange={(checked) => { setPreferences((value) => ({ ...value, contributionRecorded: checked })); setPreferencesSaved(false) }} />
      <PreferenceSwitch label="Request Updates" description="Notify me when a tracked request changes status." checked={preferences.requestUpdates} onChange={(checked) => { setPreferences((value) => ({ ...value, requestUpdates: checked })); setPreferencesSaved(false) }} />
      <PreferenceSwitch label="Report Ready" description="Notify me when a generated report is ready." checked={preferences.reportReady} onChange={(checked) => { setPreferences((value) => ({ ...value, reportReady: checked })); setPreferencesSaved(false) }} />
      <div className="account-section-actions"><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={savePreferences} disabled={!preferencesChanged}>Save Preferences</button>{preferencesSaved && !preferencesChanged && <span className="account-saved-message" role="status">Preferences saved.</span>}</div>
    </div></AccountSection>
    <AccountSection title="Generated Reports" description="Download reports within 90 days of generation."><GeneratedReports reports={account.generatedReports} onDownload={props.onDownloadReport} /></AccountSection>
  </section>
}

function AccountSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const id = `account-${title.toLowerCase().replaceAll(' ', '-')}`
  return <section className="account-section" aria-labelledby={id}><header><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</header>{children}</section>
}

const qualificationLabel: Record<Member['educationalQualification'], string> = { na: 'NA / Never attended school', primary: 'Primary school', secondary: 'Secondary school', 'senior-secondary': 'Senior secondary', diploma: 'Diploma', graduate: 'Graduate', postgraduate: 'Postgraduate', doctorate: 'Doctorate', 'post-doctorate': 'Post-doctorate' }
type EditableProfile = Pick<Member, 'name' | 'uan' | 'dateOfBirth' | 'educationalQualification' | 'maritalStatus' | 'permanentAddress' | 'currentAddress'>

function ProfileOverview({ account, onUpdateProfile }: Pick<AccountPageProps, 'account' | 'onUpdateProfile'>) {
  const { member } = account
  const [editing, setEditing] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<EditableProfile>({ name: member.name, uan: member.uan, dateOfBirth: member.dateOfBirth, educationalQualification: member.educationalQualification, maritalStatus: member.maritalStatus, permanentAddress: member.permanentAddress, currentAddress: member.currentAddress })
  const [photoError, setPhotoError] = useState('')
  const [photoStatus, setPhotoStatus] = useState('')
  const updateDraft = <K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const cancelEditing = () => { setDraft({ name: member.name, uan: member.uan, dateOfBirth: member.dateOfBirth, educationalQualification: member.educationalQualification, maritalStatus: member.maritalStatus, permanentAddress: member.permanentAddress, currentAddress: member.currentAddress }); setEditing(false) }
  const saveProfile = (event: FormEvent) => { event.preventDefault(); onUpdateProfile?.({ ...draft, name: draft.name.trim(), uan: draft.uan.replace(/\D/g, '').slice(0, 12), permanentAddress: draft.permanentAddress.trim(), currentAddress: draft.currentAddress.trim(), updatedOn: new Date().toISOString().slice(0, 10) }); setEditing(false) }
  const changePhoto = (file?: File) => {
    setPhotoError(''); setPhotoStatus('')
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setPhotoError('Choose a JPEG, JPG or PNG photograph.'); return }
    if (file.size > 1024 * 1024) { setPhotoError('Choose a photograph smaller than 1 MB.'); return }
    const image = new Image()
    image.onload = () => {
      const ratio = image.naturalWidth / image.naturalHeight
      if (Math.abs(ratio - (7 / 9)) > 0.08) { setPhotoError('Use a portrait photograph with the 3.5 cm × 4.5 cm (7:9) aspect ratio.'); return }
      onUpdateProfile?.({ passportPhotoUrl: URL.createObjectURL(file), updatedOn: new Date().toISOString().slice(0, 10) })
      setPhotoStatus('Passport photograph updated.')
    }
    image.onerror = () => setPhotoError('We could not read this photograph. Choose another JPEG, JPG or PNG file.')
    image.src = URL.createObjectURL(file)
  }
  const lockedDetails = <dl className="account-detail-list profile-detail-list profile-locked-details"><div><dt>Father’s/Husband’s name</dt><dd>{member.fatherOrHusbandName}</dd></div><div><dt>Relationship</dt><dd>{member.relationship === 'father' ? 'Father' : 'Husband'}</dd></div><div><dt>International worker</dt><dd>{member.internationalWorker ? 'Yes' : 'No'} <small className="profile-locked">Locked after UAN activation</small></dd></div><div><dt>Differently abled</dt><dd>{member.differentlyAbled ? 'Yes' : 'No'} <small className="profile-locked">Locked after UAN activation</small></dd></div></dl>
  const profileDetails = editing ? <form className="profile-editor" onSubmit={saveProfile}><div className="profile-editor-grid"><div className="service-field"><label htmlFor="profile-name">Full name</label><input id="profile-name" className="ux4g-input ux4g-input-md" value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} required /></div><div className="service-field"><label htmlFor="profile-uan">UAN</label><input id="profile-uan" className="ux4g-input ux4g-input-md" inputMode="numeric" maxLength={12} value={draft.uan} onChange={(event) => updateDraft('uan', event.target.value.replace(/\D/g, '').slice(0, 12))} required /></div><div className="service-field"><label htmlFor="profile-dob">Date of birth</label><input id="profile-dob" className="ux4g-input ux4g-input-md" type="date" value={draft.dateOfBirth} onChange={(event) => updateDraft('dateOfBirth', event.target.value)} required /></div><div className="service-field"><label htmlFor="profile-qualification">Educational qualification</label><select id="profile-qualification" className="service-select" value={draft.educationalQualification} onChange={(event) => updateDraft('educationalQualification', event.target.value as Member['educationalQualification'])}>{Object.entries(qualificationLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="service-field"><label htmlFor="profile-marital-status">Marital status</label><select id="profile-marital-status" className="service-select" value={draft.maritalStatus} onChange={(event) => updateDraft('maritalStatus', event.target.value as Member['maritalStatus'])}><option value="unmarried">Unmarried</option><option value="married">Married</option><option value="widow-widower">Widow/Widower</option><option value="divorcee">Divorcee</option></select></div><div className="service-field profile-editor-address"><label htmlFor="profile-permanent-address">Permanent address</label><textarea id="profile-permanent-address" className="service-textarea" rows={3} value={draft.permanentAddress} onChange={(event) => updateDraft('permanentAddress', event.target.value)} required /></div><div className="service-field profile-editor-address"><label htmlFor="profile-current-address">Current address</label><textarea id="profile-current-address" className="service-textarea" rows={3} value={draft.currentAddress} onChange={(event) => updateDraft('currentAddress', event.target.value)} required /></div></div>{lockedDetails}<div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={cancelEditing}>Cancel</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Save Profile</button></div></form> : <><dl className="account-detail-list profile-detail-list"><div><dt>Full name</dt><dd>{member.name}</dd></div><div><dt>UAN</dt><dd>{member.uan.replace(/(\d{4})(?=\d)/g, '$1 ')}</dd></div><div><dt>Date of birth</dt><dd>{formatDate(member.dateOfBirth)}</dd></div><div><dt>Educational qualification</dt><dd>{qualificationLabel[member.educationalQualification]}</dd></div><div><dt>Marital status</dt><dd>{member.maritalStatus === 'widow-widower' ? 'Widow/Widower' : titleCase(member.maritalStatus)}</dd></div><div><dt>Permanent address</dt><dd>{member.permanentAddress}</dd></div><div><dt>Current address</dt><dd>{member.currentAddress}</dd></div></dl>{lockedDetails}<button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => setEditing(true)}>Edit profile</button></>
  return <div className="profile-layout"><div className="profile-details">{profileDetails}</div><aside className="profile-rail"><section className="profile-photo-card" aria-labelledby="profile-photo-title"><h3 className="profile-photo-mobile-title">Passport Photograph</h3><img src={member.passportPhotoUrl} alt="Member passport photograph" /><div className="profile-photo-actions"><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => photoInputRef.current?.click()}>Change Photograph</button><span className="profile-photo-info"><button className="profile-photo-info-trigger" type="button" aria-describedby="photo-requirements" aria-label="Photograph requirements"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="8" r="1.25" fill="currentColor" /><path d="M12 11v6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg></button><span id="photo-requirements" className="profile-photo-tooltip" role="tooltip"><span>JPEG or PNG format</span><span>Face and both ears clearly visible</span><span>3.5 cm × 4.5 cm aspect ratio</span><span>Size less than 1 MB</span></span></span><input ref={photoInputRef} className="profile-photo-input" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={(event) => changePhoto(event.target.files?.[0])} /></div>{photoError && <p className="service-field-error" role="alert">{photoError}</p>}{photoStatus && <p className="account-saved-message" role="status">{photoStatus}</p>}</section><section className="ux4g-alert ux4g-alert-info profile-updated-panel" aria-label="Profile update information"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Profile Last Updated</p><p className="ux4g-alert-message"><time dateTime={member.profileUpdatedOn}>{formatDate(member.profileUpdatedOn)}</time></p></div></section></aside></div>
}

function ContactEditor({ account, onUpdateContact }: AccountPageProps) {
  const [step, setStep] = useState<ContactStep>('read')
  const [channel, setChannel] = useState<ContactChannel>('mobile')
  const [mobile, setMobile] = useState(account.member.mobile.value)
  const [email, setEmail] = useState(account.member.email.value)
  const [otp, setOtp] = useState('')
  const [errors, setErrors] = useState<{ mobile?: string; email?: string; otp?: string }>({})
  const mobileChanged = mobile !== account.member.mobile.value
  const emailChanged = email.trim() !== account.member.email.value
  const validate = () => {
    const next: { mobile?: string; email?: string } = channel === 'mobile'
      ? { mobile: mobileChanged ? validateIndianMobile(mobile) ?? undefined : 'Enter a different mobile number to continue.' }
      : { email: emailChanged ? validateEmail(email) ?? undefined : 'Enter a different email ID to continue.' }
    setErrors(next)
    if (!next.mobile && !next.email) setStep('otp')
  }
  const updateMobile = (value: string) => {
    const next = normalizeMobile(value)
    setMobile(next)
    setErrors((current) => ({ ...current, mobile: next ? validateIndianMobile(next) ?? undefined : undefined }))
  }
  const updateEmail = (value: string) => {
    setEmail(value)
    setErrors((current) => ({ ...current, email: value ? validateEmail(value) ?? undefined : undefined }))
  }
  const verifyOtp = (event: FormEvent) => { event.preventDefault(); if (otp !== DEMO_OTP) { setErrors({ otp: 'We could not verify this OTP. Check the code and try again.' }); return } setErrors({}); setStep('review') }
  const save = () => { const updatedOn = new Date().toISOString().slice(0, 10); onUpdateContact({ type: channel, value: channel === 'mobile' ? mobile : email.trim(), updatedOn }); setStep('saved') }
  const reset = () => { setChannel('mobile'); setMobile(account.member.mobile.value); setEmail(account.member.email.value); setOtp(''); setErrors({}); setStep('read') }
  const selectChannel = (next: ContactChannel) => { setChannel(next); setMobile(account.member.mobile.value); setEmail(account.member.email.value); setOtp(''); setErrors({}) }

  if (step === 'read') return <div className="contact-readonly"><div className="contact-readonly-mobile"><div><span>Mobile Number</span><strong>{maskMobile(account.member.mobile.value)}</strong><span className="ux4g-tag-filled-success ux4g-tag-s">Verified</span></div><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => { selectChannel('mobile'); setStep('edit') }}>Edit Mobile Number</button></div><div className="contact-readonly-email"><div><span>Email ID</span><strong>{maskEmail(account.member.email.value)}</strong>{account.member.email.verified && <span className="ux4g-tag-filled-success ux4g-tag-s">Verified</span>}</div><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => { selectChannel('email'); setStep('edit') }}>{account.member.email.verified ? 'Edit Email ID' : 'Add Email ID'}</button></div></div>
  if (step === 'saved') return <div className="ux4g-alert ux4g-alert-success" role="status"><div className="ux4g-alert-content"><p className="ux4g-alert-title">{channel === 'mobile' ? 'Mobile Number Updated' : 'Email Address Updated'}</p><p className="ux4g-alert-message">Your verified contact details have been updated.</p><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={reset}>Done</button></div></div>
  if (step === 'otp') return <form className="contact-editor" data-otp-destination={channel === 'email' ? 'email' : 'aadhaar-linked-mobile'} onSubmit={verifyOtp}><div className="ux4g-alert ux4g-alert-info contact-verification-alert"><div className="ux4g-alert-content"><p className="ux4g-alert-title">{channel === 'email' ? 'Email OTP verification required' : 'Aadhaar OTP verification required'}</p><p className="ux4g-alert-message">{channel === 'email' ? `A one-time password was sent to ${email.trim()}.` : 'An Aadhaar OTP was sent to the Aadhaar-linked mobile number on your account.'}</p></div></div><div className="service-field"><label htmlFor="contact-otp">{channel === 'email' ? 'Email OTP' : 'Aadhaar OTP'}</label><input id="contact-otp" className={`ux4g-input ux4g-input-md ${errors.otp ? 'ux4g-input-error' : ''}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrors({}) }} aria-invalid={Boolean(errors.otp)} aria-describedby={errors.otp ? 'contact-otp-error' : 'contact-otp-help'} />{errors.otp ? <p id="contact-otp-error" className="service-field-error" role="alert">{errors.otp}</p> : <p id="contact-otp-help" className="service-field-help">Enter the six-digit {channel === 'email' ? 'email' : 'Aadhaar'} OTP to confirm this update.</p>}</div><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('edit')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Verify {channel === 'email' ? 'Email' : 'Aadhaar'} OTP</button></div></form>
  if (step === 'review') return <div className="contact-editor"><h3>Review your change</h3><dl className="service-review-list contact-review-list"><div><dt>{channel === 'mobile' ? 'Mobile Number' : 'Email ID'}</dt><dd>{channel === 'mobile' ? mobile : email.trim()}<small>Verified</small></dd></div></dl><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('edit')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={save}>Save Contact Details</button></div></div>
  return <form className="contact-editor" onSubmit={(event) => { event.preventDefault(); validate() }} noValidate><fieldset className="contact-channel-choice"><legend>Select the detail you want to update.</legend><label className="ux4g-radio ux4g-radio-md"><input className="ux4g-radio-input" type="radio" name="contact-channel" checked={channel === 'mobile'} onChange={() => selectChannel('mobile')} /><span className="ux4g-radio-control"><span className="ux4g-radiomark" /></span><span className="ux4g-radio-content">Mobile number</span></label><label className="ux4g-radio ux4g-radio-md"><input className="ux4g-radio-input" type="radio" name="contact-channel" checked={channel === 'email'} onChange={() => selectChannel('email')} /><span className="ux4g-radio-control"><span className="ux4g-radiomark" /></span><span className="ux4g-radio-content">Email ID</span></label></fieldset>{channel === 'mobile' ? <div className="service-field"><label htmlFor="account-mobile">New Mobile Number</label><input id="account-mobile" className={`ux4g-input ux4g-input-md ${errors.mobile ? 'ux4g-input-error' : ''}`} type="tel" inputMode="numeric" value={mobile} onChange={(event) => updateMobile(event.target.value)} aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? 'account-mobile-error' : 'account-mobile-help'} />{errors.mobile ? <p id="account-mobile-error" className="service-field-error" role="alert">{errors.mobile}</p> : <p id="account-mobile-help" className="service-field-help">Enter exactly 10 digits, beginning with 6, 7, 8 or 9.</p>}</div> : <div className="service-field"><label htmlFor="account-email">New Email ID</label><input id="account-email" className={`ux4g-input ux4g-input-md ${errors.email ? 'ux4g-input-error' : ''}`} type="email" value={email} onChange={(event) => updateEmail(event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'account-email-error' : 'account-email-help'} />{errors.email ? <p id="account-email-error" className="service-field-error" role="alert">{errors.email}</p> : <p id="account-email-help" className="service-field-help">Use an email address you can access. We will send the verification code there.</p>}</div>}<div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={reset}>Cancel</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Validate and Send OTP</button></div></form>
}

function PreferenceSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="ux4g-switch ux4g-switch-md account-preference"><input className="ux4g-switch-input" type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="ux4g-switch-control"><span className="ux4g-switch-track"><span className="ux4g-switch-thumb" /></span></span><span className="ux4g-switch-content"><strong>{label}</strong><small>{description}</small></span></label>
}

const emptyNominee = (index: number): Nominee => ({ id: `nominee-${Date.now()}-${index}`, name: '', relationship: 'spouse', address: '', bankAccountNumber: '', ifscCode: '', sharePercentage: 0, updatedOn: '' })

function NominationEditor({ nominees, onSaveNominees }: { nominees: Nominee[]; onSaveNominees?: (nominees: Nominee[]) => void }) {
  const [step, setStep] = useState<'summary' | 'details' | 'review'>('summary')
  const [drafts, updateDrafts] = useState<Nominee[]>(nominees.length ? nominees : [{ ...emptyNominee(0), sharePercentage: 100 }])
  const setDrafts = (next: Parameters<typeof updateDrafts>[0]) => {
    updateDrafts(next)
    if (Array.isArray(next) && nominees.length === 0 && step === 'details') setStep('summary')
  }
  const [showErrors, setShowErrors] = useState(false)
  const totalShare = drafts.reduce((sum, nominee) => sum + Number(nominee.sharePercentage || 0), 0)
  const nomineeIsValid = (nominee: Nominee) => Boolean(nominee.name.trim() && nominee.address.trim() && /^\d{9,18}$/.test(nominee.bankAccountNumber) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(nominee.ifscCode) && nominee.sharePercentage > 0 && nominee.sharePercentage <= 100)
  const valid = drafts.length > 0 && drafts.every(nomineeIsValid) && totalShare === 100
  const updateDraft = (id: string, changes: Partial<Nominee>) => setDrafts((current) => current.map((nominee) => nominee.id === id ? { ...nominee, ...changes } : nominee))
  const startEditing = (addAnother = false) => { setDrafts(addAnother ? [...nominees, emptyNominee(nominees.length)] : nominees.length ? nominees : [{ ...emptyNominee(0), sharePercentage: 100 }]); setShowErrors(false); setStep('details') }
  const review = (event: FormEvent) => { event.preventDefault(); setShowErrors(true); if (valid) setStep('review') }
  const save = () => { const updatedOn = new Date().toISOString().slice(0, 10); onSaveNominees?.(drafts.map((nominee) => ({ ...nominee, name: nominee.name.trim(), address: nominee.address.trim(), bankAccountNumber: nominee.bankAccountNumber.trim(), ifscCode: nominee.ifscCode.trim().toUpperCase(), updatedOn }))); setStep('summary') }

  if (step === 'summary' && nominees.length === 0) return <div className="account-inline-state"><div><strong>No Nominee Added</strong></div><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => startEditing(false)}>Add Nominee</button></div>
  if (step === 'summary') return <div className="nominee-summary"><div className="nominee-summary-list">{nominees.map((nominee) => <article key={nominee.id}><div><strong>{nominee.name}</strong><span>{titleCase(nominee.relationship)} · {nominee.sharePercentage}% share</span><small>{nominee.address}</small><small>Bank account ending {nominee.bankAccountNumber.slice(-4)} · {nominee.ifscCode}</small></div></article>)}</div><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => startEditing(false)}>Modify Details</button><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => startEditing(true)}>Add Nominee</button></div></div>

  if (step === 'review') return <div className="contact-editor"><h3>Review Nomination</h3><div className="nominee-review-list">{drafts.map((nominee) => <article key={nominee.id}><h4>{nominee.name}</h4><dl className="service-review-list contact-review-list"><div><dt>Relationship</dt><dd>{titleCase(nominee.relationship)}</dd></div><div><dt>Share</dt><dd>{nominee.sharePercentage}%</dd></div><div><dt>Address</dt><dd>{nominee.address}</dd></div><div><dt>Bank Account</dt><dd>{nominee.bankAccountNumber}</dd></div><div><dt>IFSC Code</dt><dd>{nominee.ifscCode}</dd></div></dl></article>)}</div><p className="nominee-share-total">Total share <strong>{totalShare}%</strong></p><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('details')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={save}>Save Nomination</button></div></div>

  return <form className="contact-editor" onSubmit={review} noValidate><div className="nominee-editor-list">{drafts.map((nominee, index) => <fieldset className="nominee-editor" key={nominee.id}><legend>Nominee {index + 1}</legend><div className="nominee-form-grid"><div className="service-field"><label htmlFor={`nominee-name-${nominee.id}`}>Nominee Name</label><input id={`nominee-name-${nominee.id}`} className="ux4g-input ux4g-input-md" value={nominee.name} onChange={(event) => updateDraft(nominee.id, { name: event.target.value })} /></div><div className="service-field"><label htmlFor={`nominee-relationship-${nominee.id}`}>Relationship</label><select id={`nominee-relationship-${nominee.id}`} className="service-select nominee-select" value={nominee.relationship} onChange={(event) => updateDraft(nominee.id, { relationship: event.target.value as Nominee['relationship'] })}><option value="spouse">Spouse</option><option value="parent">Parent</option><option value="child">Child</option><option value="other">Other</option></select></div><div className="service-field nominee-address-field"><label htmlFor={`nominee-address-${nominee.id}`}>Address</label><textarea id={`nominee-address-${nominee.id}`} className="service-textarea" rows={3} value={nominee.address} onChange={(event) => updateDraft(nominee.id, { address: event.target.value })} /></div><div className="service-field"><label htmlFor={`nominee-bank-${nominee.id}`}>Bank Account Number</label><input id={`nominee-bank-${nominee.id}`} className="ux4g-input ux4g-input-md" inputMode="numeric" value={nominee.bankAccountNumber} onChange={(event) => updateDraft(nominee.id, { bankAccountNumber: event.target.value.replace(/\D/g, '').slice(0, 18) })} /></div><div className="service-field"><label htmlFor={`nominee-ifsc-${nominee.id}`}>IFSC Code</label><input id={`nominee-ifsc-${nominee.id}`} className="ux4g-input ux4g-input-md" value={nominee.ifscCode} maxLength={11} onChange={(event) => updateDraft(nominee.id, { ifscCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></div><div className="service-field"><label htmlFor={`nominee-share-${nominee.id}`}>Share Percentage</label><input id={`nominee-share-${nominee.id}`} className="ux4g-input ux4g-input-md" type="number" min="1" max="100" value={nominee.sharePercentage || ''} onChange={(event) => updateDraft(nominee.id, { sharePercentage: Number(event.target.value) })} /></div></div>{drafts.length > 1 && <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm" type="button" onClick={() => setDrafts((current) => current.filter((item) => item.id !== nominee.id))}>Remove Nominee</button>}</fieldset>)}</div><div className={`nominee-share-status ${totalShare === 100 ? 'is-valid' : ''}`} role="status"><span>Total allocated share</span><strong>{totalShare}%</strong></div>{showErrors && !valid && <div className="ux4g-alert ux4g-alert-error" role="alert"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Check nominee details</p><p className="ux4g-alert-message">Complete all fields. Enter a valid bank account number and IFSC code, and make sure the total share is exactly 100%.</p></div></div>}<div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => nominees.length ? setStep('summary') : setDrafts([{ ...emptyNominee(0), sharePercentage: 100 }])}>Cancel</button><button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={() => setDrafts((current) => [...current, emptyNominee(current.length)])}>Add Another Nominee</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Review Nomination</button></div></form>
}

function GeneratedReports({ reports, onDownload }: { reports: GeneratedReport[]; onDownload: (report: GeneratedReport) => void }) {
  if (reports.length === 0) return <div className="account-inline-state"><div><strong>No reports yet</strong><p>Create a statement in Passbook to see it here.</p></div></div>
  return <div className="account-report-list">{reports.map((report) => <article key={report.id}><div><strong>{report.name}</strong><span>{report.periodLabel} · {report.format === 'pdf' ? 'PDF' : 'Excel'}</span><small>{report.state === 'preparing' ? `Requested ${formatDate(report.requestedOn)}` : report.generatedOn ? `Generated ${formatDate(report.generatedOn)} · Expires ${formatDate(report.expiresOn)}` : `Expires ${formatDate(report.expiresOn)}`}</small><small>{report.deliveryState === 'mock-sent-to-verified-email' ? 'Sent to your verified email' : 'Email delivery was not requested'}</small></div><div className="account-report-actions"><span className={`ux4g-tag-filled-${report.state === 'ready' ? 'success' : report.state === 'preparing' ? 'info' : 'warning'} ux4g-tag-s`}>{titleCase(report.state)}</span><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm" type="button" disabled={report.state !== 'ready'} onClick={() => onDownload(report)}>Download</button></div></article>)}</div>
}
