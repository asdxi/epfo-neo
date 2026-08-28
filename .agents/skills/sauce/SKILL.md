---
name: sauce
description: "Run a fixed four-step UI enhancement workflow on an existing product page: read-only audit, ranked implementation of every supported finding, visual regression verification, then approval-gated copy refinement. Use invocation context to focus the work without changing the sequence or scope."
---

# Sauce

Apply the following four steps in order to the page or surface named by the user. The sequence is fixed. Treat any context supplied with the invocation as additional guidance for the target, constraints, or emphasis; it must not replace, skip, reorder, or weaken a step.

Before beginning, read the repository instructions, `DESIGN.md`, and the target page's implementation and route. Preserve current product behavior and use the repository's established components, tokens, and responsive conventions as the source of truth.

## Step 1: Audit with `improve-ui`

Load and follow the `improve-ui` skill. Audit the primary user surface and its actual rendered path. Inspect:

- shared components and design-system usage;
- responsive behavior at representative mobile and desktop widths;
- typography, spacing, and hierarchy;
- interaction states and the working task flow.

This step is strictly read-only for product source code. Produce no more than three evidence-backed findings. Rank findings by user impact and identify finding #1 unambiguously. Keep the audit tight; do not create speculative work merely to fill the three-finding allowance.

If there is no valid finding, report that outcome and stop. Do not manufacture an implementation task for Step 2.

## Step 2: Implement every finding in ranked order

Implement every supported finding from Step 1, starting with finding #1 and continuing in ranked order. Complete and verify one finding before moving to the next so higher-impact work governs later refinements. Do not redesign unrelated surfaces or add work that did not survive the audit proof gate.

For each finding, use whichever of these skills best fits its correction:

- `baseline-ui` for spacing, hierarchy, typography, and straightforward layout cleanup;
- `better-ui` for interaction details, component polish, optical alignment, or more nuanced visual behavior.

If the user specified one of those two skills in the invocation, use their choice. Otherwise, one audit may use either or both skills when different findings require different kinds of work. Load each selected skill before its first use and state why it fits.

Reuse existing components, design tokens, and responsive patterns wherever possible. Preserve current product behavior. After implementation, run the relevant focused checks and inspect the rendered result at mobile and desktop widths.

Treat the governing design system as a foundation, not an absolute ceiling. If it has no suitable component for the verified member task, use careful judgment to create a tasteful application-owned component that preserves the existing visual language and component hierarchy. Add one only when necessary, reuse the system's tokens and interaction conventions, and document its rationale, anatomy, responsive behavior, states, and accessibility contract in `DESIGN.md`. Never use this exception to bypass an adequate existing component or introduce inconsistency.

## Step 3: Visually verify the change

Verify the complete ranked set of implemented findings in the rendered product at desktop and mobile widths. Check:

- empty, loading, and populated states;
- hover, focus, pressed, and disabled states;
- text wrapping and overflow;
- spacing and alignment consistency;
- layout shifts introduced by the change.

Fix only issues caused by the Step 2 changes. Do not use verification as permission to expand the design scope. Re-run the relevant checks after any fix.

## Step 4: Propose copy refinements with `impeccable`

Load and follow the `impeccable` skill for copy refinement. Review every user-visible text element on the target page for concision, readability, repetition, and whether removal would improve comprehension.

Before changing any copy, list each proposed modification with:

- the current text;
- the proposed replacement or removal;
- a brief reason.

Then stop and ask the user which modifications to approve. Do not change copy in the same turn as the proposal list. On a later turn, implement only the modifications the user explicitly approves, preserve factual meaning, and run the relevant checks.

## Completion boundaries

- The workflow may span multiple turns because Step 4 requires explicit user approval.
- Do not commit, push, or modify unrelated files unless the user separately requests it.
- Report the audit findings, each implemented finding in ranked order, visual verification results, and the pending or approved copy changes distinctly.
