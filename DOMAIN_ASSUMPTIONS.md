# EPFO Neo v0.2 Domain Assumptions

All member, employment, financial, KYC and request data in this repository is fictional. The prototype does not connect to EPFO, Aadhaar, a bank, an employer or an email provider.

## Financial treatment

- EPF and EPS are modelled separately. EPS contributions are never added to the displayed EPF cash balance.
- The synthetic employer contribution is split between employer EPF and EPS. EPFO states that EPS contributions are diverted from the employer share, subject to scheme conditions and the applicable wage ceiling: https://www.epfindia.gov.in/site_en/FAQ.php
- A completed transfer reduces one Member ID and increases another by the same amount. A pending or submitted transfer does not move money and therefore does not change the headline balance.
- Official interest credits are included in the reconciled EPF balance only when represented as dated ledger credits. Estimated interest is labelled as an estimate and excluded from the official balance.
- Withdrawals reduce the Member ID balance only after they are represented as completed ledger records.
- The official EPFO schemes and current downloads are available from: https://www.epfindia.gov.in/site_en/Downloads.php

## Service treatment

- Claim readiness and amounts shown in this prototype apply only to the fictional scenario. Actual eligibility depends on claim type, member circumstances and the rules in force when a member applies.
- The prototype uses plain-language claim intents and never states that a member can withdraw the entire balance at any time. EPFO describes partial withdrawals as available for specified purposes: https://www.epfindia.gov.in/site_en/index.php?q=member+of+home
- KYC, OTP, employer verification, EPFO processing, bank delivery and email delivery are mocked account states, not external outcomes.
- Missing or late records do not establish employer fault. The interface only describes what is or is not currently represented in the synthetic ledger.

## Dates and record states

- `Wage Month` is the month the contribution relates to.
- `Recorded On` is the date the synthetic ledger received the record. These values are stored independently and must never be substituted for one another.
- Missing, zero, pending, unavailable, transferred and not-applicable are distinct states. A null amount means unavailable or not recorded; it is not silently converted to a citizen-facing zero.
