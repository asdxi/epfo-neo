import { useState, type FormEvent } from 'react'

interface ProfilePageProps {
  name: string
  uan: string
}

export function ProfilePage({ name, uan }: ProfilePageProps) {
  const [mobile, setMobile] = useState('98765 43210')
  const [email, setEmail] = useState('arjun.mehta@example.in')
  const [saved, setSaved] = useState(false)

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaved(true)
  }

  return <section className="profile-page" aria-labelledby="profile-title">
    <header className="feature-heading">
      <p className="feature-eyebrow">Your account</p>
      <h1 id="profile-title">Profile</h1>
      <p>View the personal details recorded for your account. You can update your mobile number and email address here.</p>
    </header>

    {saved && <div className="ux4g-alert ux4g-alert-success" role="status"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Contact details updated</p><p className="ux4g-alert-message">Your changes have been saved for this prototype.</p></div></div>}

    <form className="ux4g-card ux4g-card-outline profile-card" onSubmit={save}>
      <div className="ux4g-card-body profile-form">
        <div className="profile-readonly"><span>Name</span><strong>{name}</strong></div>
        <div className="profile-readonly"><span>UAN</span><strong>{uan}</strong></div>
        <label htmlFor="mobile">Mobile number
          <input id="mobile" className="ux4g-input ux4g-input-md" inputMode="numeric" value={mobile} onChange={(event) => { setMobile(event.target.value); setSaved(false) }} />
        </label>
        <label htmlFor="email">Email address
          <input id="email" className="ux4g-input ux4g-input-md" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setSaved(false) }} />
        </label>
        <p className="profile-note">For your security, some identity details can only be changed through the relevant verification process.</p>
      </div>
      <div className="ux4g-card-footer"><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="submit">Save contact details</button></div>
    </form>
  </section>
}
