# EPFO Redesign — Product Brief

## Product

Build a polished, working prototype of a redesigned EPFO member experience for the “Build What Moves India” hackathon.

This is NOT a generic visual redesign of the existing EPFO website.

The product thesis is:

> EPFO knows the state of my employment and retirement records, but I don't.

A user should be able to understand:

1. Where have I worked?
2. Where is my PF money?
3. How did that money move over time?
4. Is everything being contributed correctly?
5. Does anything need my attention?
6. If something is wrong, what exactly should I do?

The product is an interpretation layer over the underlying EPFO data.

Government data model → human-readable employment + money journey.

---

# DESIGN SYSTEM

Use the official UX4G Design System 3.0.

Do not substitute Material UI, Bootstrap, shadcn, or another design system.

Use UX4G components, design tokens and interaction patterns wherever possible.

UX4G:
https://www.ux4g.gov.in/get-started

Accessibility target:
WCAG 2.1 AA.

The interface should feel like a modern, trustworthy Indian government service.

Avoid:
- excessive cards
- decorative dashboards
- unnecessary charts
- dense government-style navigation
- jargon
- gratuitous animation

---

# PRODUCT PRINCIPLES

1. Explain, don't merely display.
2. Show what the system knows; never invent information.
3. Distinguish zero, missing, no contribution, pending, transferred and unavailable.
4. Every important financial number should have an explanation.
5. Every problem should have a clear next action.
6. Government forms/processes should be abstracted into user intents.
7. Users should not need to understand EPFO's internal architecture.
8. Mobile-first.
9. Accessible.
10. Calm, clear and information-dense.

Never infer why someone was not employed.

If there is a gap in employment:

> No EPF-covered employment recorded

Do NOT label it:
- career break
- study break
- MBA
- unemployed
- personal leave
- sabbatical

The system only knows what EPFO records.

---

# CORE INFORMATION ARCHITECTURE

Primary navigation:

1. Home
2. My journey
3. My money
4. Actions

Keep navigation simple.

Do not create:
- Member Services
- Online Services
- Downloads
- Forms
- separate passbook navigation
- separate claim-status navigation

Those are implementation concepts, not user concepts.

---

# SCREEN 1 — LOGIN

Create a clean, mobile-friendly login experience.

Primary:

Continue with mobile OTP

Secondary:

Continue with Aadhaar

Authentication can be mocked.

Do not build real Aadhaar, OTP, biometric or government integrations.

After authentication, take the user directly to Home.

---

# SCREEN 2 — HOME

The Home screen answers:

> What is my current PF situation?

Show:

- Current EPF balance
- Current employer
- Date joined current employer
- Latest contribution
- Contribution status
- Overall PF health
- Things requiring attention

Example synthetic state:

YOUR EPF

₹4,82,650

Latest contribution

₹7,050
May 2026

✓ Everything looks up to date

Then:

YOUR EMPLOYMENT JOURNEY

2018
Northstar Consumer Technologies
PF Trust

2020
BlueKite Digital Services
EPFO

2023
Harbor Foods India
EPFO

2026
Vertex Mobility
EPFO

If there is a period with no EPF-covered employment:

No EPF-covered employment recorded
July 2024 – February 2026

Do not infer the reason.

Then show:

THINGS THAT NEED YOUR ATTENTION

Example:

⚠ Previous PF account has not been transferred

₹38,450 remains in an older Member ID.

[Understand & fix]

The Home page should feel like a financial health dashboard.

---

# SCREEN 3 — MY JOURNEY

This is the core experience.

Build a chronological employment timeline.

Each employment episode contains:

- Employer
- Date joined
- Date exited
- PF provider
- Member ID
- EPF contributions
- Employer EPF contributions
- EPS contributions
- Interest
- Transfers
- Claims
- Current status

Do not make Member ID the primary visual element.

Example:

## Northstar Consumer Technologies

August 2018 – June 2019

PF provider:
Employer PF Trust

₹42,780 transferred to EPFO

Employee contributions
₹27,000

Employer contributions
₹8,250

Interest
₹7,530

Status:
Transferred

Then:

## BlueKite Digital Services

July 2019 – December 2022

EPF balance generated:
₹2,64,380

Employee contributions
₹1,32,000

Employer EPF
₹40,333

Interest
₹34,047

Transfers in
₹42,780

Status:
Closed

The numbers are synthetic. They must be internally reconciled.

---

