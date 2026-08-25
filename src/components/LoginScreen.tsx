import { useState, type FormEvent } from 'react'

interface LoginScreenProps {
  onAuthenticated: () => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [method, setMethod] = useState<'mobile' | 'aadhaar' | null>(null)
  const [identifier, setIdentifier] = useState('')

  const begin = (nextMethod: 'mobile' | 'aadhaar') => {
    setMethod(nextMethod)
    setIdentifier('')
  }

  const continueToHome = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (identifier.trim().length > 0) onAuthenticated()
  }

  return (
    <main className="login-screen" aria-labelledby="login-title">
      <section className="login-intro">
        <span className="brand-mark" aria-hidden="true">EPF</span>
        <p className="eyebrow">Member experience prototype</p>
        <h1 id="login-title">Your work and PF, made clear.</h1>
        <p>See your employment journey, understand your money, and take action when something needs you.</p>
      </section>
      <section className="ux4g-card ux4g-card-solid login-card" aria-label="Sign in">
        <div className="ux4g-card-body">
          <h2>{method ? `Continue with ${method === 'mobile' ? 'mobile OTP' : 'Aadhaar'}` : 'Sign in to your account'}</h2>
          {!method ? (
            <div className="login-actions">
              <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md login-button" type="button" onClick={() => begin('mobile')}>Continue with mobile OTP</button>
              <button className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-md login-button" type="button" onClick={() => begin('aadhaar')}>Continue with Aadhaar</button>
            </div>
          ) : (
            <form className="login-form" onSubmit={continueToHome}>
              <label htmlFor="identity">{method === 'mobile' ? 'Mobile number' : 'Aadhaar number'}</label>
              <input id="identity" className="ux4g-input ux4g-input-md" type={method === 'mobile' ? 'tel' : 'text'} inputMode="numeric" autoComplete="off" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={method === 'mobile' ? 'Enter 10-digit mobile number' : 'Enter 12-digit Aadhaar number'} required />
              <p className="field-help">This is a secure prototype. No personal information is collected.</p>
              <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md login-button" type="submit">Continue</button>
              <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => setMethod(null)}>Choose another way</button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
