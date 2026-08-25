import { useRef, useState, type FormEvent } from 'react'
import './login-screen.css'

interface LoginScreenProps {
  onAuthenticated: () => void
}

type DemoOutcome = 'valid' | 'invalid'
type Step = 'mobile' | 'otp'

const demoOtp = '123456'

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [outcome, setOutcome] = useState<DemoOutcome>('valid')
  const [error, setError] = useState('')
  const [verificationState, setVerificationState] = useState<'idle' | 'success' | 'error'>('idle')
  const otpInputs = useRef<Array<HTMLInputElement | null>>([])
  const cleanMobile = mobile.replace(/\D/g, '').slice(0, 10)
  const otpValue = otp.join('')

  const continueToOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (cleanMobile.length !== 10) {
      setError('Enter a valid 10-digit mobile number linked to your EPF account.')
      return
    }
    setError('')
    setStep('otp')
    requestAnimationFrame(() => otpInputs.current[0]?.focus())
  }

  const updateOtp = (index: number, nextValue: string) => {
    const digit = nextValue.replace(/\D/g, '').slice(-1)
    const nextOtp = [...otp]
    nextOtp[index] = digit
    setOtp(nextOtp)
    setError('')
    setVerificationState('idle')
    if (digit && index < otp.length - 1) otpInputs.current[index + 1]?.focus()
  }

  const verifyOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (otpValue.length !== demoOtp.length) {
      setError('Enter the 6-digit OTP to continue.')
      return
    }
    if (outcome === 'invalid' || otpValue !== demoOtp) {
      setVerificationState('error')
      setError('We could not verify this OTP. Check the code and try again.')
      return
    }
    setError('')
    setVerificationState('success')
    window.setTimeout(onAuthenticated, 450)
  }

  const resetToMobile = () => {
    setStep('mobile')
    setOtp(['', '', '', '', '', ''])
    setError('')
    setVerificationState('idle')
  }

  return (
    <main className="otp-login" aria-labelledby="login-title">
      <section className="otp-login__hero">
        <span className="brand-mark" aria-hidden="true">EPF</span>
        <p className="eyebrow">EPF member services</p>
        <h1 id="login-title">Access your EPF account</h1>
        <p>Use the mobile number registered with your EPF account to receive a one-time password.</p>
      </section>
      <section className="ux4g-card ux4g-card-solid otp-login__card" aria-labelledby="sign-in-title">
        <div className="ux4g-card-body">
          {step === 'mobile' ? (
            <form className="otp-login__form" onSubmit={continueToOtp} noValidate>
              <div><p className="eyebrow">Step 1 of 2</p><h2 id="sign-in-title">Enter your mobile number</h2><p className="otp-login__supporting">We will send a one-time password to the number linked to your account.</p></div>
              <div className="otp-login__field">
                <label htmlFor="mobile-number">Registered mobile number</label>
                <input id="mobile-number" className="ux4g-input ux4g-input-md" type="tel" inputMode="numeric" autoComplete="tel" value={mobile} onChange={(event) => { setMobile(event.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }} placeholder="Enter 10-digit mobile number" aria-describedby={error ? 'mobile-error' : 'mobile-help'} aria-invalid={Boolean(error)} />
                <p id={error ? 'mobile-error' : 'mobile-help'} className={error ? 'otp-login__error' : 'field-help'} role={error ? 'alert' : undefined}>{error || 'Only the number registered with EPFO can be used to sign in.'}</p>
              </div>
              <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md otp-login__primary" type="submit">Send OTP</button>
            </form>
          ) : (
            <form className="otp-login__form" onSubmit={verifyOtp} noValidate>
              <div><p className="eyebrow">Step 2 of 2</p><h2 id="sign-in-title">Enter the OTP</h2><p className="otp-login__supporting">We sent a 6-digit OTP to <strong>+91 {cleanMobile.slice(-4).padStart(10, '•')}</strong>.</p></div>
              <div className={`ux4g-otp ${verificationState === 'success' ? 'ux4g-otp-success' : verificationState === 'error' ? 'ux4g-otp-error' : ''}`}>
                <label className="ux4g-otp-label" id="otp-label">One-time password</label>
                <div className="ux4g-otp-group" aria-labelledby="otp-label">
                  {otp.map((digit, index) => <input key={index} ref={(element) => { otpInputs.current[index] = element }} className="ux4g-input ux4g-input-md ux4g-otp-slot ux4g-otp-input" type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} value={digit} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !otp[index] && index > 0) otpInputs.current[index - 1]?.focus() }} aria-label={`OTP digit ${index + 1}`} aria-invalid={verificationState === 'error'} />)}
                </div>
                {verificationState === 'success' && <p className="ux4g-otp-status" role="status">OTP verified. Opening your account…</p>}
                {verificationState === 'error' && <p className="ux4g-otp-status" role="alert">{error}</p>}
              </div>
              <fieldset className="otp-login__demo" aria-describedby="demo-help">
                <legend>Demo verification outcome</legend><p id="demo-help">For this prototype, use OTP <strong>123456</strong>.</p>
                <div className="otp-login__demo-options" role="radiogroup" aria-label="Demo verification outcome">
                  {(['valid', 'invalid'] as const).map((option) => <label key={option} className={outcome === option ? 'otp-login__demo-option otp-login__demo-option--selected' : 'otp-login__demo-option'}><input type="radio" name="demo-outcome" value={option} checked={outcome === option} onChange={() => { setOutcome(option); setError(''); setVerificationState('idle') }} />{option === 'valid' ? 'Show success' : 'Show failure'}</label>)}
                </div>
              </fieldset>
              {error && verificationState !== 'error' && <p className="otp-login__error" role="alert">{error}</p>}
              <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md otp-login__primary" type="submit">Verify and continue</button>
              <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md otp-login__secondary" type="button" onClick={resetToMobile}>Change mobile number</button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