# SCREEN 4 — MY MONEY

Answer:

> How did I get to my current balance?

Start with:

CURRENT EPF BALANCE

₹4,82,650

Breakdown:

Employee contributions
₹2,74,800

Employer EPF contributions
₹83,250

Interest
₹1,02,300

Transfers
₹92,300

Withdrawals
-₹69,? 

The final values must be calculated from the synthetic transaction dataset.

Do not hard-code inconsistent totals.

Create a reconciliation function.

The fundamental equation is:

closing balance =
opening balance
+ employee contributions
+ employer EPF contributions
+ interest
+ transfers in
- transfers out
- withdrawals

EPS must NOT be included in EPF balance.

---

# EPF AND EPS

Make the distinction extremely clear.

EPF:

YOUR EPF

₹4,82,650

Money accumulated in your provident fund account.

EPS:

YOUR PENSION SERVICE

8 years 4 months

EPS is a pension-related benefit/service record and should not be presented as an additional cash balance that can simply be added to EPF.

If showing EPS contributions, explain them separately.

---

# SCREEN 5 — MONTHLY CONTRIBUTION VIEW

Allow users to inspect contributions month by month.

Example:

## May 2026

PF wage reported

₹15,000

Employee EPF

₹1,800 ✓

Employer EPF

₹550 ✓

EPS

₹1,250 ✓

Contribution received

✓

Status

Everything looks correct

Use synthetic contribution data.

Create at least one deliberately anomalous month.

Example:

## February 2026

PF wage reported

₹15,000

Employee EPF

₹1,800 ✓

Employer EPF

₹0 ⚠

EPS

₹1,250 ✓

Status

Employer EPF contribution is not currently recorded.

Do not say:

“Your employer failed to pay.”

Say:

“Employer EPF contribution is not currently recorded.”

Then:

[What should I do?]

---

# SCREEN 6 — ACTIONS

Organise around user intent.

“I want to…”

- Transfer my previous PF
- Withdraw/claim my PF
- Update my personal details
- Verify/update KYC
- Add or change nominee
- Correct an employment record
- Check an existing claim
- Raise a grievance

Do not organise around government form numbers.

For example:

User intent:
Transfer my previous PF

Underlying government process:
Form 13

The UI should lead with:

Transfer my previous PF

not:

Form 13.

Never ask users to download, print, sign, scan and upload a form in the prototype.

---

# SCREEN 7 — CLAIM / TRANSFER TRACKING

Build a clear status tracker.

Example:

PF TRANSFER

Submitted ✓

Employer verification ✓

EPFO processing → CURRENT

Funds transferred ○

Completed ○

Current status:

EPFO is processing your transfer.

You don't need to do anything right now.

Alternatively:

Action required:

Your bank details need verification before this claim can proceed.

[Fix bank details]

Always explain:

- What happened
- Where it is now
- What happens next
- Whether the user needs to act

---

# SYNTHETIC USER

Create one fictional employee:

Name:
Arjun Mehta

UAN:
100000123456

Do not use real personal information.

Career history:

## Employment 1

Northstar Consumer Technologies

August 2018 – June 2019

PF provider:
Employer PF Trust

Member ID:
DL/NST/0001842

This employment should have:

- monthly contributions
- employer contributions
- interest
- transfer to EPFO
- a trust-originated transfer event

Create enough data to demonstrate that historical employer PF trusts are supported.

---

## Employment 2

BlueKite Digital Services

July 2019 – December 2022

PF provider:
EPFO

Member ID:
DL/BLK/0019274

Include:

- monthly contributions
- employer contributions
- EPS
- annual interest
- transfer-in from Northstar
- one partial withdrawal/claim
- closing balance

---

## Employment 3

Harbor Foods India

January 2023 – June 2024

PF provider:
EPFO

Member ID:
KA/HFI/0031849

Include:

- monthly contributions
- employer contributions
- EPS
- annual interest
- transfer-in from BlueKite
- transfer-out to current/next account

---

## No EPF-covered employment recorded

July 2024 – February 2026

Do not explain this period.

Do not label it as a career break.

Do not infer why it exists.

Simply show:

No EPF-covered employment recorded

---

## Employment 4

Vertex Mobility

March 2026 – Present

PF provider:
EPFO

Member ID:
KA/VTX/0048291

Current employment.

Include:

March 2026
April 2026
May 2026
June 2026

monthly contributions.

Use:

