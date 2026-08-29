# EPFO Neo

EPFO Neo is a working prototype of a clearer, more dependable EPFO member experience, created for the [**Build What Moves India**](https://buildwhatmovesindia.com/) hackathon. It is built around a simple idea: EPFO may hold a member's employment and retirement records, but the member should not have to decode those records to understand their own money.

The current experience can make routine questions surprisingly difficult to answer. The passbook sits apart from the member portal, grievances have their own path, and a person may have to move between systems just to understand a contribution and act on it. Even inside the passbook, the wage month and the date an entry was recorded can be easy to confuse. The result is a balance that looks authoritative without making its history easy to follow.

EPFO Neo brings that journey into one calm, consistent product. It turns the underlying records into a human-readable account of where a member has worked, where their PF money is held, how it moved over time, whether contributions were recorded correctly and what to do when something needs attention.

> EPFO Neo is an independent prototype, not an official EPFO product. It uses fictional data and mocked authentication throughout. It does not connect to EPFO, Aadhaar or any other government system.

## What the product changes

### Money that can be understood

Members can see a reconciled EPF balance, review employer-wise totals and inspect individual ledger transactions without working through several disconnected passbooks. Each contribution distinguishes the wage month it belongs to from the date it was recorded. That small change makes delays and recent credits much easier to understand.

Employee EPF, employer EPF and EPS are shown separately because they represent different things. Transfers from previous employers or exempted PF trusts, withdrawals and official interest credits are also explained, so the headline balance can be traced back to the records that created it.

The product does not treat every absent value as zero. Missing, pending, unavailable, transferred, withdrawn and not-applicable records remain distinct. When historical information is incomplete, EPFO Neo says so instead of inventing a transaction or an explanation.

### Problems with a next step

The Home page surfaces contribution discrepancies, an untransferred balance and incomplete KYC directly. Its language stays neutral: for example, it can say that an employer EPF contribution is not recorded, but it does not claim to know why. Every important issue leads to a relevant record, service or request rather than ending in a generic error message.

### Services organised around intent

Claims, PF transfers, KYC verification, employment corrections, grievances and exit requests follow guided, digital flows. The member starts with what they want to accomplish, not a form number or an internal EPFO process. They are not asked to download a form, print it, sign it, scan it and upload it again. The prototype also carries useful context between surfaces and prevents avoidable actions, such as starting a duplicate transfer while one is already in progress.

### Requests that remain visible

Submitted work does not disappear into a receipt screen. Requests show a reference number, current state, progress timeline, next expected step and whether the member needs to act. Open and completed requests can also be retrieved directly by reference number.

## What is included

- Aadhaar OTP-style demo sign-in and account onboarding
- A decision-oriented Home page with current balance, recent contribution, employment history and attention items
- A Passbook with balance overview, employer summaries, transaction filters and PDF or Excel exports
- Separate treatment of EPF money and EPS service records
- Guided transfer, claim, KYC, correction, grievance and exit workflows
- Open and completed request tracking with reference-number search
- Editable profile, independently verified contact details, nominees and generated reports
- Responsive navigation, keyboard support, field-level validation and accessible status feedback
- Persistent demo state in browser storage, with a Reset Demo action

The fictional account includes four employments, an exempted PF trust, completed and pending transfers, a withdrawal, official interest credits, a contribution discrepancy, a KYC issue and a period where no EPF-covered employment is recorded. EPFO Neo never guesses why that period exists.

## Why it is better

EPFO Neo is not a cosmetic reskin of the existing portal. It is an interpretation layer between a government data model and the questions a member is actually trying to answer.

That difference shapes the whole product. Home answers what the member needs to know now. Passbook explains where the money came from. Services helps them act. Requests shows what is still in progress. Account keeps their details, verification and reports together. These are not isolated screens; they are one connected path from discovering a problem to resolving or tracking it.

Totals are calculated rather than manually repeated, financial components are named precisely and incomplete records retain their uncertainty. The result is a member experience that absorbs administrative complexity instead of passing it on to the person using it.

The interface is mobile-first, targets WCAG 2.1 AA and uses the Government of India's UX4G Design System 3.0. UX4G provides the components and visual language, while a small number of application-specific patterns handle financial and employment information that the design system does not cover directly.

## Built as a working product

This repository contains a React and TypeScript application built with Vite. It has no production backend and makes no real government API calls. The domain layer under `src/domain/` owns the fictional account, typed record states, request transitions, validation, reports and financial calculations; the React pages consume that domain logic rather than hard-coding separate display totals.

Financial reconciliation is tested using the following relationship for each Member ID:

```text
closing balance = opening balance
                + employee EPF contributions
                + employer EPF contributions
                + official interest credits
                + completed transfers in
                - completed transfers out
                - completed withdrawals
```

EPS is deliberately excluded from the EPF balance.

## Run locally

Install the dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Use the fictional credentials displayed on the sign-in page:

- Mobile number: `9876543210`
- OTP: `123456`

The same OTP is used anywhere the prototype asks for verification.

## Verify the project

```bash
npm test
npm run lint
npm run build
npm run dev
```

The test suite covers financial reconciliation, the separation of EPF and EPS, transfers, withdrawals, report generation, validation, persistence and the main end-to-end product surfaces.

## Project references

- [`PRODUCT_BRIEF.md`](./PRODUCT_BRIEF.md) defines the product thesis, information model and non-negotiable member protections.
- [`DESIGN.md`](./DESIGN.md) documents the UX4G contract, approved theme and application-owned interface patterns.
- [`AGENTS.md`](./AGENTS.md) contains the implementation guardrails for contributors and coding agents.
