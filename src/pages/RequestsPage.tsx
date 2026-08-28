import { useMemo, useState, type KeyboardEvent } from 'react'
import type { AccountState, MemberRequest, RequestState, RequestType } from '../domain/types'
import './service-pages.css'

export interface RequestsPageProps {
  account: AccountState
  initialRequestId?: string
  status?: 'loading' | 'ready' | 'error'
  onRetry?: () => void
  onCitizenAction?: (request: MemberRequest) => void
}

type RequestView = 'open' | 'completed'
type RequestFilter = 'all' | RequestType

const requestViews: RequestView[] = ['open', 'completed']
const requestFilters: RequestFilter[] = ['all', 'claim', 'transfer', 'correction', 'grievance']
const requestFilterLabel: Record<RequestFilter, string> = { all: 'All', claim: 'Claims', transfer: 'Transfers', correction: 'Corrections', grievance: 'Grievances' }

const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : 'Pending'
const titleCase = (value: string) => value.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')
const statusTone: Record<RequestState, string> = { submitted: 'info', 'in-progress': 'info', 'action-required': 'warning', completed: 'success' }
const emptyRequestTitle = (view: RequestView, filter: RequestFilter) => `No ${view}${filter === 'all' ? '' : ` ${requestFilterLabel[filter].toLowerCase()}`} requests`

function RequestSkeleton() {
  return <div className="request-layout" aria-busy="true" aria-label="Loading requests"><div className="request-list">{[1, 2, 3].map((item) => <div className="request-skeleton" key={item}><span /><span /><span /></div>)}</div><div className="request-skeleton request-skeleton--detail"><span /><span /><span /><span /></div></div>
}

