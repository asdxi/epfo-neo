import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type AppRoute =
  | 'home'
  | 'passbook'
  | 'services'
  | 'requests'
  | 'account'

type PrimaryRoute = Extract<AppRoute, 'home' | 'passbook' | 'services' | 'requests' | 'account'>

const navigation: Array<{ id: PrimaryRoute; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'passbook', label: 'Passbook' },
  { id: 'services', label: 'Services' },
  { id: 'requests', label: 'Requests' },
  { id: 'account', label: 'Account' },
]

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface AppShellProps {
  activeRoute: AppRoute
  children: ReactNode
  onNavigate: (route: AppRoute) => void
  memberName?: string
  onSignOut: () => void
  onOpenTerms?: () => void
  onOpenPrivacy?: () => void
}

export function AppShell({
  activeRoute,
  children,
  onNavigate,
  memberName = 'Member',
  onSignOut,
  onOpenTerms,
  onOpenPrivacy,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  useEffect(() => {
    if (!drawerOpen) return

    const drawer = drawerRef.current
    const menuButton = menuButtonRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => element.getAttribute('aria-hidden') !== 'true')

    focusable()[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
        return
      }

      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) {
        event.preventDefault()
        drawer?.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      menuButton?.focus()
    }
  }, [closeDrawer, drawerOpen])

  useEffect(() => {
    const closeAtDesktopWidth = () => {
      if (window.innerWidth >= 1024) setDrawerOpen(false)
    }
    window.addEventListener('resize', closeAtDesktopWidth)
    return () => window.removeEventListener('resize', closeAtDesktopWidth)
  }, [])

  const navigate = (route: AppRoute) => {
    closeDrawer()
    onNavigate(route)
  }

  const signOut = () => {
    closeDrawer()
    onSignOut()
  }

  const hasFooterLinks = Boolean(onOpenTerms || onOpenPrivacy)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="mobile-header ux4g-navbar">
        <div className="ux4g-navbar-wrap shell-navbar-wrap">
          <button
            ref={menuButtonRef}
            className="ux4g-icon-btn ux4g-icon-btn-text-primary ux4g-icon-btn-lg shell-menu-button"
            type="button"
            aria-label="Open navigation menu"
            aria-controls="mobile-navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
            </svg>
          </button>
          <button className="shell-brand shell-brand-mobile" type="button" onClick={() => navigate('home')}>
            <span className="brand-mark" aria-hidden="true">EPFO</span>
            <span className="brand-copy">EPFO Member Services</span>
          </button>
        </div>
      </header>

      <header className="desktop-header ux4g-navbar">
        <div className="ux4g-navbar-wrap shell-navbar-wrap">
          <button className="shell-brand" type="button" onClick={() => navigate('home')} aria-label="EPFO Member Services home">
            <span className="brand-mark" aria-hidden="true">EPFO</span>
            <span className="brand-copy">EPFO Member Services</span>
          </button>
          <nav className="ux4g-navbar-right" aria-label="Primary navigation">
            <ul className="ux4g-navbar-links">
              {navigation.map((item) => {
                const current = activeRoute === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`ux4g-btn ${current ? 'ux4g-btn-text-primary desktop-nav-link-current' : 'ux4g-btn-text-neutral'} ux4g-btn-md shell-action desktop-nav-link`}
                      aria-current={current ? 'page' : undefined}
                      onClick={() => navigate(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                )
              })}
              <li className="desktop-sign-out">
                <button className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-md shell-action" type="button" onClick={signOut}>
                  Sign Out
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <div
        className={`ux4g-drawer-overlay mobile-drawer-overlay${drawerOpen ? ' ux4g-drawer-open' : ''}`}
        aria-hidden={!drawerOpen}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDrawer()
        }}
      >
        <div
          ref={drawerRef}
          id="mobile-navigation"
          className={`ux4g-drawer ux4g-drawer-left mobile-drawer${drawerOpen ? ' ux4g-drawer-open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-navigation-title"
          tabIndex={-1}
        >
          <div className="ux4g-drawer-header">
            <div className="ux4g-drawer-title-group">
              <div className="ux4g-drawer-title-wrapper">
                <h2 id="mobile-navigation-title" className="ux4g-drawer-title">EPFO Member Services</h2>
              </div>
              <span className="ux4g-drawer-subtitle">Signed in as {memberName}</span>
            </div>
            <div className="ux4g-drawer-header-actions">
              <button
                className="ux4g-icon-btn ux4g-icon-btn-text-primary ux4g-icon-btn-lg ux4g-drawer-close mobile-drawer-close"
                type="button"
                aria-label="Close navigation menu"
                onClick={closeDrawer}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="ux4g-drawer-body">
            <nav aria-label="Mobile primary navigation">
              <ul className="mobile-nav-list">
                {navigation.map((item) => {
                  const current = activeRoute === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`ux4g-btn ${current ? 'ux4g-btn-tonal-primary' : 'ux4g-btn-text-neutral'} ux4g-btn-md mobile-nav-link`}
                        aria-current={current ? 'page' : undefined}
                        onClick={() => navigate(item.id)}
                      >
                        {item.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
          <div className="ux4g-drawer-footer">
            <button className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-md drawer-sign-out" type="button" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <main id="main-content" className="app-main" tabIndex={-1}>{children}</main>

      {hasFooterLinks && (
        <footer className="app-footer ux4g-footer-primary">
          <div className="ux4g-footer-content app-footer-content">
            <span>EPFO Member Services</span>
            <nav className="app-footer-links" aria-label="Legal information">
              {onOpenTerms && (
                <button className="ux4g-text-link-neutral-sm app-footer-link" type="button" onClick={onOpenTerms}>Terms of Use</button>
              )}
              {onOpenPrivacy && (
                <button className="ux4g-text-link-neutral-sm app-footer-link" type="button" onClick={onOpenPrivacy}>Privacy Policy</button>
              )}
            </nav>
          </div>
        </footer>
      )}
    </div>
  )
}
