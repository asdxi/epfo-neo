import { useEffect, useState } from 'react'
import { AppShell, type AppRoute } from './components/AppShell'
import { LoginScreen } from './components/LoginScreen'
import { loadPersistedAccount, persistAccount } from './domain/persistence'
import { buildExcelStatement, buildPdfStatement, createReportRecord } from './domain/reports'
import {
  addGeneratedReport,
  markReportReady,
  submitClaim,
  submitCorrection,
  submitGrievance,
  submitPanVerification,
  submitTransfer,
  saveNominees,
  updateContact,
} from './domain/state'
import type { AccountState, GeneratedReport, Member, MemberRequest } from './domain/types'
import { AccountPage } from './pages/AccountPage'
import { HomePage, type CoreServiceId, type FinancialRoute } from './pages/HomePage'
import { LegalPage } from './pages/LegalPage'
import { PassbookPage, type PassbookView, type StatementRequest } from './pages/PassbookPage'
import { RequestsPage } from './pages/RequestsPage'
import { ServicesPage, type ServiceId } from './pages/ServicesPage'

type Surface = AppRoute | 'terms' | 'privacy'
type LoadState = 'loading' | 'ready' | 'error'

const demoToday = '2026-08-28'

const safeInitialAccount = (): AccountState => {
  try {
    return loadPersistedAccount(window.localStorage)
  } catch {
    return loadPersistedAccount({ getItem: () => null })
  }
}

