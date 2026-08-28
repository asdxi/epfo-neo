import { useRef, useState, type FormEvent, type HTMLAttributes } from 'react'
import { DEMO_OTP } from '../domain/demoCredentials'
import type { Member } from '../domain/types'
import { validateIndianMobile } from '../domain/validation'
import './login-screen.css'

type Step = 'activate' | 'profile' | 'verify' | 'complete'

export interface OnboardingScreenProps {
  onComplete: (profile: Pick<Member, 'fatherOrHusbandName' | 'relationship' | 'internationalWorker' | 'educationalQualification' | 'maritalStatus' | 'permanentAddress' | 'currentAddress' | 'differentlyAbled'>) => void
  onBack: () => void
}

const qualifications: Array<{ value: Member['educationalQualification']; label: string }> = [
  { value: 'na', label: 'NA / Never attended school' }, { value: 'primary', label: 'Primary school' }, { value: 'secondary', label: 'Secondary school' }, { value: 'senior-secondary', label: 'Senior secondary' }, { value: 'diploma', label: 'Diploma' }, { value: 'graduate', label: 'Graduate' }, { value: 'postgraduate', label: 'Postgraduate' }, { value: 'doctorate', label: 'Doctorate' }, { value: 'post-doctorate', label: 'Post-doctorate' },
]

const onboardingSteps = ['Account details', 'Profile details', 'Verify', 'Complete']

