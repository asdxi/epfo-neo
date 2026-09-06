import { useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { AppShell, type AppRoute } from './components/AppShell'
import { LoginScreen } from './components/LoginScreen'
import { OnboardingScreen } from './components/OnboardingScreen'
import { clearPersistedAccount, clearPersistedAuthentication, loadPersistedAccount, loadPersistedAuthentication, persistAccount, persistAuthentication } from './domain/persistence'
import { createInitialAccount } from './domain/data'
import { buildExcelStatement, buildPdfStatement, createReportRecord } from './domain/reports'
import {
  addGeneratedReport,
  markReportReady,
  submitClaim,
  submitCorrection,
  submitGrievance,
  submitPanVerification,
  submitTransfer,
  submitExit,
  updateMemberProfile,
  updateFaceAuthentication,
  saveNominees,
  prepareOrCheckExistingRequest,
  updateContact,
} from './domain/state'
import type { AccountState, GeneratedReport, Member, MemberRequest } from './domain/types'
import { AccountPage } from './pages/AccountPage'
import { HomePage, type CoreServiceId, type FinancialRoute } from './pages/HomePage'
import { LegalPage } from './pages/LegalPage'
import { PassbookPage, type PassbookView, type StatementRequest } from './pages/PassbookPage'
import { RequestsPage } from './pages/RequestsPage'
import { RecordReviewPage } from './pages/RecordReviewPage'
import { ServicesPage, type ServiceId } from './pages/ServicesPage'
import { contributionPassbookUrl, parsePortalLocation, portalUrl, type PortalLocation } from './navigation'

type Surface = AppRoute | 'record-review' | 'terms' | 'privacy'
type LoadState = 'loading' | 'ready' | 'error'

const demoToday = '2026-08-28'

const safeInitialAccount = (): AccountState => {
  try {
    return loadPersistedAccount(window.localStorage)
  } catch {
    return loadPersistedAccount({ getItem: () => null })
  }
}

const safeInitialAuthentication = (): boolean => {
  try {
    return loadPersistedAuthentication(window.localStorage)
  } catch {
    return false
  }
}

const fileSafe = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function downloadReport(account: AccountState, report: GeneratedReport): boolean {
  try {
    const isPdf = report.format === 'pdf'
    const contents = isPdf ? new TextDecoder().decode(buildPdfStatement(account, report)) : buildExcelStatement(account, report)
    const blob = new Blob([contents], { type: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${fileSafe(report.name)}.${isPdf ? 'pdf' : 'xlsx'}`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}

export default function App() {
  const initialLocation = parsePortalLocation(window.location)
  const [authenticated, setAuthenticated] = useState(safeInitialAuthentication)
  const [authView, setAuthView] = useState<'login' | 'register'>(window.location.pathname === '/register' ? 'register' : 'login')
  const [surface, setSurface] = useState<Surface>(initialLocation.surface)
  const [account, setAccount] = useState<AccountState>(safeInitialAccount)
  const [loadState, setLoadState] = useState<LoadState>('ready')
  const [passbookContext, setPassbookContext] = useState<string | undefined>(initialLocation.passbookContext)
  const [serviceContext, setServiceContext] = useState<{ service?: ServiceId; employmentId?: string; contributionId?: string }>({ service: initialLocation.service as ServiceId | undefined, employmentId: initialLocation.employmentId, contributionId: initialLocation.contributionId })
  const [requestContext, setRequestContext] = useState<string | undefined>(initialLocation.requestId)
  const [accountContext, setAccountContext] = useState<'nomination' | undefined>(initialLocation.accountSection)
  const [announcement, setAnnouncement] = useState<{ tone: 'success' | 'error'; message: string }>()
  const skipNextPersistence = useRef(false)

  useEffect(() => {
    if (!announcement) return
    const timeout = window.setTimeout(() => setAnnouncement(undefined), 5000)
    return () => window.clearTimeout(timeout)
  }, [announcement])

  useEffect(() => {
    if (skipNextPersistence.current) {
      skipNextPersistence.current = false
      return
    }
    try { persistAccount(window.localStorage, account) } catch { /* Browser storage is optional; in-memory state remains safe. */ }
  }, [account])

  useEffect(() => {
    const desiredInitialUrl = authenticated
      ? ['/', '/login', '/register'].includes(window.location.pathname) ? '/home' : window.location.href
      : window.location.pathname === '/register' ? '/register' : '/login'
    if (!window.history.state?.epfoNeo || desiredInitialUrl !== window.location.href) window.history.replaceState({ epfoNeo: true, depth: 0 }, '', desiredInitialUrl)
    const applyBrowserLocation = () => {
      const next = parsePortalLocation(window.location)
      setAuthView(window.location.pathname === '/register' ? 'register' : 'login')
      setSurface(next.surface)
      setPassbookContext(next.passbookContext)
      setServiceContext({ service: next.service as ServiceId | undefined, employmentId: next.employmentId, contributionId: next.contributionId })
      setRequestContext(next.requestId)
      setAccountContext(next.accountSection)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('popstate', applyBrowserLocation)
    return () => window.removeEventListener('popstate', applyBrowserLocation)
  }, [authenticated])

  const applyLocation = (next: PortalLocation, options?: { replace?: boolean; url?: string }) => {
    const depth = Number(window.history.state?.depth ?? 0)
    const state = { epfoNeo: true, depth: options?.replace ? depth : depth + 1 }
    window.history[options?.replace ? 'replaceState' : 'pushState'](state, '', options?.url ?? portalUrl(next))
    setSurface(next.surface)
    setPassbookContext(next.passbookContext)
    setServiceContext({ service: next.service as ServiceId | undefined, employmentId: next.employmentId, contributionId: next.contributionId })
    setRequestContext(next.requestId)
    setAccountContext(next.accountSection)
    setAnnouncement(undefined)
    window.scrollTo({ top: 0 })
  }

  const authenticate = () => {
    try { persistAuthentication(window.localStorage) } catch { /* Browser storage is optional; in-memory state remains safe. */ }
    setAuthenticated(true)
    applyLocation({ surface: 'home' }, { replace: true })
    setLoadState('loading')
    window.setTimeout(() => setLoadState('ready'), 450)
  }

  const resetDemo = () => {
    try {
      clearPersistedAccount(window.localStorage)
      clearPersistedAuthentication(window.localStorage)
    } catch { /* Browser storage is optional. */ }
    skipNextPersistence.current = true
    setAccount(createInitialAccount())
    setAuthenticated(false)
    applyLocation({ surface: 'home' }, { replace: true, url: '/login' })
    setAnnouncement(undefined)
  }

  const navigate = (route: AppRoute) => {
    applyLocation({ surface: route })
  }

  const navigateFinancial = (route: FinancialRoute, contextId?: string) => {
    if (route === 'passbook') {
      const contribution = account.ledger.contributions.find((item) => item.id === contextId)
      applyLocation(
        { surface: 'passbook', passbookContext: contextId },
        contribution ? { url: contributionPassbookUrl(contribution.employmentId, contribution.id) } : undefined,
      )
      return
    }
    if (route === 'requests') applyLocation({ surface: 'requests', requestId: contextId })
    else applyLocation({ surface: route })
  }

  const openService = (service: CoreServiceId | ServiceId, contextId?: string) => {
    const normalized: ServiceId = service === 'claims' ? 'claim' : service
    applyLocation({ surface: 'services', service: normalized, contributionId: normalized === 'grievance' ? contextId : undefined })
  }

  const openContributionGrievance = (contribution: AccountState['ledger']['contributions'][number]) => {
    applyLocation({ surface: 'services', service: 'grievance', employmentId: contribution.employmentId, contributionId: contribution.id })
  }

  const submitAndFind = (next: AccountState, predicate: (request: MemberRequest) => boolean): MemberRequest | void => {
    const request = next.requests.find(predicate)
    setAccount(next)
    return request
  }

  const handleTransfer = (submittedOn: string, sourceMemberId: string) => submitAndFind(
    submitTransfer(account, submittedOn, sourceMemberId),
    (request) => request.type === 'transfer' && request.submittedOn === submittedOn && request.employmentId === account.employments.find((employment) => employment.memberId === sourceMemberId)?.id,
  )

  const handleClaim = (input: { submittedOn: string; amount: number; title: string }) => submitAndFind(
    submitClaim(account, input),
    (request) => request.type === 'claim' && request.submittedOn === input.submittedOn && request.amount === input.amount,
  )

  const handleCorrection = (input: { submittedOn: string; employmentId: string; field: string; proposedValue: string }) => submitAndFind(
    submitCorrection(account, input),
    (request) => request.type === 'correction' && request.submittedOn === input.submittedOn && request.employmentId === input.employmentId,
  )

  const handleGrievance = (input: { submittedOn: string; employmentId: string; contributionId?: string; category: string; description: string }) => submitAndFind(
    submitGrievance(account, input),
    (request) => request.type === 'grievance' && request.submittedOn === input.submittedOn && request.contributionId === input.contributionId,
  )

  const handleStatement = (request: StatementRequest) => {
    const background = request.range === '5-years' || request.range === 'all-time'
    const report = createReportRecord({
      id: `report-${Date.now()}`,
      periodLabel: request.periodLabel,
      startsOn: request.startsOn,
      endsOn: request.endsOn,
      format: request.format,
      requestedOn: demoToday,
      background,
      deliverToEmail: background && account.member.email.verified,
      transactionIds: request.transactionIds,
    })
    setAccount((current) => addGeneratedReport(current, report))
    if (background) {
      setAnnouncement({ tone: 'success', message: 'Your transaction export is being prepared. It is available under Generated Reports in Account.' })
      window.setTimeout(() => {
        setAccount((current) => markReportReady(current, report.id, demoToday))
        setAnnouncement({ tone: 'success', message: 'Your transaction export is ready in Generated Reports.' })
      }, 1400)
    } else {
      const downloaded = downloadReport(account, report)
      setAnnouncement(downloaded
        ? { tone: 'success', message: `${report.format === 'pdf' ? 'PDF' : 'Excel'} transaction export downloaded and added to Generated Reports.` }
        : { tone: 'error', message: `We could not download the ${report.format === 'pdf' ? 'PDF' : 'Excel'} transaction export. Please try again.` })
    }
  }

  if (!authenticated) {
    if (authView === 'register') return <OnboardingScreen onBack={() => { setAuthView('login'); window.history.pushState({ epfoNeo: true, depth: Number(window.history.state?.depth ?? 0) + 1 }, '', '/login') }} onComplete={(profile, faceAuthenticationState) => {
      setAccount((current) => updateFaceAuthentication(updateMemberProfile(current, { ...profile, updatedOn: demoToday }), faceAuthenticationState, demoToday))
      authenticate()
    }} />
    return <LoginScreen expectedMobile={account.member.mobile.value} onAuthenticated={authenticate} onRegister={() => { setAuthView('register'); window.history.pushState({ epfoNeo: true, depth: Number(window.history.state?.depth ?? 0) + 1 }, '', '/register') }} />
  }

  const activeRoute: AppRoute = surface === 'terms' || surface === 'privacy' ? 'account' : surface === 'record-review' ? 'home' : surface
  const initialPassbookView = (passbookContext && ['overview', 'employers', 'transactions'].includes(passbookContext)) ? passbookContext as PassbookView : undefined

  const page = loadState === 'loading'
    ? <div className="route-skeleton" aria-busy="true" aria-label="Loading account"><span /><span /><span /><span /></div>
    : loadState === 'error'
      ? <div className="ux4g-alert ux4g-alert-error" role="alert"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Account Could Not Be Loaded</p><p className="ux4g-alert-message">Your saved account data is safe. Try loading it again.</p><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => { setLoadState('loading'); window.setTimeout(() => setLoadState('ready'), 350) }}>Try Again</button></div></div>
      : surface === 'home'
        ? <HomePage account={account} onNavigate={navigateFinancial} onOpenService={openService} onReviewIssues={() => applyLocation({ surface: 'record-review' })} />
        : surface === 'record-review'
          ? <RecordReviewPage
              account={account}
              onBack={() => Number(window.history.state?.depth ?? 0) > 0 ? window.history.back() : applyLocation({ surface: 'home' }, { replace: true })}
              onTrackRequest={(requestId) => applyLocation({ surface: 'requests', requestId })}
              onStartTransfer={(employmentId) => applyLocation({ surface: 'services', service: 'transfer', employmentId })}
              onRaiseContributionGrievance={openContributionGrievance}
            />
        : surface === 'passbook'
          ? <PassbookPage
              key={passbookContext ?? 'overview'}
              account={account}
              initialView={initialPassbookView}
              initialContextId={passbookContext}
              onGenerateStatement={handleStatement}
              onRaiseContributionGrievance={openContributionGrievance}
              onStartTransfer={(employmentId) => applyLocation({ surface: 'services', service: 'transfer', employmentId })}
            />
          : surface === 'services'
            ? <ServicesPage
                key={`${serviceContext.service ?? 'catalogue'}-${serviceContext.contributionId ?? ''}`}
                account={account}
                initialService={serviceContext.service}
                initialEmploymentId={serviceContext.employmentId}
                initialContributionId={serviceContext.contributionId}
                onSubmitTransfer={handleTransfer}
                onSubmitClaim={handleClaim}
                onSubmitPanVerification={(submittedOn) => setAccount((current) => submitPanVerification(current, submittedOn))}
                onSubmitCorrection={handleCorrection}
                onSubmitGrievance={handleGrievance}
                onSubmitExit={(input) => submitAndFind(submitExit(account, input), (request) => request.type === 'exit' && request.submittedOn === input.submittedOn)}
                onViewRequests={(requestId) => applyLocation({ surface: 'requests', requestId })}
                onManageNomination={() => applyLocation({ surface: 'account', accountSection: 'nomination' })}
              />
            : surface === 'requests'
              ? <RequestsPage account={account} initialRequestId={requestContext} status="ready" onCitizenAction={(request) => { setAccount((current) => prepareOrCheckExistingRequest(current, request.id, demoToday)); setAnnouncement({ tone: 'success', message: request.rejection ? 'Known details and evidence are prepared on this request.' : 'Existing request checked. No duplicate request was created.' }) }} />
              : surface === 'account'
                ? <AccountPage
                    account={account}
                    focusSection={accountContext}
                    onUpdateContact={(input) => setAccount((current) => updateContact(current, input))}
                    onUpdateProfile={(input) => setAccount((current) => updateMemberProfile(current, input))}
                    onUpdateCommunicationPreferences={(preferences: Member['communicationPreferences']) => setAccount((current) => ({ ...current, member: { ...current.member, communicationPreferences: preferences } }))}
                    onDownloadReport={(report) => {
                      const downloaded = downloadReport(account, report)
                      setAnnouncement(downloaded
                        ? { tone: 'success', message: `${report.format === 'pdf' ? 'PDF' : 'Excel'} report downloaded.` }
                        : { tone: 'error', message: `We could not download the ${report.format === 'pdf' ? 'PDF' : 'Excel'} report. Please try again.` })
                    }}
                    onSaveNominees={(nominees) => setAccount((current) => saveNominees(current, nominees))}
                    onStartPanVerification={() => applyLocation({ surface: 'services', service: 'kyc' })}
                    onCompleteFaceAuthentication={() => setAccount((current) => updateFaceAuthentication(current, 'verified', demoToday))}
                    onNavigateLegal={(legalSurface) => applyLocation({ surface: legalSurface })}
                  />
                : <LegalPage page={surface} onBack={() => applyLocation({ surface: 'account' })} onNavigate={(legalSurface) => applyLocation({ surface: legalSurface })} />

  return <>
    <Analytics />
    <AppShell
      activeRoute={activeRoute}
      onNavigate={navigate}
      memberName={account.member.name}
      onSignOut={() => {
        try { clearPersistedAuthentication(window.localStorage) } catch { /* Browser storage is optional. */ }
        setAuthenticated(false)
        applyLocation({ surface: 'home' }, { replace: true, url: '/login' })
      }}
      onOpenTerms={() => applyLocation({ surface: 'terms' })}
      onOpenPrivacy={() => applyLocation({ surface: 'privacy' })}
      onResetDemo={resetDemo}
      breadcrumbs={surface === 'record-review'
        ? [{ label: 'Home', href: '/home', onClick: () => applyLocation({ surface: 'home' }) }, { label: 'Needs Attention' }]
        : surface === 'services' && serviceContext.service
          ? [{ label: 'Services', href: '/services', onClick: () => applyLocation({ surface: 'services' }) }, { label: ({ transfer: 'Transfer Previous PF', claim: 'Withdrawal Claim', kyc: 'KYC & Verification', correction: 'Correct Employment Records', grievance: 'Raise a Grievance', exit: 'Exit from EPFO Scheme' } as const)[serviceContext.service] }]
          : undefined}
    >
      {announcement && <div className={`ux4g-alert ux4g-alert-${announcement.tone} app-announcement`} role={announcement.tone === 'error' ? 'alert' : 'status'} aria-live={announcement.tone === 'error' ? 'assertive' : 'polite'}><div className="ux4g-alert-content"><p className="ux4g-alert-message">{announcement.message}</p></div></div>}
      {page}
    </AppShell>
  </>
}