const fileSafe = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function downloadReport(account: AccountState, report: GeneratedReport): void {
  const isPdf = report.format === 'pdf'
  const contents = isPdf ? new TextDecoder().decode(buildPdfStatement(account, report)) : buildExcelStatement(account, report)
  const blob = new Blob([contents], { type: isPdf ? 'application/pdf' : 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${fileSafe(report.name)}.${isPdf ? 'pdf' : 'xls'}`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [surface, setSurface] = useState<Surface>('home')
  const [account, setAccount] = useState<AccountState>(safeInitialAccount)
  const [loadState, setLoadState] = useState<LoadState>('ready')
  const [passbookContext, setPassbookContext] = useState<string>()
  const [serviceContext, setServiceContext] = useState<{ service?: ServiceId; employmentId?: string; contributionId?: string }>({})
  const [requestContext, setRequestContext] = useState<string>()
  const [accountContext, setAccountContext] = useState<'nomination'>()
  const [announcement, setAnnouncement] = useState<string>()

  useEffect(() => {
    try { persistAccount(window.localStorage, account) } catch { /* Browser storage is optional; in-memory state remains safe. */ }
  }, [account])

  const authenticate = () => {
    setAuthenticated(true)
    setLoadState('loading')
    window.setTimeout(() => setLoadState('ready'), 450)
  }

  const navigate = (route: AppRoute) => {
    setSurface(route)
    setAnnouncement(undefined)
    if (route !== 'passbook') setPassbookContext(undefined)
    if (route !== 'services') setServiceContext({})
    if (route !== 'requests') setRequestContext(undefined)
    if (route !== 'account') setAccountContext(undefined)
    window.scrollTo({ top: 0 })
  }

  const navigateFinancial = (route: FinancialRoute, contextId?: string) => {
    if (route === 'passbook') setPassbookContext(contextId)
    if (route === 'requests') setRequestContext(contextId)
    setSurface(route)
    window.scrollTo({ top: 0 })
  }

  const openService = (service: CoreServiceId | ServiceId, contextId?: string) => {
    const normalized: ServiceId = service === 'claims' ? 'claim' : service
    setServiceContext({ service: normalized, contributionId: normalized === 'grievance' ? contextId : undefined })
    setSurface('services')
    window.scrollTo({ top: 0 })
  }

  const openContributionGrievance = (contribution: AccountState['ledger']['contributions'][number]) => {
    setServiceContext({ service: 'grievance', employmentId: contribution.employmentId, contributionId: contribution.id })
    setSurface('services')
    window.scrollTo({ top: 0 })
  }

  const submitAndFind = (next: AccountState, predicate: (request: MemberRequest) => boolean): MemberRequest | void => {
    const request = next.requests.find(predicate)
    setAccount(next)
    return request
  }

  const handleTransfer = (submittedOn: string) => submitAndFind(
    submitTransfer(account, submittedOn),
    (request) => request.type === 'transfer' && request.submittedOn === submittedOn,
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
      setAnnouncement('Your transaction export is being prepared. It is available under Generated Reports in Account.')
      window.setTimeout(() => {
        setAccount((current) => markReportReady(current, report.id, demoToday))
        setAnnouncement('Your transaction export is ready in Generated Reports.')
      }, 1400)
    } else {
      downloadReport(account, report)
      setAnnouncement(`${report.format === 'pdf' ? 'PDF' : 'Excel'} transaction export downloaded and added to Generated Reports.`)
    }
  }

  if (!authenticated) return <LoginScreen expectedMobile={account.member.mobile.value} onAuthenticated={authenticate} />

  const activeRoute: AppRoute = surface === 'terms' || surface === 'privacy' ? 'account' : surface
  const initialPassbookView = (passbookContext && ['overview', 'employers', 'transactions'].includes(passbookContext)) ? passbookContext as PassbookView : undefined

  const page = loadState === 'loading'
    ? <div className="route-skeleton" aria-busy="true" aria-label="Loading account"><span /><span /><span /><span /></div>
    : loadState === 'error'
      ? <div className="ux4g-alert ux4g-alert-error" role="alert"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Account Could Not Be Loaded</p><p className="ux4g-alert-message">Your saved account data is safe. Try loading it again.</p><button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => { setLoadState('loading'); window.setTimeout(() => setLoadState('ready'), 350) }}>Try Again</button></div></div>
      : surface === 'home'
        ? <HomePage account={account} onNavigate={navigateFinancial} onOpenService={openService} />
        : surface === 'passbook'
          ? <PassbookPage
              key={passbookContext ?? 'overview'}
              account={account}
              initialView={initialPassbookView}
              initialContextId={passbookContext}
              onGenerateStatement={handleStatement}
              onRaiseContributionGrievance={openContributionGrievance}
              onStartTransfer={(employmentId) => { setServiceContext({ service: 'transfer', employmentId }); setSurface('services') }}
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
                onViewRequests={(requestId) => { setRequestContext(requestId); setSurface('requests') }}
                onManageNomination={() => { setAccountContext('nomination'); setSurface('account') }}
              />
            : surface === 'requests'
              ? <RequestsPage account={account} initialRequestId={requestContext} status="ready" />
              : surface === 'account'
                ? <AccountPage
                    account={account}
                    focusSection={accountContext}
                    onUpdateContact={(input) => setAccount((current) => updateContact(current, input))}
                    onUpdateCommunicationPreferences={(preferences: Member['communicationPreferences']) => setAccount((current) => ({ ...current, member: { ...current.member, communicationPreferences: preferences } }))}
                    onDownloadReport={(report) => downloadReport(account, report)}
                    onSaveNominees={(nominees) => setAccount((current) => saveNominees(current, nominees))}
                    onStartPanVerification={() => { setServiceContext({ service: 'kyc' }); setSurface('services') }}
                    onNavigateLegal={setSurface}
                  />
                : <LegalPage page={surface} onBack={() => setSurface('account')} onNavigate={setSurface} />

  return <AppShell
    activeRoute={activeRoute}
    onNavigate={navigate}
    memberName={account.member.name}
    onSignOut={() => { setAuthenticated(false); setSurface('home'); setServiceContext({}); setPassbookContext(undefined); setRequestContext(undefined) }}
    onOpenTerms={() => setSurface('terms')}
    onOpenPrivacy={() => setSurface('privacy')}
  >
    {announcement && <div className="ux4g-alert ux4g-alert-success app-announcement" role="status"><div className="ux4g-alert-content"><p className="ux4g-alert-message">{announcement}</p></div><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-sm" type="button" onClick={() => setAnnouncement(undefined)}>Dismiss</button></div>}
    {page}
  </AppShell>
}