export function OnboardingScreen({ onComplete, onBack }: OnboardingScreenProps) {
  const [step, setStep] = useState<Step>('activate')
  const [uan, setUan] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [mobile, setMobile] = useState('')
  const [consent, setConsent] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [profile, setProfile] = useState<Pick<Member, 'fatherOrHusbandName' | 'relationship' | 'internationalWorker' | 'educationalQualification' | 'maritalStatus' | 'permanentAddress' | 'currentAddress' | 'differentlyAbled'>>({ fatherOrHusbandName: '', relationship: 'father', internationalWorker: false, educationalQualification: 'graduate', maritalStatus: 'unmarried', permanentAddress: '', currentAddress: '', differentlyAbled: false })
  const [profileTouched, setProfileTouched] = useState<Record<string, boolean>>({})
  const otpInputs = useRef<Array<HTMLInputElement | null>>([])
  const stepIndex = ['activate', 'profile', 'verify', 'complete'].indexOf(step)
  const otpValue = otp.join('')

  const updateProfile = <K extends keyof typeof profile>(key: K, value: typeof profile[K]) => setProfile((current) => ({ ...current, [key]: value }))
  const touch = (field: string) => setTouched((current) => ({ ...current, [field]: true }))
  const activationErrors = {
    uan: /^\d{12}$/.test(uan) ? '' : 'Enter your 12-digit UAN.',
    aadhaar: /^\d{12}$/.test(aadhaar) ? '' : 'Enter your 12-digit Aadhaar number.',
    name: name.trim() ? '' : 'Enter your name as per Aadhaar.',
    dob: dob ? '' : 'Select your date of birth.',
    mobile: validateIndianMobile(mobile) ?? '',
    consent: consent ? '' : 'You must agree to Aadhaar OTP verification to continue.',
  }
  const activationFieldsComplete = Object.entries(activationErrors).every(([field, message]) => field === 'consent' || !message)
  const canContinue = activationFieldsComplete && !activationErrors.consent
  const profileErrors = {
    fatherOrHusbandName: profile.fatherOrHusbandName.trim() ? '' : 'Enter your father’s or husband’s name.',
    permanentAddress: profile.permanentAddress.trim() ? '' : 'Enter your permanent address.',
    currentAddress: profile.currentAddress.trim() ? '' : 'Enter your current address.',
  }
  const profileFieldsComplete = Object.values(profileErrors).every((message) => !message)
  const touchProfile = (field: string) => setProfileTouched((current) => ({ ...current, [field]: true }))
  const activate = (event: FormEvent) => {
    event.preventDefault()
    setTouched({ uan: true, aadhaar: true, name: true, dob: true, mobile: true, consent: true })
    if (!canContinue) return
    setStep('profile')
  }
  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    setProfileTouched({ fatherOrHusbandName: true, permanentAddress: true, currentAddress: true })
    if (!profileFieldsComplete) return
    setStep('verify')
    requestAnimationFrame(() => otpInputs.current[0]?.focus())
  }
  const updateOtp = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const nextOtp = [...otp]
    nextOtp[index] = digit
    setOtp(nextOtp)
    if (digit && index < nextOtp.length - 1) otpInputs.current[index + 1]?.focus()
  }
  const pasteOtp = (index: number, pastedValue: string) => {
    const digits = pastedValue.replace(/\D/g, '').slice(0, otp.length - index)
    if (!digits) return
    const nextOtp = [...otp]
    digits.split('').forEach((digit, offset) => { nextOtp[index + offset] = digit })
    setOtp(nextOtp)
    otpInputs.current[Math.min(index + digits.length, otp.length - 1)]?.focus()
  }
  const verify = (event: FormEvent) => { event.preventDefault(); if (otpValue !== DEMO_OTP) return; setStep('complete') }

  return <main className="otp-login onboarding" aria-labelledby="onboarding-title">
    <section className="otp-login__hero"><span className="brand-mark" aria-hidden="true">EPFO</span><h1 id="onboarding-title">Activate your UAN</h1><p>Four short steps to set up access to your EPFO member account.</p></section>
    <section className="ux4g-card ux4g-card-solid otp-login__card"><div className="ux4g-card-body">
      <OnboardingStepper activeIndex={stepIndex} />
      {step === 'activate' && <form className="otp-login__form" onSubmit={activate} noValidate><div className="otp-login__step-heading"><h2>Confirm your details</h2><p className="otp-login__supporting">Step 1 of 4. Use the details linked to your UAN. Your Aadhaar number is used only to demonstrate this flow and is not saved.</p></div><div className="service-form-grid"><Field id="register-uan" label="UAN" value={uan} onChange={setUan} onBlur={() => touch('uan')} error={touched.uan ? activationErrors.uan : ''} required inputMode="numeric" maxLength={12} /><Field id="register-aadhaar" label="Aadhaar number" value={aadhaar} onChange={setAadhaar} onBlur={() => touch('aadhaar')} error={touched.aadhaar ? activationErrors.aadhaar : ''} required inputMode="numeric" maxLength={12} /><Field id="register-name" label="Name as per Aadhaar" value={name} onChange={setName} onBlur={() => touch('name')} error={touched.name ? activationErrors.name : ''} required /><Field id="register-dob" label="Date of birth" value={dob} onChange={setDob} onBlur={() => touch('dob')} error={touched.dob ? activationErrors.dob : ''} required type="date" /><Field id="register-mobile" label="Aadhaar-linked mobile number" value={mobile} onChange={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))} onBlur={() => touch('mobile')} error={touched.mobile ? activationErrors.mobile : ''} required inputMode="numeric" maxLength={10} /></div><label className={`ux4g-checkbox ux4g-checkbox-md ${touched.consent && activationErrors.consent ? 'ux4g-checkbox-error' : ''}`}><input className="ux4g-checkbox-input" type="checkbox" checked={consent} onBlur={() => touch('consent')} onChange={(event) => setConsent(event.target.checked)} aria-invalid={Boolean(touched.consent && activationErrors.consent)} aria-describedby={touched.consent && activationErrors.consent ? 'register-consent-error' : undefined} /><span className="ux4g-checkbox-control"><span className="ux4g-checkmark" /></span><span className="ux4g-checkbox-content"><span className="ux4g-checkbox-header"><span className="ux4g-checkbox-label">I agree to Aadhaar OTP verification for UAN activation. <span className="ux4g-checkbox-required" aria-hidden="true">*</span></span></span>{touched.consent && activationErrors.consent && <span id="register-consent-error" className="ux4g-checkbox-description ux4g-checkbox-desc-error service-field-error" role="alert">{activationErrors.consent}</span>}</span></label><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={onBack}>Back to sign in</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit" disabled={!activationFieldsComplete}>Continue</button></div></form>}
      {step === 'profile' && <form className="otp-login__form" onSubmit={saveProfile} noValidate><div className="otp-login__step-heading"><h2>Complete your profile</h2><p className="otp-login__supporting">Step 2 of 4. International-worker status is recorded at activation and cannot be changed later.</p></div><div className="service-form-grid"><Field id="register-family-name" label="Father’s/husband’s name" value={profile.fatherOrHusbandName} onChange={(value) => updateProfile('fatherOrHusbandName', value)} onBlur={() => touchProfile('fatherOrHusbandName')} error={profileTouched.fatherOrHusbandName ? profileErrors.fatherOrHusbandName : ''} required /><Select id="register-relationship" label="Relationship" value={profile.relationship} onChange={(value) => updateProfile('relationship', value as Member['relationship'])} options={[['father', 'Father'], ['husband', 'Husband']]} /><Select id="register-international" label="International worker" value={profile.internationalWorker ? 'yes' : 'no'} onChange={(value) => updateProfile('internationalWorker', value === 'yes')} options={[['no', 'No'], ['yes', 'Yes']]} /><Select id="register-qualification" label="Educational qualification" value={profile.educationalQualification} onChange={(value) => updateProfile('educationalQualification', value as Member['educationalQualification'])} options={qualifications.map((item) => [item.value, item.label])} /><Select id="register-marital" label="Marital status" value={profile.maritalStatus} onChange={(value) => updateProfile('maritalStatus', value as Member['maritalStatus'])} options={[['unmarried', 'Unmarried'], ['married', 'Married'], ['widow-widower', 'Widow/Widower'], ['divorcee', 'Divorcee']]} /><Select id="register-abled" label="Differently abled" value={profile.differentlyAbled ? 'yes' : 'no'} onChange={(value) => updateProfile('differentlyAbled', value === 'yes')} options={[['no', 'No'], ['yes', 'Yes']]} /></div><TextArea id="register-permanent-address" label="Permanent address" value={profile.permanentAddress} onChange={(value) => updateProfile('permanentAddress', value)} onBlur={() => touchProfile('permanentAddress')} error={profileTouched.permanentAddress ? profileErrors.permanentAddress : ''} required /><TextArea id="register-current-address" label="Current address" value={profile.currentAddress} onChange={(value) => updateProfile('currentAddress', value)} onBlur={() => touchProfile('currentAddress')} error={profileTouched.currentAddress ? profileErrors.currentAddress : ''} required /><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('activate')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit" disabled={!profileFieldsComplete}>Continue to verification</button></div></form>}
      {step === 'verify' && <form className="otp-login__form" onSubmit={verify} noValidate><div className="otp-login__step-heading"><h2>Verify with Aadhaar OTP</h2><p className="otp-login__supporting">Step 3 of 4. A six-digit code was sent to your Aadhaar-linked mobile number ending {mobile.slice(-4)}.</p></div><div className="ux4g-otp"><label className="ux4g-otp-label" id="register-otp-label">Aadhaar OTP <span className="field-required" aria-hidden="true">*</span></label><div className="ux4g-otp-group" aria-labelledby="register-otp-label">{otp.map((digit, index) => <input key={index} ref={(element) => { otpInputs.current[index] = element }} className="ux4g-input ux4g-input-md ux4g-otp-slot ux4g-otp-input" type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} value={digit} onChange={(event) => updateOtp(index, event.target.value)} onPaste={(event) => { event.preventDefault(); pasteOtp(index, event.clipboardData.getData('text')) }} onKeyDown={(event) => { if (event.key === 'Backspace' && !otp[index] && index > 0) otpInputs.current[index - 1]?.focus() }} aria-label={`Aadhaar OTP digit ${index + 1}`} />)}</div></div><div className="service-flow-actions"><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setStep('profile')}>Back</button><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit" disabled={otpValue.length !== DEMO_OTP.length}>Verify Aadhaar OTP</button></div></form>}
      {step === 'complete' && <section className="onboarding-success" aria-labelledby="activation-complete-title"><span className="onboarding-success__icon" aria-hidden="true">✓</span><div><h2 id="activation-complete-title">UAN activation complete</h2><p>Your profile is ready. You can now view your EPF records.</p></div><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onComplete(profile)}>View my account</button></section>}
    </div></section>
  </main>
}

