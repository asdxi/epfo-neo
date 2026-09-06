import { describe, expect, it } from 'vitest'
import { totalEpfBalance, totalEpsServiceMonths } from './calculations'
import { createInitialAccount } from './data'
import { issueContentCatalogue, issueContentFor, type IssueContentCatalogue } from './issueContent'
import { deriveRecordIssues } from './issues'

describe('controlled issue content catalogue', () => {
  it('changes presentation copy without changing classification, facts or calculations', () => {
    const account = createInitialAccount()
    const before = deriveRecordIssues(account)
    const alternate = structuredClone(issueContentCatalogue) as IssueContentCatalogue
    alternate.issues.TRANSFER_IN_PROGRESS = { label: 'Alternate transfer label', shortExplanation: 'Alternate explanation.' }

    expect(issueContentFor(before[0].code).label).toBe('Pending PF Transfer')
    expect(issueContentFor(before[0].code, alternate).label).toBe('Alternate transfer label')
    expect(deriveRecordIssues(account)).toEqual(before)
    expect(totalEpfBalance(account)).toBe(188_094)
    expect(totalEpsServiceMonths(account)).toBe(77)
  })

  it('contains only generic issue copy, not account facts or destinations', () => {
    const content = JSON.stringify(issueContentCatalogue)
    expect(issueContentCatalogue.version).toBe('record-issue-content/1.0.0')
    expect(content).not.toMatch(/Harbor Foods|Vertex Mobility|₹|TRF-2026|2026-0[1-9]-/)
  })
})
