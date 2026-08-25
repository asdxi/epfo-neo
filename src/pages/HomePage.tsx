export interface HomeSummary {
  memberName: string
  epfBalance: string
  currentEmployer: string
  joinedDate: string
  latestContribution: string
  latestContributionMonth: string
  attention?: { title: string; description: string; actionLabel: string }
}

interface HomePageProps {
  summary: HomeSummary
  onNavigate: (route: 'journey' | 'money' | 'actions') => void
}

export function HomePage({ summary, onNavigate }: HomePageProps) {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Home</p>
        <h1>Hello, {summary.memberName}</h1>
        <p>Here is your current PF situation.</p>
      </header>

      <section className="ux4g-card ux4g-card-solid balance-card" aria-labelledby="epf-balance-title">
        <div className="ux4g-card-body">
          <p className="eyebrow" id="epf-balance-title">Your EPF</p>
          <p className="balance-amount">{summary.epfBalance}</p>
          <div className="balance-details">
            <div><span>Current employer</span><strong>{summary.currentEmployer}</strong><small>Joined {summary.joinedDate}</small></div>
            <div><span>Latest contribution</span><strong>{summary.latestContribution}</strong><small>{summary.latestContributionMonth}</small></div>
          </div>
          <div className="health-ok" role="status"><span aria-hidden="true">✓</span> Everything looks up to date</div>
        </div>
        <div className="ux4g-card-footer">
          <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => onNavigate('money')}>Understand your balance</button>
        </div>
      </section>

      <section className="home-section" aria-labelledby="journey-heading">
        <div className="section-heading"><div><p className="eyebrow">Your employment journey</p><h2 id="journey-heading">Where you have worked</h2></div><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={() => onNavigate('journey')}>View full journey</button></div>
        <ol className="journey-preview">
          <li><time>2018</time><div><strong>Northstar Consumer Technologies</strong><span>PF Trust</span></div></li>
          <li><time>2020</time><div><strong>BlueKite Digital Services</strong><span>EPFO</span></div></li>
          <li><time>2023</time><div><strong>Harbor Foods India</strong><span>EPFO</span></div></li>
          <li><time>2026</time><div><strong>Vertex Mobility</strong><span>EPFO · Current employer</span></div></li>
        </ol>
      </section>

      {summary.attention && <section className="ux4g-alert ux4g-alert-warning attention-card" aria-labelledby="attention-heading">
        <div className="ux4g-alert-content"><p className="eyebrow">Things that need your attention</p><h2 className="ux4g-alert-title" id="attention-heading">{summary.attention.title}</h2><p className="ux4g-alert-message">{summary.attention.description}</p><button className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-md" type="button" onClick={() => onNavigate('actions')}>{summary.attention.actionLabel}</button></div>
      </section>}
    </div>
  )
}
