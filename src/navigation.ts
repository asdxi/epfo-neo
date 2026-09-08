export type PortalSurface = 'home' | 'record-review' | 'passbook' | 'services' | 'requests' | 'account' | 'terms' | 'privacy'

export interface PortalLocation {
  surface: PortalSurface
  passbookContext?: string
  service?: string
  employmentId?: string
  contributionId?: string
  requestId?: string
  accountSection?: 'nomination'
}

export const parsePortalLocation = (location: Pick<Location, 'pathname' | 'search'>): PortalLocation => {
  const params = new URLSearchParams(location.search)
  const path = location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/home/action-items') return { surface: 'record-review' }
  if (path === '/passbook') {
    const highlighted = params.get('highlight') ?? undefined
    const employment = params.get('employment') ?? undefined
    const view = params.get('view') ?? undefined
    return { surface: 'passbook', passbookContext: highlighted ?? employment ?? view }
  }
  if (path === '/services') return {
    surface: 'services',
    service: params.get('service') ?? undefined,
    employmentId: params.get('employment') ?? undefined,
    contributionId: params.get('contribution') ?? undefined,
  }
  if (path === '/requests') return { surface: 'requests', requestId: params.get('request') ?? undefined }
  if (path === '/profile') return { surface: 'account', accountSection: params.get('section') === 'nomination' ? 'nomination' : undefined }
  if (path === '/terms') return { surface: 'terms' }
  if (path === '/privacy') return { surface: 'privacy' }
  return { surface: 'home' }
}

export const portalUrl = (location: PortalLocation): string => {
  if (location.surface === 'record-review') return '/home/action-items'
  if (location.surface === 'home') return '/home'
  if (location.surface === 'account') {
    const params = new URLSearchParams()
    if (location.accountSection) params.set('section', location.accountSection)
    return `/profile${params.size ? `?${params}` : ''}`
  }
  if (location.surface === 'terms' || location.surface === 'privacy') return `/${location.surface}`

  const params = new URLSearchParams()
  if (location.surface === 'passbook') {
    const context = location.passbookContext
    if (context === 'overview' || context === 'employers' || context === 'transactions') params.set('view', context)
    else if (context) params.set('employment', context)
  }
  if (location.surface === 'services') {
    if (location.service) params.set('service', location.service)
    if (location.employmentId) params.set('employment', location.employmentId)
    if (location.contributionId) params.set('contribution', location.contributionId)
  }
  if (location.surface === 'requests' && location.requestId) params.set('request', location.requestId)
  return `/${location.surface}${params.size ? `?${params}` : ''}`
}

export const contributionPassbookUrl = (employmentId: string, contributionId: string): string => {
  const params = new URLSearchParams({
    view: 'transactions',
    employer: employmentId,
    type: 'contribution',
    period: '6-months',
    load: '1',
    highlight: contributionId,
  })
  return `/passbook?${params}`
}
