import { useRef, useState, type FormEvent } from 'react'
import { DEMO_OTP } from '../domain/demoCredentials'
import { validateIndianMobile } from '../domain/validation'
import './login-screen.css'

interface LoginScreenProps {
  expectedMobile: string
  onAuthenticated: () => void
}

type Step = 'mobile' | 'otp'

const invalidMobileMessage = 'Please enter a valid 10-digit mobile number.'
const mismatchedMobileMessage = 'This mobile number does not match the fictional account.'
const invalidOtpMessage = 'We could not verify this OTP. Check the code and try again.'

export function LoginScreen({ expectedMobile, onAuthenticated }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [verificationState, setVerificationState] = useState<'idle' | 'success' | 'error'>('idle')
  const otpInputs = useRef<Array<HTMLInputElement | null>>([])
  const cleanMobile = mobile.replace(/\D/g, '').slice(0, 10)
  const otpValue = otp.join('')

  const mobileErrorFor = (value: string) => {
    if (!value) return ''
    if (validateIndianMobile(value)) return invalidMobileMessage
    if (value !== expectedMobile) return mismatchedMobileMessage
    return ''
  }

  const updateMobile = (value: string) => {
    const nextMobile = value.replace(/\D/g, '').slice(0, 10)
    setMobile(nextMobile)
    setError(mobileErrorFor(nextMobile))
  }

  const continueToOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (validateIndianMobile(cleanMobile)) {
      setError(invalidMobileMessage)
      return
    }
    if (cleanMobile !== expectedMobile) {
      setError(mismatchedMobileMessage)
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

  const pasteOtp = (index: number, pastedValue: string) => {
    const digits = pastedValue.replace(/\D/g, '').slice(0, otp.length - index)
    if (!digits) return
    const nextOtp = [...otp]
    digits.split('').forEach((digit, offset) => { nextOtp[index + offset] = digit })
    setOtp(nextOtp)
    setError('')
    setVerificationState('idle')
    otpInputs.current[Math.min(index + digits.length, otp.length - 1)]?.focus()
  }

  const verifyOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (otpValue.length !== DEMO_OTP.length) return
    if (otpValue !== DEMO_OTP) {
      setVerificationState('error')
      setError(invalidOtpMessage)
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
        <span className="brand-mark" aria-hidden="true">EPFO</span>
        <p className="eyebrow">EPFO Member Services</p>
        <h1 id="login-title">Sign In to Your Account</h1>
        <p>Use the mobile number registered with your account to receive a one-time password.</p>
      </section>
      <section className="ux4g-card ux4g-card-solid otp-login__card" aria-labelledby="sign-in-title">
        <div className="ux4g-card-body">
          {step === 'mobile' ? (
            <form className="otp-login__form" onSubmit={continueToOtp} noValidate>
              <div className="otp-login__step-heading"><p className="eyebrow">Step 1 of 2</p><h2 id="sign-in-title">Enter your mobile number</h2><p className="otp-login__supporting">We will send a one-time password to the number linked to your account.</p></div>
              <div className="otp-login__field">
                <label htmlFor="mobile-number">Registered mobile number</label>
                <input id="mobile-number" className="ux4g-input ux4g-input-md" type="tel" inputMode="numeric" autoComplete="tel" pattern="[6-9][0-9]{9}" maxLength={10} value={mobile} onChange={(event) => updateMobile(event.target.value)} placeholder="Enter 10-digit mobile number" aria-describedby={error ? 'mobile-error' : 'mobile-help'} aria-invalid={Boolean(error)} />
                <p id={error ? 'mobile-error' : 'mobile-help'} className={error ? 'otp-login__error' : 'field-help'} role={error ? 'alert' : undefined}>{error || ''}</p>
              </div>
              <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md otp-login__primary" type="submit">Send OTP</button>
            </form>
          ) : (
            <form className="otp-login__form" onSubmit={verifyOtp} noValidate>
              <div className="otp-login__step-heading"><p className="eyebrow">Step 2 of 2</p><h2 id="sign-in-title">Enter the OTP</h2><p className="otp-login__supporting">We sent a 6-digit OTP to <strong>+91 {cleanMobile.slice(-4).padStart(10, '•')}</strong>.</p></div>
              <div className={`ux4g-otp ${verificationState === 'success' ? 'ux4g-otp-success' : verificationState === 'error' ? 'ux4g-otp-error' : ''}`}>
                <label className="ux4g-otp-label" id="otp-label">One-time password</label>
                <div className="ux4g-otp-group" aria-labelledby="otp-label">
                  {otp.map((digit, index) => <input key={index} ref={(element) => { otpInputs.current[index] = element }} className="ux4g-input ux4g-input-md ux4g-otp-slot ux4g-otp-input" type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} value={digit} onChange={(event) => updateOtp(index, event.target.value)} onPaste={(event) => { event.preventDefault(); pasteOtp(index, event.clipboardData.getData('text')) }} onKeyDown={(event) => { if (event.key === 'Backspace' && !otp[index] && index > 0) otpInputs.current[index - 1]?.focus() }} aria-label={`OTP digit ${index + 1}`} aria-invalid={verificationState === 'error'} />)}
                </div>
                {verificationState === 'success' && <p className="ux4g-otp-status" role="status">OTP verified. Opening your account…</p>}
                {verificationState === 'error' && <p className="ux4g-otp-status" role="alert">{error}</p>}
              </div>
              {error && verificationState !== 'error' && <p className="otp-login__error" role="alert">{error}</p>}
              <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md otp-login__primary" type="submit" disabled={otpValue.length !== DEMO_OTP.length}>Verify and continue</button>
              <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md otp-login__secondary" type="button" onClick={resetToMobile}>Change mobile number</button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