export function RequestsPage({ account, initialRequestId, status = 'ready', onRetry, onCitizenAction }: RequestsPageProps) {
  const [view, setView] = useState<RequestView>(() => account.requests.find((item) => item.id === initialRequestId)?.state === 'completed' ? 'completed' : 'open')
  const [filter, setFilter] = useState<RequestFilter>('all')
  const [selectedId, setSelectedId] = useState(initialRequestId ?? '')
  const requests = useMemo(() => account.requests
    .filter((request) => view === 'completed' ? request.state === 'completed' : request.state !== 'completed')
    .filter((request) => filter === 'all' || request.type === filter)
    .sort((a, b) => b.updatedOn.localeCompare(a.updatedOn)), [account.requests, filter, view])
  const selected = requests.find((request) => request.id === selectedId) ?? requests[0]
  const requestsInView = useMemo(() => account.requests.filter((request) => view === 'completed' ? request.state === 'completed' : request.state !== 'completed'), [account.requests, view])
  const selectView = (nextView: RequestView) => { setView(nextView); setSelectedId('') }
  const selectFilter = (nextFilter: RequestFilter) => { setFilter(nextFilter); setSelectedId('') }
  const handleTabKey = <T extends string>(event: KeyboardEvent<HTMLButtonElement>, items: T[], selectedItem: T, selectItem: (item: T) => void) => {
    const currentIndex = items.indexOf(selectedItem)
    const nextIndex = event.key === 'ArrowRight' ? (currentIndex + 1) % items.length : event.key === 'ArrowLeft' ? (currentIndex - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1
    if (nextIndex < 0) return
    event.preventDefault()
    const tablist = event.currentTarget.closest('[role="tablist"]')
    selectItem(items[nextIndex])
    requestAnimationFrame(() => tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus())
  }

  if (status === 'loading') return <section className="service-page" aria-labelledby="requests-title"><header className="service-page-heading"><h1 id="requests-title">Requests</h1></header><RequestSkeleton /></section>
  if (status === 'error') return <section className="service-page" aria-labelledby="requests-title"><header className="service-page-heading"><h1 id="requests-title">Requests</h1></header><div className="ux4g-alert ux4g-alert-error" role="alert"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Requests Could Not Be Loaded</p><p className="ux4g-alert-message">Your account data is safe. Try loading this page again.</p>{onRetry && <button className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md" type="button" onClick={onRetry}>Try Again</button>}</div></div></section>

  return <section className="service-page" aria-labelledby="requests-title">
    <header className="service-page-heading"><h1 id="requests-title">Requests</h1></header>
    <nav className="ux4g-tab ux4g-tab-underline ux4g-tab-md request-view-tabs" aria-label="Request status"><ul className="ux4g-tab-list" role="tablist">
      {requestViews.map((item) => <li key={item} role="presentation"><button id={`request-view-${item}`} className={`ux4g-tab-item ${view === item ? 'active' : ''}`} type="button" role="tab" tabIndex={view === item ? 0 : -1} aria-selected={view === item} aria-controls="requests-panel" onKeyDown={(event) => handleTabKey(event, requestViews, view, selectView)} onClick={() => selectView(item)}><span>{titleCase(item)}</span><span className="request-tab-count">{account.requests.filter((request) => item === 'completed' ? request.state === 'completed' : request.state !== 'completed').length}</span></button></li>)}
    </ul></nav>
    <nav className="request-type-tabs" aria-label="Filter requests by type"><ul>
      {requestFilters.map((item) => <li key={item}><button className={`ux4g-btn ux4g-btn-tonal-primary ux4g-btn-md request-type-tab ${filter === item ? 'is-selected' : ''}`} type="button" aria-pressed={filter === item} onClick={() => selectFilter(item)}><span>{requestFilterLabel[item]}</span><span className="request-tab-count">{item === 'all' ? requestsInView.length : requestsInView.filter((request) => request.type === item).length}</span></button></li>)}
    </ul></nav>
    <div id="requests-panel" role="tabpanel" aria-labelledby={`request-view-${view}`}>{requests.length === 0 ? <div className="request-empty"><h2>{emptyRequestTitle(view, filter)}</h2><p>{view === 'open' ? 'There is nothing waiting for review or action in this view.' : 'Completed requests will appear here with their final status and dates.'}</p></div> : <div className="request-layout">
      <div className="request-list" role="list" aria-label={`${titleCase(view)} requests`}>{requests.map((request) => <div key={request.id} role="listitem"><button className={`request-list-item ${selected?.id === request.id ? 'is-selected' : ''}`} type="button" aria-current={selected?.id === request.id ? 'true' : undefined} onClick={() => setSelectedId(request.id)}><span className="request-list-heading"><strong>{request.title}</strong><span className={`ux4g-tag-filled-${statusTone[request.state]} ux4g-tag-s`}>{titleCase(request.state)}</span></span><span>{request.service}</span><span className="request-list-meta">{request.reference}<span>Updated {formatDate(request.updatedOn)}</span></span></button></div>)}</div>
      {selected && <RequestDetail request={selected} onCitizenAction={onCitizenAction} />}
    </div>}</div>
  </section>
}

function RequestDetail({ request, onCitizenAction }: { request: MemberRequest; onCitizenAction?: (request: MemberRequest) => void }) {
  return <article className="request-detail" aria-live="polite" aria-labelledby="request-detail-title">
    <header className="request-detail-header"><h2 id="request-detail-title">{request.title}</h2><span className={`ux4g-tag-filled-${statusTone[request.state]} ux4g-tag-s`}>{titleCase(request.state)}</span></header>
    <dl className="request-facts"><div><dt>Reference Number</dt><dd>{request.reference}</dd></div><div><dt>Submitted On</dt><dd>{formatDate(request.submittedOn)}</dd></div><div><dt>Last Updated</dt><dd>{formatDate(request.updatedOn)}</dd></div>{request.amount !== undefined && <div><dt>Amount</dt><dd>{formatMoney(request.amount)}</dd></div>}</dl>
    <section className="request-next-step" aria-labelledby="next-step-title"><h3 id="next-step-title">Next Expected Step</h3><p>{request.nextExpectedStep}</p>{request.citizenAction && <div className="ux4g-alert ux4g-alert-warning"><div className="ux4g-alert-content"><p className="ux4g-alert-title">Action required</p><p className="ux4g-alert-message">{request.citizenAction}</p>{onCitizenAction && <button className="ux4g-btn ux4g-btn-primary ux4g-btn-md" type="button" onClick={() => onCitizenAction(request)}>Continue Required Action</button>}</div></div>}</section>
    <section className="request-timeline-section" aria-labelledby="request-timeline-title"><h3 id="request-timeline-title">Status Timeline</h3><ol className="request-timeline">{request.timeline.map((event) => <li key={event.id} className={`is-${event.state}`}><span className="request-timeline-marker" aria-hidden="true" /><div><div className="request-timeline-heading"><strong>{event.label}</strong><time>{formatDate(event.date)}</time></div>{event.explanation && <p>{event.explanation}</p>}</div></li>)}</ol></section>
  </article>
}
