import './service-pages.css'

export interface LegalPageProps {
  page: 'terms' | 'privacy'
  onBack: () => void
  onNavigate: (page: 'terms' | 'privacy') => void
}

export function LegalPage({ page, onBack, onNavigate }: LegalPageProps) {
  return <article className="service-page legal-page" aria-labelledby="legal-title">
    <nav className="ux4g-breadcrumb ux4g-breadcrumb-divider" aria-label="Breadcrumb"><button className="service-breadcrumb-button" type="button" onClick={onBack}>Account</button><span>{page === 'terms' ? 'Terms of Use' : 'Privacy Policy'}</span></nav>
    {page === 'terms' ? <Terms /> : <Privacy />}
    <nav className="legal-related" aria-label="Related legal information"><span>Related:</span><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => onNavigate(page === 'terms' ? 'privacy' : 'terms')}>{page === 'terms' ? 'Privacy Policy' : 'Terms of Use'}</button></nav>
  </article>
}

function Terms() {
  return <><header className="service-page-heading"><p className="service-eyebrow">Proof of concept</p><h1 id="legal-title">Terms of Use</h1><p>Last updated: 28 August 2026</p></header><div className="legal-content">
    <section><h2>About EPFO Member Services</h2><p>This application is a fictional proof of concept created for product evaluation. It is not an official Employees' Provident Fund Organisation service and is not connected to EPFO systems.</p></section>
    <section><h2>Synthetic Information Only</h2><p>All member names, identifiers, employment records, contributions, balances, requests and reports in this application are synthetic. Do not enter real personal information, EPFO credentials, Aadhaar numbers, bank details or documents.</p></section>
    <section><h2>No Financial or Legal Determination</h2><p>Balances, eligibility messages, pension-service summaries, claim amounts and process outcomes are demonstrations. They are not official account statements, legal advice, financial advice, eligibility decisions or payment commitments.</p></section>
    <section><h2>Prototype Actions</h2><p>Transfers, claims, KYC verification, corrections and grievances remain within the prototype. Submitting a flow does not contact an employer, EPFO, a bank or another government service. Email delivery and one-time passwords are mocked.</p></section>
    <section><h2>Availability and Accuracy</h2><p>The prototype may be changed, reset or unavailable without notice. It is designed to explain recorded states, including missing and unavailable data, but it should not be relied on for an official decision.</p></section>
    <section><h2>Acceptable Use</h2><p>Use the application only to evaluate the proof of concept. Do not attempt to upload real documents, identify real people, access systems without permission or misrepresent prototype output as an official EPFO record.</p></section>
    <section><h2>Questions</h2><p>For this proof of concept, questions should be directed to the demonstration team through the hackathon review channel. For real EPFO services, use official Government of India channels.</p></section>
  </div></>
}

function Privacy() {
  return <><header className="service-page-heading"><p className="service-eyebrow">Proof of concept</p><h1 id="legal-title">Privacy Policy</h1><p>Last updated: 28 August 2026</p></header><div className="legal-content">
    <section><h2>Scope</h2><p>This policy describes how the EPFO Member Services proof of concept handles information during a demonstration. It does not describe the practices of EPFO or any Government of India production system.</p></section>
    <section><h2>Information in the Prototype</h2><p>The application starts with a fictional member profile and synthetic employment, contribution, KYC, request and report records. The demo must not be used with real personal data or credentials.</p></section>
    <section><h2>Information You Enter</h2><p>Contact edits, service-flow answers, descriptions and preferences may be stored in browser state so the demonstration remains connected while you navigate. Enter synthetic information only. Demo one-time passwords are not sent through a telecom service.</p></section>
    <section><h2>How Information Is Used</h2><p>Prototype information is used to calculate explanatory balances, show service readiness, create mocked requests, preserve status continuity and generate synthetic passbook reports.</p></section>
    <section><h2>Sharing and External Delivery</h2><p>The prototype does not intentionally send entered information to EPFO, employers, banks, Aadhaar services or email providers. A report marked as sent to a verified email represents mocked account state and does not confirm external delivery.</p></section>
    <section><h2>Storage and Retention</h2><p>Connected account state may be stored in the browser used for the demonstration. Generated reports show a 90-day availability period as product behaviour. Clearing browser storage or resetting the demo may remove the prototype state sooner.</p></section>
    <section><h2>Your Choices</h2><p>You can change communication preferences, edit synthetic contact details, clear browser storage or stop using the prototype. Do not use these controls to manage a real EPFO account.</p></section>
    <section><h2>Security</h2><p>The prototype uses interface safeguards suitable for a demonstration, but it is not approved for real identity or financial information. Never enter an actual Aadhaar number, PAN, bank account, mobile number, email address or password.</p></section>
    <section><h2>Questions</h2><p>Privacy questions about this proof of concept should be directed to the demonstration team through the hackathon review channel.</p></section>
  </div></>
}
