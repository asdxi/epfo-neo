import { describe, expect, it } from 'vitest'
import { contributionPassbookUrl, parsePortalLocation, portalUrl } from './navigation'

describe('portal navigation', () => {
  it.each([
    ['/home', '', { surface: 'home' }],
    ['/home/action-items', '', { surface: 'record-review' }],
    ['/profile', '?section=nomination', { surface: 'account', accountSection: 'nomination' }],
    ['/requests', '?request=request-transfer-2026', { surface: 'requests', requestId: 'request-transfer-2026' }],
    ['/services', '?service=grievance&employment=vertex&contribution=vertex-2026-06', { surface: 'services', service: 'grievance', employmentId: 'vertex', contributionId: 'vertex-2026-06' }],
  ])('parses %s%s', (pathname, search, expected) => {
    expect(parsePortalLocation({ pathname, search })).toEqual(expected)
  })

  it('builds stable URLs for primary and nested pages', () => {
    expect(portalUrl({ surface: 'record-review' })).toBe('/home/action-items')
    expect(portalUrl({ surface: 'account', accountSection: 'nomination' })).toBe('/profile?section=nomination')
    expect(contributionPassbookUrl('vertex', 'vertex-2026-06')).toBe('/passbook?view=transactions&employer=vertex&type=contribution&period=6-months&load=1&highlight=vertex-2026-06')
  })
})