function OnboardingStepper({ activeIndex }: { activeIndex: number }) { return <div className="onboarding-stepper" aria-label={`Onboarding progress: step ${activeIndex + 1} of ${onboardingSteps.length}`}><ol className="ux4g-stepper ux4g-stepper-horizontal ux4g-stepper-center">{onboardingSteps.map((label, index) => <li key={label} className={`ux4g-stepper-step ux4g-stepper-horizontal ${index < activeIndex ? 'ux4g-stepper-done' : ''} ${index === activeIndex ? 'ux4g-stepper-inprogress ux4g-stepper-completed' : ''}`} aria-current={index === activeIndex ? 'step' : undefined}><span className="ux4g-stepper-head-icon" aria-hidden="true">{index + 1}</span><span className={index === activeIndex ? 'ux4g-stepper-label-inprogress' : index < activeIndex ? 'ux4g-stepper-label-success' : 'ux4g-stepper-label'}>{label}</span></li>)}</ol><p className="onboarding-stepper__summary">Step {activeIndex + 1} of {onboardingSteps.length}: {onboardingSteps[activeIndex]}</p></div> }

function Field({ id, label, value, onChange, onBlur, error, required = false, type = 'text', inputMode, maxLength }: { id: string; label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; required?: boolean; type?: string; inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number }) { return <div className="service-field"><label htmlFor={id}>{label}{required && <span className="field-required" aria-hidden="true"> *</span>}</label><input id={id} className={`ux4g-input ux4g-input-md ${error ? 'ux4g-input-error' : ''}`} type={type} inputMode={inputMode} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />{error && <p id={`${id}-error`} className="service-field-error" role="alert">{error}</p>}</div> }
function TextArea({ id, label, value, onChange, onBlur, error, required = false }: { id: string; label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; required?: boolean }) { return <div className="service-field"><label htmlFor={id}>{label}{required && <span className="field-required" aria-hidden="true"> *</span>}</label><textarea id={id} className={`service-textarea ${error ? 'ux4g-input-error' : ''}`} rows={3} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />{error && <p id={`${id}-error`} className="service-field-error" role="alert">{error}</p>}</div> }
function Select({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <div className="service-field"><label htmlFor={id}>{label}</label><select id={id} className="service-select" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select></div> }