Employee EPF:
₹1,800/month

Employer EPF:
₹550/month

EPS:
₹1,250/month

PF wage:
₹15,000/month

For at least one month, introduce a contribution discrepancy.

---

# SYNTHETIC DATA REQUIREMENTS

Create realistic monthly records.

The dataset should include:

- one UAN
- four employers
- four Member IDs
- one employer PF trust
- three EPFO establishments
- transfers
- monthly employee contributions
- employer EPF contributions
- EPS contributions
- annual interest
- one withdrawal
- one pending transfer
- one contribution discrepancy
- one KYC issue
- one completed claim
- one period with no EPF-covered employment

All numbers must be internally consistent.

Do not manually fabricate summary balances.

Calculate balances from transactions.

---

# DATA MODEL

Use a typed domain model.

Conceptually:

Person
├── Identity / KYC
├── UAN
└── Employment[]
    ├── Employer
    ├── Member ID
    ├── PF provider
    ├── DOJ
    ├── DOE
    ├── EPF ledger[]
    ├── EPS service
    ├── Transfers[]
    └── Claims[]

Create separate types for:

- Contribution
- InterestCredit
- Transfer
- Withdrawal
- Claim
- KYC status
- Employment
- EPS service
- Data quality state

---

# DATA STATES

Explicitly model:

- verified
- unverified
- received
- missing
- pending
- transferred
- withdrawn
- unavailable
- not applicable
- needs attention

Do not reduce these to simple booleans.

---

# DATA INTEGRITY

Build reconciliation utilities.

For every Member ID:

closing balance =
opening balance
+ contributions
+ interest
+ transfers in
- transfers out
- withdrawals

Do not include EPS in EPF balance.

Add automated tests.

The UI should surface inconsistencies rather than silently correcting them.

---

# DATA CONFIDENCE

Some historical records may be incomplete.

Support:

Complete
Partial
Unavailable

Example:

Northstar Consumer Technologies

Historical trust statement:
Partial

Reason:

“EPFO has transfer information for this employment, but the original monthly trust ledger is not available in this account.”

Do not invent missing transactions.

---

# COMPONENTS

Create reusable components for:

- Money summary
- Contribution row
- Employment timeline
- Transaction timeline
- Status badge
- Health check
- Attention card
- Explanation panel
- Claim tracker
- KYC status
- Empty state
- Data unavailable state
- Data confidence indicator

---

# ARCHITECTURE

Prefer:

- React
- TypeScript
- Vite or Next.js depending on existing repository
- UX4G
- local/mock data
- no real government APIs
- no production backend unless genuinely useful

Keep domain/data logic separate from UI.

---

# MULTI-AGENT EXECUTION

If subagents are available, parallelise independent work.

AGENT 1 — DOMAIN + DATA

Create:
- typed domain model
- synthetic dataset
- EPF/EPS calculations
- transaction model
- reconciliation utilities
- tests

AGENT 2 — UX / INFORMATION ARCHITECTURE

Define:
- page hierarchy
- navigation
- responsive behaviour
- UX4G component mapping
- empty/error/loading states

AGENT 3 — HOME

Build:
- login
- application shell
- Home
- PF health
- current balance
- current employment
- attention states

AGENT 4 — JOURNEY + MONEY

Build:
- employment timeline
- employment details
- balance breakdown
- transaction timeline
- monthly contribution view

AGENT 5 — ACTIONS

Build:
- actions
- KYC
- transfer flow
- claim flow
- grievance
- status tracking

AGENT 6 — QA

After integration:
- run app
- run tests
- run lint
- run build
- inspect responsive layouts
- check accessibility
- identify broken states
- fix issues

Do not parallelise tasks that modify the same files unless the environment provides safe isolation.

The domain/data contract should be established before UI agents depend on it.

---

# HERO DEMO

The final prototype should support this exact story:

I log in.

I immediately see my current EPF balance and whether anything needs my attention.

I open My Journey and understand every employer I've had and how my PF moved between accounts.

I open My Money and understand how my current balance was created.

I inspect a month and see employee contribution, employer EPF contribution and EPS separately.

The product tells me whether the contribution looks correct.

I discover an issue.

Instead of showing me a cryptic EPFO error or asking me to download a PDF, the product explains the problem and gives me the next action.

I can complete that action digitally and track its status.

That is the product.

Build the product, not a mockup.

Make it functional end-to-end with realistic synthetic data.