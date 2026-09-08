# Align And Clarify The Passbook Desktop View

Written against: dac4da9

## Evidence chain

- Surface: `/passbook?view=employers` and `/passbook?view=transactions`
- Problem: The Passbook rail is wider than Home's rail, recent-contribution cards waste horizontal space, employer cards mislabel Member IDs, and pagination uses text inside icon-sized controls.
- Design evidence: User-supplied rendered screenshots; `DESIGN.md` approved application theme and Passbook exceptions; `src/pages/financial-pages.css` Home and Passbook grid owners; UX4G pagination and Tag definitions in `ux4g-web-components@1.0.0`.
- Owner: `src/pages/PassbookPage.tsx` and `src/pages/financial-pages.css`
- Scope and affected surfaces: Passbook Employers and Transactions views at desktop and responsive widths.
- Uncertainty: None for the selected interface corrections. Contribution and VPF financial modelling is excluded pending a separate product decision.

## Design decision

Use Home's existing 18–22rem desktop rail rule for Passbook, compact the recent-contribution type scale, label account identifiers as Member IDs, and rebuild the transaction footer with the UX4G page-navigation and page-number class composition. Assign one semantic filled Tag tone per transaction type without changing transaction meaning.

## Reuse

- Approved EPFO-inspired UX4G tokens and small filled Tag variants.
- UX4G `ux4g-page-nav` and `ux4g-page-number` pagination controls.
- Exemplar: Home desktop rail in `src/pages/financial-pages.css`.

## Changes

1. `src/pages/PassbookPage.tsx`
   - Change: Label single account identifiers as Member ID and use DD/MM/YYYY dates in desktop employer selectors.
   - Preserve: Long-form mobile dates, account values and financial calculations.
   - Verify: Desktop cards show Member ID and numeric dates; mobile retains readable long dates.
2. `src/pages/PassbookPage.tsx`
   - Change: Apply distinct semantic UX4G Tag variants by transaction type and group the result summary with pagination.
   - Preserve: Filtering, page state, transaction order and keyboard-operable buttons.
   - Verify: Each type is visually distinct and the footer remains compact without clipping.
3. `src/pages/financial-pages.css`
   - Change: Match Home's rail width, left-align employer names, reduce contribution-value type size, and make the transaction footer responsive.
   - Preserve: Existing theme, table horizontal scrolling and narrow-layout stacking.
   - Verify: No page-level horizontal overflow; the table alone scrolls when needed.

## Scope

- Inherit: Passbook Employers and Transactions views.
- Verify: Recent Contributions rail, table pagination, keyboard focus and narrow widths.
- Exclude: Contribution amounts, VPF modelling and other product surfaces.

## Validation

- Product: Employer and transaction records remain unchanged.
- Interface: Inspect Employers and Transactions on desktop and narrow mobile; include ten-page pagination and every transaction type.
- System: Confirm reuse of the approved theme and UX4G Tag/Pagination patterns.
- Repository: `npm test -- --run`, `npm run lint`, `npm run build`, `git diff --check` -> all pass.

## Stop conditions

- Stop if a requested financial change requires assuming VPF participation, contribution policy or historical amounts.

## Design documentation

- After acceptance and validation: no design-contract update is required; these changes align existing documented patterns.
