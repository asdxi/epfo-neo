import { useMemo, useState } from 'react'
import { AppShell, type AppRoute } from './components/AppShell'
import { LoginScreen } from './components/LoginScreen'
import {
  ActionsPage,
  JourneyPage,
  MoneyPage,
  type ActionItem,
  type JourneyEmployment,
  type MonthlyContribution,
  type Tracker,
} from './components/feature-pages'
import { arjunMehta } from './domain/data'
import { balanceForEmployment, moneyBreakdown, totalEpfBalance, totalEpsServiceMonths } from './domain/calculations'
import { HomePage } from './pages/HomePage'

const formatMoney = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(value)

const formatMonth = (month: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
  .format(new Date(`${month}-01T00:00:00`))

const journeyItems: JourneyEmployment[] = arjunMehta.employments.map((employment) => {
  const balance = balanceForEmployment(employment)
  const transferIn = employment.transfers.find((transfer) => transfer.toMemberId === employment.memberId && transfer.status === 'completed')
  return {
    id: employment.id,
    employer: employment.employer,
    dates: `${new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(employment.joinedOn))} – ${employment.exitedOn ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(employment.exitedOn)) : 'Present'}`,
    provider: employment.provider === 'employer-pf-trust' ? 'Employer PF Trust' : 'EPFO',
    memberId: employment.memberId,
    employeeEpf: employment.contributions.reduce((total, item) => total + item.employeeEpf, 0),
    employerEpf: employment.contributions.reduce((total, item) => total + (item.employerEpf ?? 0), 0),
    eps: employment.epsService.contributions,
    interest: employment.interestCredits.reduce((total, item) => total + item.amount, 0),
    transfersIn: transferIn?.amount,
    transferNote: transferIn?.note ?? (balance === 0 ? 'Balance moved to the next account.' : undefined),
    status: employment.status === 'transferred' ? 'Transferred' : employment.status === 'closed' ? 'Closed' : 'Needs attention',
    statusTone: employment.status === 'needs-attention' ? 'warning' : employment.status === 'current' ? 'success' : 'info',
    confidence: employment.dataConfidence[0].toUpperCase() + employment.dataConfidence.slice(1) as 'Complete' | 'Partial' | 'Unavailable',
    confidenceNote: employment.dataConfidenceNote,
    current: employment.status === 'current',
  }
})

const currentEmployment = arjunMehta.employments.at(-1)!
const monthlyContributions: MonthlyContribution[] = currentEmployment.contributions.map((item) => ({
  id: item.id,
  month: formatMonth(item.month),
  pfWage: item.pfWage,
  employeeEpf: item.employeeEpf,
  employerEpf: item.employerEpf,
  eps: item.eps,
  received: item.status === 'received' ? 'Received' : item.status === 'missing' ? 'Missing' : 'Pending',
  message: item.note ?? 'Everything looks correct.',
  needsAttention: item.status === 'needs-attention' || item.status === 'missing',
}))

const actions: ActionItem[] = [
  ['transfer', 'Transfer my previous PF', 'Move eligible PF from a previous account.', 'Processing'],
  ['withdraw', 'Withdraw or claim my PF', 'Start a claim and see what happens next.'],
  ['details', 'Update my personal details', 'Review the details attached to your account.'],
  ['kyc', 'Verify or update KYC', 'Keep your identity and bank details ready for services.', 'Needs attention'],
  ['nominee', 'Add or change nominee', 'Choose who should receive benefits if needed.'],
  ['employment', 'Correct an employment record', 'Tell us about an employment record that looks wrong.'],
  ['claim', 'Check an existing claim', 'See the progress of a submitted request.', 'In progress'],
  ['grievance', 'Raise a grievance', 'Get help when an issue cannot be resolved here.'],
].map(([id, title, description, status]) => ({ id, title, description, status, tone: status === 'Needs attention' ? 'warning' : 'info' }))

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [route, setRoute] = useState<AppRoute>('home')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const total = totalEpfBalance(arjunMehta)
  const breakdown = useMemo(() => moneyBreakdown(arjunMehta), [])
  const monthCount = totalEpsServiceMonths(arjunMehta)
  const pendingTransfer = arjunMehta.employments.flatMap((item) => item.transfers).find((item) => item.status === 'pending')
  const tracker: Tracker = {
    title: 'PF transfer',
    steps: [
      { label: 'Submitted', state: 'completed' },
      { label: 'Employer verification', state: 'completed' },
      { label: 'EPFO processing', detail: 'Current status', state: 'current' },
      { label: 'Funds transferred', state: 'upcoming' },
      { label: 'Completed', state: 'upcoming' },
    ],
    message: 'EPFO is processing your transfer. You do not need to do anything right now.',
  }

  const completeAction = (id: string) => {
    const item = actions.find((action) => action.id === id)
    setActionMessage(item ? `${item.title} is ready to continue in this prototype.` : 'Your bank details can be reviewed in this prototype.')
  }

  if (!authenticated) return <LoginScreen onAuthenticated={() => setAuthenticated(true)} />

  const page = route === 'home' ? <HomePage
    summary={{ memberName: arjunMehta.name.split(' ')[0], epfBalance: formatMoney(total), currentEmployer: currentEmployment.employer, joinedDate: 'March 2026', latestContribution: formatMoney(2_350), latestContributionMonth: 'May 2026', attention: pendingTransfer ? { title: 'Previous PF transfer is still processing', description: `${formatMoney(pendingTransfer.amount)} remains in your previous Member ID.`, actionLabel: 'Understand and track' } : undefined }}
    onNavigate={(target) => setRoute(target)}
  /> : route === 'journey' ? <JourneyPage employments={journeyItems} /> : route === 'money' ? <MoneyPage
    summary={{ closingBalance: total, employeeContributions: breakdown.employeeContributions, employerContributions: breakdown.employerEpfContributions, interest: breakdown.interest, transfersIn: breakdown.transfersIn, transfersOut: breakdown.transfersOut, withdrawals: breakdown.withdrawals, pensionService: `${Math.floor(monthCount / 12)} years ${monthCount % 12} months` }}
    contributions={monthlyContributions}
  /> : <ActionsPage actions={actions} kycStatus="Bank details need verification" tracker={tracker} onAction={completeAction} />

  return <AppShell activeRoute={route} onNavigate={setRoute} memberName={arjunMehta.name} onSignOut={() => { setAuthenticated(false); setRoute('home') }}>
    {actionMessage && <div className="ux4g-alert ux4g-alert-success" role="status"><div className="ux4g-alert-content"><p className="ux4g-alert-message">{actionMessage}</p></div><button className="ux4g-btn ux4g-btn-text-primary ux4g-btn-md" onClick={() => setActionMessage(null)} type="button">Dismiss</button></div>}
    {page}
  </AppShell>
}
