import type { ReactNode } from 'react'

export type AppRoute = 'home' | 'journey' | 'money' | 'actions' | 'profile'

const navigation: Array<{ id: AppRoute; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'journey', label: 'My journey' },
  { id: 'money', label: 'My money' },
  { id: 'actions', label: 'Actions' },
]

interface AppShellProps {
  activeRoute: AppRoute
  children: ReactNode
  onNavigate: (route: AppRoute) => void
  memberName?: string
  onSignOut?: () => void
}

export function AppShell({ activeRoute, children, onNavigate, memberName = 'Member', onSignOut }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => onNavigate('home')} aria-label="EPF journey home">
          <span className="brand-mark" aria-hidden="true">EPF</span>
          <span><strong>EPF journey</strong><small>Know your work and money record</small></span>
        </button>
        <div className="member-menu">
          <button className="profile-trigger" type="button" onClick={() => onNavigate('profile')} aria-label={`Open ${memberName}'s profile`}>
            <span className="member-avatar" aria-hidden="true">{memberName.slice(0, 1).toUpperCase()}</span>
            <span className="member-name">{memberName}</span>
          </button>
          {onSignOut && <button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" type="button" onClick={onSignOut}>Sign out</button>}
        </div>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigation.map((item) => (
          <button key={item.id} type="button" className={activeRoute === item.id ? 'nav-link nav-link-active' : 'nav-link'} aria-current={activeRoute === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <main id="main-content" className="app-main">{children}</main>
    </div>
  )
}
